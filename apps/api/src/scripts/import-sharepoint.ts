import { config } from "dotenv";
import { resolve, join, relative, extname, basename, dirname } from "node:path";
import { existsSync, readdirSync, statSync, createReadStream, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { and, eq, ilike } from "drizzle-orm";
import { PutObjectCommand } from "@aws-sdk/client-s3";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { db } = await import("../db/client.js");
const { createTenantDb, closePool } = await import("../db/client.js");
const { organizations, tenants, users } = await import("../db/schema/public.js");
const { getStorageClient, getBucketName, buildStorageKey } = await import("../storage/client.js");
const { nextOrderNumber } = await import("@construction/shared");
const { generateNameSlug, generateSlug, generateUniqueProjectSlug } = await import("../utils/slug.js");

/**
 * One-time import of SharePoint jobs into a company.
 *
 *   npx tsx src/scripts/import-sharepoint.ts --plan /mig/plan.json --library /sp --company "Thomson Enterprises" [--apply]
 *
 * Without --apply nothing is written: it prints what would happen and writes a report.
 * Safe to run again: projects are matched by job number and files already in a project (same folder and name) are skipped,
 * so a second run adds files for folders that were missing the first time.
 */
function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const APPLY = process.argv.includes("--apply");
const PLAN = arg("plan", "/mig/plan.json")!;
const LIBRARY = arg("library", "/sp")!;
const COMPANY = arg("company", "Thomson Enterprises")!;
const USER_EMAIL = arg("user", "ethomson@thomsonenterprises.com")!;
const REPORT = arg("report", join(dirname(PLAN), "import-report.json"))!;
const BATCH = randomUUID();

interface Flag { code: string; text: string }
interface PlanInvoice { number: string; name: string; amount: number; date: string | null; paid?: number; unbilled?: boolean }
interface PlanJob {
  customerFolder: string; jobNumber: string; name: string; phase: string; spStatus: string | null; sourceDir: string | null;
  address: { street1: string; city: string; state: string; zip: string } | null; flags: Flag[];
  contract: number | null; invoices: PlanInvoice[]; assumedChangeOrder: number | null;
  cost?: { proposal: number; co: number | null; breakdown: Record<string, number>; source: string | null; notes: string };
}
interface Attachment { customerFolder: string; sourceDir: string; attachToJob: string; subfolder: string }
const plan = JSON.parse(readFileSync(PLAN, "utf8")) as { jobs: PlanJob[]; attachments: Attachment[] };

const r2 = (n: number) => Math.round(n * 100) / 100;
const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const JUNK = /^(~\$|\.ds_store$|thumbs\.db$|desktop\.ini$|\.tmp$)/i;
const MIME: Record<string, string> = {
  ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".heic": "image/heic", ".gif": "image/gif",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12", ".xls": "application/vnd.ms-excel",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".doc": "application/msword", ".csv": "text/csv", ".txt": "text/plain",
  ".zip": "application/zip", ".mov": "video/quicktime", ".mp4": "video/mp4", ".dwg": "application/acad", ".msg": "application/vnd.ms-outlook",
};
const mimeOf = (f: string) => MIME[extname(f).toLowerCase()] ?? "application/octet-stream";

interface FileEntry { abs: string; rel: string; size: number }
function walk(dir: string, base = dir, out: FileEntry[] = []): FileEntry[] {
  for (const name of readdirSync(dir)) {
    if (JUNK.test(name)) continue;
    const abs = join(dir, name);
    let st; try { st = statSync(abs); } catch { continue; }
    if (st.isDirectory()) walk(abs, base, out);
    else if (st.isFile()) out.push({ abs, rel: relative(base, abs).split("\\").join("/"), size: st.size });
  }
  return out;
}

const dupNumbers = plan.jobs.map((j) => j.jobNumber).filter((n, i, a) => a.indexOf(n) !== i);
if (dupNumbers.length) { console.error(`The plan reuses job numbers: ${[...new Set(dupNumbers)].join(", ")}. Fix the plan first.`); process.exit(1); }

// ---------- company, user, customers ----------
const [org] = await db.select().from(organizations).where(ilike(organizations.name, COMPANY)).limit(1);
if (!org?.tenantId) { console.error(`Company "${COMPANY}" not found.`); process.exit(1); }
const [tenant] = await db.select().from(tenants).where(eq(tenants.id, org.tenantId)).limit(1);
const [user] = await db.select().from(users).where(ilike(users.email, USER_EMAIL)).limit(1);
if (!tenant || !user) { console.error(`Could not find the company's tenant or the user ${USER_EMAIL}.`); process.exit(1); }
const t = createTenantDb(tenant.schemaName);
const tdb = t.db;
const userId = user.id;
console.log(`${APPLY ? "APPLYING" : "DRY RUN"} for ${org.name} as ${user.email}. Batch ${BATCH}`);

const customerRows = await tdb.select().from(t.customers);
const customerKey = new Map<string, string>();
for (const c of customerRows) {
  if (c.companyName) customerKey.set(norm(c.companyName), c.id);
  customerKey.set(norm(c.contactName), customerKey.get(norm(c.contactName)) ?? c.id);
}
const existingProjects = await tdb.select({ id: t.projects.id, jobNumber: t.projects.jobNumber, metadata: t.projects.metadata }).from(t.projects);
/** Projects an earlier run of this script created: only these are topped up with a contract or costs. */
const importedIds = new Set(existingProjects.filter((p) => (p.metadata as { import?: { source?: string } } | null)?.import?.source === "sharepoint").map((p) => p.id));
const projectByJob = new Map(existingProjects.filter((p) => p.jobNumber).map((p) => [p.jobNumber as string, p.id]));
const takenCustomerSlugs = new Set(customerRows.map((c) => c.slug).filter(Boolean) as string[]);

async function customerFor(name: string): Promise<{ id: string | null; created: boolean }> {
  const hit = customerKey.get(norm(name));
  if (hit) return { id: hit, created: false };
  if (!APPLY) return { id: null, created: true };
  const base = generateNameSlug(name) || "customer";
  let slug = base;
  for (let n = 2; takenCustomerSlugs.has(slug); n++) slug = `${base}-${n}`;
  takenCustomerSlugs.add(slug);
  const [c] = await tdb.insert(t.customers).values({ companyName: name, contactName: name, slug, createdBy: userId, importBatchId: BATCH, importSource: "SharePoint project import" }).returning();
  customerKey.set(norm(name), c.id);
  return { id: c.id, created: true };
}

// ---------- files ----------
const folderCache = new Map<string, string>(); // projectId|path -> folder id
async function ensureFolder(projectId: string, path: string): Promise<string> {
  const key = `${projectId}|${path}`;
  const cached = folderCache.get(key);
  if (cached) return cached;
  const parts = path.split("/");
  const parentPath = parts.slice(0, -1).join("/");
  const parentId = parentPath ? await ensureFolder(projectId, parentPath) : null;
  const all = await tdb.select().from(t.folders).where(eq(t.folders.projectId, projectId));
  const hit = all.find((f) => f.name === parts[parts.length - 1] && (f.parentId ?? null) === parentId);
  if (hit) { folderCache.set(key, hit.id); return hit.id; }
  const [f] = await tdb.insert(t.folders).values({ projectId, parentId, name: parts[parts.length - 1], createdBy: userId }).returning();
  folderCache.set(key, f.id);
  return f.id;
}

async function uploadFiles(projectId: string, files: FileEntry[], prefix: string, log: { uploaded: number; skipped: number; failed: string[] }) {
  const have = await tdb.select({ name: t.documents.name, folderId: t.documents.folderId }).from(t.documents).where(eq(t.documents.projectId, projectId));
  for (const f of files) {
    const rel = prefix ? `${prefix}/${f.rel}` : f.rel;
    const folderPath = dirname(rel) === "." ? "" : dirname(rel);
    const fileName = basename(rel);
    try {
      const folderId = folderPath ? await ensureFolder(projectId, folderPath) : null;
      if (have.some((d) => d.name === fileName && (d.folderId ?? null) === folderId)) { log.skipped++; continue; }
      const key = buildStorageKey(tenant.id, projectId, fileName);
      const ct = mimeOf(fileName);
      await getStorageClient().send(new PutObjectCommand({ Bucket: getBucketName(), Key: key, Body: createReadStream(f.abs), ContentLength: f.size, ContentType: ct }));
      await tdb.transaction(async (tx) => {
        const [d] = await tx.insert(t.documents).values({ projectId, folderId, name: fileName, fileSize: f.size, contentType: ct, createdBy: userId }).returning();
        const [v] = await tx.insert(t.documentVersions).values({ documentId: d.id, versionNumber: 1, storageKey: key, fileSize: f.size, contentType: ct, uploadedBy: userId, changeNotes: "Imported from SharePoint" }).returning();
        await tx.update(t.documents).set({ currentVersionId: v.id }).where(eq(t.documents.id, d.id));
      });
      have.push({ name: fileName, folderId });
      log.uploaded++;
    } catch (e) {
      log.failed.push(`${rel}: ${(e as Error).message}`);
    }
  }
}


const CONTRACT_PHASES = ["active", "on_hold", "closed"];

/** The contract (and any assumed change orders) with its invoicing schedule, invoices and payments. */
async function createContract(tx: any, p: { id: string }, job: PlanJob) {
  const contract = job.contract!;
  // Split the invoices between the contract and any assumed change orders: the contract takes the first dollars billed.
  type Spec = { number: string; name: string; amount: number; paid: number; unbilled: boolean; date: string | null };
  const baseInv: Spec[] = [], coInv: Spec[] = [];
  let cap = contract;
  for (const inv of job.invoices) {
    const paid = r2(inv.paid ?? 0);
    const unbilled = !!inv.unbilled;
    const baseAmt = r2(Math.min(inv.amount, Math.max(0, cap)));
    const coAmt = r2(inv.amount - baseAmt);
    cap = r2(cap - baseAmt);
    const basePaid = Math.min(paid, baseAmt);
    if (baseAmt > 0) baseInv.push({ number: inv.number, name: inv.name, amount: baseAmt, paid: r2(basePaid), unbilled, date: inv.date });
    if (coAmt > 0) coInv.push({ number: baseAmt > 0 ? `${inv.number}-CO` : inv.number, name: "Assumed change orders (imported)", amount: coAmt, paid: r2(paid - basePaid), unbilled, date: inv.date });
  }
  const coTotal = r2(coInv.reduce((n, i) => n + i.amount, 0));

  const makeEstimate = async (opts: { name: string; kind: "proposal" | "change_order"; total: number; invs: Spec[]; slugKey: string; number?: string; baseId?: string }) => {
    const [est] = await tx.insert(t.estimates).values({
      projectId: p.id, name: opts.name, status: "accepted", projectType: "commercial",
      directCosts: String(opts.total), totalCost: String(opts.total), isActive: opts.kind === "proposal", kind: opts.kind,
      number: opts.number ?? null, baseEstimateId: opts.baseId ?? null,
      acceptedAt: new Date(), submittedAt: new Date(), createdBy: userId,
      slug: generateSlug(opts.slugKey, opts.kind === "proposal" ? "contract imported" : "assumed change orders"),
    }).returning();
    await tx.insert(t.proposalCostLines).values({ estimateId: est.id, type: "other", name: opts.kind === "proposal" ? "Contract amount (imported)" : "Assumed change orders (imported)", quantity: "1", unit: "ea", unitCost: String(opts.total), marginPercent: "0", sortOrder: 0 });
    // The invoicing schedule: one milestone per invoice, percentages totalling exactly 100.
    let used = 0;
    let order = 0;
    for (const [i, inv] of opts.invs.entries()) {
      const pct = i === opts.invs.length - 1 ? r2(100 - used) : r2((inv.amount / opts.total) * 100);
      used = r2(used + pct);
      const [m] = await tx.insert(t.invoiceMilestones).values({ estimateId: est.id, name: inv.name, percent: String(pct), sortOrder: order }).returning();
      const status = inv.unbilled ? "draft" : inv.paid >= inv.amount - 0.005 ? "paid" : inv.paid > 0 ? "partially_paid" : "sent";
      const [row] = await tx.insert(t.invoices).values({
        projectId: p.id, estimateId: est.id, milestoneId: m.id, number: inv.number, milestoneName: inv.name,
        percent: String(pct), amount: String(inv.amount), status,
        sentOn: inv.unbilled ? null : inv.date ? new Date(inv.date).toISOString().slice(0, 10) : null,
        sortOrder: order++, createdBy: userId, notes: "Imported from SharePoint",
      }).returning();
      if (inv.paid > 0) await tx.insert(t.invoicePayments).values({ invoiceId: row.id, amount: String(inv.paid), receivedAt: today, reference: "Imported from SharePoint", createdBy: userId });
    }
    return est;
  };

  const base = await makeEstimate({ name: "Contract (imported from SharePoint)", kind: "proposal", total: contract, invs: baseInv.length ? baseInv : [{ number: `INV${job.jobNumber}-1`, name: "Contract (imported)", amount: contract, paid: 0, unbilled: true, date: null }], slugKey: `est-${job.jobNumber}` });
  if (coTotal > 0) await makeEstimate({ name: "Assumed change orders (imported, verify)", kind: "change_order", total: coTotal, invs: coInv, slugKey: `co-${job.jobNumber}`, number: `CO${job.jobNumber}-01`, baseId: base.id });
}

/** True when the project already has a contract or proposal of any kind. */
async function hasEstimates(projectId: string): Promise<boolean> {
  return (await tdb.select({ id: t.estimates.id }).from(t.estimates).where(eq(t.estimates.projectId, projectId)).limit(1)).length > 0;
}

const COST_PHASES = ["active", "closed"];
const COST_MARKER = "Imported from SharePoint cost sheet";

/**
 * Projected cost as draft orders (no vendor yet), which is where BidAxiom's Cost Budget and Projected figures come from.
 * Materials, equipment and extras go on a purchase order; subcontractors and labor on a work order; accepted change
 * order cost on a work order of its own with no budget (it was not on the proposal). Drafts are never sent anywhere.
 */
async function createCostOrders(tx: any, projectId: string, job: PlanJob) {
  const cost = job.cost!;
  const [est] = await tx.select({ id: t.estimates.id }).from(t.estimates).where(and(eq(t.estimates.projectId, projectId), eq(t.estimates.isActive, true))).limit(1);
  const b = cost.breakdown ?? {};
  const itemized = Object.keys(b).length > 0;
  const mat = "COGS: Materials & Supplies", eq_ = "COGS: Equipment Rental", sub = "COGS: Subcontract Labor";
  type L = { description: string; category: string; budget: number; projected: number };
  const po: L[] = [], wo: L[] = [], co: L[] = [];
  const add = (arr: L[], description: string, category: string, amount: number | undefined) => { if (amount && amount > 0) arr.push({ description, category, budget: amount, projected: amount }); };
  if (itemized) {
    add(po, "Materials (cost sheet)", mat, b.materials);
    add(po, "Equipment / rental (cost sheet)", eq_, b.equipment);
    add(po, "Extras (cost sheet)", mat, b.extras);
    add(wo, "Subcontractors (cost sheet)", sub, b.subs);
    add(wo, "Labor (cost sheet)", sub, b.labor);
  } else add(po, "Projected cost (cost sheet total)", mat, cost.proposal);
  if (cost.co && cost.co > 0) co.push({ description: "Accepted change order cost (cost sheet)", category: sub, budget: 0, projected: cost.co });
  const used = (await tx.select({ number: t.orders.number }).from(t.orders).where(eq(t.orders.projectId, projectId))).map((u: { number: string }) => u.number);
  for (const [kind, lines, label] of [["purchase", po, "materials"], ["work", wo, "subs and labor"], ["work", co, "accepted change orders"]] as const) {
    if (!lines.length) continue;
    const number = nextOrderNumber(used, kind === "purchase" ? "PO" : "WO", job.jobNumber);
    used.push(number);
    const [o] = await tx.insert(t.orders).values({ projectId, estimateId: est?.id ?? null, kind, number, vendorId: null, status: "draft", notes: `${COST_MARKER} (${label}). Assign vendors and adjust before issuing.`, createdBy: userId }).returning();
    await tx.insert(t.orderLines).values(lines.map((l, i) => ({ orderId: o.id, sourceLineId: null, description: l.description, category: l.category, budgetCost: String(r2(l.budget)), projectedCost: String(r2(l.projected)), sortOrder: i })));
  }
}

async function hasCostOrders(projectId: string): Promise<boolean> {
  const rows = await tdb.select({ notes: t.orders.notes }).from(t.orders).where(eq(t.orders.projectId, projectId));
  return rows.some((r) => (r.notes ?? "").startsWith(COST_MARKER));
}

// ---------- jobs ----------
const report: Array<Record<string, unknown>> = [];
const today = new Date().toISOString().slice(0, 10);

for (const job of plan.jobs) {
  const srcAbs = job.sourceDir ? join(LIBRARY, job.sourceDir) : null;
  const srcOk = !!srcAbs && existsSync(srcAbs);
  const files = srcOk ? walk(srcAbs!) : [];
  const attach = plan.attachments.filter((a) => a.attachToJob === job.jobNumber && existsSync(join(LIBRARY, a.sourceDir)));
  const flags = [...job.flags];
  if (job.sourceDir && !srcOk) flags.push({ code: "files_missing", text: "The SharePoint folder was not found when this job was imported, so no files were attached." });

  const entry: Record<string, unknown> = {
    job: job.jobNumber, name: job.name, customer: job.customerFolder, phase: job.phase,
    contract: job.contract, invoices: job.invoices.length, files: files.length + attach.reduce((n, a) => n + walk(join(LIBRARY, a.sourceDir)).length, 0),
    flags: flags.map((f) => f.code), folderFound: srcOk,
  };
  const cust = await customerFor(job.customerFolder);
  entry.customer_action = cust.id ? (cust.created ? "created" : "matched") : "will create";
  const existingId = projectByJob.get(job.jobNumber);
  const canTopUp = !!existingId && importedIds.has(existingId);
  const wantContract = !!job.contract && job.contract > 0 && CONTRACT_PHASES.includes(job.phase);
  const wantCost = !!job.cost && COST_PHASES.includes(job.phase);
  const needContract = wantContract && (!existingId || (canTopUp && !(await hasEstimates(existingId))));
  const needCost = wantCost && (!existingId || (canTopUp && !(await hasCostOrders(existingId))));
  entry.project_action = existingId ? (canTopUp ? "exists (top up)" : "exists (files only)") : "create";
  entry.adds_contract = needContract ? { contract: job.contract, invoiced: r2(job.invoices.reduce((n, i) => n + i.amount, 0)), paid: r2(job.invoices.reduce((n, i) => n + (i.paid ?? 0), 0)) } : null;
  entry.adds_cost_orders = needCost ? { budget: job.cost!.proposal, accepted_co_cost: job.cost!.co, itemized: Object.keys(job.cost!.breakdown ?? {}).length > 0 } : null;

  if (APPLY) {
    let projectId = existingId;
    if (!projectId) {
      projectId = await tdb.transaction(async (tx) => {
        const slug = await generateUniqueProjectSlug(job.jobNumber, job.name, tx, t as never);
        const [p] = await tx.insert(t.projects).values({
          name: job.name, jobNumber: job.jobNumber, slug, customerId: cust.id!, projectType: "commercial",
          lifecyclePhase: job.phase, status: "active",
          street1: job.address?.street1 ?? null, city: job.address?.city ?? null, state: job.address?.state ?? null, zip: job.address?.zip ?? null,
          createdBy: userId,
          metadata: {
            import: { source: "sharepoint", batchId: BATCH, importedAt: new Date().toISOString(), spStatus: job.spStatus },
            ...(flags.length ? { importReview: { items: flags, reviewedAt: null } } : {}),
          },
        }).returning();
        await tx.insert(t.projectLifecycleTransitions).values({
          projectId: p.id, fromPhase: "opportunity", toPhase: job.phase, triggeredBy: "system", actorId: "system",
          reason: "Imported from SharePoint", eventSource: "sharepoint_import",
        });

        if (job.contract && job.contract > 0 && CONTRACT_PHASES.includes(job.phase)) await createContract(tx, p, job);
        if (job.cost && COST_PHASES.includes(job.phase)) await createCostOrders(tx, p.id, job);
        return p.id;
      });
      projectByJob.set(job.jobNumber, projectId);
    } else if (canTopUp) {
      // The project exists from an earlier run: add the contract or cost orders it does not have yet.
      if (needContract) await tdb.transaction(async (tx) => { await createContract(tx, { id: projectId! }, job); });
      if (needCost) await tdb.transaction(async (tx) => { await createCostOrders(tx, projectId!, job); });
    }
    const log = { uploaded: 0, skipped: 0, failed: [] as string[] };
    if (srcOk) await uploadFiles(projectId, files, "", log);
    for (const a of attach) await uploadFiles(projectId, walk(join(LIBRARY, a.sourceDir)), a.subfolder, log);
    entry.uploaded = log.uploaded; entry.alreadyThere = log.skipped; entry.failed = log.failed;
    console.log(`${job.jobNumber} ${job.name}: ${log.uploaded} files${log.failed.length ? `, ${log.failed.length} FAILED` : ""}`);
  }
  report.push(entry);
}

writeFileSync(REPORT, JSON.stringify(report, null, 1));
const newCustomers = new Set(report.filter((r) => r.customer_action === "will create" || r.customer_action === "created").map((r) => r.customer));
console.log(`\n${report.length} jobs. New customers: ${newCustomers.size}. Jobs with no SharePoint folder found: ${report.filter((r) => !r.folderFound).length}. Report: ${REPORT}`);
if (!APPLY) console.log("Dry run only. Nothing was written. Run again with --apply to import.");
await closePool();
