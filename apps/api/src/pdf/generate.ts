import { eq, sql } from "drizzle-orm";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import {
  getStorageClient,
  getBucketName,
  buildStorageKey,
} from "../storage/client.js";

// ---------------------------------------------------------------------------
// Company Branding
// ---------------------------------------------------------------------------

/**
 * Company branding returned for PDF generation.
 * In Phase 38, only the company name and BIDAXIOM brand color are used.
 * Logo embedding is deferred to Phase 39 (PDF-05 partial satisfaction).
 */
export interface CompanyBranding {
  companyName: string;
  primaryColor: string; // Always "#3B5BDB" in Phase 38; logo support in Phase 39
}

/**
 * Fetch company branding for a tenant.
 * Queries public.tenants for the company name and returns Phase 38 default
 * branding (BIDAXIOM brand color; no logo).
 *
 * @param db     - Drizzle DB instance (tenant-scoped or public — uses raw SQL)
 * @param tenantId - Tenant ID (matches public.tenants.id)
 */
export async function getCompanyBranding(
  db: any,
  tenantId: string
): Promise<CompanyBranding> {
  // Query public.tenants for the company name (not the tenant schema).
  const result = await db.execute(
    sql`SELECT name FROM public.tenants WHERE id = ${tenantId} LIMIT 1`
  );
  const companyName = result.rows?.[0]?.name ?? "Your Company";
  return {
    companyName,
    primaryColor: "#3B5BDB", // BIDAXIOM brand color — logo embedding deferred to Phase 39
  };
}

// ---------------------------------------------------------------------------
// S3 Upload + Document Library Insert
// ---------------------------------------------------------------------------

/**
 * Parameters for uploading a generated PDF and saving it to the document library.
 */
export interface SavePdfParams {
  db: any;          // Drizzle DB instance (tenant-scoped)
  schema: any;      // Tenant schema object from buildTenantContext()
  tenantId: string;
  projectId: string;
  userId: string;
  fileName: string;    // Already resolved by resolveDocumentFileName()
  category: string;    // "proposal" | "change_order" | "payment_app" | "rfq"
  description: string;
  pdfBuffer: Buffer;
  templateId?: string | null; // Phase 39: FK to document_templates.id (TMPL-06)
}

/**
 * Result returned from uploadPdfAndSave.
 */
export interface SavePdfResult {
  documentId: string;
  storageKey: string;
  fileName: string;
}

/**
 * Upload a PDF buffer to S3 and insert rows into documents + document_versions.
 *
 * Steps:
 *  1. Build a tenant-isolated S3 key and upload the PDF buffer.
 *  2. Insert a row into schema.documents and capture the generated ID.
 *  3. Insert a row into schema.documentVersions (version 1).
 *  4. Update schema.documents.currentVersionId to point to the new version.
 *
 * @param params - See SavePdfParams interface
 * @returns { documentId, storageKey, fileName }
 */
export async function uploadPdfAndSave(
  params: SavePdfParams
): Promise<SavePdfResult> {
  const {
    db,
    schema,
    tenantId,
    projectId,
    userId,
    fileName,
    category,
    description,
    pdfBuffer,
    templateId,
  } = params;

  const s3 = getStorageClient();
  const bucket = getBucketName();
  const key = buildStorageKey(tenantId, projectId, fileName);

  // 1. Upload to S3
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    })
  );

  // 2. Insert document metadata row
  const [doc] = await db
    .insert(schema.documents)
    .values({
      projectId,
      name: fileName,
      category,
      description,
      fileSize: pdfBuffer.length,
      contentType: "application/pdf",
      createdBy: userId,
      templateId: templateId ?? null,
    })
    .returning({ id: schema.documents.id });

  // 3. Insert document version row (version 1)
  const [version] = await db
    .insert(schema.documentVersions)
    .values({
      documentId: doc.id,
      versionNumber: 1,
      storageKey: key,
      fileSize: pdfBuffer.length,
      contentType: "application/pdf",
      uploadedBy: userId,
    })
    .returning({ id: schema.documentVersions.id });

  // 4. Update document to point to current version
  await db
    .update(schema.documents)
    .set({ currentVersionId: version.id })
    .where(eq(schema.documents.id, doc.id));

  return {
    documentId: doc.id,
    storageKey: key,
    fileName,
  };
}
