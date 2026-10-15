import { z } from "zod";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, max } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";
import {
  DEFAULT_CONCRETE,
  DEFAULT_METAL,
  computeConcrete,
  computeMetalBuilding,
  applyOverrides,
  nextOrderNumber,
  AuditAction,
  type TakeoffLine,
} from "@construction/shared";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { createAuditLog } from "../../audit/logger.js";

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
      vendorAssignments: row.vendorAssignments ?? {},
    };
  }),

  /** Lines of this takeoff that are already on a purchase order, and the orders that hold them. */
  orders: protectedProcedure.input(z.object({ takeoffId: z.string().uuid() })).query(async ({ ctx, input }) => {
    if (!ctx.tenant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    await assertCanEdit(ctx, "read");
    const { db, schema } = ctx.tenant;
    const rows = await db
      .select({
        key: schema.orderLines.takeoffKey, cost: schema.orderLines.projectedCost, orderId: schema.orders.id,
        number: schema.orders.number, status: schema.orders.status, vendorId: schema.orders.vendorId,
      })
      .from(schema.orderLines)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderLines.orderId))
      .where(eq(schema.orderLines.takeoffId, input.takeoffId));
    const vendorIds = Array.from(new Set(rows.map((r) => r.vendorId).filter((v): v is string => !!v)));
    const vendors = vendorIds.length
      ? await db.select({ id: schema.subcontractorDirectory.id, name: schema.subcontractorDirectory.companyName }).from(schema.subcontractorDirectory).where(inArray(schema.subcontractorDirectory.id, vendorIds))
      : [];
    const vname = new Map(vendors.map((v) => [v.id, v.name]));
    const byKey: Record<string, { orderId: string; number: string }> = {};
    const byOrder = new Map<string, { orderId: string; number: string; status: string; vendor: string | null; lines: number; total: number }>();
    for (const r of rows) {
      if (r.key) byKey[r.key] = { orderId: r.orderId, number: r.number };
      const o = byOrder.get(r.orderId) ?? { orderId: r.orderId, number: r.number, status: r.status, vendor: r.vendorId ? vname.get(r.vendorId) ?? null : null, lines: 0, total: 0 };
      o.lines += 1;
      o.total += Number(r.cost);
      byOrder.set(r.orderId, o);
    }
    return { byKey, orders: Array.from(byOrder.values()).map((o) => ({ ...o, total: Math.round(o.total * 100) / 100 })) };
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
      vendorAssignments: z.record(z.string().max(60), z.string().uuid()).refine((m) => Object.keys(m).length <= 200).optional(),
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
        .set({ name: input.name, inputs, qtyOverrides: input.qtyOverrides, costOverrides: input.costOverrides, ...(input.vendorAssignments ? { vendorAssignments: input.vendorAssignments } : {}), updatedAt: new Date() })
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
   * Turn the material and equipment lines into draft purchase orders, one per vendor (lines with no vendor
   * go on one unassigned draft). Lines already on an order are skipped, so running it again after a change
   * only adds what is new. Labor and subcontract lines are left for work orders. Budget is 0 (these were not
   * on an accepted proposal); projected is the takeoff cost.
   */
  createPurchaseOrders: protectedProcedure
    .input(z.object({ takeoffId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      const { db, schema } = ctx.tenant;
      await assertCanEdit(ctx);
      const [row] = await db.select().from(schema.materialTakeoffs).where(eq(schema.materialTakeoffs.id, input.takeoffId)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Takeoff not found" });
      const [proj] = await db.select({ jobNumber: schema.projects.jobNumber }).from(schema.projects).where(eq(schema.projects.id, row.projectId));
      const all = compute(row.kind as "concrete" | "metal_building", row.inputs, row.qtyOverrides, row.costOverrides).lines.filter((l) => !l.info && l.quantity > 0);
      const orderable = all.filter((l) => l.type === "material" || l.type === "equipment");
      const skippedOther = all.length - orderable.length;
      const existing = await db
        .select({ key: schema.orderLines.takeoffKey, orderId: schema.orderLines.orderId })
        .from(schema.orderLines)
        .where(eq(schema.orderLines.takeoffId, row.id));
      const already = new Set(existing.map((e) => e.key));
      const fresh = orderable.filter((l) => !already.has(l.key));
      if (fresh.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: orderable.length === 0 ? "There is nothing to order yet." : "Every material on this takeoff is already on a purchase order." });
      }
      // Only vendors that still exist and are active.
      const assigned = Array.from(new Set(Object.values(row.vendorAssignments ?? {})));
      const validVendors = assigned.length
        ? await db.select({ id: schema.subcontractorDirectory.id, name: schema.subcontractorDirectory.companyName, status: schema.subcontractorDirectory.status }).from(schema.subcontractorDirectory).where(inArray(schema.subcontractorDirectory.id, assigned))
        : [];
      const vendorName = new Map(validVendors.filter((v) => v.status === "active").map((v) => [v.id, v.name]));
      const groups = new Map<string, TakeoffLine[]>(); // "" = unassigned
      for (const l of fresh) {
        const v = row.vendorAssignments?.[l.key];
        const k = v && vendorName.has(v) ? v : "";
        groups.set(k, [...(groups.get(k) ?? []), l]);
      }
      // Draft orders from this takeoff that can take more lines.
      const draftIds = Array.from(new Set(existing.map((e) => e.orderId)));
      const drafts = draftIds.length
        ? await db.select({ id: schema.orders.id, vendorId: schema.orders.vendorId, status: schema.orders.status, number: schema.orders.number }).from(schema.orders).where(inArray(schema.orders.id, draftIds))
        : [];
      const results: { orderId: string; number: string; vendor: string | null; lines: number; total: number; added: boolean }[] = [];
      for (const [vendorId, lines] of groups) {
        let target = drafts.find((d) => d.status === "draft" && (d.vendorId ?? "") === vendorId);
        let created = false;
        if (!target) {
          const used = await db.select({ number: schema.orders.number }).from(schema.orders).where(eq(schema.orders.projectId, row.projectId));
          const number = nextOrderNumber(used.map((u) => u.number), "PO", proj?.jobNumber ?? null);
          const [o] = await db
            .insert(schema.orders)
            .values({ projectId: row.projectId, estimateId: null, kind: "purchase", number, vendorId: vendorId || null, status: "draft", notes: `From takeoff: ${row.name}`, createdBy: ctx.userId })
            .returning({ id: schema.orders.id, number: schema.orders.number, vendorId: schema.orders.vendorId, status: schema.orders.status });
          target = o;
          created = true;
          await createAuditLog(db, schema, { entityType: "Order", entityId: o.id, action: AuditAction.CREATE, actorId: ctx.userId, changes: { after: { number, fromTakeoff: row.name } } });
        }
        const current = await db.select({ id: schema.orderLines.id }).from(schema.orderLines).where(eq(schema.orderLines.orderId, target.id));
        let sort = current.length;
        let total = 0;
        const values = lines.map((l) => {
          const amount = Math.round(l.quantity * l.unitCost * 100) / 100;
          total += amount;
          return {
            orderId: target!.id, sourceLineId: null,
            description: `${l.name} — ${l.quantity} ${l.unit} @ ${l.unitCost.toFixed(2)}`,
            category: l.type === "equipment" ? "COGS: Equipment Rental" : "COGS: Materials & Supplies",
            budgetCost: "0", projectedCost: String(amount), takeoffId: row.id, takeoffKey: l.key, sortOrder: sort++,
          };
        });
        await db.insert(schema.orderLines).values(values as never);
        await db.update(schema.orders).set({ updatedAt: new Date() }).where(eq(schema.orders.id, target.id));
        results.push({ orderId: target.id, number: target.number, vendor: vendorId ? vendorName.get(vendorId) ?? null : null, lines: lines.length, total: Math.round(total * 100) / 100, added: !created });
      }
      return { orders: results, skippedOther, alreadyOrdered: orderable.length - fresh.length };
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
