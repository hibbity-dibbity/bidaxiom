import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { createAuditLog } from "../../audit/logger.js";
import { lastInvoiceSeq, rememberInvoiceSeq } from "../../services/invoiceDrafts.js";
import { onInvoiceSent, onInvoicesChanged, resolvePrompts } from "../../services/projectAutomation.js";
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

/** "Proposal" or "CO26-014-01 Rev 1: name" for the estimate an invoice milestone came from. */
async function sourceLabels(c: Ctx, estimateIds: string[]) {
  const { db, schema } = c.tenant;
  const map = new Map<string, { label: string; kind: string; number: string | null; name: string; revision: number }>();
  if (estimateIds.length === 0) return map;
  const rows = await db
    .select({ id: schema.estimates.id, kind: schema.estimates.kind, number: schema.estimates.number, name: schema.estimates.name, revision: schema.estimates.revision })
    .from(schema.estimates)
    .where(inArray(schema.estimates.id, estimateIds));
  for (const r of rows) {
    const label =
      r.kind === "change_order"
        ? `${r.number ?? "Change order"}${r.revision > 0 ? ` Rev ${r.revision}` : ""}: ${r.name}`
        : r.revision > 0 ? `Proposal Rev ${r.revision}` : "Proposal";
    map.set(r.id, { label, kind: r.kind, number: r.number, name: r.name, revision: r.revision });
  }
  return map;
}

/** Natural order of invoice numbers (INV26-014-02 before INV26-014-10). */
const byNumber = (a: { number: string }, b: { number: string }) => a.number.localeCompare(b.number, undefined, { numeric: true });

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
    const items = invoices.length
      ? await db.select().from(schema.invoiceItems).where(inArray(schema.invoiceItems.invoiceId, invoices.map((i) => i.id)))
      : [];
    const sources = await sourceLabels(c, [...new Set(invoices.map((i) => i.estimateId))]);
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
        milestoneIds: [i.milestoneId, ...items.filter((x) => x.invoiceId === i.id).map((x) => x.milestoneId)].filter((v): v is string => Boolean(v)),
        itemCount: items.filter((x) => x.invoiceId === i.id).length,
        source: sources.get(i.estimateId)?.label ?? "",
        isChangeOrder: sources.get(i.estimateId)?.kind === "change_order",
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
    const all = (await db.select().from(schema.invoices).where(eq(schema.invoices.projectId, inv.projectId))).sort(byNumber);
    const items = await db.select().from(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, inv.id)).orderBy(asc(schema.invoiceItems.sortOrder));
    const sources = await sourceLabels(c, [inv.estimateId]);
    const payments = await db
      .select()
      .from(schema.invoicePayments)
      .where(eq(schema.invoicePayments.invoiceId, inv.id))
      .orderBy(desc(schema.invoicePayments.receivedAt), desc(schema.invoicePayments.createdAt));
    const [project] = await db
      .select({
        name: schema.projects.name,
        jobNumber: schema.projects.jobNumber,
        poNumber: schema.projects.poNumber,
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
    const src = sources.get(inv.estimateId);
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
    const idx = all.findIndex((i) => i.id === inv.id);
    // Billed so far counts invoices that have actually gone out, plus this one; drafts ahead of it have not been billed.
    const throughThis = r2(all.slice(0, idx + 1).reduce((a, i) => a + (i.id === inv.id || isSent(i.status) ? Number(i.amount) : 0), 0));
    const hasChangeOrders = (await db.select({ k: schema.estimates.kind }).from(schema.estimates).where(and(eq(schema.estimates.projectId, inv.projectId), eq(schema.estimates.kind, "change_order"), inArray(schema.estimates.status, ["accepted", "under_contract"]))).limit(1)).length > 0;
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
      source: src ? { label: src.label, kind: src.kind, number: src.number, name: src.name, revision: src.revision } : null,
      items: items.map((x) => ({ id: x.id, label: x.label, sourceLabel: x.sourceLabel, percent: Number(x.percent), amount: Number(x.amount) })),
      hasChangeOrders,
      companyName: c.tenant.companyName,
      companyContact,
      customerName: customer ? customer.companyName || customer.contactName : null,
      projectName: project?.name ?? null,
      projectNumber: project?.jobNumber ?? null,
      poNumber: project?.poNumber ?? null,
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

  /**
   * Merge unsent invoices into one. The earliest invoice number is kept; the others are removed.
   * The merged invoice lists each original milestone, with the proposal or change order it came from.
   */
  merge: protectedProcedure
    .input(z.object({ invoiceIds: z.array(z.string().uuid()).min(2).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const c = need(ctx);
      await can(c, "update");
      const { db, schema } = c.tenant;
      const rows = (await db.select().from(schema.invoices).where(inArray(schema.invoices.id, input.invoiceIds))).sort(byNumber);
      if (rows.length !== new Set(input.invoiceIds).size) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
      if (new Set(rows.map((r) => r.projectId)).size > 1) throw new TRPCError({ code: "BAD_REQUEST", message: "Those invoices are on different projects." });
      if (rows.some((r) => r.status !== "draft")) throw new TRPCError({ code: "BAD_REQUEST", message: "Only invoices that have not been sent can be merged." });
      const sources = await sourceLabels(c, [...new Set(rows.map((r) => r.estimateId))]);
      const existingItems = await db.select().from(schema.invoiceItems).where(inArray(schema.invoiceItems.invoiceId, rows.map((r) => r.id)));
      const parts: Array<{ estimateId: string; milestoneId: string | null; label: string; sourceLabel: string; percent: string; amount: string }> = [];
      for (const r of rows) {
        const mine = existingItems.filter((x) => x.invoiceId === r.id).sort((a, b) => a.sortOrder - b.sortOrder);
        if (mine.length > 0) {
          for (const x of mine) parts.push({ estimateId: x.estimateId, milestoneId: x.milestoneId, label: x.label, sourceLabel: x.sourceLabel, percent: x.percent, amount: x.amount });
        } else {
          parts.push({ estimateId: r.estimateId, milestoneId: r.milestoneId, label: r.milestoneName, sourceLabel: sources.get(r.estimateId)?.label ?? "", percent: r.percent, amount: r.amount });
        }
      }
      const keep = rows[0];
      const total = r2(parts.reduce((a, p) => a + Number(p.amount), 0));
      const used = await lastInvoiceSeq(db, schema, keep.projectId);
      await db.transaction(async (tx) => {
        await rememberInvoiceSeq(tx, schema, keep.projectId, used); // the numbers removed here are never handed out again
        await tx.delete(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, keep.id));
        await tx.insert(schema.invoiceItems).values(parts.map((p, i) => ({ invoiceId: keep.id, ...p, sortOrder: i })));
        await tx.delete(schema.invoices).where(inArray(schema.invoices.id, rows.slice(1).map((r) => r.id)));
        await tx
          .update(schema.invoices)
          .set({ amount: String(total), milestoneName: `Combined invoice (${parts.length} items)`, percent: "0", milestoneId: null, updatedAt: new Date() })
          .where(eq(schema.invoices.id, keep.id));
      });
      await createAuditLog(db, schema, {
        entityType: "Invoice",
        entityId: keep.id,
        action: AuditAction.UPDATE,
        actorId: c.userId,
        changes: { after: { merged: rows.map((r) => r.number), amount: total } },
      });
      return { id: keep.id, number: keep.number, removed: rows.slice(1).map((r) => r.number) };
    }),

  /**
   * Split an unsent merged invoice back into one invoice per original milestone. The first keeps
   * this invoice's number; the others are numbered after the project's last invoice.
   */
  unmerge: protectedProcedure.input(z.object({ invoiceId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const c = need(ctx);
    await can(c, "update");
    const { db, schema } = c.tenant;
    const inv = await loadInvoice(c, input.invoiceId);
    if (inv.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "Only invoices that have not been sent can be split." });
    const items = await db.select().from(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, inv.id)).orderBy(asc(schema.invoiceItems.sortOrder));
    if (items.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "This invoice is not a combined invoice." });
    const all = await db.select({ number: schema.invoices.number, sortOrder: schema.invoices.sortOrder }).from(schema.invoices).where(eq(schema.invoices.projectId, inv.projectId));
    const prefix = inv.number.replace(/-\d+$/, "");
    let seq = await lastInvoiceSeq(db, schema, inv.projectId, all.map((r) => r.number));
    let sort = all.reduce((a, r) => Math.max(a, r.sortOrder), -1);
    const created: string[] = [];
    await db.transaction(async (tx) => {
      const [first, ...rest] = items;
      await tx.update(schema.invoices).set({
        estimateId: first.estimateId, milestoneId: first.milestoneId, milestoneName: first.label,
        percent: first.percent, amount: first.amount, updatedAt: new Date(),
      }).where(eq(schema.invoices.id, inv.id));
      for (const x of rest) {
        seq += 1;
        sort += 1;
        const number = `${prefix}-${String(seq).padStart(2, "0")}`;
        await tx.insert(schema.invoices).values({
          projectId: inv.projectId, estimateId: x.estimateId, milestoneId: x.milestoneId, number,
          milestoneName: x.label, percent: x.percent, amount: x.amount, status: "draft",
          paymentTerms: inv.paymentTerms, sortOrder: sort, createdBy: c.userId,
        });
        created.push(number);
      }
      await tx.delete(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, inv.id));
      await rememberInvoiceSeq(tx, schema, inv.projectId, seq);
    });
    await createAuditLog(db, schema, { entityType: "Invoice", entityId: inv.id, action: AuditAction.UPDATE, actorId: c.userId, changes: { after: { unmerged: [inv.number, ...created] } } });
    return { id: inv.id, number: inv.number, created };
  }),

  /** Save the date sent and due date on a draft without sending it. They are used when the invoice is sent. */
  updateDates: protectedProcedure
    .input(z.object({ invoiceId: z.string().uuid(), sentOn: dateText, dueOn: dateText }))
    .mutation(async ({ ctx, input }) => {
      const c = need(ctx);
      await can(c, "update");
      const inv = await loadInvoice(c, input.invoiceId);
      if (inv.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "A sent invoice cannot be changed." });
      if (input.dueOn < input.sentOn) throw new TRPCError({ code: "BAD_REQUEST", message: "The due date is before the date sent." });
      await c.tenant.db.update(c.tenant.schema.invoices).set({ sentOn: input.sentOn, dueOn: input.dueOn, updatedAt: new Date() }).where(eq(c.tenant.schema.invoices.id, inv.id));
      return { id: inv.id };
    }),

  /**
   * Split an unsent invoice in two by amount: this invoice keeps the amount you give and a new draft,
   * numbered after the project's last invoice, takes the rest.
   */
  splitAmount: protectedProcedure
    .input(z.object({ invoiceId: z.string().uuid(), amount: z.number().positive() }))
    .mutation(async ({ ctx, input }) => {
      const c = need(ctx);
      await can(c, "update");
      const { db, schema } = c.tenant;
      const inv = await loadInvoice(c, input.invoiceId);
      if (inv.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "Only invoices that have not been sent can be split." });
      const items = await db.select({ id: schema.invoiceItems.id }).from(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, inv.id));
      if (items.length > 1) throw new TRPCError({ code: "BAD_REQUEST", message: "Split this combined invoice back into its parts first." });
      const total = Number(inv.amount);
      const first = r2(input.amount);
      const rest = r2(total - first);
      if (total <= 0 || first <= 0 || rest <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter an amount smaller than the invoice total." });
      const all = await db.select({ number: schema.invoices.number, sortOrder: schema.invoices.sortOrder }).from(schema.invoices).where(eq(schema.invoices.projectId, inv.projectId));
      const prefix = inv.number.replace(/-\d+$/, "");
      const seq = (await lastInvoiceSeq(db, schema, inv.projectId, all.map((r) => r.number))) + 1;
      const sort = all.reduce((a, r) => Math.max(a, r.sortOrder), -1) + 1;
      const number = `${prefix}-${String(seq).padStart(2, "0")}`;
      const pct = Number(inv.percent);
      await db.transaction(async (tx) => {
        await tx.update(schema.invoices).set({ amount: String(first), percent: String(r2((pct * first) / total)), updatedAt: new Date() }).where(eq(schema.invoices.id, inv.id));
        await tx.insert(schema.invoices).values({
          projectId: inv.projectId, estimateId: inv.estimateId, milestoneId: inv.milestoneId, number,
          milestoneName: inv.milestoneName, percent: String(r2(pct - (pct * first) / total)), amount: String(rest), status: "draft",
          paymentTerms: inv.paymentTerms, notes: inv.notes, sortOrder: sort, createdBy: c.userId,
        });
        await rememberInvoiceSeq(tx, schema, inv.projectId, seq);
      });
      await createAuditLog(db, schema, { entityType: "Invoice", entityId: inv.id, action: AuditAction.UPDATE, actorId: c.userId, changes: { after: { splitInto: [inv.number, number], amounts: [first, rest] } } });
      return { id: inv.id, number: inv.number, created: number };
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
      const credit = Number(inv.amount) < 0;
      if (Number(inv.amount) === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "This invoice has no amount to bill." });
      // Dates saved on the draft are used when none are given (emailing the invoice sends without any).
      const sentOn = input.sentOn ?? inv.sentOn ?? todayText();
      const dueOn = input.dueOn ?? (input.sentOn ? null : inv.dueOn) ?? dueDateFor(sentOn, inv.paymentTerms);
      if (dueOn < sentOn) throw new TRPCError({ code: "BAD_REQUEST", message: "The due date is before the date sent." });
      // A credit (negative amount) has nothing to collect, so it is settled when sent.
      await db.update(schema.invoices).set({ status: credit ? "paid" : "sent", sentOn, dueOn, updatedAt: new Date() }).where(eq(schema.invoices.id, inv.id));
      await createAuditLog(db, schema, {
        entityType: "Invoice",
        entityId: inv.id,
        action: AuditAction.UPDATE,
        actorId: c.userId,
        changes: { before: { status: "draft" }, after: { status: credit ? "paid" : "sent", sentOn, dueOn } },
      });
      await onInvoiceSent(c.tenant, inv.id).catch((e) => console.error("[automation] invoice sent failed", e));
      if (credit) await onInvoicesChanged(c.tenant, inv.projectId, inv.id).catch((e) => console.error("[automation] invoices changed failed", e));
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
      await onInvoicesChanged(c.tenant, inv.projectId, inv.id).catch((e) => console.error("[automation] invoices changed failed", e));
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
    // A payment was taken back, so "everything is paid" may no longer be true.
    await resolvePrompts(c.tenant, { projectId: inv.projectId, kinds: ["close_project"] }, "A payment was removed").catch(() => undefined);
    return { id: inv.id };
  }),
});

