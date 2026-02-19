import { eq, sql } from "drizzle-orm";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import {
  getStorageClient,
  getBucketName,
  buildStorageKey,
} from "../storage/client.js";
import type { PdfDocType, DocumentNamingSettings } from "@construction/shared";

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
// Atomic Document Sequence Counter
// ---------------------------------------------------------------------------

/**
 * Get and atomically increment the next sequence number for a document type.
 *
 * Uses SELECT FOR UPDATE inside a transaction to prevent race conditions when
 * multiple users generate PDFs of the same type concurrently.
 *
 * Returns the NEW (already-incremented) sequence number.
 *
 * @param db      - Drizzle DB instance (tenant schema)
 * @param schema  - Tenant schema object from buildTenantContext()
 * @param docType - "proposal" | "change_order" | "payment_app" | "rfq"
 */
export async function getNextDocumentSequence(
  db: any,
  schema: any,
  docType: PdfDocType
): Promise<number> {
  return await db.transaction(async (tx: any) => {
    const [counter] = await tx
      .select()
      .from(schema.documentNamingCounters)
      .where(eq(schema.documentNamingCounters.docType, docType))
      .for("update");

    if (!counter) {
      // First PDF of this type — insert with currentNumber: 1
      await tx.insert(schema.documentNamingCounters).values({
        docType,
        currentNumber: 1,
      });
      return 1;
    }

    // Increment existing counter
    const nextNumber = counter.currentNumber + 1;
    await tx
      .update(schema.documentNamingCounters)
      .set({ currentNumber: nextNumber })
      .where(eq(schema.documentNamingCounters.id, counter.id));

    return nextNumber;
  });
}

// ---------------------------------------------------------------------------
// File Name Resolution
// ---------------------------------------------------------------------------

/** Shorthand label used in the {DOC-TYPE} template variable */
const DOC_TYPE_LABELS: Record<PdfDocType, string> = {
  proposal: "PROPOSAL",
  change_order: "CO",
  payment_app: "PAY-APP",
  rfq: "RFQ",
};

/**
 * Slugify a project name for use in file names.
 * Replaces spaces with dashes, lowercases, and truncates to 40 characters.
 */
function slugifyProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
}

/**
 * Resolve the final PDF file name from naming settings and document metadata.
 *
 * Pure function — no I/O. Replaces template variables:
 *   {JOB-NUMBER}    → jobNumber (or "NOJOB" if null)
 *   {PROJECT-NAME}  → slugified project name (max 40 chars)
 *   {DOC-TYPE}      → "PROPOSAL" | "CO" | "PAY-APP" | "RFQ"
 *   {SEQ}           → zero-padded 3-digit sequence (e.g., "003")
 *   {YEAR}          → 4-digit year (e.g., "2026")
 *   {MONTH}         → zero-padded month (e.g., "02")
 *   {DATE}          → YYYY-MM-DD
 *
 * @param settings       - DocumentNamingSettings from companyProfiles (may be null)
 * @param docType        - Document type key
 * @param jobNumber      - Job number string or null
 * @param projectName    - Project display name
 * @param sequenceNumber - Sequence number from getNextDocumentSequence()
 * @returns File name with .pdf extension (guaranteed)
 */
export function resolveFileName(
  settings: DocumentNamingSettings | null | undefined,
  docType: PdfDocType,
  jobNumber: string | null,
  projectName: string,
  sequenceNumber: number
): string {
  const template =
    settings?.[docType]?.template ?? "{DOC-TYPE}-{JOB-NUMBER}-{DATE}";

  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = `${year}-${month}-${String(now.getDate()).padStart(2, "0")}`;

  let fileName = template
    .replace(/\{JOB-NUMBER\}/g, jobNumber ?? "NOJOB")
    .replace(/\{PROJECT-NAME\}/g, slugifyProjectName(projectName))
    .replace(/\{DOC-TYPE\}/g, DOC_TYPE_LABELS[docType])
    .replace(/\{SEQ\}/g, String(sequenceNumber).padStart(3, "0"))
    .replace(/\{YEAR\}/g, year)
    .replace(/\{MONTH\}/g, month)
    .replace(/\{DATE\}/g, date);

  // Ensure .pdf extension
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    fileName += ".pdf";
  }

  return fileName;
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
  fileName: string;    // From resolveFileName()
  category: string;    // "proposal" | "change_order" | "payment_app" | "rfq"
  description: string;
  pdfBuffer: Buffer;
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
