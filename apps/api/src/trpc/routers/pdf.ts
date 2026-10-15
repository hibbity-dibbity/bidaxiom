import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, isNull, sql, and } from "drizzle-orm";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { renderDocumentPdf } from "../../pdf/documents.js";
import { buildRfqHtml, type RfqPdfData } from "../../pdf/templates/rfq.js";
import {
  getNextDocumentSequence,
  resolveFileName,
  uploadPdfAndSave,
} from "../../pdf/generate.js";
import { generatePdfBuffer } from "../../pdf/engine.js";
import { getStorageClient, getBucketName } from "../../storage/client.js";
import { renderTemplate } from "../../templates/render.js";

/**
 * Resolve a renderTemplate() result OR a plain HTML string to a PDF buffer.
 * - RenderResult { type: "pdf" }  → return buffer directly (LibreOffice path)
 * - RenderResult { type: "html" } → run through Puppeteer
 * - string                        → run through Puppeteer (built-in HTML builders)
 */
async function resolveToPdf(
  result: Awaited<ReturnType<typeof renderTemplate>> | string
): Promise<Buffer> {
  if (typeof result === "string") return generatePdfBuffer(result);
  return result.type === "pdf" ? result.buffer : generatePdfBuffer(result.html);
}
import type { FieldMapping } from "@construction/shared";


/**
 * Format an ISO date string as "Month DD, YYYY" (e.g., "February 19, 2026").
 */
function formatGeneratedDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}


/**
 * PDF generation router.
 * Shell router for Phase 38 — procedures added by plans 38-03 through 38-06.
 */
export const pdfRouter = router({
  /**
   * Smoke-test procedure to confirm the router loads without error.
   * Returns { ok: true } for all authenticated + tenant-scoped requests.
   */
  getStatus: protectedProcedure
    .query(() => ({ ok: true })),

  /**
   * PDF of a proposal, change order, invoice or order exactly as it looks on screen. Returned as
   * base64 so the browser can save it. Email uses the same renderer.
   */
  document: protectedProcedure
    .input(z.object({ kind: z.enum(["proposal", "invoice", "order"]), id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId || !ctx.orgId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      const out = await renderDocumentPdf(
        ctx.tenant,
        { userId: ctx.userId, orgId: ctx.orgId, orgRole: ctx.orgRole ?? "org:member", orgName: ctx.tenant.companyName },
        input.kind,
        input.id
      );
      return { filename: out.filename, base64: out.buffer.toString("base64") };
    }),

  /**
   * Generate an RFQ PDF for a Request for Quotation.
   *
   * 1. Looks up project by slug.
   * 2. Looks up RFQ by id; verifies it belongs to the project.
   * 3. Gets company name from public.tenants.
   * 4. Gets documentNamingSettings from active companyProfile.
   * 5. Increments the "rfq" sequence counter.
   * 6. Resolves PDF file name from naming settings.
   * 7. Builds RfqPdfData using actual RFQ schema fields.
   * 8. Calls buildRfqHtml().
   * 9. Renders PDF via Puppeteer (generatePdfBuffer).
   * 10. Uploads to S3 and inserts document + version rows with category "rfq".
   * 11. Returns { documentId, fileName, message }.
   */
  generateRfq: protectedProcedure
    .input(
      z.object({
        projectSlug: z.string(),
        rfqId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const tenantId = ctx.tenant.tenantId as string;

      // --- 1. Look up project by slug ---
      const [project] = await db
        .select({
          id: schema.projects.id,
          name: schema.projects.name,
          jobNumber: schema.projects.jobNumber,
          street1: schema.projects.street1,
          street2: schema.projects.street2,
          city: schema.projects.city,
          state: schema.projects.state,
          zip: schema.projects.zip,
        })
        .from(schema.projects)
        .where(eq(schema.projects.slug, input.projectSlug))
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // --- 2. Look up RFQ and verify it belongs to this project ---
      const [rfq] = await db
        .select()
        .from(schema.rfqs)
        .where(eq(schema.rfqs.id, input.rfqId))
        .limit(1);

      if (!rfq || rfq.projectId !== project.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RFQ not found for this project",
        });
      }

      // --- 3. Get company name from public.tenants ---
      const tenantResult = await db.execute(
        sql`SELECT name FROM public.tenants WHERE id = ${tenantId} LIMIT 1`
      );
      const companyName =
        (tenantResult.rows?.[0] as { name?: string } | undefined)?.name ??
        "Your Company";

      // --- 4. Fetch active company profile for naming settings ---
      const [companyProfile] = await db
        .select({
          documentNamingSettings: schema.companyProfiles.documentNamingSettings,
          phone: schema.companyProfiles.phone,
          license: schema.companyProfiles.license,
          street1: schema.companyProfiles.street1,
          street2: schema.companyProfiles.street2,
          city: schema.companyProfiles.city,
          state: schema.companyProfiles.state,
          zip: schema.companyProfiles.zip,
        })
        .from(schema.companyProfiles)
        .where(isNull(schema.companyProfiles.validTo))
        .limit(1);

      // --- 5. Get next sequence number ---
      const seq = await getNextDocumentSequence(db, schema, "rfq");

      // --- 6. Resolve file name ---
      const fileName = resolveFileName(
        companyProfile?.documentNamingSettings ?? null,
        "rfq",
        project.jobNumber ?? null,
        project.name,
        seq
      );

      // --- 7. Build RfqPdfData ---
      const addressParts = [project.street1, project.city, project.state, project.zip].filter(Boolean);
      const projectAddress =
        addressParts.length > 0 ? addressParts.join(", ") : "Address not provided";

      const generatedDate = formatGeneratedDate(new Date().toISOString());

      // Format dueDate as "Month DD, YYYY" or null if missing
      const dueDateFormatted = rfq.dueDate
        ? formatGeneratedDate(new Date(rfq.dueDate).toISOString())
        : null;

      // RFQ number: prefer schema rfqNumber, otherwise derive from sequence
      const rfqNumber = rfq.rfqNumber || `RFQ-${seq.toString().padStart(3, "0")}`;

      const pdfData: RfqPdfData = {
        companyName,
        projectName: project.name,
        jobNumber: project.jobNumber ?? null,
        projectAddress,
        rfqTitle: rfq.title,
        rfqNumber,
        scopeOfWork: rfq.scopeOfWork,
        dueDate: dueDateFormatted,
        description: rfq.description ?? null,
        generatedDate,
      };

      // --- 8. Check for active custom template (TMPL-06) ---
      const [activeTemplate] = await db
        .select()
        .from(schema.documentTemplates)
        .where(
          and(
            eq(schema.documentTemplates.docType, "rfq"),
            eq(schema.documentTemplates.isActive, true)
          )
        )
        .limit(1);

      // --- 9. Build HTML or PDF (custom template or built-in fallback) ---
      let htmlOrResult: string | Awaited<ReturnType<typeof renderTemplate>>;
      if (activeTemplate?.fieldMappings?.length) {
        // Download .docx from S3 and fill placeholders via docxtemplater → mammoth
        const s3 = getStorageClient();
        const bucket = getBucketName();
        const getCmd = new GetObjectCommand({ Bucket: bucket, Key: activeTemplate.storageKey });
        const s3Res = await s3.send(getCmd);
        const chunks: Uint8Array[] = [];
        for await (const chunk of s3Res.Body as AsyncIterable<Uint8Array>) {
          chunks.push(chunk);
        }
        const docxBuffer = Buffer.concat(chunks);

        const companyAddressParts = [companyProfile?.street1, companyProfile?.city, companyProfile?.state, companyProfile?.zip].filter(Boolean);
        const realData: Record<string, string> = {
          "company.name": companyName,
          "company.phone": companyProfile?.phone ?? "",
          "company.license": companyProfile?.license ?? "",
          "company.address": companyAddressParts.length > 0 ? companyAddressParts.join(", ") : "",
          "company.street1": companyProfile?.street1 ?? "",
          "company.street2": companyProfile?.street2 ?? "",
          "company.city": companyProfile?.city ?? "",
          "company.state": companyProfile?.state ?? "",
          "company.zip": companyProfile?.zip ?? "",
          "company.primaryColor": "#3B5BDB",
          "project.name": pdfData.projectName,
          "project.jobNumber": project.jobNumber ?? "",
          "project.clientName": "",
          "project.address": pdfData.projectAddress,
          "project.street1": project.street1 ?? "",
          "project.street2": project.street2 ?? "",
          "project.city": project.city ?? "",
          "project.state": project.state ?? "",
          "project.zip": project.zip ?? "",
          "doc.rfqNumber": String(pdfData.rfqNumber ?? ""),
          "doc.rfqTitle": String(pdfData.rfqTitle ?? ""),
          "doc.submissionDeadline": String(pdfData.dueDate ?? ""),
          "doc.scopeOfWork": String(pdfData.scopeOfWork ?? ""),
          "doc.paymentTerms": "Net 30",
          "doc.generatedDate": pdfData.generatedDate,
        };
        htmlOrResult = await renderTemplate(
          docxBuffer,
          activeTemplate.fileType as "docx" | "xlsx",
          activeTemplate.fieldMappings as FieldMapping[],
          realData,
          false // isPreview=false — production
        );
      } else {
        htmlOrResult = buildRfqHtml(pdfData);
      }

      // --- 10. Generate PDF buffer (LibreOffice or Puppeteer) ---
      const pdfBuffer = await resolveToPdf(htmlOrResult);

      // --- 11. Upload to S3 + insert document record ---
      const result = await uploadPdfAndSave({
        db,
        schema,
        tenantId,
        projectId: project.id,
        userId: ctx.userId,
        fileName,
        category: "rfq",
        description: `RFQ: ${rfq.title || rfq.description || "Request for Quotation"}`,
        pdfBuffer,
        templateId: activeTemplate?.id ?? null,
      });

      return {
        documentId: result.documentId,
        fileName: result.fileName,
        message: "RFQ PDF generated successfully",
      };
    }),
});
