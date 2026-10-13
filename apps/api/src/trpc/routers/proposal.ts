import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import {
  AuditAction,
  PAYMENT_TERMS,
  computeProposal,
  applyAcceptance,
  computeSchedule,
  milestonesTotal100,
  buildCustomerView,
  type CostLineInput,
} from "@construction/shared";
import { createAuditLog } from "../../audit/logger.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { eq, asc } from "drizzle-orm";
import { generateSlug } from "../../utils/slug.js";
import { ForbiddenError } from "@casl/ability";
import { ensureCurrentTerms, readTermsVersion } from "./terms.js";

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
  unitCost: z.number().min(0).max(1e9),
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
async function loadComputed(tenant: Tenant, estimateId: string) {
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
    quantity: Number(l.quantity),
    unitCost: Number(l.unitCost),
    marginPercent: Number(l.marginPercent),
    contingencyPercent: Number(l.contingencyPercent),
    visibility: l.visibility as "price" | "name_only" | "hidden",
    isOptional: l.isOptional,
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

/**
 * Copy a proposal's settings, lines, global costs and invoicing schedule into a new draft.
 * Used for "copy a previous proposal" and for revisions. Terms are not copied: the copy pins
 * the terms version current at the time it is sent.
 */
async function cloneProposal(
  tenant: Tenant,
  userId: string,
  sourceId: string,
  opts: { name: string; slugSuffix?: string; revision: number; revisionOfId: string | null }
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
  if (baseParents.length === 0 || c.result.totals.total <= 0) return "Add at least one priced line before sending.";
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

      const [newer] = await db
        .select({ slug: schema.estimates.slug, revision: schema.estimates.revision })
        .from(schema.estimates)
        .where(eq(schema.estimates.revisionOfId, estimate.id))
        .limit(1);
      const newerRevision = newer ? { slug: newer.slug, revision: newer.revision } : null;

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
          newerRevision,
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
      const { db, schema } = ctx.tenant;
      const abilities = await loadAbilities({ tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole });
      ForbiddenError.from(abilities).throwUnlessCan("read", "Estimate");

      const c = await loadComputed(ctx.tenant, input.estimateId);
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

      const pinned = c.estimate.termsVersionId ? await readTermsVersion(ctx.tenant, c.estimate.termsVersionId) : null;
      const terms = pinned ?? (await ensureCurrentTerms(ctx.tenant, ctx.userId));

      const addressParts = project
        ? [project.street1, project.street2, [project.city, project.state].filter(Boolean).join(", "), project.zip].filter(Boolean)
        : [];
      return {
        title: c.estimate.name,
        status: c.estimate.status,
        sentAt: c.estimate.submittedAt,
        revision: c.estimate.revision,
        validDays: c.estimate.validDays,
        paymentTerms: c.estimate.paymentTerms,
        proposalNumber: project?.jobNumber ?? null,
        companyName: ctx.tenant.companyName,
        customerName: customer ? (customer.companyName || customer.contactName) : null,
        projectName: project?.name ?? null,
        projectAddress: addressParts.length > 0 ? addressParts.join(", ") : null,
        salesTaxPercent: Number(c.estimate.salesTaxPercent),
        view,
        terms: { version: terms.version, sections: terms.sections, pinned: Boolean(pinned) },
        blocker: sendBlocker(c),
      };
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

      const terms = await ensureCurrentTerms(ctx.tenant, ctx.userId);
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
   * Copy any proposal in a project into a new draft in the same project, without making a template.
   */
  duplicate: protectedProcedure
    .input(z.object({ estimateId: z.string().uuid(), name: z.string().trim().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      const { db, schema } = ctx.tenant;
      const abilities = await loadAbilities({ tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole });
      ForbiddenError.from(abilities).throwUnlessCan("create", "Estimate");

      const copy = await cloneProposal(ctx.tenant, ctx.userId, input.estimateId, {
        name: input.name,
        revision: 1,
        revisionOfId: null,
      });
      await createAuditLog(db, schema, {
        entityType: "Estimate",
        entityId: copy.id,
        action: AuditAction.CREATE,
        actorId: ctx.userId,
        changes: { after: { copiedFrom: input.estimateId, name: input.name } },
      });
      return { id: copy.id, slug: copy.slug };
    }),

  /**
   * Revise a sent proposal: copies it into a new editable draft (Rev 2, 3, ...). The sent
   * proposal stays unchanged as the record of what the customer received.
   */
  createRevision: protectedProcedure
    .input(z.object({ estimateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      const { db, schema } = ctx.tenant;
      const abilities = await loadAbilities({ tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole });
      ForbiddenError.from(abilities).throwUnlessCan("update", "Estimate");

      const [src] = await db.select().from(schema.estimates).where(eq(schema.estimates.id, input.estimateId)).limit(1);
      if (!src) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found" });
      if (src.status !== "submitted") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            src.status === "draft"
              ? "This proposal has not been sent, so you can edit it directly."
              : "Accepted proposals change through change orders, not revisions.",
        });
      }
      const [existingRevision] = await db
        .select({ slug: schema.estimates.slug })
        .from(schema.estimates)
        .where(eq(schema.estimates.revisionOfId, src.id))
        .limit(1);
      if (existingRevision) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A newer revision of this proposal already exists." });
      }

      const next = src.revision + 1;
      const copy = await cloneProposal(ctx.tenant, ctx.userId, src.id, {
        name: src.name,
        slugSuffix: `-rev${next}`,
        revision: next,
        revisionOfId: src.id,
      });
      await createAuditLog(db, schema, {
        entityType: "Estimate",
        entityId: copy.id,
        action: AuditAction.CREATE,
        actorId: ctx.userId,
        changes: { after: { revisionOf: src.id, revision: next } },
      });
      return { id: copy.id, slug: copy.slug, revision: next };
    }),
});
