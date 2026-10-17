import { formatCompanyDateTime } from "../../utils/company-time.js";
import { eq } from "drizzle-orm";
import { refreshQboToken } from "./oauth.js";
import { encryptToken } from "./crypto.js";
import { explainReceipt } from "./receipts.js";
import { isNull, desc } from "drizzle-orm";

/**
 * Read-only health check of a company's QuickBooks connection.
 * Only ever issues GET requests (company info, preferences, SELECT queries). The one write is to our own
 * database: if the access token has expired it is refreshed, and QuickBooks hands back a replacement refresh token
 * that has to be stored (the same thing the sync worker does).
 */

export interface DiagnoseItem {
  key: string;
  label: string;
  ok: boolean;
  value?: string;
  note?: string;
}

export interface DiagnoseResult {
  checkedAt: string;
  environment: string;
  tokenRefreshed: boolean;
  items: DiagnoseItem[];
  /** True when a saved project link points at something in QuickBooks that is missing or is not that project. */
  needsLinkReset?: boolean;
  /** Where it stopped, if it could not even reach QuickBooks. */
  fatal?: string;
}

const BASE: Record<string, string> = {
  production: "https://quickbooks.api.intuit.com",
  sandbox: "https://sandbox-quickbooks.api.intuit.com",
};

async function qboGet(base: string, realmId: string, token: string, path: string): Promise<any> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${base}/v3/company/${realmId}/${path}${sep}minorversion=75`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`QuickBooks answered ${res.status}${body ? `: ${body}` : ""}`);
  }
  return res.json();
}

const sel = (q: string) => `query?query=${encodeURIComponent(q)}`;

export async function diagnoseQboConnection(tenant: { db: any; schema: any }): Promise<DiagnoseResult> {
  const { db, schema } = tenant;
  const result: DiagnoseResult = { checkedAt: new Date().toISOString(), environment: "", tokenRefreshed: false, items: [] };
  const add = (i: DiagnoseItem) => result.items.push(i);

  const [conn] = await db.select().from(schema.qboConnections).where(eq(schema.qboConnections.status, "active")).limit(1);
  if (!conn) {
    result.fatal = "No active QuickBooks connection. Connect first.";
    return result;
  }
  result.environment = conn.environment ?? process.env.QBO_ENVIRONMENT ?? "sandbox";
  const base = BASE[result.environment] ?? BASE.sandbox;

  if (!process.env.QBO_CLIENT_ID || !process.env.QBO_CLIENT_SECRET) {
    result.fatal = "The server has no QuickBooks app keys (QBO_CLIENT_ID / QBO_CLIENT_SECRET), so it cannot talk to QuickBooks.";
    return result;
  }

  // Token: use the stored one, refresh when expired.
  let token: string | null = conn.accessToken;
  if (!token || new Date(conn.tokenExpiresAt) <= new Date()) {
    try {
      const t = await refreshQboToken(conn.encryptedRefreshToken);
      await db
        .update(schema.qboConnections)
        .set({
          accessToken: t.accessToken,
          encryptedRefreshToken: encryptToken(t.refreshToken),
          tokenExpiresAt: t.tokenExpiresAt,
          refreshTokenExpiresAt: t.refreshTokenExpiresAt,
          updatedAt: new Date(),
        })
        .where(eq(schema.qboConnections.id, conn.id));
      token = t.accessToken;
      result.tokenRefreshed = true;
    } catch (e) {
      result.fatal = `The saved connection can no longer be renewed (${e instanceof Error ? e.message : "unknown error"}). Disconnect and connect QuickBooks again.`;
      return result;
    }
  }
  add({ key: "token", label: "Sign-in to QuickBooks", ok: true, value: result.tokenRefreshed ? "Renewed" : "Valid" });

  const realm = conn.realmId as string;
  const run = async (key: string, label: string, fn: () => Promise<Omit<DiagnoseItem, "key" | "label" | "ok">>) => {
    try {
      add({ key, label, ok: true, ...(await fn()) });
    } catch (e) {
      add({ key, label, ok: false, note: e instanceof Error ? e.message : "Failed" });
    }
  };

  await run("company", "Company", async () => {
    const d = await qboGet(base, realm, token!, `companyinfo/${realm}`);
    const c = d.CompanyInfo ?? {};
    const nv: Array<{ Name: string; Value: string }> = c.NameValue ?? [];
    const pick = (n: string) => nv.find((x) => x.Name === n)?.Value;
    const plan = pick("OfferingSku");
    const status = pick("SubscriptionStatus");
    return {
      value: [c.CompanyName ?? c.LegalName, c.Country].filter(Boolean).join(" · "),
      note: [plan ? `Plan: ${plan}` : null, status ? `Subscription: ${status}` : null].filter(Boolean).join(" · ") || "QuickBooks did not report the plan.",
    };
  });

  await run("preferences", "Features", async () => {
    const d = await qboGet(base, realm, token!, "preferences");
    const p = d.Preferences ?? {};
    const nv: Array<{ Name: string; Value: string }> = p.OtherPrefs?.NameValue ?? [];
    const projectFlags = nv.filter((x) => /project/i.test(x.Name)).map((x) => `${x.Name}=${x.Value}`);
    const bits = [
      `Class tracking: ${p.AccountingInfoPrefs?.ClassTrackingPerTxn ? "on" : "off"}`,
      `Locations: ${p.AccountingInfoPrefs?.TrackDepartments ? "on" : "off"}`,
      projectFlags.length ? `Projects: ${projectFlags.join(", ")}` : "No Projects setting was reported",
    ];
    return { value: bits.join(" · ") };
  });

  const since = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const count = async (q: string) => {
    const d = await qboGet(base, realm, token!, sel(q));
    return Number(d.QueryResponse?.totalCount ?? 0);
  };

  await run("links", "Projects linked to QuickBooks", async () => {
    const maps = await db
      .select({ platformId: schema.qboEntityMappings.platformId, qboId: schema.qboEntityMappings.qboId, syncStatus: schema.qboEntityMappings.syncStatus })
      .from(schema.qboEntityMappings)
      .where(eq(schema.qboEntityMappings.entityType, "project"));
    if (maps.length === 0) return { value: "None yet" };
    const lines: string[] = [];
    for (const m of maps.slice(0, 10)) {
      const [proj] = await db.select({ name: schema.projects.name, jobNumber: schema.projects.jobNumber }).from(schema.projects).where(eq(schema.projects.id, m.platformId)).limit(1);
      const mine = proj ? [proj.jobNumber, proj.name].filter(Boolean).join(" - ") : "(project deleted)";
      try {
        const d = await qboGet(base, realm, token!, `customer/${m.qboId}`);
        const theirs: string = d.Customer?.DisplayName ?? "(no name)";
        const same = proj && theirs.trim().toLowerCase() === mine.trim().toLowerCase();
        if (!same) result.needsLinkReset = true;
        lines.push(`${mine} is linked to QuickBooks customer #${m.qboId} "${theirs}"${same ? "" : " (a different name: this link looks stale)"}`);
      } catch {
        result.needsLinkReset = true;
        lines.push(`${mine} is linked to QuickBooks customer #${m.qboId}, which does not exist in this QuickBooks company (stale link)`);
      }
    }
    return { value: `${maps.length}`, note: lines.join("\n") };
  });

  await run("customers", "Customers", async () => {
    const all = await count("select count(*) from Customer");
    const jobs = await count("select count(*) from Customer where Job = true");
    return { value: `${all} total, ${jobs} sub-customers (jobs)` };
  });

  // What the books actually contain: tells us where income and costs are recorded.
  const kinds: Array<[string, string, string]> = [
    ["deposits", "Deposits (last 12 months)", `select count(*) from Deposit where TxnDate >= '${since}'`],
    ["salesReceipts", "Sales receipts (last 12 months)", `select count(*) from SalesReceipt where TxnDate >= '${since}'`],
    ["payments", "Customer payments (last 12 months)", `select count(*) from Payment where TxnDate >= '${since}'`],
    ["invoices", "Invoices (last 12 months)", `select count(*) from Invoice where TxnDate >= '${since}'`],
    ["purchases", "Expenses and checks (last 12 months)", `select count(*) from Purchase where TxnDate >= '${since}'`],
    ["bills", "Vendor bills (last 12 months)", `select count(*) from Bill where TxnDate >= '${since}'`],
    ["purchaseOrders", "Purchase orders (last 12 months)", `select count(*) from PurchaseOrder where TxnDate >= '${since}'`],
  ];
  for (const [key, label, q] of kinds) await run(key, label, async () => ({ value: String(await count(q)) }));

  // What BidAxiom has read from QuickBooks as money received, and what it did with each.
  await run("receipts", "Deposits read by BidAxiom", async () => {
    const [prof] = await db
      .select({ on: schema.companyProfiles.qboReadPayments, last: schema.companyProfiles.qboReceiptsLastCheckAt })
      .from(schema.companyProfiles)
      .where(isNull(schema.companyProfiles.validTo))
      .limit(1);
    const rows = await db.select().from(schema.qboReceipts).orderBy(desc(schema.qboReceipts.txnDate)).limit(8);
    const head = prof?.on
      ? `Reading is on${prof.last ? `, last checked ${formatCompanyDateTime(prof.last)}` : ", but it has not run yet (press Check now on the Outstanding page)"}`
      : "Reading is OFF (turn on \"Read deposits and payments from QuickBooks\" in Automatic sync)";
    if (rows.length === 0) return { value: "None read yet", note: head };
    const lines: string[] = [];
    for (const r of rows) lines.push(`${r.txnDate}  $${Number(r.amount).toFixed(2)}  ${r.qboCustomerName ?? "(no customer)"}: ${await explainReceipt({ tenantId: "", db, schema }, r)}`);
    return { value: `${rows.length} most recent`, note: `${head}\n${lines.join("\n")}` };
  });

  return result;
}
