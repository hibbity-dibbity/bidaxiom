import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { createAuditLog } from "../../audit/logger.js";
import { AuditAction, dueDateFor, invoiceStatusAfterReceipts, isOverdue, isSent } from "@construction/shared";

/**
 * Customer invoices (money in). Drafts are created when a proposal is accepted, one per invoicing
 * schedule milestone. Sending is a manual action that sets the date sent and the due date.
 * Sent invoices are locked. Payments received are recorded per invoice. Amounts are dollars.
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
    .select({ projectId: c.tenant.schema.projectTeamMembers.projectId, role: c.tenant.schema.projectTeamMembers.role })
    .from(c.tenant.schema.projectTeamMembers)
    .where(eq(c.tenant.schema.projectTeamMembers.userId, c.userId));
  const abilities = defineAbilitiesFor(c.orgRole ?? "org:member", c.userId, memberships);
  ForbiddenError.from(abilities).throwUnlessCan(action, "Estimate");
}

const r2 = (n: number) => Math.round(n * 100) / 100;

const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function todayText() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function loadInvoice(c: Ctx, invoiceId: string) {
  const [inv] = await c.tenant.db.select().from(c.tenant.schema.invoices).where(eq(c.tenant.schema.invoices.id, invoiceId));
  if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
  return inv;
}

export const invoiceRouter = router({
  /** Invoices for a project with received/outstanding per invoice and the totals the header uses. */
  list: protectedProcedure.input(z.object({ projectId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const c = need(ctx);
    await can(c, "read");
    const { db, schema } = c.tenant;
    const invoices = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.projectId, input.projectId))
      .orderBy(asc(schema.invoices.sortOrder), asc(schema.invoices.number));
    const pays = invoices.length
      ? await db.select().from(schema.invoicePayments).where(inArray(schema.invoicePayments.invoiceId, invoices.map((i) => i.id)))
      : [];
    const today = todayText();
    const rows = invoices.map((i) => {
      const amount = Number(i.amount);
      const received = r2(pays.filter((p) => p.invoiceId === i.id).reduce((a, p) => a + Number(p.amount), 0));
      return {
        id: i.id,
        number: i.number,
        estimateId: i.estimateId,
        milestoneId: i.milestoneId,
        milestoneName: i.milestoneName,
        percent: Number(i.percent),
        amount,
        status: i.status,
        sentOn: i.sentOn,
        dueOn: i.dueOn,
        received,
        outstanding: isSent(i.status) ? r2(Math.max(amount - received, 0)) : null,
        overdue: isOverdue(i.status, i.dueOn, today),
      };
    });
    const sum = (f: (r: (typeof rows)[number]) => number) => r2(rows.reduce((a, r) => a + f(r), 0));
    return {
      rows,
      total: sum((r) => r.amount),
      billed: sum((r) => (isSent(r.status) ? r.amount : 0)),
      collected: sum((r) => r.received),
      outstanding: sum((r) => r.outstanding ?? 0),
      openCount: rows.filter((r) => r.status !== "paid").length,
    };
  }),

  /** One invoice with everything the customer view and the payment section need. */
  get: protectedProcedure.input(z.object({ invoiceId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const c = need(ctx);
    await can(c, "read");
    const { db, schema } = c.tenant;
    const inv = await loadInvoice(c, input.invoiceId);
    const all = await db.select().from(schema.invoices).where(eq(schema.invoices.estimateId, inv.estimateId)).orderBy(asc(schema.invoices.sortOrder));
    const payments = await db
      .select()
      .from(schema.invoicePayments)
      .where(eq(schema.invoicePayments.invoiceId, inv.id))
      .orderBy(desc(schema.invoicePayments.receivedAt), desc(schema.invoicePayments.createdAt));
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
      .where(eq(schema.projects.id, inv.projectId))
      .limit(1);
    const [customer] = project
      ? await db
          .select({ companyName: schema.customers.companyName, contactName: schema.customers.contactName })
          .from(schema.customers)
          .where(eq(schema.customers.id, project.customerId))
          .limit(1)
      : [];
    const [est] = await db
      .select({ revision: schema.estimates.revision, slug: schema.estimates.slug })
      .from(schema.estimates)
      .where(eq(schema.estimates.id, inv.estimateId));
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
    const addressParts = project
      ? [project.street1, project.street2, [project.city, project.state].filter(Boolean).join(", "), project.zip].filter(Boolean)
      : [];

    const amount = Number(inv.amount);
    const received = r2(payments.reduce((a, p) => a + Number(p.amount), 0));
    const contractValue = r2(all.reduce((a, i) => a + Number(i.amount), 0));
    const throughThis = r2(all.filter((i) => i.sortOrder <= inv.sortOrder).reduce((a, i) => a + Number(i.amount), 0));
    return {
      invoice: {
        id: inv.id,
        number: inv.number,
        status: inv.status,
        milestoneName: inv.milestoneName,
        percent: Number(inv.percent),
        amount,
        sentOn: inv.sentOn,
        dueOn: inv.dueOn,
        paymentTerms: inv.paymentTerms,
        notes: inv.notes,
        overdue: isOverdue(inv.status, inv.dueOn, todayText()),
      },
      projectId: inv.projectId,
      proposalRevision: est?.revision ?? 0,
      companyName: c.tenant.companyName,
      companyContact,
      customerName: customer ? customer.companyName || customer.contactName : null,
      projectName: project?.name ?? null,
      projectNumber: project?.jobNumber ?? null,
      projectAddress: addressParts.join(", ") || null,
      contractValue,
      billedThroughThis: throughThis,
      balanceAfterThis: r2(Math.max(contractValue - throughThis, 0)),
      payments: payments.map((p) => ({ id: p.id, amount: Number(p.amount), receivedAt: p.receivedAt, reference: p.reference })),
      received,
      outstanding: isSent(inv.status) ? r2(Math.max(amount - received, 0)) : null,
      canSend: inv.status === "draft",
    };
  }),

  /** Internal note printed on the invoice. Drafts only. */
  updateNotes: protectedProcedure
    .input(z.object({ invoiceId: z.string().uuid(), notes: z.string().max(5000).nullable() }))
    .mutation(async ({ ctx, input }) => {
      const c = need(ctx);
      await can(c, "update");
      const inv = await loadInvoice(c, input.invoiceId);
      if (inv.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "A sent invoice cannot be changed." });
      await c.tenant.db.update(c.tenant.schema.invoices).set({ notes: input.notes, updatedAt: new Date() }).where(eq(c.tenant.schema.invoices.id, inv.id));
      return { id: inv.id };
    }),

  /**
   * Send a draft invoice. This is the manual step that sets the date sent and the due date (from
   * the payment terms, or a due date you pick). The invoice locks. Delivery by email is not set up;
   * use Download PDF to send it.
   */
  send: protectedProcedure
    .input(z.object({ invoiceId: z.string().uuid(), sentOn: dateText.optional(), dueOn: dateText.optional() }))
    .mutation(async ({ ctx, input }) => {
      const c = need(ctx);
      await can(c, "update");
      const { db, schema } = c.tenant;
      const inv = await loadInvoice(c, input.invoiceId);
      if (inv.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "This invoice was already sent." });
      if (Number(inv.amount) <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "This invoice has no amount to bill." });
      const sentOn = input.sentOn ?? todayText();
      const dueOn = input.dueOn ?? dueDateFor(sentOn, inv.paymentTerms);
      if (dueOn < sentOn) throw new TRPCError({ code: "BAD_REQUEST", message: "The due date is before the date sent." });
      await db.update(schema.invoices).set({ status: "sent", sentOn, dueOn, updatedAt: new Date() }).where(eq(schema.invoices.id, inv.id));
      await createAuditLog(db, schema, {
        entityType: "Invoice",
        entityId: inv.id,
        action: AuditAction.UPDATE,
        actorId: c.userId,
        changes: { before: { status: "draft" }, after: { status: "sent", sentOn, dueOn } },
      });
      return { id: inv.id, sentOn, dueOn };
    }),

  /** Record money received against a sent invoice. Cannot exceed the invoice amount. */
  recordPayment: protectedProcedure
    .input(
      z.object({
        invoiceId: z.string().uuid(),
        amount: z.number().gt(0).max(1e10),
        receivedAt: dateText,
        reference: z.string().max(200).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const c = need(ctx);
      await can(c, "update");
      const { db, schema } = c.tenant;
      const inv = await loadInvoice(c, input.invoiceId);
      if (!isSent(inv.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "Send the invoice before recording a payment." });
      const amount = Math.round(input.amount * 100) / 100;
      await db.transaction(async (tx) => {
        const prior = await tx.select({ a: schema.invoicePayments.amount }).from(schema.invoicePayments).where(eq(schema.invoicePayments.invoiceId, inv.id));
        const received = prior.reduce((a, r) => a + Number(r.a), 0);
        const total = Number(inv.amount);
        if (received + amount > total + 0.005) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `That is more than the invoice. Only ${(total - received).toFixed(2)} is outstanding.` });
        }
        await tx.insert(schema.invoicePayments).values({ invoiceId: inv.id, amount: String(amount), receivedAt: input.receivedAt, reference: input.reference ?? null, createdBy: c.userId });
        await tx.update(schema.invoices).set({ status: invoiceStatusAfterReceipts(received + amount, total), updatedAt: new Date() }).where(eq(schema.invoices.id, inv.id));
      });
      await createAuditLog(db, schema, { entityType: "Invoice", entityId: inv.id, action: AuditAction.UPDATE, actorId: c.userId, changes: { after: { payment: amount, receivedAt: input.receivedAt } } });
      return { id: inv.id };
    }),

  /** Delete a payment entered by mistake. */
  deletePayment: protectedProcedure.input(z.object({ paymentId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const c = need(ctx);
    await can(c, "update");
    const { db, schema } = c.tenant;
    const [pay] = await db.select().from(schema.invoicePayments).where(eq(schema.invoicePayments.id, input.paymentId));
    if (!pay) throw new TRPCError({ code: "NOT_FOUND", message: "Payment not found." });
    const inv = await loadInvoice(c, pay.invoiceId);
    await db.transaction(async (tx) => {
      await tx.delete(schema.invoicePayments).where(eq(schema.invoicePayments.id, pay.id));
      const rest = await tx.select({ a: schema.invoicePayments.amount }).from(schema.invoicePayments).where(eq(schema.invoicePayments.invoiceId, inv.id));
      const received = rest.reduce((a, r) => a + Number(r.a), 0);
      if (isSent(inv.status)) {
        await tx.update(schema.invoices).set({ status: invoiceStatusAfterReceipts(received, Number(inv.amount)), updatedAt: new Date() }).where(eq(schema.invoices.id, inv.id));
      }
    });
    await createAuditLog(db, schema, { entityType: "Invoice", entityId: inv.id, action: AuditAction.UPDATE, actorId: c.userId, changes: { before: { payment: Number(pay.amount) } } });
    return { id: inv.id };
  }),
});

