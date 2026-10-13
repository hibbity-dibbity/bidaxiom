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
  type CostLineInput,
} from "@construction/shared";
import { createAuditLog } from "../../audit/logger.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { eq, asc } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";

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

const LOCKED_STATUSES = ["accepted", "under_contract"];

/** Structural rules the database cannot express: two levels, optional items stand alone. */
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
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This proposal is accepted and locked. Use a change order for scope changes.",
        });
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
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This proposal is accepted and locked. Use a change order for scope changes.",
      });
    }

    const structureError = validateLineStructure(input.lines);
    if (structureError) throw new TRPCError({ code: "BAD_REQUEST", message: structureError });

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
        .set({ updatedAt: new Date() })
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
});
