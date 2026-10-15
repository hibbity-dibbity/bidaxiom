import { z } from "zod";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, max } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";
import {
  DEFAULT_CONCRETE,
  DEFAULT_METAL,
  computeConcrete,
  computeMetalBuilding,
  applyOverrides,
  type TakeoffLine,
} from "@construction/shared";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";

const kindEnum = z.enum(["concrete", "metal_building"]);
const num = z.number().finite().min(0).max(1e7);
const overrideMap = z.record(z.string().max(60), z.number().finite().min(-1e9).max(1e9)).refine((m) => Object.keys(m).length <= 200);

/** Inputs are merged over the defaults, so a missing or new field never breaks a saved takeoff. */
function mergeInputs(kind: "concrete" | "metal_building", raw: Record<string, unknown>) {
  const base = kind === "concrete" ? DEFAULT_CONCRETE : DEFAULT_METAL;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(raw ?? {})) {
    if (k in base && typeof v === typeof (base as unknown as Record<string, unknown>)[k]) out[k] = v;
  }
  return out;
}

function compute(kind: "concrete" | "metal_building", rawInputs: Record<string, unknown>, qty: Record<string, number>, cost: Record<string, number>) {
  const inputs = mergeInputs(kind, rawInputs);
  if (kind === "concrete") {
    const r = computeConcrete(inputs as unknown as typeof DEFAULT_CONCRETE);
    return { inputs, lines: applyOverrides(r.lines, qty, cost), warnings: r.warnings, summary: r };
  }
  const r = computeMetalBuilding(inputs as unknown as typeof DEFAULT_METAL);
  return { inputs, lines: applyOverrides(r.lines, qty, cost), warnings: r.warnings, summary: r };
}

const costOf = (lines: TakeoffLine[]) => lines.filter((l) => !l.info).reduce((s, l) => s + l.quantity * l.unitCost, 0);

export const takeoffRouter = router({
  list: protectedProcedure.input(z.object({ projectId: z.string().uuid() })).query(async ({ ctx, input }) => {
    if (!ctx.tenant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    await assertCanEdit(ctx, "read");
    const { db, schema } = ctx.tenant;
    const rows = await db
      .select()
      .from(schema.materialTakeoffs)
      .where(eq(schema.materialTakeoffs.projectId, input.projectId))
      .orderBy(asc(schema.materialTakeoffs.createdAt));
    return rows.map((r) => {
      const c = compute(r.kind as "concrete" | "metal_building", r.inputs, r.qtyOverrides, r.costOverrides);
      return { id: r.id, kind: r.kind, name: r.name, total: Math.round(costOf(c.lines) * 100) / 100, updatedAt: r.updatedAt };
    });
  }),

  /** Draft proposals and change orders a takeoff can be copied into. */
  targets: protectedProcedure.input(z.object({ projectId: z.string().uuid() })).query(async ({ ctx, input }) => {
    if (!ctx.tenant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    await assertCanEdit(ctx, "read");
    const { db, schema } = ctx.tenant;
    const rows = await db
      .select({ id: schema.estimates.id, name: schema.estimates.name, kind: schema.estimates.kind, revision: schema.estimates.revision })
      .from(schema.estimates)
      .where(and(eq(schema.estimates.projectId, input.projectId), eq(schema.estimates.status, "draft")))
      .orderBy(asc(schema.estimates.createdAt));
    return rows.filter((r) => r.kind === "proposal" || r.kind === "change_order");
  }),

  get: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    if (!ctx.tenant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    await assertCanEdit(ctx, "read");
    const { db, schema } = ctx.tenant;
    const [row] = await db.select().from(schema.materialTakeoffs).where(eq(schema.materialTakeoffs.id, input.id)).limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Takeoff not found" });
    return {
      id: row.id, projectId: row.projectId, kind: row.kind as "concrete" | "metal_building", name: row.name,
      inputs: mergeInputs(row.kind as "concrete" | "metal_building", row.inputs),
      qtyOverrides: row.qtyOverrides, costOverrides: row.costOverrides,
    };
  }),

  create: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), kind: kindEnum, name: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      const { db, schema } = ctx.tenant;
      await assertCanEdit(ctx);
      const [row] = await db
        .insert(schema.materialTakeoffs)
        .values({
          projectId: input.projectId, kind: input.kind, name: input.name,
          inputs: (input.kind === "concrete" ? DEFAULT_CONCRETE : DEFAULT_METAL) as unknown as Record<string, unknown>,
          createdBy: ctx.userId,
        })
        .returning({ id: schema.materialTakeoffs.id });
      return row;
    }),

  save: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(200),
      inputs: z.record(z.string().max(40), z.union([num, z.string().max(20), z.boolean()])),
      qtyOverrides: overrideMap,
      costOverrides: overrideMap,
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      const { db, schema } = ctx.tenant;
      await assertCanEdit(ctx);
      const [row] = await db.select().from(schema.materialTakeoffs).where(eq(schema.materialTakeoffs.id, input.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Takeoff not found" });
      const inputs = mergeInputs(row.kind as "concrete" | "metal_building", input.inputs);
      await db
        .update(schema.materialTakeoffs)
        .set({ name: input.name, inputs, qtyOverrides: input.qtyOverrides, costOverrides: input.costOverrides, updatedAt: new Date() })
        .where(eq(schema.materialTakeoffs.id, input.id));
      return { ok: true as const };
    }),

  remove: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    if (!ctx.tenant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    const { db, schema } = ctx.tenant;
    await assertCanEdit(ctx);
    await db.delete(schema.materialTakeoffs).where(eq(schema.materialTakeoffs.id, input.id));
    return { ok: true as const };
  }),

  /**
   * Copy the priced material list into a proposal (or change order) as a new parent line.
   * "itemized" keeps every material as a hidden child line (the customer sees one price);
   * "single" adds one lump-sum line. Locked proposals are refused.
   */
  addToProposal: protectedProcedure
    .input(z.object({
      takeoffId: z.string().uuid(),
      estimateId: z.string().uuid(),
      mode: z.enum(["itemized", "single"]).default("itemized"),
      marginPercent: z.number().min(0).lt(100).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      const { db, schema } = ctx.tenant;
      await assertCanEdit(ctx);
      const [row] = await db.select().from(schema.materialTakeoffs).where(eq(schema.materialTakeoffs.id, input.takeoffId)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Takeoff not found" });
      const [est] = await db.select().from(schema.estimates).where(eq(schema.estimates.id, input.estimateId)).limit(1);
      if (!est) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found" });
      if (est.projectId !== row.projectId) throw new TRPCError({ code: "BAD_REQUEST", message: "The proposal belongs to a different project." });
      if (["submitted", "accepted", "under_contract"].includes(est.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That proposal is sent or accepted and locked. Add the materials to a draft or revision." });
      }
      const lines = compute(row.kind as "concrete" | "metal_building", row.inputs, row.qtyOverrides, row.costOverrides).lines.filter((l) => !l.info && l.quantity > 0);
      if (lines.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "There is nothing to copy yet." });
      const [{ top }] = await db
        .select({ top: max(schema.proposalCostLines.sortOrder) })
        .from(schema.proposalCostLines)
        .where(eq(schema.proposalCostLines.estimateId, input.estimateId));
      let order = (top ?? -1) + 1;
      const parentId = randomUUID();
      const m = String(input.marginPercent);
      const base = { estimateId: input.estimateId, marginPercent: m, contingencyPercent: "0", visibility: "hidden" };
      const parentLabel = `${row.name} (materials)`;
      const total = Math.round(costOf(lines) * 100) / 100;
      const rows =
        input.mode === "single"
          ? [{ ...base, id: parentId, parentId: null, type: "material", name: parentLabel, quantity: "1", unit: "ls", unitCost: String(total), visibility: "price", sortOrder: order }]
          : [
              { ...base, id: parentId, parentId: null, type: "other", name: parentLabel, quantity: "0", unit: "ls", unitCost: "0", visibility: "price", sortOrder: order++ },
              ...lines.map((l) => ({
                ...base, id: randomUUID(), parentId, type: l.type, name: l.name, quantity: String(l.quantity),
                unit: l.unit, unitCost: String(l.unitCost), sortOrder: order++,
                notes: `From takeoff: ${row.name}`,
              })),
            ];
      await db.insert(schema.proposalCostLines).values(rows as never);
      await db.update(schema.estimates).set({ updatedAt: new Date() }).where(eq(schema.estimates.id, input.estimateId));
      return { added: rows.length, total };
    }),
});

async function assertCanEdit(ctx: { tenant: unknown; userId: string | null; orgRole: string | null }, action: "update" | "read" = "update") {
  const t = ctx.tenant as NonNullable<Awaited<ReturnType<typeof import("../../tenant/context.js").buildTenantContext>>>;
  const memberships = await t.db
    .select({ projectId: t.schema.projectTeamMembers.projectId, role: t.schema.projectTeamMembers.role })
    .from(t.schema.projectTeamMembers)
    .where(eq(t.schema.projectTeamMembers.userId, ctx.userId ?? ""));
  ForbiddenError.from(defineAbilitiesFor(ctx.orgRole ?? "org:member", ctx.userId ?? "", memberships)).throwUnlessCan(action, "Estimate");
}
