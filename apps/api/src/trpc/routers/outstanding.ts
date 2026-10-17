import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { applyReceiptToInvoice, candidateInvoices, resolveScopes, runReceiptPass, setReceiptIgnored, undoReceipt } from "../../integrations/quickbooks/receipts.js";
import { billContext, candidateOrders, linkBill, setBillIgnored, unlinkBill } from "../../integrations/quickbooks/vendorBills.js";
import { countsAsIssued, isOverdue, isSent } from "@construction/shared";

/**
 * One page of everything still owed, for reference while matching bank activity in QuickBooks:
 * sent invoices that are not fully paid (money coming in, grouped by customer) and issued purchase / work orders
 * that are not fully paid (money going out, grouped by vendor). Read-only. Amounts are dollars.
 */

const VIEW_ROLES = new Set(["org:admin", "org:project_manager", "org:accountant"]);
const ALLOCATE_ROLES = new Set(["org:admin", "org:project_manager"]);
const r2 = (n: number) => Math.round(n * 100) / 100;

function todayText() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const outstandingRouter = router({
  /**
   * Money QuickBooks says was received that still needs a person: open deposits (with the invoices each could pay)
   * and recent ones already applied (so an automatic match can be undone).
   */
  receipts: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    if (!VIEW_ROLES.has(ctx.orgRole ?? "")) throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed." });
    const { db, schema } = ctx.tenant;
    const [prof] = await db.select({ on: schema.companyProfiles.qboReadPayments, last: schema.companyProfiles.qboReceiptsLastCheckAt }).from(schema.companyProfiles).where(isNull(schema.companyProfiles.validTo)).limit(1);
    const since = new Date(Date.now() - 30 * 86400000);
    const rows = await db
      .select()
      .from(schema.qboReceipts)
      .where(and(inArray(schema.qboReceipts.status, ["open", "applied", "ignored"]), gte(schema.qboReceipts.updatedAt, since)))
      .orderBy(desc(schema.qboReceipts.txnDate));
    const relevant = rows.filter((r) => r.qboCustomerId);
    const scopes = await resolveScopes(ctx.tenant, [...new Set(relevant.map((r) => r.qboCustomerId as string))]);
    const customerRows = await db.select({ id: schema.customers.id, companyName: schema.customers.companyName, contactName: schema.customers.contactName }).from(schema.customers);
    const cname = new Map(customerRows.map((c) => [c.id, c.companyName || c.contactName]));
    const allocs = relevant.length ? await db.select().from(schema.qboReceiptAllocations).where(inArray(schema.qboReceiptAllocations.receiptId, relevant.map((r) => r.id))) : [];
    const invIds = [...new Set(allocs.map((a) => a.invoiceId))];
    const invRows = invIds.length ? await db.select({ id: schema.invoices.id, number: schema.invoices.number, projectId: schema.invoices.projectId }).from(schema.invoices).where(inArray(schema.invoices.id, invIds)) : [];
    const invById = new Map(invRows.map((i) => [i.id, i]));

    const out = [];
    for (const r of relevant) {
      const scope = scopes.get(r.qboCustomerId as string);
      if (!scope) continue;
      const mine = allocs.filter((a) => a.receiptId === r.id);
      const applied = r2(mine.reduce((a, x) => a + Number(x.amount), 0));
      out.push({
        id: r.id,
        status: r.status,
        txnDate: r.txnDate,
        amount: Number(r.amount),
        remaining: r2(Number(r.amount) - applied),
        qboType: r.qboType,
        qboCustomerName: r.qboCustomerName,
        customerName: scope.customerId ? cname.get(scope.customerId) ?? null : null,
        customerId: scope.customerId,
        memo: r.memo,
        reference: r.reference,
        auto: mine.length > 0 && mine.every((a) => a.source === "auto"),
        applications: mine.map((a) => ({ invoiceId: a.invoiceId, number: invById.get(a.invoiceId)?.number ?? "", amount: Number(a.amount), source: a.source })),
        candidates: r.status === "open" ? await candidateInvoices(ctx.tenant, scope, r.txnDate) : [],
      });
    }
    return { enabled: Boolean(prof?.on), lastCheckAt: prof?.last ?? null, receipts: out };
  }),

  /** Look in QuickBooks now instead of waiting for the next scheduled check. */
  checkReceiptsNow: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    if (!ALLOCATE_ROLES.has(ctx.orgRole ?? "")) throw new TRPCError({ code: "FORBIDDEN", message: "Only owners, administrators and project managers can do this." });
    try {
      return await runReceiptPass(ctx.tenant);
    } catch (e) {
      throw new TRPCError({ code: "BAD_REQUEST", message: e instanceof Error ? e.message : "Could not read from QuickBooks." });
    }
  }),

  /** Apply part or all of a QuickBooks deposit to one or more invoices. */
  allocateReceipt: protectedProcedure
    .input(z.object({ receiptId: z.string().uuid(), allocations: z.array(z.object({ invoiceId: z.string().uuid(), amount: z.number().gt(0).max(1e10) })).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      if (!ALLOCATE_ROLES.has(ctx.orgRole ?? "")) throw new TRPCError({ code: "FORBIDDEN", message: "Only owners, administrators and project managers can allocate deposits." });
      for (const a of input.allocations) {
        await applyReceiptToInvoice(ctx.tenant, { receiptId: input.receiptId, invoiceId: a.invoiceId, amount: a.amount, source: "manual", actorId: ctx.userId });
      }
      return { ok: true };
    }),

  undoReceipt: protectedProcedure.input(z.object({ receiptId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    if (!ALLOCATE_ROLES.has(ctx.orgRole ?? "")) throw new TRPCError({ code: "FORBIDDEN", message: "Only owners, administrators and project managers can undo this." });
    await undoReceipt(ctx.tenant, input.receiptId, ctx.userId);
    return { ok: true };
  }),

  /** Set a deposit aside (it is not income for any invoice) or bring it back. */
  ignoreReceipt: protectedProcedure.input(z.object({ receiptId: z.string().uuid(), ignored: z.boolean() })).mutation(async ({ ctx, input }) => {
    if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    if (!ALLOCATE_ROLES.has(ctx.orgRole ?? "")) throw new TRPCError({ code: "FORBIDDEN", message: "Only owners, administrators and project managers can do this." });
    await setReceiptIgnored(ctx.tenant, input.receiptId, input.ignored);
    return { ok: true };
  }),

  /**
   * Vendor bills QuickBooks holds that concern BidAxiom (they name a job, a vendor or an order number). Open ones need
   * a person to choose the order; linked ones show where they went and can be taken back.
   */
  bills: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    if (!VIEW_ROLES.has(ctx.orgRole ?? "")) throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed." });
    const { db, schema } = ctx.tenant;
    const [prof] = await db.select({ on: schema.companyProfiles.qboReadPayments }).from(schema.companyProfiles).where(isNull(schema.companyProfiles.validTo)).limit(1);
    const since = new Date(Date.now() - 30 * 86400000);
    const rows = await db
      .select()
      .from(schema.qboBills)
      .where(and(eq(schema.qboBills.relevant, true), inArray(schema.qboBills.status, ["open", "linked", "ignored"]), gte(schema.qboBills.updatedAt, since)))
      .orderBy(desc(schema.qboBills.txnDate));
    const orderRows = await db.select({ id: schema.orders.id, number: schema.orders.number, projectId: schema.orders.projectId, vendorId: schema.orders.vendorId }).from(schema.orders);
    const projects = await db.select({ id: schema.projects.id, name: schema.projects.name, jobNumber: schema.projects.jobNumber }).from(schema.projects);
    const vendors = await db.select({ id: schema.subcontractorDirectory.id, name: schema.subcontractorDirectory.companyName }).from(schema.subcontractorDirectory);
    const pname = new Map(projects.map((p) => [p.id, [p.jobNumber, p.name].filter(Boolean).join(" - ")]));
    const vname = new Map(vendors.map((v) => [v.id, v.name]));
    const oById = new Map(orderRows.map((o) => [o.id, o]));
    const out = [];
    for (const b of rows) {
      const o = b.orderId ? oById.get(b.orderId) : null;
      let candidates: Array<{ id: string; label: string }> = [];
      if (b.status === "open") {
        const bc = await billContext(ctx.tenant, b);
        candidates = (await candidateOrders(ctx.tenant, bc)).map((c: any) => ({ id: c.id, label: `${c.number} · ${vname.get(c.vendorId) ?? "No vendor"} · ${pname.get(c.projectId) ?? ""}` }));
      }
      out.push({
        id: b.id,
        status: b.status,
        docNumber: b.docNumber,
        txnDate: b.txnDate,
        dueDate: b.dueDate,
        vendorName: b.vendorName,
        total: Number(b.total),
        balance: Number(b.balance),
        memo: b.memo,
        auto: b.linkSource === "auto",
        orderId: b.orderId,
        orderNumber: o?.number ?? null,
        projectName: o ? pname.get(o.projectId) ?? null : null,
        candidates,
      });
    }
    return { enabled: Boolean(prof?.on), bills: out };
  }),

  linkBill: protectedProcedure.input(z.object({ billId: z.string().uuid(), orderId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    if (!ALLOCATE_ROLES.has(ctx.orgRole ?? "")) throw new TRPCError({ code: "FORBIDDEN", message: "Only owners, administrators and project managers can link bills." });
    await linkBill(ctx.tenant, { billId: input.billId, orderId: input.orderId, source: "manual", actorId: ctx.userId });
    return { ok: true };
  }),

  unlinkBill: protectedProcedure.input(z.object({ billId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    if (!ALLOCATE_ROLES.has(ctx.orgRole ?? "")) throw new TRPCError({ code: "FORBIDDEN", message: "Only owners, administrators and project managers can unlink bills." });
    await unlinkBill(ctx.tenant, input.billId, ctx.userId);
    return { ok: true };
  }),

  ignoreBill: protectedProcedure.input(z.object({ billId: z.string().uuid(), ignored: z.boolean() })).mutation(async ({ ctx, input }) => {
    if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    if (!ALLOCATE_ROLES.has(ctx.orgRole ?? "")) throw new TRPCError({ code: "FORBIDDEN", message: "Only owners, administrators and project managers can do this." });
    await setBillIgnored(ctx.tenant, input.billId, input.ignored, ctx.userId);
    return { ok: true };
  }),

  overview: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    if (!VIEW_ROLES.has(ctx.orgRole ?? "")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only owners, administrators, project managers and accountants can see what is outstanding across projects." });
    }
    const { db, schema } = ctx.tenant;
    const today = todayText();

    const projects = await db
      .select({
        id: schema.projects.id,
        name: schema.projects.name,
        jobNumber: schema.projects.jobNumber,
        slug: schema.projects.slug,
        customerId: schema.projects.customerId,
      })
      .from(schema.projects)
      .where(isNull(schema.projects.deletedAt));
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const projectIds = projects.map((p) => p.id);
    if (projectIds.length === 0) return { customers: [], vendors: [], invoiceTotal: 0, expenseTotal: 0, asOf: today };

    // ---- Money in: sent invoices with a balance -------------------------------------------------
    const invoices = await db
      .select()
      .from(schema.invoices)
      .where(and(inArray(schema.invoices.projectId, projectIds), inArray(schema.invoices.status, ["sent", "partially_paid"])));
    const invPays = invoices.length
      ? await db.select().from(schema.invoicePayments).where(inArray(schema.invoicePayments.invoiceId, invoices.map((i) => i.id)))
      : [];
    const customerRows = await db.select().from(schema.customers);
    const customerById = new Map(customerRows.map((c) => [c.id, c]));

    type InvoiceRow = {
      id: string; number: string; milestoneName: string; amount: number; received: number; outstanding: number;
      sentOn: string | null; dueOn: string | null; overdue: boolean;
      projectId: string; projectName: string; jobNumber: string | null; projectSlug: string | null;
    };
    const byCustomer = new Map<string, InvoiceRow[]>();
    for (const i of invoices) {
      if (!isSent(i.status)) continue;
      const p = projectById.get(i.projectId);
      if (!p) continue;
      const amount = Number(i.amount);
      const received = r2(invPays.filter((x) => x.invoiceId === i.id).reduce((a, x) => a + Number(x.amount), 0));
      const outstanding = r2(Math.max(amount - received, 0));
      if (outstanding <= 0.004) continue;
      const row: InvoiceRow = {
        id: i.id, number: i.number, milestoneName: i.milestoneName, amount, received, outstanding,
        sentOn: i.sentOn, dueOn: i.dueOn, overdue: isOverdue(i.status, i.dueOn, today),
        projectId: p.id, projectName: p.name, jobNumber: p.jobNumber, projectSlug: p.slug,
      };
      const list = byCustomer.get(p.customerId) ?? [];
      list.push(row);
      byCustomer.set(p.customerId, list);
    }
    const customers = [...byCustomer.entries()]
      .map(([customerId, rows]) => {
        const c = customerById.get(customerId);
        rows.sort((a, b) => (a.dueOn ?? a.sentOn ?? "").localeCompare(b.dueOn ?? b.sentOn ?? "") || a.number.localeCompare(b.number, undefined, { numeric: true }));
        return {
          customerId,
          name: c?.companyName || c?.contactName || "Unknown customer",
          total: r2(rows.reduce((a, r) => a + r.outstanding, 0)),
          overdueTotal: r2(rows.filter((r) => r.overdue).reduce((a, r) => a + r.outstanding, 0)),
          projectCount: new Set(rows.map((r) => r.projectId)).size,
          invoices: rows,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // ---- Money out: issued purchase / work orders with a balance -----------------------------------
    const orders = await db.select().from(schema.orders).where(inArray(schema.orders.projectId, projectIds));
    const open = orders.filter((o) => countsAsIssued(o.status) && o.status !== "paid");
    const lines = open.length ? await db.select().from(schema.orderLines).where(inArray(schema.orderLines.orderId, open.map((o) => o.id))) : [];
    const ordPays = open.length ? await db.select().from(schema.orderPayments).where(inArray(schema.orderPayments.orderId, open.map((o) => o.id))) : [];
    const vendorRows = await db.select({ id: schema.subcontractorDirectory.id, name: schema.subcontractorDirectory.companyName }).from(schema.subcontractorDirectory);
    const vendorById = new Map(vendorRows.map((v) => [v.id, v.name]));

    type ExpenseRow = {
      id: string; number: string; kind: "purchase" | "work"; total: number; paid: number; outstanding: number;
      issuedAt: string | null; projectId: string; projectName: string; jobNumber: string | null; projectSlug: string | null;
    };
    const byVendor = new Map<string, { name: string; rows: ExpenseRow[] }>();
    for (const o of open) {
      const p = projectById.get(o.projectId);
      if (!p) continue;
      const total = r2(lines.filter((l) => l.orderId === o.id).reduce((a, l) => a + Number(l.projectedCost), 0));
      const paid = r2(ordPays.filter((x) => x.orderId === o.id).reduce((a, x) => a + Number(x.amount), 0));
      const outstanding = r2(Math.max(total - paid, 0));
      if (outstanding <= 0.004) continue;
      const key = o.vendorId ?? "none";
      const group = byVendor.get(key) ?? { name: o.vendorId ? (vendorById.get(o.vendorId) ?? "Unknown vendor") : "No vendor chosen", rows: [] };
      group.rows.push({
        id: o.id, number: o.number, kind: o.kind as "purchase" | "work", total, paid, outstanding,
        issuedAt: o.issuedAt ? o.issuedAt.toISOString().slice(0, 10) : null,
        projectId: p.id, projectName: p.name, jobNumber: p.jobNumber, projectSlug: p.slug,
      });
      byVendor.set(key, group);
    }
    const vendors = [...byVendor.entries()]
      .map(([vendorId, g]) => {
        g.rows.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
        return { vendorId, name: g.name, total: r2(g.rows.reduce((a, r) => a + r.outstanding, 0)), orders: g.rows };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      asOf: today,
      customers,
      vendors,
      invoiceTotal: r2(customers.reduce((a, c) => a + c.total, 0)),
      expenseTotal: r2(vendors.reduce((a, v) => a + v.total, 0)),
    };
  }),
});
