import { TRPCError } from "@trpc/server";
import { and, inArray, isNull } from "drizzle-orm";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { countsAsIssued, isOverdue, isSent } from "@construction/shared";

/**
 * One page of everything still owed, for reference while matching bank activity in QuickBooks:
 * sent invoices that are not fully paid (money coming in, grouped by customer) and issued purchase / work orders
 * that are not fully paid (money going out, grouped by vendor). Read-only. Amounts are dollars.
 */

const VIEW_ROLES = new Set(["org:admin", "org:project_manager", "org:accountant"]);
const r2 = (n: number) => Math.round(n * 100) / 100;

function todayText() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const outstandingRouter = router({
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
