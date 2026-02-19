# Phase 38: PDF Generation + Document Naming - Research

**Researched:** 2026-02-19
**Domain:** Server-side PDF generation (Puppeteer), document naming conventions, AIA G702/G703 form layout, S3 document storage integration
**Confidence:** HIGH (codebase verified; library already installed; patterns confirmed)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PDF-01 | Proposal PDF from Estimates section with logo, line items, subtotals, signature block | Puppeteer + HTML template; `estimates` + `estimate_line_items` tables confirmed; logo via static file |
| PDF-02 | Change Order PDF with CO number, cost breakdown by labor/materials, signature blocks | `change_orders` + `change_order_line_items` tables confirmed; costType field distinguishes labor/materials |
| PDF-03 | AIA G702/G703-compliant Payment Application PDF | `payment_apps` + `payment_app_line_items` + `sov_items` tables confirmed; all required G702/G703 fields map to schema |
| PDF-04 | RFQ PDF with scope items, description/qty/unit, deadline, payment terms | **Schema gap**: RFQ `scopeOfWork` is a text blob, not structured line items; qty/unit do not exist; `paymentTerms` field does not exist |
| PDF-05 | PDFs use company logo and brand colors from Company Settings | `companyProfiles.logoStorageKey` exists but `brandColor`/`primaryColor` columns do not exist in schema; BIDAXIOM fallback logos exist in `/apps/web/public/` |
| PDF-06 | Generated PDFs stored in project document library immediately | S3 storage infrastructure fully implemented; `documents` + `document_versions` tables confirmed; `buildStorageKey` helper ready |
| NAME-01 | Admin configures naming template per doc type with variables in Company Settings | New JSONB column needed on `companyProfiles`; no existing document naming config |
| NAME-02 | Per-doc-type sequence counter auto-increments atomically on each generation | Pattern established (SELECT FOR UPDATE in transactions) via `workflowCounters`, `changeOrderCounters`, `paymentAppCounters` |
| NAME-03 | Live preview of resulting filename in settings UI | Frontend only; variable substitution logic in shared package |
| NAME-04 | Default naming `{DOC-TYPE}-{JOB-NUMBER}-{DATE}` when no convention configured | Fallback logic in generation service |
</phase_requirements>

---

## Summary

Puppeteer is already installed at version ^24.37.3 in `apps/api/package.json`. This eliminates the library selection decision and makes PDF generation straightforward: render an HTML template server-side, call `page.pdf({ format: 'Letter', printBackground: true })` to get a Buffer, upload the buffer to S3 via the existing storage infrastructure, and insert a record into the `documents` + `document_versions` tables. The existing codebase has all the infrastructure needed for steps 2 through 4.

The document naming system requires a new JSONB column on `companyProfiles` to store naming conventions per document type, plus a new table (or JSONB column) for company-scoped sequence counters. The SELECT FOR UPDATE atomic counter pattern is already well-established in this codebase across `workflowCounters`, `changeOrderCounters`, and `paymentAppCounters` — replicate this pattern exactly for document naming sequences.

Two important gaps require decisions before planning. First, the RFQ PDF requirement (PDF-04) specifies "scope items with description/qty/unit" but the current RFQ schema only has a free-text `scopeOfWork` field — no structured line items with qty/unit columns exist. The PDF will need to either render the `scopeOfWork` text block as-is, or the schema must be extended with a `rfq_line_items` table. Second, the Company Settings schema has no brand color fields — PDF-05 requires custom brand colors but only `logoStorageKey` exists. Either add `primaryColor`/`secondaryColor` columns, or hard-code BIDAXIOM branding for Phase 38.

**Primary recommendation:** Use Puppeteer (already installed) with inline HTML/CSS templates rendered server-side in Fastify, uploading resulting PDF Buffers to S3 via the existing `storage/client.ts` infrastructure, and save records to the documents table. Add a `pdfRouter` to the tRPC app router following the existing router pattern. Add `documentNamingSettings` JSONB column to `companyProfiles` and a new `document_naming_counters` table for sequence management.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| puppeteer | ^24.37.3 (already installed) | Headless Chrome PDF generation | Already in package.json; renders HTML/CSS exactly like a browser; industry standard for templated server-side PDFs |
| @aws-sdk/client-s3 | ^3.988.0 (already installed) | Upload PDF Buffer to S3/MinIO | Already used for all document uploads; existing `generateUploadUrl`/`buildStorageKey` helpers |
| drizzle-orm | ^0.45.1 (already installed) | DB inserts for documents/counters | Existing ORM throughout codebase |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new required) | — | All needed libraries already installed | — |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Puppeteer (HTML-to-PDF) | PDFKit (canvas-like API) | PDFKit is pure JS with no browser overhead but requires manual layout math; Puppeteer uses HTML/CSS which is far easier for complex templated documents like AIA G702/G703 |
| Puppeteer (HTML-to-PDF) | pdf-lib | pdf-lib is for modifying existing PDFs; not a generator for new templated documents |
| Puppeteer (HTML-to-PDF) | pdfmake | pdfmake is pure JS and good for data-driven tables; lighter than Puppeteer but less flexible for branded layouts |

**Installation:**
```bash
# No new packages needed — puppeteer already in apps/api/package.json
```

---

## Architecture Patterns

### Recommended Project Structure

```
apps/api/src/
├── pdf/                          # New directory for PDF generation
│   ├── engine.ts                 # Puppeteer browser lifecycle (singleton)
│   ├── templates/
│   │   ├── proposal.ts           # HTML template builder for Proposal PDF
│   │   ├── change-order.ts       # HTML template builder for Change Order PDF
│   │   ├── payment-app.ts        # HTML template builder for AIA G702/G703
│   │   └── rfq.ts                # HTML template builder for RFQ PDF
│   └── generate.ts               # Orchestrates: template → render → S3 upload → DB insert
├── trpc/routers/
│   └── pdf.ts                    # New tRPC router: generateProposal, generateCO, generatePayApp, generateRfq
```

### Pattern 1: Puppeteer Singleton Browser

**What:** Keep one browser instance alive; create a new page per PDF, close the page when done.
**When to use:** Always — launching a new browser per request is too slow and memory-intensive.

```typescript
// Source: Puppeteer best practices - https://pptr.dev/guides/pdf-generation
// apps/api/src/pdf/engine.ts

import puppeteer, { type Browser } from "puppeteer";

let _browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!_browser || !_browser.connected) {
    _browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",            // Required in Docker/Linux containers
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage", // Prevents shared memory issues
        "--disable-gpu",           // GPU not needed for PDF generation
      ],
    });
  }
  return _browser;
}

export async function generatePdfBuffer(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    const buffer = await page.pdf({
      format: "Letter",           // Standard US construction document size
      printBackground: true,      // Required for brand colors and logo backgrounds
      margin: { top: "0.75in", right: "0.75in", bottom: "0.75in", left: "0.75in" },
    });
    return Buffer.from(buffer);
  } finally {
    await page.close();           // Always close page to prevent memory leaks
  }
}
```

### Pattern 2: HTML Template Builder Functions

**What:** Each document type has a TypeScript function that takes structured data and returns an HTML string.
**When to use:** For all four document types (Proposal, CO, PayApp, RFQ).

```typescript
// apps/api/src/pdf/templates/proposal.ts (illustrative structure)

interface ProposalPdfData {
  companyName: string;
  logoStorageKey: string | null;    // From companyProfiles; generate signed URL if set
  projectName: string;
  projectAddress: string;
  estimateName: string;
  lineItems: Array<{
    description: string;
    quantity: string;
    unit: string;
    unitCost: string;
    total: string;
    costType: string;
  }>;
  subtotals: { labor: string; materials: string; equipment: string; subcontractor: string };
  overheadAmount: string;
  markupAmount: string;
  totalCost: string;
  generatedDate: string;
}

export function buildProposalHtml(data: ProposalPdfData): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    /* Inline all styles — no external CSS files */
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #1a1a1a; }
    /* ... brand-color variables injected here */
  </style>
</head>
<body>
  <!-- Header with logo -->
  <!-- Line items table -->
  <!-- Totals section -->
  <!-- Signature blocks (placeholder per v1.5 scope) -->
</body>
</html>`;
}
```

### Pattern 3: Atomic Document Naming Sequence Counter

**What:** SELECT FOR UPDATE within a transaction to get and increment the next sequence number, preventing race conditions.
**When to use:** Every PDF generation that needs a sequence number in the filename.

```typescript
// Replicates the pattern from apps/api/src/trpc/routers/workflow.ts
// apps/api/src/pdf/generate.ts

async function getNextDocumentSequence(
  db: any,
  countersTable: any,
  companyId: string,   // Company-scoped (not project-scoped per NAME-02)
  docType: string      // "proposal" | "change_order" | "payment_app" | "rfq"
): Promise<number> {
  return await db.transaction(async (tx: any) => {
    const result = await tx.execute(
      sql`SELECT id, current_number FROM ${countersTable}
          WHERE company_id = ${companyId}
          AND doc_type = ${docType}
          FOR UPDATE`
    );
    const rows = result.rows as any[];
    let nextNumber: number;
    if (!rows || rows.length === 0) {
      await tx.insert(countersTable).values({ companyId, docType, currentNumber: 1 });
      nextNumber = 1;
    } else {
      nextNumber = rows[0].current_number + 1;
      await tx.update(countersTable)
        .set({ currentNumber: nextNumber })
        .where(eq(countersTable.id, rows[0].id));
    }
    return nextNumber;
  });
}
```

### Pattern 4: Document Storage After PDF Generation

**What:** Upload PDF Buffer directly to S3 using AWS SDK PutObjectCommand, then insert into `documents` + `document_versions` tables.
**When to use:** After every PDF generation (PDF-06).

```typescript
// Uses existing storage infrastructure from apps/api/src/storage/client.ts
// No pre-signed URL needed — API uploads directly (not browser upload)

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getStorageClient, getBucketName, buildStorageKey } from "../storage/client.js";

async function uploadPdfToS3(
  tenantId: string,
  projectId: string,
  fileName: string,
  pdfBuffer: Buffer
): Promise<string> {
  const s3 = getStorageClient();
  const bucket = getBucketName();
  const key = buildStorageKey(tenantId, projectId, fileName);
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: pdfBuffer,
    ContentType: "application/pdf",
  }));
  return key; // storageKey saved in document_versions.storage_key
}
```

### Anti-Patterns to Avoid

- **New browser per PDF:** Launching `puppeteer.launch()` inside the tRPC procedure. Cost: 500ms+ per request plus memory spike. Instead use singleton `getBrowser()`.
- **Writing PDFs to local disk:** Using `page.pdf({ path: '...' })`. Files would not persist across deploys. Always return Buffer, upload to S3.
- **Calling external URLs in templates:** Do not use `page.goto('http://...')`. Use `page.setContent(html)` with fully inline HTML to avoid network dependency.
- **External CSS files in templates:** CDN links break in server environments or add latency. Inline all styles as `<style>` tags.
- **Project-scoped sequence counters for document naming:** NAME-02 specifies company-scoped counters — do not reuse `workflowCounters` (which are project-scoped). Create a separate `document_naming_counters` table.
- **Storing the Puppeteer browser in tRPC context:** Store the singleton at module level, not in request context. Module-level initialization is the existing pattern (`getStorageClient()`, `getBrowser()`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF rendering | Custom HTML→PDF converter | puppeteer (already installed) | Browser-accurate CSS rendering; handles page breaks, tables, images; proven at scale |
| S3 upload | Custom HTTP upload | `@aws-sdk/client-s3` PutObjectCommand (already used) | Handles retries, checksums, multipart; already tested in codebase |
| Atomic counter | Redis INCR or custom lock | SELECT FOR UPDATE in a transaction (established pattern) | Already used in workflowCounters, changeOrderCounters, paymentAppCounters — consistent, no new dependencies |
| Template syntax | Custom `{{variable}}` parser | Plain TypeScript string interpolation or template literals | Simpler than Handlebars for server-side; no new library; full type safety |

**Key insight:** The codebase already has all three infrastructure pieces needed (PDF library, S3, atomic counters). Phase 38 is primarily an integration task, not a new-tech-adoption task.

---

## Common Pitfalls

### Pitfall 1: Logo Display in PDFs
**What goes wrong:** The company logo is stored in S3 with a pre-signed URL that expires in 1 hour. Embedding a pre-signed URL directly in HTML can cause the logo to not render if Puppeteer does not follow the redirect, or if the URL is logged.
**Why it happens:** Pre-signed URLs contain authentication credentials in query parameters; Puppeteer opens pages in an isolated context.
**How to avoid:** Generate a fresh 1-hour pre-signed download URL immediately before rendering, OR download the logo bytes and embed as a `data:image/png;base64,...` URI in the HTML.
**Warning signs:** PDF renders with missing/broken image placeholder where logo should appear.

### Pitfall 2: RFQ Scope Items Schema Gap
**What goes wrong:** PDF-04 requires "list of items (description, qty, unit)" but the RFQ table only has `scopeOfWork` as a single text field (TEXT column, up to 10000 chars). There are no structured line item rows.
**Why it happens:** RFQ was designed with a free-text scope, not a table of items.
**How to avoid:** Either (a) accept that the RFQ PDF renders the `scopeOfWork` text block as a formatted paragraph instead of a table, or (b) add an `rfq_line_items` table with description/quantity/unit/unitPrice columns plus a Phase 38 migration. Option (b) requires a schema change.
**Warning signs:** Attempting to render "scope items with qty/unit" will fail silently or produce empty rows.

### Pitfall 3: Puppeteer Memory Leak from Unclosed Pages
**What goes wrong:** If a PDF generation fails mid-way (template error, S3 failure), the `page` object is not closed, accumulating orphaned Chrome tabs.
**Why it happens:** Missing `finally { await page.close() }` block.
**How to avoid:** Always close pages in a `finally` block. The `generatePdfBuffer` function should wrap `page.close()` in `finally`.
**Warning signs:** Memory usage grows over time; eventually Chrome process crashes or becomes unresponsive.

### Pitfall 4: Drizzle + `sql` Tagged Template in Transactions
**What goes wrong:** Using raw `sql` template in Drizzle transactions requires passing the transaction client `tx`, not the outer `db`. Using the wrong client causes the SELECT FOR UPDATE to be outside the transaction, defeating the locking.
**Why it happens:** `tx.execute(sql`...`)` is correct; `db.execute(sql`...`)` inside a transaction bypasses the lock.
**How to avoid:** Always use the `tx` parameter inside `db.transaction(async (tx) => { ... })` for counter operations. See `workflow.ts:58-84` for the verified pattern.
**Warning signs:** Race conditions in sequence numbers (duplicate document numbers) under concurrent load.

### Pitfall 5: Brand Colors Not in Schema
**What goes wrong:** PDF-05 requires "company's brand colors if configured" but `companyProfiles` has no brand color columns. Only `logoStorageKey` exists.
**Why it happens:** Brand color storage was not implemented in prior phases.
**How to avoid:** Either add `primaryColor TEXT` / `accentColor TEXT` columns to `companyProfiles` (requires schema change + migration) and corresponding fields to `companyConfigSchema`, OR use BIDAXIOM default brand colors hardcoded in PDF templates for Phase 38 and defer custom colors to Phase 39. The requirement says "if configured" — defaulting is acceptable.
**Warning signs:** If brand color fields are added without updating the effective-dating write pattern in `company.ts:update`, color values will be lost on next company profile update.

### Pitfall 6: PDF-06 Document Library Category
**What goes wrong:** Inserting a generated PDF into `documents` without setting the `category` field, making it uncategorized and hard to find.
**Why it happens:** `category` is nullable in the schema.
**How to avoid:** Always set `category` to the appropriate value (`change_order`, `payment_app`, `invoice`, or create a new `proposal` / `rfq` category) when inserting generated PDFs.
**Warning signs:** Generated PDFs appear in the document list with no category badge.

### Pitfall 7: G702/G703 Retainage Percentage Column
**What goes wrong:** The G703 has a Column I for "variable retainage" but the AIA standard only includes this column when retainage varies per line item. Rendering Column I when all lines use the same rate adds an unnecessary column.
**Why it happens:** Copying a G703 template without understanding when Column I is optional.
**How to avoid:** Check if retainage is uniform (use the `retainagePercent` on the first line item as the default rate) and only render Column I when line items have differing rates.

---

## Code Examples

Verified patterns from existing codebase:

### Existing Atomic Counter Pattern (SELECT FOR UPDATE)
```typescript
// Source: apps/api/src/trpc/routers/workflow.ts:58-84 (verified in codebase)
// Replicate this for document_naming_counters

async function getNextWorkflowNumber(db, workflowCounters, projectId, workflowType) {
  return await db.transaction(async (tx) => {
    const counterResult = await tx.execute(
      sql`SELECT id, current_number FROM ${workflowCounters}
          WHERE project_id = ${projectId}
          AND workflow_type = ${workflowType}
          FOR UPDATE`
    );
    const rows = counterResult.rows;
    let nextNumber: number;
    if (!rows || rows.length === 0) {
      await tx.insert(workflowCounters).values({ projectId, workflowType, currentNumber: 1 });
      nextNumber = 1;
    } else {
      nextNumber = rows[0].current_number + 1;
      await tx.update(workflowCounters)
        .set({ currentNumber: nextNumber })
        .where(eq(workflowCounters.id, rows[0].id));
    }
    return nextNumber;
  });
}
```

### Existing Drizzle `.for("update")` Pattern (Alternative Syntax)
```typescript
// Source: apps/api/src/trpc/routers/payment-app.ts:51-81 (verified in codebase)
// Drizzle ORM supports .for("update") on select queries — cleaner than raw sql

const [counter] = await tx
  .select()
  .from(schema.paymentAppCounters)
  .where(and(
    eq(schema.paymentAppCounters.projectId, projectId),
    eq(schema.paymentAppCounters.year, year)
  ))
  .for("update");  // <-- Drizzle ORM's built-in SELECT FOR UPDATE
```

### Direct S3 Upload (Server-side, No Pre-signed URL)
```typescript
// Source: apps/api/src/storage/client.ts (verified in codebase)
// For API-side uploads (not client-side), use PutObjectCommand directly

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getStorageClient, getBucketName, buildStorageKey } from "../storage/client.js";

const key = buildStorageKey(tenantId, projectId, "proposal.pdf");
await getStorageClient().send(new PutObjectCommand({
  Bucket: getBucketName(),
  Key: key,
  Body: pdfBuffer,            // Buffer from page.pdf()
  ContentType: "application/pdf",
}));
```

### Document + Version Insert Pattern
```typescript
// Source: Inferred from apps/api/src/trpc/routers/document.ts and schema (verified)

const [doc] = await db.insert(schema.documents).values({
  projectId,
  name: generatedFileName,          // e.g., "CO-2026-001-003.pdf"
  category: "change_order",
  description: "Generated Change Order PDF",
  fileSize: pdfBuffer.length,
  contentType: "application/pdf",
  createdBy: userId,
}).returning();

const [version] = await db.insert(schema.documentVersions).values({
  documentId: doc.id,
  versionNumber: 1,
  storageKey: key,                  // S3 key from buildStorageKey()
  fileSize: pdfBuffer.length,
  contentType: "application/pdf",
  uploadedBy: userId,
}).returning();

// Update documents.current_version_id
await db.update(schema.documents)
  .set({ currentVersionId: version.id })
  .where(eq(schema.documents.id, doc.id));
```

---

## AIA G702/G703 Field Reference

All G702/G703 fields map directly to existing `payment_apps` and `payment_app_line_items` schema columns.

### G702 Header Fields (from `projects` + `customers` + `companyProfiles`)
| Form Label | Schema Source |
|-----------|---------------|
| Owner Name | `customers.contactName` / `customers.companyName` |
| Owner Address | `customers.street1`, `city`, `state`, `zip` |
| Contractor Name | Company name from `companyProfiles` (need to add `companyName` column or use tenant name) |
| Project Name | `projects.name` |
| Project Address | `projects.street1`, `city`, `state`, `zip` |
| Application Number | `paymentApps.applicationNumber` |
| Period To (Date) | `paymentApps.periodEnd` |
| Contract Date | `projects.startDate` (closest available) |

### G702 Payment Lines (from `payment_apps`)
| Form Line | Schema Column |
|-----------|---------------|
| 1. Original Contract Sum | `originalContractSum` |
| 2. Net Change by Change Orders | `netChangeByChangeOrders` |
| 3. Contract Sum to Date | `contractSumToDate` |
| 4. Total Completed and Stored to Date | `totalCompletedAndStored` |
| 5. Retainage (% + amount) | `retainageAmount` |
| 6. Total Earned Less Retainage | `totalEarnedLessRetainage` |
| 7. Less Previous Certificates | `previousPayments` |
| 8. Current Payment Due | `currentPaymentDue` |
| 9. Balance to Finish | `balanceToFinish` |

### G703 Continuation Sheet Columns (from `payment_app_line_items` joined to `sov_items`)
| Column | Label | Schema Source |
|--------|-------|---------------|
| A | Item No. | `sovItems.itemNumber` |
| B | Description of Work | `sovItems.description` |
| C | Scheduled Value | `sovItems.scheduledValue` |
| D | Work Completed from Previous Applications | `paymentAppLineItems.workCompletedThisPeriod` for prior apps |
| E | Work Completed This Period | `paymentAppLineItems.workCompletedThisPeriod` |
| F | Materials Presently Stored | `paymentAppLineItems.materialsStoredThisPeriod` |
| G | Total Completed and Stored to Date (D+E+F) | `paymentAppLineItems.totalCompletedAndStored` |
| H | Balance to Finish (C-G) | Calculated: `scheduledValue - totalCompletedAndStored` |
| I | Retainage (variable only) | `paymentAppLineItems.retainagePercent` (only when rates differ) |

**Note on Column D:** The existing `payment_app_line_items` schema stores `workCompletedThisPeriod` (current period) and `previousPercentComplete`. Column D needs to be calculated from `previousPercentComplete * scheduledValue`, which is derivable from existing data.

---

## Schema Changes Required

This phase requires the following new schema elements:

### New Table: `document_naming_counters`
```
document_naming_counters:
  id: UUID primary key
  docType: TEXT (proposal, change_order, payment_app, rfq)
  currentNumber: INTEGER default 0
  (no projectId — company-scoped per NAME-02)
```

### New JSONB Column on `companyProfiles`
```
documentNamingSettings: JSONB
  Type: Record<docType, { template: string }>
  Example: { "proposal": "{DOC-TYPE}-{JOB-NUMBER}-{DATE}", "change_order": "CO-{JOB-NUMBER}-{SEQ}" }
  Default: null (use system default)
```

### Migration (Phase 38)
```sql
-- In every tenant schema:
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS document_naming_settings JSONB;

CREATE TABLE IF NOT EXISTS document_naming_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type TEXT NOT NULL,
  current_number INTEGER NOT NULL DEFAULT 0,
  UNIQUE (doc_type)
);
```

### Optional: Brand Color Columns on `companyProfiles`
If implementing PDF-05 brand colors in Phase 38 (vs. defaulting to BIDAXIOM colors):
```
primaryColor: TEXT (hex, e.g., "#1a56db")
accentColor: TEXT (hex, e.g., "#e74c3c")
```
These must be part of the effective-dated `company.update` write pattern (create new version).

---

## State of the Art

| Old Approach | Current Approach | Impact for Phase 38 |
|--------------|------------------|---------------------|
| `html-pdf` (PhantomJS-based) | Puppeteer (Chromium-based) | Puppeteer already installed; PhantomJS is EOL |
| Pre-signed URLs for server uploads | Direct PutObjectCommand from API | API can upload directly without pre-signed URL round-trip |
| Per-request browser launch | Singleton browser + per-request pages | Must implement singleton to avoid 500ms+ cold start per PDF |

**Deprecated/outdated:**
- `html-pdf`: Uses PhantomJS, EOL, do not use even if found in older docs
- `wkhtmltopdf`: Requires system binary, excluded by project constraints
- `@react-pdf/renderer`: Client-side library, not suitable for server-side generation

---

## Open Questions

1. **RFQ Structured Line Items (PDF-04)**
   - What we know: Current `rfqs` table has `scopeOfWork` as a TEXT blob (up to 10,000 chars). No qty/unit columns.
   - What's unclear: Whether the RFQ PDF should render the text block as-is, or whether new `rfq_line_items` table rows (description, qty, unit) should be added.
   - Recommendation: For Phase 38, render `scopeOfWork` as a formatted text section and `dueDate` as the submission deadline. Defer structured RFQ line items to Phase 39+ since adding a new table is a schema expansion outside Phase 38's stated scope. Payment terms do not exist in the schema — either omit or add a `paymentTerms` TEXT column to `rfqs`.

2. **Brand Colors for PDF-05**
   - What we know: `companyProfiles` has `logoStorageKey` but no color columns. BIDAXIOM logo files exist at `apps/web/public/BIDAXIOM-Logo-Dark-TransparentBG.png`.
   - What's unclear: Whether custom brand colors should be implemented in Phase 38 or deferred.
   - Recommendation: For Phase 38, use BIDAXIOM default colors and the static logo file (embedded as base64 from `apps/web/public/`). Mark custom brand colors as Phase 39 scope alongside custom templates (TMPL-01 through TMPL-06 are Phase 39). Add a TODO comment.

3. **Company Name in PDF Header**
   - What we know: PDFs need the company name (GC/contractor) but `companyProfiles` has no `companyName` column. The public schema likely has a `tenants` table.
   - What's unclear: Where to source the company name.
   - Recommendation: Check `public.tenants` table (Phase 1 provisioning) for organization/company name. Alternatively check the Clerk org name stored in `userProfiles` or `tenants` table.

4. **Puppeteer Singleton Browser Startup Timing**
   - What we know: Puppeteer must be launched before serving requests. The existing `ensureBucket()` call in server startup (storage) provides a pattern.
   - What's unclear: Whether to launch on first PDF request (lazy) or at server startup (eager).
   - Recommendation: Lazy initialization via `getBrowser()` singleton (on first call). Server startup is fast; Puppeteer launch is ~500ms. Lazy avoids startup delay when PDF feature is never used in a session.

---

## Sources

### Primary (HIGH confidence)
- Codebase — `apps/api/src/db/schema/tenant.ts` — All table schemas verified directly
- Codebase — `apps/api/package.json` — `puppeteer@^24.37.3` confirmed already installed
- Codebase — `apps/api/src/storage/client.ts` + `presigned.ts` — S3 infrastructure verified
- Codebase — `apps/api/src/trpc/routers/workflow.ts:52-95` — SELECT FOR UPDATE counter pattern verified
- Codebase — `apps/api/src/trpc/routers/payment-app.ts:44-81` — Drizzle `.for("update")` pattern verified
- Codebase — `apps/api/src/trpc/router.ts` — All existing routers and registration pattern verified
- Codebase — `packages/shared/src/types/company.ts:347-356` — `companyConfigSchema` fields verified; no brandColor columns
- Codebase — `packages/shared/src/types/bidding.ts:37-47` — RFQ schema confirmed (no structured line items)
- Official puppeteer docs — https://pptr.dev/guides/pdf-generation — page.pdf() API options

### Secondary (MEDIUM confidence)
- WebSearch + WebFetch — AIA G702/G703 field reference from Procore and AIA documentation
- WebFetch — docupotion.com — Puppeteer production launch args verified
- WebSearch — PDFBolt — Library comparison (Puppeteer vs. PDFKit vs. pdfmake) — confirmed Puppeteer is correct choice for HTML-based templated PDFs

### Tertiary (LOW confidence)
- AIA G703 Column I (variable retainage) — sourced from WebSearch community articles, not official AIA docs directly (AIA site returned 403). Cross-referenced with two independent sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Puppeteer already installed; confirmed in package.json; all supporting libs in place
- Architecture: HIGH — Singleton browser pattern, S3 direct upload, existing counter pattern all verified in codebase
- AIA G702/G703 field mapping: MEDIUM — Schema fields verified; form field labels from secondary sources (AIA official site 403'd)
- Pitfalls: HIGH — Schema gaps (RFQ items, brand colors) verified by direct code inspection; Puppeteer pitfalls from multiple verified sources
- RFQ gap: HIGH — Confirmed by direct inspection of `rfqs` table schema and `createRfqSchema`

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (stable — no fast-moving dependencies; all verified against installed versions)
