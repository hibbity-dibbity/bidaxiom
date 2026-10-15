import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import {
  AuditAction,
  PAYMENT_TERMS,
  DEFAULT_PAYMENT_TERMS,
  computeProposal,
  applyAcceptance,
  computeSchedule,
  milestonesTotal100,
  buildCustomerView,
  generateDraftOrders,
  formatDocNumber,
  type CostLineInput,
} from "@construction/shared";
import { createAuditLog } from "../../audit/logger.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { eq, asc, desc, and, isNull, inArray } from "drizzle-orm";
import { generateSlug } from "../../utils/slug.js";
import { ForbiddenError } from "@casl/ability";
import { ensureCurrentTerms, readTermsVersion } from "./terms.js";
import { createInvoiceDrafts } from "../../services/invoiceDrafts.js";

const costLineTypeEnum = z.enum(["labor", "material", "subcontractor", "equipment", "other"]);
const visibilityEnum = z.enum(["price", "name_only", "hidden"]);

const costLineInputSchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  type: costLineTypeEnum,
  name: z.string().min(1).max(300),
  costCodeId: z.number().int().nullable().optional(),
  quantity: z.number().min(0).max(1e9),
  unit: z.string().min(1).max(20),
  /** negative only on change orders (a credit / deductive line) */
  unitCost: z.number().min(-1e9).max(1e9),
  /** percent of price, 0 up to but not including 100 */
  marginPercent: z.number().min(0).lt(100),
  /** padding on cost, percent of cost */
  contingencyPercent: z.number().min(0).max(1000).default(0),
  /** internal notes, never shown to customers */
  notes: z.string().max(5000).nullable().optional(),
  visibility: visibilityEnum.default("price"),
  isOptional: z.boolean().default(false),
  vendorId: z.string().uuid().nullable().optional(),
});

const saveContentSchema = z.object({
  estimateId: z.string().uuid(),
  lines: z.array(costLineInputSchema).max(2000),
  globals: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(200),
        amount: z.number().min(0).max(1e9),
      })
    )
    .max(100),
  milestones: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(200),
        percent: z.number().min(0).max(100),
      })
    )
    .max(50),
});

/** Sent, accepted and under-contract proposals cannot be edited. Changes after sending go through a revision. */
const LOCKED_STATUSES = ["submitted", "accepted", "under_contract"];

function lockedMessage(status: string): string {
  return status === "submitted"
    ? "This proposal has been sent to the customer and is locked. Create a revision to make changes."
    : "This proposal is accepted and locked. Use a change order for scope changes.";
}

/** Structural rules the database cannot express: two levels, optional items stand alone. */
type Tenant = NonNullable<
  Awaited<ReturnType<typeof import("../../tenant/context.js").buildTenantContext>>
>;

/** Load a proposal's rows and run the shared calculation. Used by customer view and send. */
export async function loadComputed(tenant: Tenant, estimateId: string) {
  const { db, schema } = tenant;
  const [estimate] = await db.select().from(schema.estimates).where(eq(schema.estimates.id, estimateId)).limit(1);
  if (!estimate) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found" });
  const lineRows = await db
    .select()
    .from(schema.proposalCostLines)
    .where(eq(schema.proposalCostLines.estimateId, estimateId))
    .orderBy(asc(schema.proposalCostLines.sortOrder));
  const globalRows = await db
    .select()
    .from(schema.proposalGlobalCosts)
    .where(eq(schema.proposalGlobalCosts.estimateId, estimateId))
    .orderBy(asc(schema.proposalGlobalCosts.sortOrder));
  const milestoneRows = await db
    .select()
    .from(schema.invoiceMilestones)
    .where(eq(schema.invoiceMilestones.estimateId, estimateId))
    .orderBy(asc(schema.invoiceMilestones.sortOrder));
  const lines = lineRows.map((l) => ({
    id: l.id,
    parentId: l.parentId,
    name: l.name,
    type: l.type as CostLineInput["type"],
    costCodeId: l.costCodeId,
    vendorId: l.vendorId,
    quantity: Number(l.quantity),
    unitCost: Number(l.unitCost),
    marginPercent: Number(l.marginPercent),
    contingencyPercent: Number(l.contingencyPercent),
    visibility: l.visibility as "price" | "name_only" | "hidden",
    isOptional: l.isOptional,
    optionAccepted: l.optionAccepted,
  }));
  const milestones = milestoneRows.map((m) => ({ id: m.id, name: m.name, percent: Number(m.percent) }));
  const result = computeProposal({
    lines,
    globals: globalRows.map((g) => ({ id: g.id, amount: Number(g.amount) })),
    taxRatePercent: Number(estimate.salesTaxPercent),
  });
  return { estimate, lines, milestones, result };
}

/** Make a unique estimate slug: base, then base-2, base-3... */
async function uniqueSlug(tenant: Tenant, base: string): Promise<string> {
  const { db, schema } = tenant;
  for (let n = 1; n < 200; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const [hit] = await db
      .select({ id: schema.estimates.id })
      .from(schema.estimates)
      .where(eq(schema.estimates.slug, candidate))
      .limit(1);
    if (!hit) return candidate;
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create a unique link for the copy" });
}

/** Accepted contract value in cents for one proposal or change order (base plus accepted options). */
async function acceptedValueCents(tenant: Tenant, estimateId: string) {
  const c = await loadComputed(tenant, estimateId);
  const acceptedIds = c.lines.filter((l) => l.isOptional && l.optionAccepted === true).map((l) => l.id);
  const a = applyAcceptance(c.result, acceptedIds);
  const acceptedOptions = c.result.options.filter((o) => acceptedIds.includes(o.id));
  return {
    c,
    contractValue: a.contractValue,
    cost: a.costBudget,
    contingency: a.contingencyBudget,
    profit: c.result.totals.basePrice - c.result.totals.baseCost + acceptedOptions.reduce((x, o) => x + o.profit, 0),
  };
}

/** Accepted change orders of a project, each with its accepted value. */
async function acceptedChangeOrders(tenant: Tenant, projectId: string) {
  const { db, schema } = tenant;
  const rows = await db
    .select()
    .from(schema.estimates)
    .where(and(eq(schema.estimates.projectId, projectId), eq(schema.estimates.kind, "change_order"), inArray(schema.estimates.status, ["accepted", "under_contract"])))
    .orderBy(asc(schema.estimates.createdAt));
  const out = [];
  for (const r of rows) {
    const v = await acceptedValueCents(tenant, r.id);
    out.push({ row: r, ...v });
  }
  return out;
}

/** Make one proposal the project's only active one. */
async function activate(tenant: Tenant, projectId: string, estimateId: string) {
  const { db, schema } = tenant;
  await db.transaction(async (tx) => {
    await tx.update(schema.estimates).set({ isActive: false }).where(eq(schema.estimates.projectId, projectId));
    await tx.update(schema.estimates).set({ isActive: true }).where(eq(schema.estimates.id, estimateId));
  });
}

/**
 * Copy a proposal's settings, lines, global costs and invoicing schedule into a new draft.
 * Used for "copy a previous proposal" and for revisions. Terms are not copied: the copy pins
 * the terms version current at the time it is sent.
 */
async function cloneProposal(
  tenant: Tenant,
  userId: string,
  sourceId: string,
  opts: {
    name: string;
    slugSuffix?: string;
    revision: number;
    revisionOfId: string | null;
    /** change orders: kind, number and the proposal they change carry over to the copy */
    extra?: { kind: string; number: string | null; baseEstimateId: string | null };
  }
) {
  const { db, schema } = tenant;
  const [src] = await db.select().from(schema.estimates).where(eq(schema.estimates.id, sourceId)).limit(1);
  if (!src) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found" });
  const [project] = await db
    .select({ jobNumber: schema.projects.jobNumber })
    .from(schema.projects)
    .where(eq(schema.projects.id, src.projectId))
    .limit(1);
  const lineRows = await db.select().from(schema.proposalCostLines).where(eq(schema.proposalCostLines.estimateId, sourceId)).orderBy(asc(schema.proposalCostLines.sortOrder));
  const globalRows = await db.select().from(schema.proposalGlobalCosts).where(eq(schema.proposalGlobalCosts.estimateId, sourceId)).orderBy(asc(schema.proposalGlobalCosts.sortOrder));
  const milestoneRows = await db.select().from(schema.invoiceMilestones).where(eq(schema.invoiceMilestones.estimateId, sourceId)).orderBy(asc(schema.invoiceMilestones.sortOrder));

  const identifier = project?.jobNumber ? `est-${project.jobNumber}` : `est-${src.projectId.slice(0, 8)}`;
  const base = generateSlug(identifier, opts.name) + (opts.slugSuffix ?? "");
  const slug = await uniqueSlug(tenant, base);

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.estimates)
      .values({
        projectId: src.projectId,
        name: opts.name,
        description: src.description,
        status: "draft",
        projectType: src.projectType,
        currentVersion: 1,
        salesTaxPercent: src.salesTaxPercent,
        paymentTerms: src.paymentTerms,
        validDays: src.validDays,
        totalCost: src.totalCost,
        revision: opts.revision,
        revisionOfId: opts.revisionOfId,
        kind: opts.extra?.kind ?? "proposal",
        number: opts.extra?.number ?? null,
        baseEstimateId: opts.extra?.baseEstimateId ?? null,
        slug,
        createdBy: userId,
      })
      .returning({ id: schema.estimates.id, slug: schema.estimates.slug });

    const idMap = new Map(lineRows.map((l) => [l.id, crypto.randomUUID()]));
    if (lineRows.length > 0) {
      await tx.insert(schema.proposalCostLines).values(
        lineRows.map((l) => ({
          id: idMap.get(l.id)!,
          estimateId: created.id,
          parentId: l.parentId ? (idMap.get(l.parentId) ?? null) : null,
          type: l.type,
          name: l.name,
          costCodeId: l.costCodeId,
          quantity: l.quantity,
          unit: l.unit,
          unitCost: l.unitCost,
          marginPercent: l.marginPercent,
          contingencyPercent: l.contingencyPercent,
          notes: l.notes,
          visibility: l.visibility,
          isOptional: l.isOptional,
          optionAccepted: null,
          vendorId: l.vendorId,
          sortOrder: l.sortOrder,
        }))
      );
    }
    const linkRows = await tx.select().from(schema.proposalTakeoffLinks).where(eq(schema.proposalTakeoffLinks.estimateId, src.id));
    if (linkRows.length > 0) {
      await tx.insert(schema.proposalTakeoffLinks).values(
        linkRows.filter((k) => idMap.has(k.lineId)).map((k) => ({ estimateId: created.id, lineId: idMap.get(k.lineId)!, takeoffId: k.takeoffId, mode: k.mode, snapshot: k.snapshot }))
      );
    }
    if (globalRows.length > 0) {
      await tx.insert(schema.proposalGlobalCosts).values(
        globalRows.map((g) => ({ estimateId: created.id, name: g.name, amount: g.amount, sortOrder: g.sortOrder }))
      );
    }
    if (milestoneRows.length > 0) {
      await tx.insert(schema.invoiceMilestones).values(
        milestoneRows.map((m) => ({ estimateId: created.id, name: m.name, percent: m.percent, sortOrder: m.sortOrder }))
      );
    }
    return { id: created.id, slug: created.slug as string, source: src };
  });
}

/** Why a proposal cannot be sent yet, or null when it can. */
function sendBlocker(c: Awaited<ReturnType<typeof loadComputed>>): string | null {
  if (c.estimate.status === "submitted") return "This proposal has already been sent. Create a revision to change and resend it.";
  if (LOCKED_STATUSES.includes(c.estimate.status)) return "This proposal is already accepted.";
  const baseParents = c.lines.filter((l) => !l.parentId && !l.isOptional);
  const isCo = c.estimate.kind === "change_order";
  if (baseParents.length === 0 || (isCo ? c.result.totals.total === 0 : c.result.totals.total <= 0)) return "Add at least one priced line before sending.";
  if (!isCo && c.lines.some((l) => Number(l.unitCost) < 0)) return "Only a change order can have a negative unit cost.";
  if (c.lines.some((l) => !l.name.trim())) return "Every line needs a name.";
  if (c.milestones.length === 0) return "Add an invoicing schedule.";
  if (c.milestones.some((m) => !m.name.trim())) return "Every milestone needs a name.";
  if (!milestonesTotal100(c.milestones)) {
    const total = c.milestones.reduce((a, m) => a + m.percent, 0);
    return `The invoicing schedule totals ${Math.round(total * 100) / 100}%. It must total 100% before sending.`;
  }
  return null;
}

export function validateLineStructure(lines: Array<z.infer<typeof costLineInputSchema>>): string | null {
  const byId = new Map(lines.map((l) => [l.id, l]));
  if (byId.size !== lines.length) return "Duplicate line ids";
  const hasChildren = new Set<string>();
  for (const l of lines) {
    if (l.parentId) {
      const parent = byId.get(l.parentId);
      if (!parent) return `Line "${l.name}" points at a parent that is not in this proposal`;
      if (parent.parentId) return `Line "${l.name}" is nested more than two levels deep`;
      if (l.isOptional) return "Lines inside an optional item are not themselves optional";
      hasChildren.add(l.parentId);
    }
  }
  for (const l of lines) {
    if (l.isOptional && l.parentId) return "Optional items must be top-level";
  }
  return null;
}

async function loadAbilities(ctx: {
  tenant: NonNullable<
    Awaited<ReturnType<typeof import("../../tenant/context.js").buildTenantContext>>
  >;
  userId: string;
  orgRole: string | null;
}) {
  const memberships = await ctx.tenant.db
    .select({
      projectId: ctx.tenant.schema.projectTeamMembers.projectId,
      role: ctx.tenant.schema.projectTeamMembers.role,
    })
    .from(ctx.tenant.schema.projectTeamMembers)
    .where(eq(ctx.tenant.schema.projectTeamMembers.userId, ctx.userId));
  return defineAbilitiesFor(ctx.orgRole ?? "org:member", ctx.userId, memberships);
}

/**
 * Proposal builder router. A proposal is an estimate; this router reads and writes
 * its cost lines, global costs and invoicing schedule, and returns computed totals
 * from the shared calculation module.
 */
/** The customer-facing document data (shared by the signed-in preview and the public signing page). */
export async function buildCustomerViewData(tenant: Tenant, userId: string, estimateId: string) {
  const { db, schema } = tenant;
  const c = await loadComputed(tenant, estimateId);
  const view = buildCustomerView({ lines: c.lines, result: c.result, milestones: c.milestones });

  const [project] = await db
    .select({
      name: schema.projects.name,
      jobNumber: schema.projects.jobNumber,
      customerId: schema.projects.customerId,
      street1: schema.projects.street1,
      street2: schema.projects.street2,
      city: schema.projects.city,
      state: schema.projects.state,
      zip: schema.projects.zip,
    })
    .from(schema.projects)
    .where(eq(schema.projects.id, c.estimate.projectId))
    .limit(1);
  const [customer] = project
    ? await db
        .select({ companyName: schema.customers.companyName, contactName: schema.customers.contactName })
        .from(schema.customers)
        .where(eq(schema.customers.id, project.customerId))
        .limit(1)
    : [];

  const [profile] = await db
    .select({
      phone: schema.companyProfiles.phone,
      website: schema.companyProfiles.website,
      street1: schema.companyProfiles.street1,
      street2: schema.companyProfiles.street2,
      city: schema.companyProfiles.city,
      state: schema.companyProfiles.state,
      zip: schema.companyProfiles.zip,
    })
    .from(schema.companyProfiles)
    .where(isNull(schema.companyProfiles.validTo))
    .limit(1);
  const cityState = [profile?.city, [profile?.state, profile?.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const companyContact = [
    profile?.phone,
    profile?.website,
    [[profile?.street1, profile?.street2].filter(Boolean).join(" "), cityState].filter(Boolean).join(", "),
  ].filter((v): v is string => Boolean(v && v.trim()));

  const pinned = c.estimate.termsVersionId ? await readTermsVersion(tenant, c.estimate.termsVersionId) : null;
  const terms = pinned ?? (await ensureCurrentTerms(tenant, userId, c.estimate.kind === "change_order" ? "change_order" : "proposal"));

  const addressParts = project
    ? [project.street1, project.street2, [project.city, project.state].filter(Boolean).join(", "), project.zip].filter(Boolean)
    : [];
  // A change order shows what the contract was, what this changes, and what it becomes.
  let contract: { before: number; change: number; after: number } | null = null;
  if (c.estimate.kind === "change_order") {
    let before = 0;
    if (c.estimate.baseEstimateId) before += (await acceptedValueCents(tenant, c.estimate.baseEstimateId)).contractValue;
    for (const co of await acceptedChangeOrders(tenant, c.estimate.projectId)) {
      if (co.row.id !== c.estimate.id) before += co.contractValue;
    }
    const change = c.estimate.acceptedAt ? (await acceptedValueCents(tenant, c.estimate.id)).contractValue : c.result.totals.total;
    contract = { before, change, after: before + change };
  }
  const [signature] = await db
    .select()
    .from(schema.proposalSignatures)
    .where(and(eq(schema.proposalSignatures.estimateId, estimateId), eq(schema.proposalSignatures.outcome, "accepted")))
    .orderBy(desc(schema.proposalSignatures.signedAt))
    .limit(1);
  return {
    kind: c.estimate.kind,
    number: c.estimate.number,
    contract,
    title: c.estimate.name,
    status: c.estimate.status,
    sentAt: c.estimate.submittedAt,
    revision: c.estimate.revision,
    validDays: c.estimate.validDays,
    paymentTerms: c.estimate.paymentTerms,
    projectNumber: project?.jobNumber ?? null,
    companyContact,
    companyName: tenant.companyName,
    customerName: customer ? (customer.companyName || customer.contactName) : null,
    projectName: project?.name ?? null,
    projectAddress: addressParts.length > 0 ? addressParts.join(", ") : null,
    salesTaxPercent: Number(c.estimate.salesTaxPercent),
    view,
    terms: { version: terms.version, sections: terms.sections, pinned: Boolean(pinned) },
    blocker: sendBlocker(c),
    signature: signature
      ? {
          signerName: signature.signerName,
          signerEmail: signature.signerEmail,
          signatureType: signature.signatureType,
          signatureImage: signature.signatureImage,
          signedAt: signature.signedAt,
          ip: signature.ip,
          userAgent: signature.userAgent,
          documentHash: signature.documentHash,
          acceptedOptionIds: signature.acceptedOptionIds,
          contractValueCents: signature.contractValueCents === null ? null : Number(signature.contractValueCents),
          pdfDocumentId: signature.pdfDocumentId,
        }
      : null,
  };
}

/** What the contract value would be with these options chosen (cents). Used by the signing page. */
export async function previewAcceptance(tenant: Tenant, estimateId: string, optionIds: string[]) {
  const c = await loadComputed(tenant, estimateId);
  const valid = c.lines.filter((l) => l.isOptional && !l.parentId).map((l) => l.id);
  const chosen = [...new Set(optionIds)].filter((id) => valid.includes(id));
  const a = applyAcceptance(c.result, chosen);
  return { contractValue: a.contractValue, chosen };
}

/** Mark a sent proposal accepted: records options, locks it, drafts orders and invoices. Callers check permission. */
export async function acceptProposal(tenant: Tenant, userId: string, estimateId: string, acceptedOptionIds: string[]) {
  const { db, schema } = tenant;
  const c = await loadComputed(tenant, estimateId);
  if (c.estimate.status === "draft") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Send the proposal to the customer before marking it accepted." });
  }
  if (c.estimate.status !== "submitted") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "This proposal is already accepted." });
  }
  const isCO = c.estimate.kind === "change_order";
  if (isCO) {
    const [base] = c.estimate.baseEstimateId
      ? await db.select({ status: schema.estimates.status }).from(schema.estimates).where(eq(schema.estimates.id, c.estimate.baseEstimateId))
      : [];
    if (!base || !["accepted", "under_contract"].includes(base.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "The proposal this change order changes is not accepted." });
    }
  }
  const optionIds = c.lines.filter((l) => l.isOptional && !l.parentId).map((l) => l.id);
  const accepted = [...new Set(acceptedOptionIds)];
  if (accepted.some((id) => !optionIds.includes(id))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "One of the selected options is not an option on this proposal." });
  }

  const sourceLines = c.lines.map((l) => ({
    id: l.id,
    parentId: l.parentId,
    name: l.name,
    type: l.type,
    costCodeId: l.costCodeId,
    vendorId: l.vendorId,
    isOptional: l.isOptional,
  }));
  const acceptance = applyAcceptance(c.result, accepted);

  // Takeoffs copied in as one lump-sum line still order from their itemized material list: the
  // snapshot is expanded into stand-in child lines so the purchase orders list every material.
  const links = await db.select().from(schema.proposalTakeoffLinks).where(eq(schema.proposalTakeoffLinks.estimateId, estimateId));
  const hasKids = new Set(c.lines.filter((l) => l.parentId).map((l) => l.parentId as string));
  const synthOwner = new Map<string, { lineId: string; takeoffId: string; key: string }>();
  const orderLinesSrc = sourceLines.map((l) => ({ ...l }));
  const orderResult = { ...c.result, lines: { ...c.result.lines } };
  for (const link of links) {
    const parent = orderLinesSrc.find((l) => l.id === link.lineId);
    if (!parent || hasKids.has(parent.id)) continue; // removed from the proposal, or already itemized
    parent.type = "other";
    link.snapshot.forEach((s, i) => {
      const id = `synth:${link.id}:${i}`;
      orderLinesSrc.push({
        id, parentId: parent.id, name: `${s.name} — ${s.quantity} ${s.unit} @ ${s.unitCost.toFixed(2)}`,
        type: s.type as typeof parent.type, costCodeId: null, vendorId: s.vendorId, isOptional: false,
      });
      orderResult.lines[id] = { ...(orderResult.lines[parent.id] ?? {}), cost: Math.round(s.quantity * s.unitCost * 100) } as (typeof orderResult.lines)[string];
      synthOwner.set(id, { lineId: parent.id, takeoffId: link.takeoffId, key: s.key });
    });
  }
  const drafts = generateDraftOrders(orderLinesSrc, orderResult, accepted);
  const projectId = c.estimate.projectId;
  const [proj] = await db.select({ jobNumber: schema.projects.jobNumber }).from(schema.projects).where(eq(schema.projects.id, projectId));
  const projectNumber = proj?.jobNumber ?? null;
  const now = new Date();

  const createdOrders = await db.transaction(async (tx) => {
    for (const id of optionIds) {
      await tx
        .update(schema.proposalCostLines)
        .set({ optionAccepted: accepted.includes(id) })
        .where(eq(schema.proposalCostLines.id, id));
    }
    await tx
      .update(schema.estimates)
      .set({ status: "accepted", acceptedAt: now, updatedAt: now })
      .where(eq(schema.estimates.id, estimateId));
    if (!isCO) {
      await tx.update(schema.estimates).set({ isActive: false }).where(eq(schema.estimates.projectId, projectId));
      await tx.update(schema.estimates).set({ isActive: true }).where(eq(schema.estimates.id, estimateId));
    }

    const existing = await tx
      .select({ kind: schema.orders.kind })
      .from(schema.orders)
      .where(eq(schema.orders.projectId, projectId));
    const counters = {
      purchase: existing.filter((o) => o.kind === "purchase").length,
      work: existing.filter((o) => o.kind === "work").length,
    };
    const out: Array<{ id: string; number: string; kind: string; vendorId: string | null; lines: number; total: number }> = [];
    for (const d of drafts) {
      counters[d.kind] += 1;
      const number = formatDocNumber(d.kind === "purchase" ? "PO" : "WO", projectNumber, counters[d.kind]);
      const [order] = await tx
        .insert(schema.orders)
        .values({ projectId, estimateId: estimateId, kind: d.kind, number, vendorId: d.vendorId, status: "draft", createdBy: userId })
        .returning({ id: schema.orders.id });
      await tx.insert(schema.orderLines).values(
        d.lines.map((l, i) => ({
          orderId: order.id,
          sourceLineId: synthOwner.get(l.sourceLineId)?.lineId ?? l.sourceLineId,
          takeoffId: synthOwner.get(l.sourceLineId)?.takeoffId ?? null,
          takeoffKey: synthOwner.get(l.sourceLineId)?.key ?? null,
          description: l.description,
          category: l.category,
          budgetCost: String(l.budgetCost / 100),
          projectedCost: String(l.budgetCost / 100),
          sortOrder: i,
        }))
      );
      out.push({ id: order.id, number, kind: d.kind, vendorId: d.vendorId, lines: d.lines.length, total: d.total });
    }
    await createInvoiceDrafts(tx as unknown as typeof db, schema, {
      projectId,
      estimateId: estimateId,
      jobNumber: projectNumber,
      contractValueCents: acceptance.contractValue,
      milestones: c.milestones,
      paymentTerms: c.estimate.paymentTerms ?? null,
      userId,
    });
    return out;
  });

  await createAuditLog(db, schema, {
    entityType: "Estimate",
    entityId: estimateId,
    action: AuditAction.UPDATE,
    actorId: userId,
    changes: {
      before: { status: "submitted" },
      after: {
        status: "accepted",
        acceptedOptions: accepted.length,
        contractValue: acceptance.contractValue,
        draftOrders: createdOrders.length,
      },
    },
  });
  return { contractValue: acceptance.contractValue, costBudget: acceptance.costBudget, orders: createdOrders };
}

export const proposalRouter = router({
  /** Full proposal with computed totals. */
  get: protectedProcedure
    .input(z.object({ estimateId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      const { db, schema } = ctx.tenant;
      const abilities = await loadAbilities({ tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole });
      ForbiddenError.from(abilities).throwUnlessCan("read", "Estimate");

      const [estimate] = await db
        .select()
        .from(schema.estimates)
        .where(eq(schema.estimates.id, input.estimateId))
        .limit(1);
      if (!estimate) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found" });

      const lineRows = await db
        .select()
        .from(schema.proposalCostLines)
        .where(eq(schema.proposalCostLines.estimateId, input.estimateId))
        .orderBy(asc(schema.proposalCostLines.sortOrder));
      const globalRows = await db
        .select()
        .from(schema.proposalGlobalCosts)
        .where(eq(schema.proposalGlobalCosts.estimateId, input.estimateId))
        .orderBy(asc(schema.proposalGlobalCosts.sortOrder));
      const milestoneRows = await db
        .select()
        .from(schema.invoiceMilestones)
        .where(eq(schema.invoiceMilestones.estimateId, input.estimateId))
        .orderBy(asc(schema.invoiceMilestones.sortOrder));

      const [latest] = await db
        .select({ id: schema.estimates.id, slug: schema.estimates.slug, revision: schema.estimates.revision })
        .from(schema.estimates)
        .where(
          and(
            eq(schema.estimates.projectId, estimate.projectId),
            eq(schema.estimates.kind, estimate.kind),
            estimate.kind === "change_order" && estimate.number ? eq(schema.estimates.number, estimate.number) : undefined
          )
        )
        .orderBy(desc(schema.estimates.revision))
        .limit(1);
      const latestRevision = latest && latest.id !== estimate.id ? { slug: latest.slug, revision: latest.revision } : null;

      const lines = lineRows.map((l) => ({
        id: l.id,
        parentId: l.parentId,
        type: l.type as CostLineInput["type"],
        name: l.name,
        costCodeId: l.costCodeId,
        quantity: Number(l.quantity),
        unit: l.unit,
        unitCost: Number(l.unitCost),
        marginPercent: Number(l.marginPercent),
        contingencyPercent: Number(l.contingencyPercent),
        notes: l.notes,
        visibility: l.visibility,
        isOptional: l.isOptional,
        optionAccepted: l.optionAccepted,
        vendorId: l.vendorId,
      }));
      const globals = globalRows.map((g) => ({ id: g.id, name: g.name, amount: Number(g.amount) }));
      const milestones = milestoneRows.map((m) => ({ id: m.id, name: m.name, percent: Number(m.percent) }));

      const result = computeProposal({
        lines,
        globals,
        taxRatePercent: Number(estimate.salesTaxPercent),
      });
      const acceptedIds = lines.filter((l) => l.isOptional && l.optionAccepted === true).map((l) => l.id);
      const acceptance = applyAcceptance(result, acceptedIds);
      const valid = milestonesTotal100(milestones);
      // Schedule is based on the contract value once accepted, otherwise the base proposal total.
      const scheduleBase = estimate.acceptedAt ? acceptance.contractValue : result.totals.total;
      const schedule = computeSchedule(scheduleBase, milestones);

      return {
        estimate: {
          id: estimate.id,
          projectId: estimate.projectId,
          name: estimate.name,
          description: estimate.description,
          status: estimate.status,
          salesTaxPercent: Number(estimate.salesTaxPercent),
          paymentTerms: estimate.paymentTerms,
          validDays: estimate.validDays,
          acceptedAt: estimate.acceptedAt,
          sentAt: estimate.submittedAt,
          revision: estimate.revision,
          latestRevision,
          isActive: estimate.isActive,
          kind: estimate.kind,
          number: estimate.number,
          isLocked: LOCKED_STATUSES.includes(estimate.status),
        },
        lines,
        globals,
        milestones,
        computed: result,
        acceptance,
        schedule,
        milestonesTotal100: valid,
      };
    }),

  /** Name, tax rate, payment terms, validity. */
  updateSettings: protectedProcedure
    .input(
      z.object({
        estimateId: z.string().uuid(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(5000).nullable().optional(),
        salesTaxPercent: z.number().min(0).max(100).optional(),
        paymentTerms: z.enum(PAYMENT_TERMS).optional(),
        validDays: z.number().int().min(1).max(365).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      const { db, schema } = ctx.tenant;
      const abilities = await loadAbilities({ tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole });
      ForbiddenError.from(abilities).throwUnlessCan("update", "Estimate");

      const [existing] = await db
        .select()
        .from(schema.estimates)
        .where(eq(schema.estimates.id, input.estimateId))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found" });
      if (LOCKED_STATUSES.includes(existing.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: lockedMessage(existing.status) });
      }

      const values: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) values.name = input.name;
      if (input.description !== undefined) values.description = input.description;
      if (input.salesTaxPercent !== undefined) values.salesTaxPercent = String(input.salesTaxPercent);
      if (input.paymentTerms !== undefined) values.paymentTerms = input.paymentTerms;
      if (input.validDays !== undefined) values.validDays = input.validDays;

      const [updated] = await db
        .update(schema.estimates)
        .set(values)
        .where(eq(schema.estimates.id, input.estimateId))
        .returning();

      await createAuditLog(db, schema, {
        entityType: "Estimate",
        entityId: input.estimateId,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: { before: existing, after: updated },
      });
      return { id: updated.id };
    }),

  /**
   * Replace all cost lines, global costs and milestones in one save.
   * The builder sends its whole state; ids are generated client-side so parent
   * references resolve. Rejected when the proposal is accepted and locked.
   */
  saveContent: protectedProcedure.input(saveContentSchema).mutation(async ({ ctx, input }) => {
    if (!ctx.tenant || !ctx.userId) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    }
    const { db, schema } = ctx.tenant;
    const abilities = await loadAbilities({ tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole });
    ForbiddenError.from(abilities).throwUnlessCan("update", "Estimate");

    const [existing] = await db
      .select()
      .from(schema.estimates)
      .where(eq(schema.estimates.id, input.estimateId))
      .limit(1);
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found" });
    if (LOCKED_STATUSES.includes(existing.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: lockedMessage(existing.status) });
    }

    const structureError = validateLineStructure(input.lines);
    if (structureError) throw new TRPCError({ code: "BAD_REQUEST", message: structureError });
    if (existing.kind !== "change_order" && input.lines.some((l) => l.unitCost < 0)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Only a change order can have a negative unit cost (a credit)." });
    }

    const proposalTotal = computeProposal({
      lines: input.lines.map((l) => ({
        id: l.id,
        parentId: l.parentId,
        type: l.type,
        quantity: l.quantity,
        unitCost: l.unitCost,
        marginPercent: l.marginPercent,
        contingencyPercent: l.contingencyPercent,
        isOptional: l.isOptional,
      })),
      globals: input.globals.map((g) => ({ id: g.id, amount: g.amount })),
      taxRatePercent: Number(existing.salesTaxPercent),
    }).totals.total;

    await db.transaction(async (tx) => {
      await tx.delete(schema.proposalCostLines).where(eq(schema.proposalCostLines.estimateId, input.estimateId));
      // A takeoff whose line was deleted from the proposal is no longer part of it.
      const keepIds = input.lines.map((l) => l.id);
      const stale = await tx.select({ id: schema.proposalTakeoffLinks.id, lineId: schema.proposalTakeoffLinks.lineId }).from(schema.proposalTakeoffLinks).where(eq(schema.proposalTakeoffLinks.estimateId, input.estimateId));
      const staleIds = stale.filter((x) => !keepIds.includes(x.lineId)).map((x) => x.id);
      if (staleIds.length) await tx.delete(schema.proposalTakeoffLinks).where(inArray(schema.proposalTakeoffLinks.id, staleIds));
      await tx.delete(schema.proposalGlobalCosts).where(eq(schema.proposalGlobalCosts.estimateId, input.estimateId));
      await tx.delete(schema.invoiceMilestones).where(eq(schema.invoiceMilestones.estimateId, input.estimateId));

      if (input.lines.length > 0) {
        await tx.insert(schema.proposalCostLines).values(
          input.lines.map((l, i) => ({
            id: l.id,
            estimateId: input.estimateId,
            parentId: l.parentId,
            type: l.type,
            name: l.name,
            costCodeId: l.costCodeId ?? null,
            quantity: String(l.quantity),
            unit: l.unit,
            unitCost: String(l.unitCost),
            marginPercent: String(l.marginPercent),
            contingencyPercent: String(l.contingencyPercent),
            notes: l.notes?.trim() ? l.notes : null,
            visibility: l.visibility,
            isOptional: l.isOptional,
            vendorId: l.vendorId ?? null,
            sortOrder: i,
          }))
        );
      }
      if (input.globals.length > 0) {
        await tx.insert(schema.proposalGlobalCosts).values(
          input.globals.map((g, i) => ({
            id: g.id,
            estimateId: input.estimateId,
            name: g.name,
            amount: String(g.amount),
            sortOrder: i,
          }))
        );
      }
      if (input.milestones.length > 0) {
        await tx.insert(schema.invoiceMilestones).values(
          input.milestones.map((m, i) => ({
            id: m.id,
            estimateId: input.estimateId,
            name: m.name,
            percent: String(m.percent),
            sortOrder: i,
          }))
        );
      }
      await tx
        .update(schema.estimates)
        .set({ updatedAt: new Date(), totalCost: String(proposalTotal / 100) })
        .where(eq(schema.estimates.id, input.estimateId));
    });

    await createAuditLog(db, schema, {
      entityType: "Estimate",
      entityId: input.estimateId,
      action: AuditAction.UPDATE,
      actorId: ctx.userId,
      changes: {
        after: {
          lines: input.lines.length,
          globals: input.globals.length,
          milestones: input.milestones.length,
        },
      },
    });

    return { ok: true as const };
  }),

  /**
   * What the customer receives: built from an allow-list, so hidden lines, cost, margin,
   * contingency, vendors and notes are never included. Terms are the pinned version once sent,
   * otherwise the current master terms.
   */
  customerView: protectedProcedure
    .input(z.object({ estimateId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      const abilities = await loadAbilities({ tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole });
      ForbiddenError.from(abilities).throwUnlessCan("read", "Estimate");
      return buildCustomerViewData(ctx.tenant, ctx.userId, input.estimateId);
    }),

  /**
   * Record the proposal as sent to the customer (delivery by email is not built yet).
   * Requires a 100% invoicing schedule, and pins the master terms version that is current now.
   */
  send: protectedProcedure
    .input(z.object({ estimateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      const { db, schema } = ctx.tenant;
      const abilities = await loadAbilities({ tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole });
      ForbiddenError.from(abilities).throwUnlessCan("update", "Estimate");

      const c = await loadComputed(ctx.tenant, input.estimateId);
      const blocker = sendBlocker(c);
      if (blocker) throw new TRPCError({ code: "BAD_REQUEST", message: blocker });

      const terms = await ensureCurrentTerms(ctx.tenant, ctx.userId, c.estimate.kind === "change_order" ? "change_order" : "proposal");
      const sentAt = new Date();
      await db
        .update(schema.estimates)
        .set({ status: "submitted", submittedAt: sentAt, termsVersionId: terms.id, updatedAt: sentAt })
        .where(eq(schema.estimates.id, input.estimateId));

      await createAuditLog(db, schema, {
        entityType: "Estimate",
        entityId: input.estimateId,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: {
          before: { status: c.estimate.status, termsVersionId: c.estimate.termsVersionId },
          after: { status: "submitted", termsVersion: terms.version, total: c.result.totals.total },
        },
      });
      return { sentAt, termsVersion: terms.version };
    }),

  /**
   * Create the next revision of a project's proposal ("Rev 1", "Rev 2", ...; the first proposal is Rev 0). It copies the
   * given proposal (default: the latest one) and becomes the active proposal. With no existing
   * proposal it creates an empty Rev 1.
   */
  createNext: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), copyFromId: z.string().uuid().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      const { db, schema } = ctx.tenant;
      const abilities = await loadAbilities({ tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole });
      ForbiddenError.from(abilities).throwUnlessCan("create", "Estimate");

      const existing = await db
        .select({ id: schema.estimates.id, revision: schema.estimates.revision, status: schema.estimates.status })
        .from(schema.estimates)
        .where(and(eq(schema.estimates.projectId, input.projectId), eq(schema.estimates.kind, "proposal")))
        .orderBy(desc(schema.estimates.revision));
      if (existing.some((e) => e.status === "accepted" || e.status === "under_contract")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This project has an accepted proposal. Changes now go through a change order, not a new revision.",
        });
      }
      const next = existing.length === 0 ? 0 : existing[0].revision + 1; // the first proposal is Rev 0
      const name = `Rev ${next}`;
      const copyFromId = input.copyFromId ?? existing[0]?.id ?? null;
      if (copyFromId && !existing.some((e) => e.id === copyFromId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That proposal is not in this project." });
      }

      let created: { id: string; slug: string };
      if (copyFromId) {
        created = await cloneProposal(ctx.tenant, ctx.userId, copyFromId, {
          name,
          slugSuffix: "",
          revision: next,
          revisionOfId: copyFromId,
        });
      } else {
        const [project] = await db
          .select({ jobNumber: schema.projects.jobNumber, customerId: schema.projects.customerId })
          .from(schema.projects)
          .where(eq(schema.projects.id, input.projectId))
          .limit(1);
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        // The customer's own terms, else the company default.
        const [cust] = await db.select({ paymentTerms: schema.customers.paymentTerms }).from(schema.customers).where(eq(schema.customers.id, project.customerId)).limit(1);
        const identifier = project.jobNumber ? `est-${project.jobNumber}` : `est-${input.projectId.slice(0, 8)}`;
        const slug = await uniqueSlug(ctx.tenant, generateSlug(identifier, name));
        const [row] = await db
          .insert(schema.estimates)
          .values({
            projectId: input.projectId,
            name,
            status: "draft",
            projectType: "commercial",
            currentVersion: 1,
            paymentTerms: cust?.paymentTerms ?? DEFAULT_PAYMENT_TERMS,
            revision: next,
            slug,
            createdBy: ctx.userId,
          })
          .returning({ id: schema.estimates.id, slug: schema.estimates.slug });
        // Every schedule starts with Substantial Completion, which takes whatever balance is left.
        await db.insert(schema.invoiceMilestones).values({ estimateId: row.id, name: "Substantial Completion", percent: "100", sortOrder: 0 });
        created = { id: row.id, slug: row.slug as string };
      }

      await activate(ctx.tenant, input.projectId, created.id);
      await createAuditLog(db, schema, {
        entityType: "Estimate",
        entityId: created.id,
        action: AuditAction.CREATE,
        actorId: ctx.userId,
        changes: { after: { name, revision: next, copiedFrom: copyFromId } },
      });
      return { id: created.id, slug: created.slug, revision: next };
    }),

  /** Make a revision the project's active proposal (the one that feeds the project numbers). */
  setActive: protectedProcedure
    .input(z.object({ estimateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      const { db, schema } = ctx.tenant;
      const abilities = await loadAbilities({ tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole });
      ForbiddenError.from(abilities).throwUnlessCan("update", "Estimate");
      const [est] = await db
        .select({ projectId: schema.estimates.projectId, status: schema.estimates.status, kind: schema.estimates.kind })
        .from(schema.estimates)
        .where(eq(schema.estimates.id, input.estimateId))
        .limit(1);
      if (!est) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found" });
      if (est.kind !== "proposal") throw new TRPCError({ code: "BAD_REQUEST", message: "Only a proposal can be the active proposal." });
      await activate(ctx.tenant, est.projectId, input.estimateId);
      await createAuditLog(db, schema, {
        entityType: "Estimate",
        entityId: input.estimateId,
        action: AuditAction.UPDATE,
        actorId: ctx.userId,
        changes: { after: { isActive: true } },
      });
      return { ok: true as const };
    }),

  /**
   * The project's active proposal with the numbers that feed the project header: contract value,
   * cost, profit and contingency. Null when the project has no proposal yet.
   */
  activeForProject: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      const { db, schema } = ctx.tenant;
      const abilities = await loadAbilities({ tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole });
      ForbiddenError.from(abilities).throwUnlessCan("read", "Estimate");
      const [active] = await db
        .select({ id: schema.estimates.id, slug: schema.estimates.slug, revision: schema.estimates.revision })
        .from(schema.estimates)
        .where(and(eq(schema.estimates.projectId, input.projectId), eq(schema.estimates.isActive, true)))
        .limit(1);
      if (!active) return null;
      const c = await loadComputed(ctx.tenant, active.id);
      const accepted = c.estimate.acceptedAt != null;
      const acceptedIds = c.lines.filter((l) => l.isOptional && l.optionAccepted === true).map((l) => l.id);
      const acceptance = applyAcceptance(c.result, acceptedIds);
      const contractValue = accepted ? acceptance.contractValue : c.result.totals.total;
      const cost = accepted ? acceptance.costBudget : c.result.totals.baseCost;
      const contingency = accepted ? acceptance.contingencyBudget : c.result.totals.baseContingency;
      // Margin profit: price minus cost (contingency counts as cost, so unspent contingency is
      // extra profit later). Accepted options add their own price minus cost.
      const acceptedOptions = c.result.options.filter((o) => acceptedIds.includes(o.id));
      const profit =
        c.result.totals.basePrice - c.result.totals.baseCost +
        (accepted ? acceptedOptions.reduce((a, o) => a + o.profit, 0) : 0);
      // Accepted change orders add to the contract value, cost and profit.
      const cos = accepted ? await acceptedChangeOrders(ctx.tenant, c.estimate.projectId) : [];
      const coValue = cos.reduce((a, x) => a + x.contractValue, 0);
      return {
        estimateId: active.id,
        slug: active.slug,
        revision: active.revision,
        status: c.estimate.status,
        accepted,
        baseContractValue: contractValue,
        changeOrdersValue: coValue,
        changeOrders: cos.map((x) => ({
          id: x.row.id,
          number: x.row.number,
          name: x.row.name,
          revision: x.row.revision,
          contractValue: x.contractValue,
          schedule: computeSchedule(x.contractValue, x.c.milestones).map((r) => ({ ...r, name: x.c.milestones.find((m) => m.id === r.id)?.name ?? "" })),
        })),
        contractValue: contractValue + coValue,
        cost: cost + cos.reduce((a, x) => a + x.cost, 0),
        contingency: contingency + cos.reduce((a, x) => a + x.contingency, 0),
        profit: profit + cos.reduce((a, x) => a + x.profit, 0),
        optionsTotal: c.result.options.reduce((a, o) => a + o.price + o.tax, 0),
        /** cents; milestone amounts follow the contract value */
        schedule: computeSchedule(contractValue, c.milestones).map((r) => ({ ...r, name: c.milestones.find((m) => m.id === r.id)?.name ?? "" })),
        acceptedOptionNames: accepted ? c.lines.filter((l) => !l.parentId && l.isOptional && acceptedIds.includes(l.id)).map((l) => l.name) : [],
        declinedOptionNames: accepted ? c.lines.filter((l) => !l.parentId && l.isOptional && !acceptedIds.includes(l.id)).map((l) => l.name) : [],
      };
    }),

  /**
   * Create the draft invoices for an accepted proposal that has none (for example one accepted
   * before invoices existed). Does nothing if invoices already exist.
   */
  createInvoices: protectedProcedure
    .input(z.object({ estimateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      const { db, schema } = ctx.tenant;
      const abilities = await loadAbilities({ tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole });
      ForbiddenError.from(abilities).throwUnlessCan("update", "Estimate");
      const c = await loadComputed(ctx.tenant, input.estimateId);
      if (c.estimate.acceptedAt == null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invoices are created when a proposal is accepted." });
      }
      const existing = await db.select({ id: schema.invoices.id }).from(schema.invoices).where(eq(schema.invoices.estimateId, input.estimateId)).limit(1);
      if (existing.length > 0) return { created: 0 };
      const acceptedIds = c.lines.filter((l) => l.isOptional && l.optionAccepted === true).map((l) => l.id);
      const acceptance = applyAcceptance(c.result, acceptedIds);
      const [proj] = await db.select({ jobNumber: schema.projects.jobNumber }).from(schema.projects).where(eq(schema.projects.id, c.estimate.projectId));
      const made = await createInvoiceDrafts(db, schema, {
        projectId: c.estimate.projectId,
        estimateId: input.estimateId,
        jobNumber: proj?.jobNumber ?? null,
        contractValueCents: acceptance.contractValue,
        milestones: c.milestones,
        paymentTerms: c.estimate.paymentTerms ?? null,
        userId: ctx.userId,
      });
      return { created: made.length };
    }),

  /**
   * Mark a sent proposal accepted. The customer's chosen options are recorded, the contract
   * value and invoicing amounts follow from them, the proposal locks, it becomes the project's
   * active proposal, and draft purchase orders and work orders are generated from its cost lines.
   */
  accept: protectedProcedure
    .input(z.object({ estimateId: z.string().uuid(), acceptedOptionIds: z.array(z.string().uuid()).max(500) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      const abilities = await loadAbilities({ tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole });
      ForbiddenError.from(abilities).throwUnlessCan("update", "Estimate");
      return acceptProposal(ctx.tenant, ctx.userId, input.estimateId, input.acceptedOptionIds);
    }),
  // ---- Change orders: built like proposals (estimates.kind = "change_order") ----

  /** Change orders for a project with their status and amounts. */
  listChangeOrders: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      const { db, schema } = ctx.tenant;
      const abilities = await loadAbilities({ tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole });
      ForbiddenError.from(abilities).throwUnlessCan("read", "Estimate");
      const rows = await db
        .select()
        .from(schema.estimates)
        .where(and(eq(schema.estimates.projectId, input.projectId), eq(schema.estimates.kind, "change_order")))
        .orderBy(asc(schema.estimates.number), asc(schema.estimates.revision));
      const [base] = await db
        .select({ id: schema.estimates.id })
        .from(schema.estimates)
        .where(and(eq(schema.estimates.projectId, input.projectId), eq(schema.estimates.kind, "proposal"), inArray(schema.estimates.status, ["accepted", "under_contract"])))
        .limit(1);
      const list = [];
      for (const r of rows) {
        const c = await loadComputed(ctx.tenant, r.id);
        const acceptedIds = c.lines.filter((l) => l.isOptional && l.optionAccepted === true).map((l) => l.id);
        const total = r.acceptedAt ? applyAcceptance(c.result, acceptedIds).contractValue : c.result.totals.total;
        const latest = rows.filter((x) => x.number === r.number).reduce((a, x) => Math.max(a, x.revision), 0);
        list.push({
          id: r.id,
          slug: r.slug as string,
          number: r.number,
          name: r.name,
          revision: r.revision,
          status: r.status,
          total,
          sentAt: r.submittedAt,
          acceptedAt: r.acceptedAt,
          superseded: r.revision < latest && r.status !== "accepted",
          createdAt: r.createdAt,
        });
      }
      return { rows: list, canCreate: Boolean(base) };
    }),

  /** Start a new change order (Rev 0) against the project's accepted proposal. */
  createChangeOrder: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), name: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      const { db, schema } = ctx.tenant;
      const abilities = await loadAbilities({ tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole });
      ForbiddenError.from(abilities).throwUnlessCan("create", "Estimate");
      const [base] = await db
        .select()
        .from(schema.estimates)
        .where(and(eq(schema.estimates.projectId, input.projectId), eq(schema.estimates.kind, "proposal"), inArray(schema.estimates.status, ["accepted", "under_contract"])))
        .limit(1);
      if (!base) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A change order changes an accepted proposal. Accept the proposal first." });
      }
      const [project] = await db.select({ jobNumber: schema.projects.jobNumber }).from(schema.projects).where(eq(schema.projects.id, input.projectId));
      const existing = await db
        .select({ number: schema.estimates.number })
        .from(schema.estimates)
        .where(and(eq(schema.estimates.projectId, input.projectId), eq(schema.estimates.kind, "change_order")));
      const lastSeq = existing.reduce((a, r) => Math.max(a, Number(/-(\d+)$/.exec(r.number ?? "")?.[1] ?? 0)), 0);
      const number = formatDocNumber("CO", project?.jobNumber ?? null, lastSeq + 1);
      const identifier = project?.jobNumber ? `co-${project.jobNumber}` : `co-${input.projectId.slice(0, 8)}`;
      const slug = await uniqueSlug(ctx.tenant, generateSlug(identifier, `${String(lastSeq + 1).padStart(2, "0")}`));
      const created = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(schema.estimates)
          .values({
            projectId: input.projectId,
            name: input.name.trim(),
            status: "draft",
            projectType: base.projectType,
            currentVersion: 1,
            salesTaxPercent: base.salesTaxPercent,
            paymentTerms: base.paymentTerms,
            validDays: base.validDays,
            revision: 0,
            kind: "change_order",
            number,
            baseEstimateId: base.id,
            isActive: false,
            slug,
            createdBy: ctx.userId!,
          })
          .returning({ id: schema.estimates.id, slug: schema.estimates.slug });
        await tx.insert(schema.invoiceMilestones).values({ estimateId: row.id, name: "Substantial Completion", percent: "100", sortOrder: 0 });
        return row;
      });
      await createAuditLog(db, schema, {
        entityType: "Estimate",
        entityId: created.id,
        action: AuditAction.CREATE,
        actorId: ctx.userId,
        changes: { after: { kind: "change_order", number, name: input.name } },
      });
      return { id: created.id, slug: created.slug as string, number };
    }),

  /** Copy a sent change order into a new draft revision. An accepted change order cannot be revised. */
  reviseChangeOrder: protectedProcedure
    .input(z.object({ estimateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      const { db, schema } = ctx.tenant;
      const abilities = await loadAbilities({ tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole });
      ForbiddenError.from(abilities).throwUnlessCan("create", "Estimate");
      const [src] = await db.select().from(schema.estimates).where(eq(schema.estimates.id, input.estimateId));
      if (!src || src.kind !== "change_order") throw new TRPCError({ code: "NOT_FOUND", message: "Change order not found" });
      if (src.status === "accepted" || src.status === "under_contract") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This change order is accepted. A further change needs a new change order." });
      }
      if (src.status === "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "This change order is still a draft. Edit it directly." });
      const siblings = await db
        .select({ revision: schema.estimates.revision })
        .from(schema.estimates)
        .where(and(eq(schema.estimates.projectId, src.projectId), eq(schema.estimates.kind, "change_order"), src.number ? eq(schema.estimates.number, src.number) : undefined));
      const next = siblings.reduce((a, r) => Math.max(a, r.revision), 0) + 1;
      if (next - 1 !== src.revision && siblings.some((r) => r.revision > src.revision)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A newer revision of this change order already exists." });
      }
      const created = await cloneProposal(ctx.tenant, ctx.userId, src.id, {
        name: src.name,
        slugSuffix: `-rev${next}`,
        revision: next,
        revisionOfId: src.id,
        extra: { kind: "change_order", number: src.number, baseEstimateId: src.baseEstimateId },
      });
      await createAuditLog(db, schema, {
        entityType: "Estimate",
        entityId: created.id,
        action: AuditAction.CREATE,
        actorId: ctx.userId,
        changes: { after: { kind: "change_order", number: src.number, revision: next } },
      });
      return { id: created.id, slug: created.slug, revision: next };
    }),

  /** Delete a change order that has not been sent. */
  deleteChangeOrder: protectedProcedure
    .input(z.object({ estimateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      const { db, schema } = ctx.tenant;
      const abilities = await loadAbilities({ tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole });
      ForbiddenError.from(abilities).throwUnlessCan("delete", "Estimate");
      const [src] = await db.select().from(schema.estimates).where(eq(schema.estimates.id, input.estimateId));
      if (!src || src.kind !== "change_order") throw new TRPCError({ code: "NOT_FOUND", message: "Change order not found" });
      if (src.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "Only a draft change order can be deleted." });
      await db.delete(schema.estimates).where(eq(schema.estimates.id, src.id));
      await createAuditLog(db, schema, {
        entityType: "Estimate",
        entityId: src.id,
        action: AuditAction.DELETE,
        actorId: ctx.userId,
        changes: { before: { kind: "change_order", number: src.number, name: src.name } },
      });
      return { ok: true as const };
    }),
});
