import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, isNull, sql, and } from "drizzle-orm";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { renderDocumentPdf } from "../../pdf/documents.js";
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

});
