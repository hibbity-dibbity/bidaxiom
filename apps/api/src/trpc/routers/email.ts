import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { db as publicDb } from "../../db/client.js";
import { users } from "../../db/schema/public.js";
import { createAuditLog } from "../../audit/logger.js";
import { AuditAction } from "@construction/shared";
import { renderDocumentPdf, type PdfKind } from "../../pdf/documents.js";
import { sendDocumentMail } from "../../services/email.js";
import { proposalRouter } from "./proposal.js";
import { createSigningLink } from "./signing.js";
import { invoiceRouter } from "./invoice.js";

/**
 * Emailing proposals, change orders, invoices and orders as a PDF attachment, sent through Resend
 * from the app's own address with the company name in front and the user as the reply-to.
 * Drafts that are sent for the first time are marked sent first, so the PDF shows the final state.
 */

const kindSchema = z.enum(["proposal", "invoice", "order"]);
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const clean = (list: string[]) => [...new Map(list.map((a) => [a.trim().toLowerCase(), a.trim()])).values()].filter(Boolean);

type Ctx = Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]["ctx"];

function need(ctx: Ctx) {
  if (!ctx.tenant || !ctx.userId || !ctx.orgId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
  return { tenant: ctx.tenant, userId: ctx.userId, orgId: ctx.orgId, orgRole: ctx.orgRole ?? "org:member" };
}

async function describe(ctx: Ctx, kind: PdfKind, id: string) {
  const { tenant } = need(ctx);
  const { db, schema } = tenant;
  const notFound = () => new TRPCError({ code: "NOT_FOUND", message: "Document not found." });
  const customerOf = async (customerId: string) => {
    const [c] = await db.select({ email: schema.customers.email, contactName: schema.customers.contactName, companyName: schema.customers.companyName }).from(schema.customers).where(eq(schema.customers.id, customerId));
    return c ?? null;
  };
  const projectOf = async (projectId: string) => {
    const [p] = await db.select({ name: schema.projects.name, jobNumber: schema.projects.jobNumber, customerId: schema.projects.customerId }).from(schema.projects).where(eq(schema.projects.id, projectId));
    if (!p) throw notFound();
    return p;
  };
  const projectLabel = (p: { name: string; jobNumber: string | null }) => [p.jobNumber, p.name].filter(Boolean).join(" ");

  if (kind === "proposal") {
    const [e] = await db.select().from(schema.estimates).where(eq(schema.estimates.id, id));
    if (!e) throw notFound();
    const p = await projectOf(e.projectId);
    const c = await customerOf(p.customerId);
    const co = e.kind === "change_order";
    const rev = e.revision > 0 ? ` Rev ${e.revision}` : "";
    const label = co ? `Change Order ${e.number ?? ""}${rev}`.trim() : `Proposal${rev}`;
    return {
      projectId: e.projectId,
      recipient: c ? { email: c.email, name: c.contactName || c.companyName } : null,
      subject: `${label} - ${projectLabel(p)}`,
      intro: `Please find attached ${co ? `change order ${e.number ?? ""}${rev}`.trim() : `our proposal${rev}`} for ${projectLabel(p)}.`,
      draft: e.status === "draft",
      signable: e.status === "draft" || e.status === "submitted",
      blocker: null as string | null,
    };
  }
  if (kind === "invoice") {
    const [i] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id));
    if (!i) throw notFound();
    const p = await projectOf(i.projectId);
    const c = await customerOf(p.customerId);
    const amt = Number(i.amount);
    return {
      projectId: i.projectId,
      recipient: c ? { email: c.email, name: c.contactName || c.companyName } : null,
      subject: `Invoice ${i.number} - ${projectLabel(p)}`,
      intro: `Please find attached invoice ${i.number} for ${projectLabel(p)}${amt > 0 ? `, in the amount of ${money(amt)}` : ""}.${i.paymentTerms ? ` Payment terms: ${i.paymentTerms}.` : ""}`,
      draft: i.status === "draft",
      blocker: null as string | null,
    };
  }
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, id));
  if (!o) throw notFound();
  const p = await projectOf(o.projectId);
  const [v] = o.vendorId
    ? await db.select({ email: schema.subcontractorDirectory.contactEmail, contact: schema.subcontractorDirectory.contactName, company: schema.subcontractorDirectory.companyName }).from(schema.subcontractorDirectory).where(eq(schema.subcontractorDirectory.id, o.vendorId))
    : [];
  const label = `${o.kind === "work" ? "Work Order" : "Purchase Order"} ${o.number}${o.revision > 0 ? ` Rev ${o.revision}` : ""}`;
  return {
    projectId: o.projectId,
    recipient: v ? { email: v.email, name: v.contact || v.company } : null,
    subject: `${label} - ${projectLabel(p)}`,
    intro: `Please find attached ${o.kind === "work" ? "work order" : "purchase order"} ${o.number}${o.revision > 0 ? ` (Rev ${o.revision})` : ""} for ${projectLabel(p)}. Please confirm receipt.`,
    draft: false,
    blocker: o.status === "draft" ? "Issue the order before emailing it." : null,
  };
}

async function whoAmI(userId: string) {
  const [u] = await publicDb.select({ email: users.email, firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, userId));
  return { email: u?.email ?? null, name: [u?.firstName, u?.lastName].filter(Boolean).join(" ") };
}

export const emailRouter = router({
  /** What the send dialog starts with: recipient, subject, message, reply-to. */
  compose: protectedProcedure.input(z.object({ kind: kindSchema, id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const c = need(ctx);
    const d = await describe(ctx, input.kind, input.id);
    const me = await whoAmI(c.userId);
    const greeting = d.recipient?.name ? `Hello ${d.recipient.name.split(" ")[0]},` : "Hello,";
    const message = `${greeting}\n\n${d.intro}\n\nIf you have any questions, just reply to this email.\n\nThank you,\n${[me.name, c.tenant.companyName].filter(Boolean).join("\n")}`;
    const history = await c.tenant.db
      .select({ id: c.tenant.schema.emailLog.id, to: c.tenant.schema.emailLog.toAddresses, status: c.tenant.schema.emailLog.status, sentAt: c.tenant.schema.emailLog.sentAt })
      .from(c.tenant.schema.emailLog)
      .where(eq(c.tenant.schema.emailLog.entityId, input.id))
      .orderBy(desc(c.tenant.schema.emailLog.sentAt))
      .limit(5);
    return {
      to: d.recipient?.email ? [d.recipient.email] : [],
      recipientName: d.recipient?.name ?? null,
      subject: d.subject,
      message,
      replyTo: me.email,
      ccMe: me.email,
      willMarkSent: d.draft,
      canSign: input.kind === "proposal" && "signable" in d && d.signable === true,
      blocker: d.blocker,
      history,
    };
  }),

  /** Email the document as a PDF. A draft is marked sent first. */
  send: protectedProcedure
    .input(
      z.object({
        kind: kindSchema,
        id: z.string().uuid(),
        to: z.array(z.string().email()).min(1).max(10),
        cc: z.array(z.string().email()).max(10).default([]),
        subject: z.string().min(1).max(300),
        message: z.string().min(1).max(10000),
        replyTo: z.string().email().nullable().optional(),
        /** Proposals and change orders: add a private link to review and sign online. */
        signOnline: z.boolean().default(false),
        /** Attach the PDF. At least one of link or PDF is required. */
        attachPdf: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const c = need(ctx);
      const { db, schema } = c.tenant;
      const d = await describe(ctx, input.kind, input.id);
      if (d.blocker) throw new TRPCError({ code: "BAD_REQUEST", message: d.blocker });

      let markedSent = false;
      if (d.draft) {
        if (input.kind === "proposal") await proposalRouter.createCaller(ctx).send({ estimateId: input.id });
        else if (input.kind === "invoice") await invoiceRouter.createCaller(ctx).send({ invoiceId: input.id });
        markedSent = true;
      }

      if (!input.attachPdf && !(input.signOnline && input.kind === "proposal")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose to attach the PDF, include the signing link, or both." });
      }
      const to = clean(input.to);
      const cc = clean(input.cc).filter((a) => !to.map((t) => t.toLowerCase()).includes(a.toLowerCase()));
      let filename: string | null = null;
      try {
        let body = input.message;
        if (input.signOnline && input.kind === "proposal") {
          const [cur] = await db.select({ status: schema.estimates.status }).from(schema.estimates).where(eq(schema.estimates.id, input.id));
          if (cur?.status !== "submitted") throw new TRPCError({ code: "BAD_REQUEST", message: "This is already accepted, so it cannot be sent for signing. Attach the PDF instead." });
          const link = await createSigningLink({ organizationId: c.orgId, userId: c.userId, estimateId: input.id, recipientEmail: to.join(", ") });
          body += `\n\nReview and sign online:\n${link.url}\n\nThis private link works until ${link.expiresAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`;
        }
        const out = input.attachPdf || input.kind !== "proposal"
          ? await renderDocumentPdf(c.tenant, { userId: c.userId, orgId: c.orgId, orgRole: c.orgRole, orgName: c.tenant.companyName }, input.kind, input.id)
          : null;
        filename = out?.filename ?? null;
        const r = await sendDocumentMail({
          fromName: c.tenant.companyName,
          replyTo: input.replyTo ?? null,
          to,
          cc,
          subject: input.subject,
          text: body,
          attachment: out ? { filename: out.filename, content: out.buffer } : null,
        });
        await db.insert(schema.emailLog).values({
          kind: input.kind, entityId: input.id, projectId: d.projectId, toAddresses: to.join(", "), ccAddresses: cc.join(", ") || null,
          subject: input.subject, attachmentName: filename ?? (input.signOnline ? "(signing link)" : null), status: "sent", providerId: r.id, sentBy: c.userId,
        });
        await createAuditLog(db, schema, { entityType: "Email", entityId: input.id, action: AuditAction.CREATE, actorId: c.userId, changes: { after: { kind: input.kind, to, cc, subject: input.subject, signOnline: input.signOnline, attachPdf: input.attachPdf } } });
        return { sent: true, markedSent, to };
      } catch (e) {
        const message = e instanceof Error ? e.message : "The email could not be sent.";
        await db.insert(schema.emailLog).values({
          kind: input.kind, entityId: input.id, projectId: d.projectId, toAddresses: to.join(", "), ccAddresses: cc.join(", ") || null,
          subject: input.subject, attachmentName: filename, status: "failed", error: message.slice(0, 1000), sentBy: c.userId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: markedSent ? `${message} The document was marked as sent; use Email again once this is fixed.` : message,
        });
      }
    }),
});
