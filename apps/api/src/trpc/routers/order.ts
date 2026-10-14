import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { createAuditLog } from "../../audit/logger.js";
import { companyContactLines } from "../../services/companyContact.js";
import {
  AuditAction,
  insuranceStatus,
  insuranceMessage,
  isEditable,
  canRevise,
  issueBlockers,
  moveBlockers,
  nextOrderNumber,
  statusAfterPayments,
  countsAsIssued,
} from "@construction/shared";

/**
 * Purchase and work orders: review the drafts created at acceptance, issue them, and revise issued
 * orders. Money is stored as numeric dollars and returned as numbers (dollars).
 *
 * Rules (see packages/shared orderRules):
 * - Only drafts are edited. Issued orders lock.
 * - Issue needs a vendor and at least one line, and records a snapshot.
 * - Revising an issued order reopens it as a draft with revision + 1; earlier snapshots are kept.
 * - Lines move between drafts of the same kind; a moved line can start a new order (split).
 * - Budget never changes. Projected is editable. Insurance problems only warn.
 */

type Ctx = {
  tenant: NonNullable<Awaited<ReturnType<typeof import("../../tenant/context.js").buildTenantContext>>>;
  userId: string;
  orgRole: string | null;
};

function need(ctx: { tenant?: Ctx["tenant"] | null; userId?: string | null; orgRole?: string | null }): Ctx {
  if (!ctx.tenant || !ctx.userId) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
  }
  return { tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole ?? null };
}

async function can(c: Ctx, action: "read" | "update") {
  const memberships = await c.tenant.db
    .select({
      projectId: c.tenant.schema.projectTeamMembers.projectId,
      role: c.tenant.schema.projectTeamMembers.role,
    })
    .from(c.tenant.schema.projectTeamMembers)
    .where(eq(c.tenant.schema.projectTeamMembers.userId, c.userId));
  const abilities = defineAbilitiesFor(c.orgRole ?? "org:member", c.userId, memberships);
  ForbiddenError.from(abilities).throwUnlessCan(action, "Estimate");
}

const dateText = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

async function loadOrder(c: Ctx, orderId: string) {
  const { db, schema } = c.tenant;
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
  if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
  return order;
}

function mustBeDraft(status: string) {
  if (!isEditable(status)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "This order is issued and locked. Revise it to make changes." });
  }
}

async function vendorInfo(c: Ctx, vendorIds: string[]) {
  const { db, schema } = c.tenant;
  if (vendorIds.length === 0) return new Map<string, { name: string; kind: string; insuranceExpiresAt: Date | null; paymentTerms: string | null; w9OnFile: boolean }>();
  const rows = await db
    .select({
      id: schema.subcontractorDirectory.id,
      name: schema.subcontractorDirectory.companyName,
      kind: schema.subcontractorDirectory.kind,
      insuranceExpiresAt: schema.subcontractorDirectory.insuranceExpiresAt,
      paymentTerms: schema.subcontractorDirectory.paymentTerms,
      w9OnFile: schema.subcontractorDirectory.w9OnFile,
    })
    .from(schema.subcontractorDirectory)
    .where(inArray(schema.subcontractorDirectory.id, vendorIds));
  return new Map(rows.map((r) => [r.id, r]));
}

function insuranceFor(kind: string, expiresAt: Date | null | undefined, hasVendor: boolean) {
  if (kind !== "work" || !hasVendor) return { status: null as null, message: null as string | null };
  const status = insuranceStatus(expiresAt ?? null);
  return { status, message: insuranceMessage(status) };
}

async function orderSnapshot(c: Ctx, orderId: string) {
  const { db, schema } = c.tenant;
  const order = await loadOrder(c, orderId);
  const lines = await db.select().from(schema.orderLines).where(eq(schema.orderLines.orderId, orderId)).orderBy(asc(schema.orderLines.sortOrder));
  const vendors = await vendorInfo(c, order.vendorId ? [order.vendorId] : []);
  return {
    number: order.number,
    kind: order.kind,
    revision: order.revision,
    vendorId: order.vendorId,
    vendorName: order.vendorId ? (vendors.get(order.vendorId)?.name ?? null) : null,
    orderDate: order.orderDate,
    deliveryDate: order.deliveryDate,
    shipTo: order.shipTo,
    shipping: order.shipping,
    startDate: order.startDate,
    finishDate: order.finishDate,
    paymentTerms: order.paymentTerms,
    insuranceRequired: order.insuranceRequired,
    lienWaiverRequired: order.lienWaiverRequired,
    notes: order.notes,
    lines: lines.map((l) => ({
      id: l.id,
      sourceLineId: l.sourceLineId,
      description: l.description,
      category: l.category,
      budgetCost: Number(l.budgetCost),
      projectedCost: Number(l.projectedCost),
      exclusions: l.exclusions,
    })),
    budgetTotal: lines.reduce((a, l) => a + Number(l.budgetCost), 0),
    projectedTotal: lines.reduce((a, l) => a + Number(l.projectedCost), 0),
  };
}

function mapLine(l: {
  id: string;
  description: string;
  category: string | null;
  budgetCost: string;
  projectedCost: string;
  exclusions: string | null;
}) {
  return {
    id: l.id,
    description: l.description,
    category: l.category,
    budgetCost: Number(l.budgetCost),
    projectedCost: Number(l.projectedCost),
    exclusions: l.exclusions,
  };
}

export const orderRouter = router({
  /** Orders of one kind on a project, with vendors, insurance warnings and lines (dollars). Drives the PO and WO tabs. */
  listCards: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), kind: z.enum(["purchase", "work"]) }))
    .query(async ({ ctx, input }) => {
      const c = need(ctx);
      await can(c, "read");
      const { db, schema } = c.tenant;
      const orders = await db
        .select()
        .from(schema.orders)
        .where(and(eq(schema.orders.projectId, input.projectId), eq(schema.orders.kind, input.kind)))
        .orderBy(asc(schema.orders.number));
      if (orders.length === 0) return [];

      const lines = await db
        .select()
        .from(schema.orderLines)
        .where(inArray(schema.orderLines.orderId, orders.map((o) => o.id)))
        .orderBy(asc(schema.orderLines.sortOrder));
      const pays = await db.select().from(schema.orderPayments).where(inArray(schema.orderPayments.orderId, orders.map((o) => o.id)));
      const vendors = await vendorInfo(c, [...new Set(orders.map((o) => o.vendorId).filter((v): v is string => !!v))]);

      return orders.map((o) => {
        const ol = lines.filter((l) => l.orderId === o.id).map(mapLine);
        const v = o.vendorId ? vendors.get(o.vendorId) : undefined;
        const paid = pays.filter((p) => p.orderId === o.id).reduce((a, p) => a + Number(p.amount), 0);
        const projectedTotal = ol.reduce((a, l) => a + l.projectedCost, 0);
        return {
          id: o.id,
          kind: o.kind as "purchase" | "work",
          number: o.number,
          status: o.status,
          revision: o.revision,
          vendorId: o.vendorId,
          vendorName: o.vendorId ? (v?.name ?? "Unknown vendor") : null,
          insurance: insuranceFor(o.kind, v?.insuranceExpiresAt, !!o.vendorId),
          fromProposal: o.estimateId !== null,
          budgetTotal: ol.reduce((a, l) => a + l.budgetCost, 0),
          projectedTotal,
          paid,
          outstanding: countsAsIssued(o.status) ? Math.max(projectedTotal - paid, 0) : null,
          lines: ol,
        };
      });
    }),

  /** One order with its details, vendor, lines and revision history. */
  get: protectedProcedure.input(z.object({ orderId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const c = need(ctx);
    await can(c, "read");
    const { db, schema } = c.tenant;
    const order = await loadOrder(c, input.orderId);
    const lines = await db
      .select()
      .from(schema.orderLines)
      .where(eq(schema.orderLines.orderId, order.id))
      .orderBy(asc(schema.orderLines.sortOrder));
    const vendors = await vendorInfo(c, order.vendorId ? [order.vendorId] : []);
    const v = order.vendorId ? vendors.get(order.vendorId) : undefined;
    const [proj] = await db
      .select({ name: schema.projects.name, jobNumber: schema.projects.jobNumber })
      .from(schema.projects)
      .where(eq(schema.projects.id, order.projectId));
    const [est] = order.estimateId
      ? await db
          .select({ slug: schema.estimates.slug, name: schema.estimates.name })
          .from(schema.estimates)
          .where(eq(schema.estimates.id, order.estimateId))
      : [];
    const payments = await db
      .select()
      .from(schema.orderPayments)
      .where(eq(schema.orderPayments.orderId, order.id))
      .orderBy(desc(schema.orderPayments.paidAt), desc(schema.orderPayments.createdAt));
    const revisions = await db
      .select({
        id: schema.orderRevisions.id,
        revision: schema.orderRevisions.revision,
        reason: schema.orderRevisions.reason,
        createdAt: schema.orderRevisions.createdAt,
        snapshot: schema.orderRevisions.snapshot,
      })
      .from(schema.orderRevisions)
      .where(eq(schema.orderRevisions.orderId, order.id))
      .orderBy(desc(schema.orderRevisions.revision));
    const mapped = lines.map(mapLine);
    return {
      order: {
        id: order.id,
        projectId: order.projectId,
        estimateId: order.estimateId,
        kind: order.kind as "purchase" | "work",
        number: order.number,
        status: order.status,
        revision: order.revision,
        issuedAt: order.issuedAt,
        vendorId: order.vendorId,
        orderDate: order.orderDate,
        deliveryDate: order.deliveryDate,
        shipTo: order.shipTo,
        shipping: order.shipping,
        startDate: order.startDate,
        finishDate: order.finishDate,
        paymentTerms: order.paymentTerms,
        insuranceRequired: order.insuranceRequired,
        lienWaiverRequired: order.lienWaiverRequired,
        notes: order.notes,
      },
      project: proj ?? null,
      companyName: c.tenant.companyName,
      companyContact: await companyContactLines(c.tenant),
      estimate: est ?? null,
      vendor: v ? { id: order.vendorId as string, name: v.name, paymentTerms: v.paymentTerms, w9OnFile: v.w9OnFile } : null,
      insurance: insuranceFor(order.kind, v?.insuranceExpiresAt, !!order.vendorId),
      lines: mapped.map((l, i) => ({ ...l, manual: lines[i].sourceLineId === null })),
      budgetTotal: mapped.reduce((a, l) => a + l.budgetCost, 0),
      projectedTotal: mapped.reduce((a, l) => a + l.projectedCost, 0),
      payments: payments.map((p) => ({ id: p.id, amount: Number(p.amount), paidAt: p.paidAt, reference: p.reference })),
      paid: payments.reduce((a, p) => a + Number(p.amount), 0),
      fromProposal: order.estimateId !== null,
      blockers: issueBlockers({ status: order.status, vendorId: order.vendorId, lineCount: lines.length }),
      canEdit: isEditable(order.status),
      canRevise: canRevise(order.status),
      revisions: revisions.map((r) => ({ id: r.id, revision: r.revision, reason: r.reason, createdAt: r.createdAt })),
    };
  }),

  /** Active vendors for the vendor picker, with insurance status for work orders. */
  vendorOptions: protectedProcedure.query(async ({ ctx }) => {
    const c = need(ctx);
    await can(c, "read");
    const { db, schema } = c.tenant;
    const rows = await db
      .select({
        id: schema.subcontractorDirectory.id,
        name: schema.subcontractorDirectory.companyName,
        kind: schema.subcontractorDirectory.kind,
        status: schema.subcontractorDirectory.status,
        insuranceExpiresAt: schema.subcontractorDirectory.insuranceExpiresAt,
      })
      .from(schema.subcontractorDirectory)
      .orderBy(asc(schema.subcontractorDirectory.companyName));
    return rows
      .filter((r) => r.status === "active")
      .map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind as "subcontractor" | "supplier",
        insurance: insuranceStatus(r.insuranceExpiresAt),
      }));
  }),

  /** Change the vendor and details of a draft order. Omitted fields are left alone. */
  update: protectedProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        vendorId: z.string().uuid().nullable().optional(),
        orderDate: dateText.optional(),
        deliveryDate: dateText.optional(),
        shipTo: z.string().max(500).nullable().optional(),
        shipping: z.enum(["delivered", "will_call"]).nullable().optional(),
        startDate: dateText.optional(),
        finishDate: dateText.optional(),
        paymentTerms: z.string().max(100).nullable().optional(),
        insuranceRequired: z.boolean().optional(),
        lienWaiverRequired: z.boolean().optional(),
        notes: z.string().max(10000).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const c = need(ctx);
      await can(c, "update");
      const { db, schema } = c.tenant;
      const order = await loadOrder(c, input.orderId);
      mustBeDraft(order.status);
      const { orderId, ...rest } = input;
      if (rest.vendorId) {
        const vendors = await vendorInfo(c, [rest.vendorId]);
        if (!vendors.has(rest.vendorId)) throw new TRPCError({ code: "BAD_REQUEST", message: "That vendor was not found." });
      }
      const values: Record<string, unknown> = { updatedAt: new Date() };
      for (const [k, val] of Object.entries(rest)) if (val !== undefined) values[k] = val;
      await db.update(schema.orders).set(values).where(eq(schema.orders.id, orderId));
      return { id: orderId };
    }),

  /** Edit one line of a draft order. Budget is never editable. Exclusions are for work orders. */
  updateLine: protectedProcedure
    .input(
      z.object({
        lineId: z.string().uuid(),
        projectedCost: z.number().min(0).max(1e9).optional(),
        exclusions: z.string().max(5000).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const c = need(ctx);
      await can(c, "update");
      const { db, schema } = c.tenant;
      const [line] = await db.select().from(schema.orderLines).where(eq(schema.orderLines.id, input.lineId));
      if (!line) throw new TRPCError({ code: "NOT_FOUND", message: "Line not found." });
      const order = await loadOrder(c, line.orderId);
      mustBeDraft(order.status);
      const values: Record<string, unknown> = {};
      if (input.projectedCost !== undefined) values.projectedCost = String(Math.round(input.projectedCost * 100) / 100);
      if (input.exclusions !== undefined) {
        if (order.kind !== "work") throw new TRPCError({ code: "BAD_REQUEST", message: "Exclusions are only for work orders." });
        values.exclusions = input.exclusions;
      }
      if (Object.keys(values).length === 0) return { id: line.id };
      await db.update(schema.orderLines).set(values).where(eq(schema.orderLines.id, line.id));
      await db.update(schema.orders).set({ updatedAt: new Date() }).where(eq(schema.orders.id, order.id));
      return { id: line.id };
    }),

  /**
   * Move lines to another draft order of the same kind, or to a new order when toOrderId is
   * omitted (split). The source keeps at least one line when splitting; the new order starts with
   * no vendor and no revision history. Budget stays on each line.
   */
  moveLines: protectedProcedure
    .input(
      z.object({
        lineIds: z.array(z.string().uuid()).min(1),
        toOrderId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const c = need(ctx);
      await can(c, "update");
      const { db, schema } = c.tenant;
      const lines = await db.select().from(schema.orderLines).where(inArray(schema.orderLines.id, input.lineIds));
      if (lines.length !== new Set(input.lineIds).size) throw new TRPCError({ code: "NOT_FOUND", message: "Line not found." });
      const fromId = lines[0].orderId;
      if (lines.some((l) => l.orderId !== fromId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Pick lines from one order." });
      }
      const from = await loadOrder(c, fromId);
      const to = input.toOrderId ? await loadOrder(c, input.toOrderId) : null;
      if (to && to.id === from.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Pick a different order." });
      const problems = moveBlockers(from, to);
      if (problems.length > 0) throw new TRPCError({ code: "BAD_REQUEST", message: problems[0] });

      const remaining = await db.select({ id: schema.orderLines.id }).from(schema.orderLines).where(eq(schema.orderLines.orderId, from.id));
      if (!to && remaining.length === lines.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Leave at least one line on this order, or change its vendor instead." });
      }

      return db.transaction(async (tx) => {
        let target = to;
        if (!target) {
          const [proj] = await tx.select({ jobNumber: schema.projects.jobNumber }).from(schema.projects).where(eq(schema.projects.id, from.projectId));
          const used = await tx.select({ number: schema.orders.number }).from(schema.orders).where(eq(schema.orders.projectId, from.projectId));
          const number = nextOrderNumber(used.map((u) => u.number), from.kind === "purchase" ? "PO" : "WO", proj?.jobNumber ?? null);
          [target] = await tx
            .insert(schema.orders)
            .values({
              projectId: from.projectId,
              estimateId: from.estimateId,
              kind: from.kind,
              number,
              vendorId: null,
              status: "draft",
              paymentTerms: from.paymentTerms,
              insuranceRequired: from.insuranceRequired,
              lienWaiverRequired: from.lienWaiverRequired,
              createdBy: c.userId,
            })
            .returning();
        }
        const existing = await tx.select({ id: schema.orderLines.id }).from(schema.orderLines).where(eq(schema.orderLines.orderId, target.id));
        let sort = existing.length;
        for (const l of [...lines].sort((a, b) => a.sortOrder - b.sortOrder)) {
          await tx.update(schema.orderLines).set({ orderId: target.id, sortOrder: sort++ }).where(eq(schema.orderLines.id, l.id));
        }
        const now = new Date();
        await tx.update(schema.orders).set({ updatedAt: now }).where(inArray(schema.orders.id, [from.id, target.id]));
        return { orderId: target.id, number: target.number };
      }).then(async (r) => {
        await createAuditLog(db, schema, {
          entityType: "Order",
          entityId: from.id,
          action: AuditAction.UPDATE,
          actorId: c.userId,
          changes: { before: { orderId: from.id }, after: { movedLineIds: input.lineIds, toOrderId: r.orderId, toNumber: r.number } },
        });
        return r;
      });
    }),

  /** Merge a draft order into another draft of the same kind. The merged order is deleted. */
  merge: protectedProcedure
    .input(z.object({ fromOrderId: z.string().uuid(), intoOrderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const c = need(ctx);
      await can(c, "update");
      const { db, schema } = c.tenant;
      const from = await loadOrder(c, input.fromOrderId);
      const into = await loadOrder(c, input.intoOrderId);
      if (from.id === into.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Pick a different order." });
      const problems = moveBlockers(from, into);
      if (problems.length > 0) throw new TRPCError({ code: "BAD_REQUEST", message: problems[0] });
      const history = await db.select({ id: schema.orderRevisions.id }).from(schema.orderRevisions).where(eq(schema.orderRevisions.orderId, from.id)).limit(1);
      if (history.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This order was issued before, so its history is kept. Move its lines instead." });
      }
      await db.transaction(async (tx) => {
        const existing = await tx.select({ id: schema.orderLines.id }).from(schema.orderLines).where(eq(schema.orderLines.orderId, into.id));
        const moving = await tx.select().from(schema.orderLines).where(eq(schema.orderLines.orderId, from.id)).orderBy(asc(schema.orderLines.sortOrder));
        let sort = existing.length;
        for (const l of moving) {
          await tx.update(schema.orderLines).set({ orderId: into.id, sortOrder: sort++ }).where(eq(schema.orderLines.id, l.id));
        }
        await tx.delete(schema.orders).where(eq(schema.orders.id, from.id));
        await tx.update(schema.orders).set({ updatedAt: new Date() }).where(eq(schema.orders.id, into.id));
      });
      await createAuditLog(db, schema, {
        entityType: "Order",
        entityId: into.id,
        action: AuditAction.UPDATE,
        actorId: c.userId,
        changes: { before: { merged: from.number }, after: { into: into.number } },
      });
      return { orderId: into.id };
    }),

  /** Issue a draft order: needs a vendor and lines. Records a snapshot and locks the order. */
  issue: protectedProcedure
    .input(z.object({ orderId: z.string().uuid(), reason: z.string().max(1000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const c = need(ctx);
      await can(c, "update");
      const { db, schema } = c.tenant;
      const order = await loadOrder(c, input.orderId);
      const lineRows = await db.select({ id: schema.orderLines.id }).from(schema.orderLines).where(eq(schema.orderLines.orderId, order.id));
      const count = lineRows.length;
      const blockers = issueBlockers({ status: order.status, vendorId: order.vendorId, lineCount: count });
      if (blockers.length > 0) throw new TRPCError({ code: "BAD_REQUEST", message: blockers.join(" ") });

      const snapshot = await orderSnapshot(c, order.id);
      const now = new Date();
      await db.transaction(async (tx) => {
        await tx.insert(schema.orderRevisions).values({
          orderId: order.id,
          revision: order.revision,
          snapshot,
          reason: input.reason ?? (order.revision === 0 ? "Issued" : null),
          createdBy: c.userId,
        });
        const paidRows = await tx.select({ amount: schema.orderPayments.amount }).from(schema.orderPayments).where(eq(schema.orderPayments.orderId, order.id));
        const paid = paidRows.reduce((a, r) => a + Number(r.amount), 0);
        const projected = snapshot.projectedTotal;
        await tx.update(schema.orders).set({ status: statusAfterPayments(paid, projected), issuedAt: now, updatedAt: now }).where(eq(schema.orders.id, order.id));
      });
      await createAuditLog(db, schema, {
        entityType: "Order",
        entityId: order.id,
        action: AuditAction.UPDATE,
        actorId: c.userId,
        changes: { before: { status: "draft" }, after: { status: "issued", revision: order.revision } },
      });
      return { id: order.id, revision: order.revision };
    }),

  /** Reopen an issued order as a draft with the next revision. Earlier snapshots stay on record. */
  revise: protectedProcedure.input(z.object({ orderId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const c = need(ctx);
    await can(c, "update");
    const { db, schema } = c.tenant;
    const order = await loadOrder(c, input.orderId);
    if (!canRevise(order.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Only an issued order can be revised." });
    }
    const next = order.revision + 1;
    await db.update(schema.orders).set({ status: "draft", revision: next, updatedAt: new Date() }).where(eq(schema.orders.id, order.id));
    await createAuditLog(db, schema, {
      entityType: "Order",
      entityId: order.id,
      action: AuditAction.UPDATE,
      actorId: c.userId,
      changes: { before: { status: "issued", revision: order.revision }, after: { status: "draft", revision: next } },
    });
    return { id: order.id, revision: next };
  }),

  /** Add a draft order by hand (materials missed in estimating, extra scope). No proposal link, no customer charge. */
  createManual: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), kind: z.enum(["purchase", "work"]), vendorId: z.string().uuid().nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      const c = need(ctx);
      await can(c, "update");
      const { db, schema } = c.tenant;
      const [proj] = await db.select({ jobNumber: schema.projects.jobNumber }).from(schema.projects).where(eq(schema.projects.id, input.projectId));
      if (!proj) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
      const used = await db.select({ number: schema.orders.number }).from(schema.orders).where(eq(schema.orders.projectId, input.projectId));
      const number = nextOrderNumber(used.map((u) => u.number), input.kind === "purchase" ? "PO" : "WO", proj.jobNumber ?? null);
      const [row] = await db
        .insert(schema.orders)
        .values({ projectId: input.projectId, estimateId: null, kind: input.kind, number, vendorId: input.vendorId ?? null, status: "draft", createdBy: c.userId })
        .returning({ id: schema.orders.id });
      await createAuditLog(db, schema, { entityType: "Order", entityId: row.id, action: AuditAction.CREATE, actorId: c.userId, changes: { after: { number, manual: true } } });
      return { id: row.id, number };
    }),

  /** Add a line to a draft order by hand. Budget is 0 (it was not on the proposal); projected is the expected cost. */
  addLine: protectedProcedure
    .input(z.object({ orderId: z.string().uuid(), description: z.string().min(1).max(300), projectedCost: z.number().min(0).max(1e9) }))
    .mutation(async ({ ctx, input }) => {
      const c = need(ctx);
      await can(c, "update");
      const { db, schema } = c.tenant;
      const order = await loadOrder(c, input.orderId);
      mustBeDraft(order.status);
      const existing = await db.select({ id: schema.orderLines.id }).from(schema.orderLines).where(eq(schema.orderLines.orderId, order.id));
      const category = order.kind === "purchase" ? "COGS: Materials & Supplies" : "COGS: Subcontract Labor";
      const [row] = await db
        .insert(schema.orderLines)
        .values({
          orderId: order.id,
          sourceLineId: null,
          description: input.description.trim(),
          category,
          budgetCost: "0",
          projectedCost: String(Math.round(input.projectedCost * 100) / 100),
          sortOrder: existing.length,
        })
        .returning({ id: schema.orderLines.id });
      await db.update(schema.orders).set({ updatedAt: new Date() }).where(eq(schema.orders.id, order.id));
      return { id: row.id };
    }),

  /** Remove a line that was added by hand from a draft order. Lines from the proposal stay. */
  removeLine: protectedProcedure.input(z.object({ lineId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const c = need(ctx);
    await can(c, "update");
    const { db, schema } = c.tenant;
    const [line] = await db.select().from(schema.orderLines).where(eq(schema.orderLines.id, input.lineId));
    if (!line) throw new TRPCError({ code: "NOT_FOUND", message: "Line not found." });
    const order = await loadOrder(c, line.orderId);
    mustBeDraft(order.status);
    if (line.sourceLineId !== null) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Lines from the proposal cannot be deleted. Move them to another order instead." });
    }
    await db.delete(schema.orderLines).where(eq(schema.orderLines.id, line.id));
    return { id: line.id };
  }),

  /** Record a payment against an issued order. Cannot exceed the order's projected cost. */
  recordPayment: protectedProcedure
    .input(z.object({ orderId: z.string().uuid(), amount: z.number().gt(0).max(1e9), paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reference: z.string().max(200).nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      const c = need(ctx);
      await can(c, "update");
      const { db, schema } = c.tenant;
      const order = await loadOrder(c, input.orderId);
      if (!countsAsIssued(order.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Issue the order before recording payments." });
      }
      const amount = Math.round(input.amount * 100) / 100;
      await db.transaction(async (tx) => {
        const lines = await tx.select({ p: schema.orderLines.projectedCost }).from(schema.orderLines).where(eq(schema.orderLines.orderId, order.id));
        const projected = lines.reduce((a, l) => a + Number(l.p), 0);
        const prior = await tx.select({ a: schema.orderPayments.amount }).from(schema.orderPayments).where(eq(schema.orderPayments.orderId, order.id));
        const paid = prior.reduce((a, r) => a + Number(r.a), 0);
        if (paid + amount > projected + 0.005) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `That is more than the ${projected.toFixed(2)} order total. Only ${(projected - paid).toFixed(2)} is outstanding.` });
        }
        await tx.insert(schema.orderPayments).values({ orderId: order.id, amount: String(amount), paidAt: input.paidAt, reference: input.reference ?? null, createdBy: c.userId });
        await tx.update(schema.orders).set({ status: statusAfterPayments(paid + amount, projected), updatedAt: new Date() }).where(eq(schema.orders.id, order.id));
      });
      await createAuditLog(db, schema, { entityType: "Order", entityId: order.id, action: AuditAction.UPDATE, actorId: c.userId, changes: { after: { payment: amount, paidAt: input.paidAt } } });
      return { id: order.id };
    }),

  /** Files attached to an order, newest first. Open them with document.getDownloadUrl. */
  attachments: protectedProcedure.input(z.object({ orderId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const c = need(ctx);
    await can(c, "read");
    const { db, schema } = c.tenant;
    const rows = await db
      .select({
        id: schema.orderDocuments.id,
        documentId: schema.documents.id,
        name: schema.documents.name,
        fileSize: schema.documents.fileSize,
        contentType: schema.documents.contentType,
        addedAt: schema.orderDocuments.createdAt,
      })
      .from(schema.orderDocuments)
      .innerJoin(schema.documents, eq(schema.documents.id, schema.orderDocuments.documentId))
      .where(eq(schema.orderDocuments.orderId, input.orderId))
      .orderBy(desc(schema.orderDocuments.createdAt));
    return rows;
  }),

  /** Attach an uploaded project document (created with document.create) to an order. */
  attachDocument: protectedProcedure
    .input(z.object({ orderId: z.string().uuid(), documentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const c = need(ctx);
      await can(c, "update");
      const { db, schema } = c.tenant;
      const order = await loadOrder(c, input.orderId);
      const [doc] = await db.select({ id: schema.documents.id, projectId: schema.documents.projectId }).from(schema.documents).where(eq(schema.documents.id, input.documentId));
      if (!doc || doc.projectId !== order.projectId) throw new TRPCError({ code: "BAD_REQUEST", message: "That file is not on this project." });
      const [row] = await db.insert(schema.orderDocuments).values({ orderId: order.id, documentId: doc.id, createdBy: c.userId }).returning({ id: schema.orderDocuments.id });
      await createAuditLog(db, schema, { entityType: "Order", entityId: order.id, action: AuditAction.UPDATE, actorId: c.userId, changes: { after: { attached: doc.id } } });
      return { id: row.id };
    }),

  /** Remove an attachment from an order. The file stays in the project's documents. */
  detachDocument: protectedProcedure.input(z.object({ attachmentId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const c = need(ctx);
    await can(c, "update");
    const { db, schema } = c.tenant;
    const [row] = await db.select().from(schema.orderDocuments).where(eq(schema.orderDocuments.id, input.attachmentId));
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Attachment not found." });
    await db.delete(schema.orderDocuments).where(eq(schema.orderDocuments.id, row.id));
    await createAuditLog(db, schema, { entityType: "Order", entityId: row.orderId, action: AuditAction.UPDATE, actorId: c.userId, changes: { before: { attached: row.documentId } } });
    return { id: row.orderId };
  }),

  /** Delete a payment entered by mistake. */
  deletePayment: protectedProcedure.input(z.object({ paymentId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const c = need(ctx);
    await can(c, "update");
    const { db, schema } = c.tenant;
    const [pay] = await db.select().from(schema.orderPayments).where(eq(schema.orderPayments.id, input.paymentId));
    if (!pay) throw new TRPCError({ code: "NOT_FOUND", message: "Payment not found." });
    const order = await loadOrder(c, pay.orderId);
    await db.transaction(async (tx) => {
      await tx.delete(schema.orderPayments).where(eq(schema.orderPayments.id, pay.id));
      if (countsAsIssued(order.status)) {
        const lines = await tx.select({ p: schema.orderLines.projectedCost }).from(schema.orderLines).where(eq(schema.orderLines.orderId, order.id));
        const projected = lines.reduce((a, l) => a + Number(l.p), 0);
        const rest = await tx.select({ a: schema.orderPayments.amount }).from(schema.orderPayments).where(eq(schema.orderPayments.orderId, order.id));
        const paid = rest.reduce((a, r) => a + Number(r.a), 0);
        await tx.update(schema.orders).set({ status: statusAfterPayments(paid, projected), updatedAt: new Date() }).where(eq(schema.orders.id, order.id));
      }
    });
    await createAuditLog(db, schema, { entityType: "Order", entityId: order.id, action: AuditAction.UPDATE, actorId: c.userId, changes: { before: { payment: Number(pay.amount) } } });
    return { id: order.id };
  }),

  /** Purchase orders or work orders for a project, with cost, paid and outstanding (dollars). */
  listForProject: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), kind: z.enum(["purchase", "work"]) }))
    .query(async ({ ctx, input }) => {
      const c = need(ctx);
      await can(c, "read");
      const { db, schema } = c.tenant;
      const orders = await db
        .select()
        .from(schema.orders)
        .where(and(eq(schema.orders.projectId, input.projectId), eq(schema.orders.kind, input.kind)))
        .orderBy(asc(schema.orders.number));
      if (orders.length === 0) return { rows: [], hasProposal: false };
      const ids = orders.map((o) => o.id);
      const lines = await db.select().from(schema.orderLines).where(inArray(schema.orderLines.orderId, ids)).orderBy(asc(schema.orderLines.sortOrder));
      const pays = await db.select().from(schema.orderPayments).where(inArray(schema.orderPayments.orderId, ids));
      const vendors = await vendorInfo(c, [...new Set(orders.map((o) => o.vendorId).filter((v): v is string => !!v))]);
      const rows = orders.map((o) => {
        const ol = lines.filter((l) => l.orderId === o.id);
        const cost = ol.reduce((a, l) => a + Number(l.projectedCost), 0);
        const paid = pays.filter((p) => p.orderId === o.id).reduce((a, p) => a + Number(p.amount), 0);
        const issued = countsAsIssued(o.status);
        return {
          id: o.id,
          number: o.number,
          status: o.status,
          revision: o.revision,
          vendorName: o.vendorId ? (vendors.get(o.vendorId)?.name ?? "Unknown vendor") : null,
          lineSummary: ol.map((l) => l.description.split(": ").pop() as string).join(", "),
          fromProposal: o.estimateId !== null,
          cost,
          paid,
          outstanding: issued ? Math.max(cost - paid, 0) : null,
        };
      });
      return { rows, hasProposal: orders.some((o) => o.estimateId !== null) };
    }),

  /**
   * Numbers for the project header and Overview: cost budget, projected cost, paid, outstanding,
   * order counts, and the cash-out rows. Billed and collected stay 0 until invoices exist.
   */
  projectSummary: protectedProcedure.input(z.object({ projectId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const c = need(ctx);
    await can(c, "read");
    const { db, schema } = c.tenant;
    const orders = await db.select().from(schema.orders).where(eq(schema.orders.projectId, input.projectId)).orderBy(asc(schema.orders.kind), asc(schema.orders.number));
    const ids = orders.map((o) => o.id);
    const lines = ids.length ? await db.select().from(schema.orderLines).where(inArray(schema.orderLines.orderId, ids)) : [];
    const pays = ids.length ? await db.select().from(schema.orderPayments).where(inArray(schema.orderPayments.orderId, ids)) : [];
    const vendors = await vendorInfo(c, [...new Set(orders.map((o) => o.vendorId).filter((v): v is string => !!v))]);
    const rows = orders.map((o) => {
      const ol = lines.filter((l) => l.orderId === o.id);
      const projected = ol.reduce((a, l) => a + Number(l.projectedCost), 0);
      const budget = ol.reduce((a, l) => a + Number(l.budgetCost), 0);
      const paid = pays.filter((p) => p.orderId === o.id).reduce((a, p) => a + Number(p.amount), 0);
      const issued = countsAsIssued(o.status);
      return {
        id: o.id,
        kind: o.kind as "purchase" | "work",
        number: o.number,
        status: o.status,
        vendorName: o.vendorId ? (vendors.get(o.vendorId)?.name ?? "Unknown vendor") : null,
        budget,
        projected,
        paid,
        outstanding: issued ? Math.max(projected - paid, 0) : 0,
        issued,
      };
    });
    const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
    return {
      costBudget: sum((r) => r.budget),
      projectedCost: sum((r) => r.projected),
      paid: sum((r) => r.paid),
      outstanding: sum((r) => r.outstanding),
      draftTotal: sum((r) => (r.issued ? 0 : r.projected)),
      purchaseCount: rows.filter((r) => r.kind === "purchase").length,
      workCount: rows.filter((r) => r.kind === "work").length,
      rows,
    };
  }),
});
