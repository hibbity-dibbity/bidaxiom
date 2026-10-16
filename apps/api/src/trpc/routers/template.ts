/**
 * Template management router — Phase 39 (TMPL-01 through TMPL-06).
 *
 * Provides 7 procedures for the full custom template lifecycle:
 *   getUploadUrl       — presigned S3 PUT URL for browser upload
 *   registerAndExtract — download uploaded file, extract <<fields>>, insert row
 *   updateMappings     — save field mappings (always allowed per CONTEXT.md)
 *   generatePreview    — build HTML → PDF → presigned GET URL (no document row)
 *   setActive          — atomic deactivate-all then activate target (per docType)
 *   listByDocType      — list all templates, optionally filtered by docType
 *   deleteTemplate     — delete from S3 + DB
 *
 * Auth: all procedures use protectedProcedure; admin check enforced inline.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { getPresignClient, getStorageClient, getBucketName, buildTemplateStorageKey } from "../../storage/client.js";
import { parseDocxFields, parseXlsxFields } from "../../templates/extract.js";
import { renderTemplate, type RenderResult } from "../../templates/render.js";
import { buildPreviewData } from "../../templates/fixtures.js";
import { getCompanyBranding } from "../../pdf/generate.js";
import { generatePdfBuffer } from "../../pdf/engine.js";
import type { FieldMapping } from "@construction/shared";

// ---------------------------------------------------------------------------
// Shared Zod enums
// ---------------------------------------------------------------------------

const docTypeEnum = z.enum(["proposal", "change_order"]);
const fileTypeEnum = z.enum(["docx", "xlsx"]);

// ---------------------------------------------------------------------------
// Helper: enforce admin role
// ---------------------------------------------------------------------------

function requireAdmin(ctx: { orgRole: string | null }): void {
  if (ctx.orgRole !== "org:admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Template management requires admin role",
    });
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const templateRouter = router({
  /**
   * TMPL-01 — Get a presigned S3 PUT URL for uploading a template file.
   *
   * The browser uploads directly to S3 using the returned uploadUrl.
   * After the upload completes, call registerAndExtract with the storageKey.
   *
   * Returns: { uploadUrl, storageKey, fileType }
   */
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        fileName: z.string().min(1),
        contentType: z.enum([
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ]),
        docType: docTypeEnum,
        name: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      requireAdmin(ctx);

      const tenantId = ctx.tenant.tenantId as string;

      // Derive fileType from contentType
      const fileType: "docx" | "xlsx" = input.contentType.endsWith(
        "wordprocessingml.document"
      )
        ? "docx"
        : "xlsx";

      const storageKey = buildTemplateStorageKey(tenantId, input.fileName);

      const s3 = getStorageClient();
      const bucket = getBucketName();

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        ContentType: input.contentType,
      });

      const uploadUrl = await getSignedUrl(getPresignClient(), command, { expiresIn: 300 }); // 5 minutes

      return { uploadUrl, storageKey, fileType };
    }),

  /**
   * TMPL-01 continued — Register a template after browser upload and extract fields.
   *
   * Downloads the file from S3, extracts <<field>> merge tags, inserts a
   * document_templates row, and returns the detected fields.
   *
   * Returns: { templateId, detectedFields }
   */
  registerAndExtract: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        docType: docTypeEnum,
        fileType: fileTypeEnum,
        storageKey: z.string().min(1),
        fileSize: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      requireAdmin(ctx);

      const { db, schema } = ctx.tenant;

      // Download file from S3
      const s3 = getStorageClient();
      const bucket = getBucketName();

      const getCmd = new GetObjectCommand({
        Bucket: bucket,
        Key: input.storageKey,
      });

      const response = await s3.send(getCmd);
      if (!response.Body) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Template file not found in storage",
        });
      }

      // Stream S3 response body to Buffer
      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      // Extract fields from the uploaded file
      const extractedFields =
        input.fileType === "docx"
          ? parseDocxFields(buffer)
          : await parseXlsxFields(buffer);

      // Insert document_templates row
      const [inserted] = await db
        .insert(schema.documentTemplates)
        .values({
          docType: input.docType,
          name: input.name,
          fileType: input.fileType,
          storageKey: input.storageKey,
          fileSize: input.fileSize ?? null,
          detectedFields: extractedFields,
          fieldMappings: extractedFields.map((f) => ({ ...f, mappedTo: null })),
          isActive: false,
          uploadedBy: ctx.userId!,
        })
        .returning({ id: schema.documentTemplates.id });

      return {
        templateId: inserted.id,
        detectedFields: extractedFields,
      };
    }),

  /**
   * TMPL-02 / TMPL-03 — Save field mappings for a template.
   *
   * Save is ALWAYS allowed per CONTEXT.md — unmapped fields do NOT block saving.
   * Returns unmapped field names for UI awareness only (not an error).
   *
   * Returns: { savedAt, unmappedCount, unmappedFields }
   */
  updateMappings: protectedProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
        fieldMappings: z.array(
          z.object({
            detectedField: z.string(),
            displayField: z.string(),
            mappedTo: z.string().nullable(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      requireAdmin(ctx);

      const { db, schema } = ctx.tenant;

      // Verify template belongs to this tenant (security check)
      const [template] = await db
        .select({ id: schema.documentTemplates.id })
        .from(schema.documentTemplates)
        .where(eq(schema.documentTemplates.id, input.templateId))
        .limit(1);

      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }

      // Compute unmapped fields for informational return value
      const unmappedFields = input.fieldMappings
        .filter((m) => m.mappedTo === null)
        .map((m) => m.displayField);

      // Save mappings — always allowed, never blocked
      await db
        .update(schema.documentTemplates)
        .set({
          fieldMappings: input.fieldMappings as FieldMapping[],
          updatedAt: new Date(),
        })
        .where(eq(schema.documentTemplates.id, input.templateId));

      const savedAt = new Date().toISOString();

      return {
        savedAt,
        unmappedCount: unmappedFields.length,
        unmappedFields,
      };
    }),

  /**
   * TMPL-04 — Generate a preview PDF using sample data.
   *
   * Unmapped fields render as [UNMAPPED] in preview mode.
   * Uploads a throw-away preview PDF to S3 and returns a presigned GET URL.
   * Does NOT insert a row into schema.documents.
   *
   * Returns: { previewUrl } — signed S3 URL valid for 5 minutes
   */
  generatePreview: protectedProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      requireAdmin(ctx);

      const { db, schema } = ctx.tenant;
      const tenantId = ctx.tenant.tenantId as string;

      // Fetch template (verify tenant ownership)
      const [template] = await db
        .select()
        .from(schema.documentTemplates)
        .where(eq(schema.documentTemplates.id, input.templateId))
        .limit(1);

      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }

      // Download .docx from S3 to fill with sample data
      const s3 = getStorageClient();
      const bucket = getBucketName();
      const getCmd = new GetObjectCommand({ Bucket: bucket, Key: template.storageKey });
      const s3Response = await s3.send(getCmd);
      if (!s3Response.Body) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Template file not found in storage",
        });
      }
      const chunks: Uint8Array[] = [];
      for await (const chunk of s3Response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      const docxBuffer = Buffer.concat(chunks);

      // Fetch company branding
      const branding = await getCompanyBranding(db, tenantId);

      // Build preview data: real company branding over fixture data
      const previewData = buildPreviewData({
        "company.name": branding.companyName,
        "company.primaryColor": branding.primaryColor,
      });

      // Render: fill placeholders → PDF (LibreOffice) or HTML (mammoth/ExcelJS fallback)
      const rendered = await renderTemplate(
        docxBuffer,
        template.fileType as "docx" | "xlsx",
        template.fieldMappings as FieldMapping[],
        previewData,
        true // isPreview
      );

      // Generate PDF buffer — native from LibreOffice or via Puppeteer
      const pdfBuffer =
        rendered.type === "pdf"
          ? rendered.buffer
          : await generatePdfBuffer(rendered.html);

      // Upload to S3 with a temporary preview key
      // (Reuse s3/bucket already declared above for the .docx download)
      const previewKey = `tenants/${tenantId}/previews/${input.templateId}/preview.pdf`;

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: previewKey,
          Body: pdfBuffer,
          ContentType: "application/pdf",
        })
      );

      // Generate presigned GET URL valid for 5 minutes
      const previewGetCmd = new GetObjectCommand({
        Bucket: bucket,
        Key: previewKey,
      });
      const previewUrl = await getSignedUrl(getPresignClient(), previewGetCmd, { expiresIn: 300 }); // 5 minutes

      return { previewUrl };
    }),

  /**
   * TMPL-05 — Toggle a template active/inactive.
   *
   * When activating: deactivates ALL templates of the same docType first,
   * then activates the target. Atomic transaction — DB partial unique index
   * enforces one-active-per-docType at the storage level.
   *
   * Returns: { ok: true }
   */
  setActive: protectedProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      requireAdmin(ctx);

      const { db, schema } = ctx.tenant;

      await db.transaction(async (tx) => {
        // Fetch the template to get its docType
        const [tpl] = await tx
          .select()
          .from(schema.documentTemplates)
          .where(eq(schema.documentTemplates.id, input.templateId))
          .limit(1);

        if (!tpl) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        }

        if (input.isActive) {
          // Deactivate all templates of this docType first
          await tx
            .update(schema.documentTemplates)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(schema.documentTemplates.docType, tpl.docType));

          // Activate the target
          await tx
            .update(schema.documentTemplates)
            .set({ isActive: true, updatedAt: new Date() })
            .where(eq(schema.documentTemplates.id, input.templateId));
        } else {
          // Just deactivate this one
          await tx
            .update(schema.documentTemplates)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(schema.documentTemplates.id, input.templateId));
        }
      });

      return { ok: true };
    }),

  /**
   * Fetch a single template by ID (for the field mapping page).
   * Returns the full template row including detectedFields and fieldMappings.
   *
   * Returns: template row
   */
  getById: protectedProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }

      const { db, schema } = ctx.tenant;

      const [template] = await db
        .select()
        .from(schema.documentTemplates)
        .where(eq(schema.documentTemplates.id, input.templateId))
        .limit(1);

      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }

      return template;
    }),

  /**
   * List all templates for this tenant, optionally filtered by docType.
   * Ordered by createdAt descending (newest first).
   *
   * Returns: Array of document_templates rows
   */
  listByDocType: protectedProcedure
    .input(
      z.object({
        docType: docTypeEnum.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }

      const { db, schema } = ctx.tenant;

      const rows = await db
        .select()
        .from(schema.documentTemplates)
        .where(
          input.docType
            ? eq(schema.documentTemplates.docType, input.docType)
            : undefined
        )
        .orderBy(schema.documentTemplates.createdAt);

      return rows;
    }),

  /**
   * Delete a template: remove from S3 and from the database.
   *
   * FK on documents.templateId has ON DELETE SET NULL — safe to delete.
   * Returns: { deleted: true }
   */
  deleteTemplate: protectedProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      requireAdmin(ctx);

      const { db, schema } = ctx.tenant;

      // Verify template belongs to this tenant
      const [template] = await db
        .select()
        .from(schema.documentTemplates)
        .where(eq(schema.documentTemplates.id, input.templateId))
        .limit(1);

      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }

      // Delete file from S3
      const s3 = getStorageClient();
      const bucket = getBucketName();

      try {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: template.storageKey,
          })
        );
      } catch {
        // S3 delete failure is non-fatal — proceed with DB deletion
        // (file may already be gone; DB row must still be cleaned up)
      }

      // Delete from DB
      await db
        .delete(schema.documentTemplates)
        .where(eq(schema.documentTemplates.id, input.templateId));

      return { deleted: true };
    }),
});
