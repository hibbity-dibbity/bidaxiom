import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { AuditAction } from "@construction/shared";
import { router } from "../trpc.js";
import { publicProcedure } from "../procedures.js";
import { protectedProcedure } from "../procedures.js";
import { db as publicDb } from "../../db/client.js";
import { organizations, organizationMemberships, signingLinks, users } from "../../db/schema/public.js";
import { buildTenantContext } from "../../tenant/context.js";
import { createAuditLog } from "../../audit/logger.js";
import { getStorageClient, getBucketName, buildStorageKey } from "../../storage/client.js";
import { generateDownloadUrl } from "../../storage/presigned.js";
import { renderDocumentPdf } from "../../pdf/documents.js";
import { sendDocumentMail } from "../../services/email.js";
import { acceptProposal, buildCustomerViewData, previewAcceptance } from "./proposal.js";

/**
 * In-house e-signature for proposals and change orders. The customer gets a private link, reviews
 * the exact document, picks any optional items, and signs by drawing or typing their name. The
 * signature, the options chosen, the total, a fingerprint of the document, the time and the
 * customer's IP are recorded; the proposal is accepted (which locks it and drafts the purchase
 * orders and invoices); and a signed PDF with a certificate page is filed in the project's Documents.
 */

const LINK_DAYS = 60;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

type Tenant = Awaited<ReturnType<typeof buildTenantContext>>;

function appBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Make a signing link for a sent proposal. Earlier pending links for it stop working. */
export async function createSigningLink(opts: { organizationId: string; userId: string; estimateId: string; recipientEmail: string; recipientName?: string | null }) {
  const token = randomBytes(32).toString("base64url");
  await publicDb
    .update(signingLinks)
    .set({ status: "revoked" })
    .where(and(eq(signingLinks.estimateId, opts.estimateId), eq(signingLinks.status, "pending")));
  const expiresAt = new Date(Date.now() + LINK_DAYS * 86_400_000);
  await publicDb.insert(signingLinks).values({
    organizationId: opts.organizationId, createdBy: opts.userId, estimateId: opts.estimateId,
    tokenHash: sha256(token), recipientEmail: opts.recipientEmail, recipientName: opts.recipientName ?? null, expiresAt,
  });
  return { url: `${appBase()}/sign/${token}`, expiresAt };
}

async function openLink(token: string) {
  const [link] = await publicDb.select().from(signingLinks).where(eq(signingLinks.tokenHash, sha256(token))).limit(1);
  if (!link) throw new TRPCError({ code: "NOT_FOUND", message: "This link is not valid. Ask the sender for a new one." });
  const tenant = await buildTenantContext(link.organizationId, link.createdBy);
  return { link, tenant };
}

type LinkState = "open" | "signed" | "declined" | "expired" | "revoked" | "superseded";

async function stateOf(link: typeof signingLinks.$inferSelect, tenant: Tenant): Promise<LinkState> {
  if (link.status === "signed") return "signed";
  if (link.status === "declined") return "declined";
  if (link.status === "revoked") return "revoked";
  if (link.expiresAt.getTime() < Date.now()) return "expired";
  const { db, schema } = tenant;
  const [e] = await db.select({ status: schema.estimates.status }).from(schema.estimates).where(eq(schema.estimates.id, link.estimateId)).limit(1);
  if (!e) return "revoked";
  const [newer] = await db.select({ id: schema.estimates.id }).from(schema.estimates).where(eq(schema.estimates.revisionOfId, link.estimateId)).limit(1);
  if (newer) return "superseded";
  if (e.status !== "submitted") return "revoked";
  return "open";
}

async function roleOf(userId: string, orgId: string): Promise<string> {
  const [m] = await publicDb
    .select({ role: organizationMemberships.role })
    .from(organizationMemberships)
    .where(and(eq(organizationMemberships.userId, userId), eq(organizationMemberships.organizationId, orgId)))
    .limit(1);
  return m?.role ?? "org:member";
}

/** Print the signed proposal and file it in the project's Documents, under "Signed Proposals". */
async function filePdf(tenant: Tenant, link: typeof signingLinks.$inferSelect, projectId: string) {
  const { db, schema } = tenant;
  const [org] = await publicDb.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, link.organizationId));
  const [sender] = await publicDb.select({ email: users.email }).from(users).where(eq(users.id, link.createdBy));
  const out = await renderDocumentPdf(
    tenant,
    { userId: link.createdBy, orgId: link.organizationId, orgRole: await roleOf(link.createdBy, link.organizationId), orgName: org?.name, email: sender?.email },
    "proposal",
    link.estimateId
  );
  const filename = out.filename.replace(/\.pdf$/, " - SIGNED.pdf");
  const key = buildStorageKey(tenant.tenantId, projectId, filename);
  await getStorageClient().send(new PutObjectCommand({ Bucket: getBucketName(), Key: key, Body: out.buffer, ContentType: "application/pdf" }));

  let [folder] = await db.select().from(schema.folders).where(and(eq(schema.folders.projectId, projectId), eq(schema.folders.name, "Signed Proposals"))).limit(1);
  if (!folder) {
    [folder] = await db.insert(schema.folders).values({ projectId, name: "Signed Proposals", createdBy: link.createdBy }).returning();
  }
  const docId = await db.transaction(async (tx) => {
    const [d] = await tx
      .insert(schema.documents)
      .values({ projectId, folderId: folder.id, name: filename, category: "contract", description: "Electronically signed by the customer", fileSize: out.buffer.length, contentType: "application/pdf", createdBy: link.createdBy })
      .returning({ id: schema.documents.id });
    const [v] = await tx
      .insert(schema.documentVersions)
      .values({ documentId: d.id, versionNumber: 1, storageKey: key, fileSize: out.buffer.length, contentType: "application/pdf", uploadedBy: link.createdBy, changeNotes: "Signed copy" })
      .returning({ id: schema.documentVersions.id });
    await tx.update(schema.documents).set({ currentVersionId: v.id }).where(eq(schema.documents.id, d.id));
    return d.id;
  });
  return { docId, filename, buffer: out.buffer };
}

export const signingRouter = router({
  /** The document the customer is asked to sign, or why they cannot sign it. */
  view: publicProcedure.input(z.object({ token: z.string().min(20).max(100) })).query(async ({ input }) => {
    const { link, tenant } = await openLink(input.token);
    const state = await stateOf(link, tenant);
    if (!link.viewedAt && state === "open") {
      await publicDb.update(signingLinks).set({ viewedAt: new Date() }).where(eq(signingLinks.id, link.id));
    }
    const sender = await publicDb.select({ first: users.firstName, last: users.lastName, email: users.email }).from(users).where(eq(users.id, link.createdBy)).limit(1);
    const doc = await buildCustomerViewData(tenant, link.createdBy, link.estimateId);
    return {
      state,
      doc: state === "revoked" || state === "superseded" || state === "expired" ? null : doc,
      companyName: tenant.companyName,
      contact: { name: [sender[0]?.first, sender[0]?.last].filter(Boolean).join(" ") || null, email: sender[0]?.email ?? null },
      recipientName: link.recipientName,
      expiresAt: link.expiresAt,
    };
  }),

  /** Total with the chosen options, computed on the server. */
  preview: publicProcedure
    .input(z.object({ token: z.string().min(20).max(100), optionIds: z.array(z.string().uuid()).max(500) }))
    .query(async ({ input }) => {
      const { link, tenant } = await openLink(input.token);
      return previewAcceptance(tenant, link.estimateId, input.optionIds);
    }),

  /** Sign: accepts the proposal with the chosen options. */
  submit: publicProcedure
    .input(
      z.object({
        token: z.string().min(20).max(100),
        signerName: z.string().trim().min(2).max(200),
        signatureType: z.enum(["drawn", "typed"]),
        signatureImage: z.string().max(400_000).regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/).nullable(),
        acceptedOptionIds: z.array(z.string().uuid()).max(500),
        consent: z.literal(true),
        userAgent: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.signatureType === "drawn" && !input.signatureImage) throw new TRPCError({ code: "BAD_REQUEST", message: "Please draw your signature." });
      const { link, tenant } = await openLink(input.token);
      const state = await stateOf(link, tenant);
      if (state !== "open") throw new TRPCError({ code: "BAD_REQUEST", message: state === "signed" ? "This has already been signed." : "This link can no longer be used. Ask the sender for a new one." });
      const { db, schema } = tenant;

      // Claim the link so a double click cannot sign twice.
      const claimed = await publicDb
        .update(signingLinks)
        .set({ status: "signed", completedAt: new Date() })
        .where(and(eq(signingLinks.id, link.id), eq(signingLinks.status, "pending")))
        .returning({ id: signingLinks.id });
      if (claimed.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "This has already been signed." });

      const doc = await buildCustomerViewData(tenant, link.createdBy, link.estimateId);
      let accepted: Awaited<ReturnType<typeof acceptProposal>>;
      try {
        accepted = await acceptProposal(tenant, link.createdBy, link.estimateId, input.acceptedOptionIds);
      } catch (e) {
        await publicDb.update(signingLinks).set({ status: "pending", completedAt: null }).where(eq(signingLinks.id, link.id));
        throw e;
      }
      const optionIds = [...new Set(input.acceptedOptionIds)].sort();
      const documentHash = sha256(JSON.stringify({ title: doc.title, number: doc.number, revision: doc.revision, view: doc.view, terms: doc.terms.sections, options: optionIds, contractValue: accepted.contractValue }));
      const signerEmail = link.recipientEmail?.split(",")[0]?.trim() || null;
      const [co] = await db.select().from(schema.companySignature).limit(1);
      const countersign = co && co.enabled ? co : null;
      const [sig] = await db
        .insert(schema.proposalSignatures)
        .values({
          estimateId: link.estimateId, outcome: "accepted", signerName: input.signerName, signerEmail,
          signatureType: input.signatureType, signatureImage: input.signatureType === "drawn" ? input.signatureImage : null,
          acceptedOptionIds: optionIds, contractValueCents: String(accepted.contractValue), documentHash,
          termsVersion: doc.terms.version, ip: ctx.ip ?? null, userAgent: input.userAgent ?? null,
          companySignerName: countersign?.signerName ?? null, companySignerTitle: countersign?.signerTitle ?? null,
          companySignatureType: countersign?.signatureType ?? null, companySignatureImage: countersign?.signatureImage ?? null,
        })
        .returning({ id: schema.proposalSignatures.id });
      await createAuditLog(db, schema, {
        entityType: "Estimate", entityId: link.estimateId, action: AuditAction.UPDATE, actorId: `signer:${signerEmail ?? input.signerName}`,
        changes: { after: { esigned: true, signer: input.signerName, contractValue: accepted.contractValue, hash: documentHash } },
      });

      // Everything after this point is best effort: the signature and acceptance already stand.
      let filed: { docId: string; filename: string; buffer: Buffer } | null = null;
      let pdfError: string | null = null;
      try {
        const [est] = await db.select({ projectId: schema.estimates.projectId }).from(schema.estimates).where(eq(schema.estimates.id, link.estimateId));
        filed = await filePdf(tenant, link, est.projectId);
        await db.update(schema.proposalSignatures).set({ pdfDocumentId: filed.docId }).where(eq(schema.proposalSignatures.id, sig.id));
      } catch (e) {
        pdfError = e instanceof Error ? e.message : "The signed PDF could not be made.";
        console.error("[SIGNING] signed PDF failed:", pdfError);
      }
      const [sender] = await publicDb.select({ email: users.email, first: users.firstName }).from(users).where(eq(users.id, link.createdBy));
      const label = `${doc.kind === "change_order" ? "Change order" : "Proposal"}${doc.number ? ` ${doc.number}` : ""} - ${[doc.projectNumber, doc.projectName].filter(Boolean).join(" ")}`;
      const attachment = filed ? { filename: filed.filename, content: filed.buffer } : null;
      const customerTo = (link.recipientEmail ?? "").split(",").map((a) => a.trim()).filter(Boolean);
      const notes: string[] = [];
      if (customerTo.length) {
        try {
          await sendDocumentMail({
            fromName: tenant.companyName, replyTo: sender?.email ?? null, to: customerTo,
            subject: `Signed: ${label}`,
            text: `Hello,\n\nThank you. ${input.signerName} signed ${label} on ${new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}.${attachment ? " A signed copy is attached for your records." : ""}\n\n${tenant.companyName}`,
            attachment,
          });
        } catch (e) { notes.push(`customer email: ${e instanceof Error ? e.message : "failed"}`); }
      }
      if (sender?.email) {
        try {
          await sendDocumentMail({
            fromName: "BidAxiom", to: [sender.email],
            subject: `Signed by ${input.signerName}: ${label}`,
            text: `${input.signerName} signed ${label}.\n\nContract value: ${(accepted.contractValue / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}. ${accepted.orders.length} draft order${accepted.orders.length === 1 ? "" : "s"} created.\n\nThe signed copy is in the project's Documents under Signed Proposals.${pdfError ? `\n\nThe signed PDF could not be made automatically (${pdfError}). Open the proposal and use Download PDF.` : ""}`,
            attachment,
          });
        } catch (e) { notes.push(`sender email: ${e instanceof Error ? e.message : "failed"}`); }
      }
      if (notes.length) console.error("[SIGNING] notifications:", notes.join("; "));
      return { signed: true as const, contractValue: accepted.contractValue };
    }),

  /** The customer declines. The proposal stays as sent so it can be revised. */
  decline: publicProcedure
    .input(z.object({ token: z.string().min(20).max(100), signerName: z.string().trim().min(2).max(200), reason: z.string().trim().max(2000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const { link, tenant } = await openLink(input.token);
      if ((await stateOf(link, tenant)) !== "open") throw new TRPCError({ code: "BAD_REQUEST", message: "This link can no longer be used." });
      const claimed = await publicDb
        .update(signingLinks)
        .set({ status: "declined", completedAt: new Date() })
        .where(and(eq(signingLinks.id, link.id), eq(signingLinks.status, "pending")))
        .returning({ id: signingLinks.id });
      if (claimed.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "This link can no longer be used." });
      const { db, schema } = tenant;
      await db.insert(schema.proposalSignatures).values({
        estimateId: link.estimateId, outcome: "declined", signerName: input.signerName,
        signerEmail: link.recipientEmail?.split(",")[0]?.trim() || null, declineReason: input.reason || null, ip: ctx.ip ?? null,
      });
      const [sender] = await publicDb.select({ email: users.email }).from(users).where(eq(users.id, link.createdBy));
      if (sender?.email) {
        sendDocumentMail({
          fromName: "BidAxiom", to: [sender.email], subject: `Declined by ${input.signerName}`,
          text: `${input.signerName} declined the proposal you sent${input.reason ? `.\n\nReason: ${input.reason}` : "."}\n\nYou can create a revision and send it again.`,
        }).catch((e) => console.error("[SIGNING] decline notice failed:", e));
      }
      return { declined: true as const };
    }),

  /** For the sender: where the signing stands on this proposal. */
  status: protectedProcedure.input(z.object({ estimateId: z.string().uuid() })).query(async ({ ctx, input }) => {
    if (!ctx.tenant || !ctx.orgId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    const { db, schema } = ctx.tenant;
    const [link] = await publicDb
      .select()
      .from(signingLinks)
      .where(and(eq(signingLinks.estimateId, input.estimateId), eq(signingLinks.organizationId, ctx.orgId)))
      .orderBy(desc(signingLinks.createdAt))
      .limit(1);
    const sigs = await db.select().from(schema.proposalSignatures).where(eq(schema.proposalSignatures.estimateId, input.estimateId)).orderBy(desc(schema.proposalSignatures.signedAt)).limit(1);
    const sig = sigs[0] ?? null;
    let pdfUrl: string | null = null;
    if (sig?.pdfDocumentId) {
      const [d] = await db.select({ name: schema.documents.name, versionId: schema.documents.currentVersionId }).from(schema.documents).where(eq(schema.documents.id, sig.pdfDocumentId));
      if (d?.versionId) {
        const [v] = await db.select({ key: schema.documentVersions.storageKey }).from(schema.documentVersions).where(eq(schema.documentVersions.id, d.versionId));
        if (v) pdfUrl = await generateDownloadUrl(v.key, d.name);
      }
    }
    return {
      link: link ? { status: link.status, recipient: link.recipientEmail, viewedAt: link.viewedAt, expiresAt: link.expiresAt, sentAt: link.createdAt, expired: link.status === "pending" && link.expiresAt.getTime() < Date.now() } : null,
      signature: sig ? { outcome: sig.outcome, signerName: sig.signerName, signedAt: sig.signedAt, declineReason: sig.declineReason, hasPdf: !!sig.pdfDocumentId } : null,
      pdfUrl,
    };
  }),

  /** The stored company signature for the settings page. */
  companyGet: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    const { db, schema } = ctx.tenant;
    const [co] = await db.select().from(schema.companySignature).limit(1);
    return co ? { enabled: co.enabled, signerName: co.signerName, signerTitle: co.signerTitle, signatureType: co.signatureType, signatureImage: co.signatureImage, authorizedAt: co.authorizedAt } : null;
  }),

  /** Set or replace the company signature. Admins only; saving records the authorization. */
  companySave: protectedProcedure
    .input(z.object({
      signerName: z.string().trim().min(2).max(200),
      signerTitle: z.string().trim().max(200).optional(),
      signatureType: z.enum(["drawn", "typed"]),
      signatureImage: z.string().max(400_000).regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/).nullable(),
      authorize: z.literal(true),
      enabled: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      if (ctx.orgRole !== "org:admin") throw new TRPCError({ code: "FORBIDDEN", message: "Only an administrator can set the company signature." });
      if (input.signatureType === "drawn" && !input.signatureImage) throw new TRPCError({ code: "BAD_REQUEST", message: "Please draw the signature." });
      const { db, schema } = ctx.tenant;
      const values = {
        enabled: input.enabled, signerName: input.signerName, signerTitle: input.signerTitle || null, signatureType: input.signatureType,
        signatureImage: input.signatureType === "drawn" ? input.signatureImage : null, authorizedBy: ctx.userId, authorizedAt: new Date(),
      };
      const [existing] = await db.select({ id: schema.companySignature.id }).from(schema.companySignature).limit(1);
      if (existing) await db.update(schema.companySignature).set(values).where(eq(schema.companySignature.id, existing.id));
      else await db.insert(schema.companySignature).values(values);
      await createAuditLog(db, schema, { entityType: "CompanySignature", entityId: existing?.id ?? "company", action: AuditAction.UPDATE, actorId: ctx.userId, changes: { after: { signer: input.signerName, title: input.signerTitle, enabled: input.enabled } } });
      return { ok: true as const };
    }),

  /** Turn automatic countersigning off (keeps the signature on file). */
  companyDisable: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    if (ctx.orgRole !== "org:admin") throw new TRPCError({ code: "FORBIDDEN", message: "Only an administrator can change the company signature." });
    await ctx.tenant.db.update(ctx.tenant.schema.companySignature).set({ enabled: false });
    return { ok: true as const };
  }),

  /** Stop a pending link from working. */
  revoke: protectedProcedure.input(z.object({ estimateId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    if (!ctx.orgId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    await publicDb
      .update(signingLinks)
      .set({ status: "revoked" })
      .where(and(eq(signingLinks.estimateId, input.estimateId), eq(signingLinks.organizationId, ctx.orgId), eq(signingLinks.status, "pending")));
    return { ok: true as const };
  }),
});
