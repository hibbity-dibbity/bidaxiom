# Phase 39: Custom Template Import + Field Mapping - Research

**Researched:** 2026-02-20
**Domain:** Custom document templates — .docx/.xlsx parsing, merge field detection, field mapping UI, custom HTML/Puppeteer PDF rendering
**Confidence:** HIGH (codebase verified; docxtemplater/exceljs already installed via exceljs; architecture confirmed)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Merge Field Syntax**
- Delimiter: `<<angle_brackets>>` — e.g. `<<project_name>>`, `<<total_amount>>`
- Detection: regex scan on .docx text runs and .xlsx cell values for `<<...>>` patterns
- Case-insensitive: `<<Project_Name>>` and `<<project_name>>` both detected and treated as the same field
- Display: field shown as typed by the user in the template (not normalized)

**Available Data Contexts (Field Mapping Targets)**
All 4 data contexts are supported:
1. Company / Branding — company name, address, phone, license number, primary color
2. Project — project name, job number, address, client name, lifecycle phase, start/end dates
3. Document-Specific — varies per doc type (Proposal, Change Order, Payment Application, RFQ)
4. Line Item Tables (repeating rows) — estimate line items, CO line items, SOV rows

**Who Authors Templates**
- User types `<<field_name>>` directly in their Word/Excel document
- System detects whatever they typed upon upload — no guided insertion flow
- BIDAXIOM publishes a canonical field reference list (downloadable, shown in UI sidebar)

**Field Mapping UI Layout**
- Split view: left panel = text preview with detected `<<fields>>` highlighted in amber; right panel = mapping list
- Clicking a highlighted field scrolls the mapping list to that field (and vice versa)
- Progress indicator in the right panel header: "X / Y fields mapped"

**Field Picker**
- Grouped dropdown (select/combobox) per mapping row
- Groups: Company, Project, [Doc-Type-Specific], Line Tables
- Searchable type-ahead within the dropdown

**Unmappable Fields**
- Fields with no BIDAXIOM equivalent: user can mark as Ignored — field placeholder is stripped from output
- No static text replacement option

**Save Behavior**
- Save is always allowed regardless of mapping completeness
- Unmapped fields are auto-ignored on save (stripped from output)
- Warning toast on save summarizes unmapped fields that were removed
- Completely unmapped templates (0 fields mapped) can be saved

**Preview Generation**
- Available at any time during mapping, not gated on completion
- Unmapped fields render as `[UNMAPPED]` in the preview PDF
- Sample data: hybrid — real company branding, fixture data for all project/document fields
- Preview uses same Puppeteer pipeline as Phase 38, but driven by the field mapping configuration

**Template Activation**
- Toggle switch on each template card — only one template active per doc type at a time
- Toggling on auto-deactivates the previously active template for that doc type
- No confirmation dialog (instant)

**Existing Documents on Template Switch**
- Previously generated PDFs are frozen — they reference the template via `template_id` FK
- No re-generation prompt or banner

**Version History (Simplified)**
- No version history UI
- Technical traceability only: `project_documents.template_id` FK on `documents` rows
- Uploading a new file over an existing template replaces it in-place
- Old template files in S3 are overwritten (no retention)

### Claude's Discretion

- Field reference guide format (PDF or inline collapsible sidebar) — research and recommend
- Exact canonical field reference list contents per doc type
- Implementation approach for field detection in .docx vs .xlsx

### Deferred Ideas (OUT OF SCOPE)

- Parallel approval workflows within templates
- E-signature integration / signature placeholder embedding
- Template sharing between companies / marketplace
- AI-assisted field mapping suggestions
- Bulk re-generation of existing documents when a new template is activated
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TMPL-01 | Admin can upload Word (.docx) or Excel (.xlsx) as custom template for any of 4 doc types in Company Settings | `exceljs` already installed for xlsx; `docxtemplater` + `pizzip` needed for docx; S3 upload via existing presigned URL flow; new `document_templates` table required |
| TMPL-02 | System detects merge fields (`<<field_name>>`) and presents visual field mapping interface | docxtemplater InspectModule with `<<` `>>` delimiters for .docx; regex `/<</([^>]+)>>/g` scan on exceljs cell values for .xlsx; field detection happens server-side after upload |
| TMPL-03 | Field mapping UI shows "Mapped X/Y fields" progress; save allowed without complete mapping | Frontend state management only; unmapped fields auto-ignored on save; counter computed from mapping state array |
| TMPL-04 | Preview PDF generation using sample data verifiable before activating | Custom HTML builder driven by field mapping + sample data fixtures; same `generatePdfBuffer()` Puppeteer function from Phase 38; no new PDF engine needed |
| TMPL-05 | Custom templates are scoped per company; one active template per doc type | `document_templates` table with `isActive` boolean + unique constraint on `(docType, isActive=true)`; tRPC toggle procedure with transaction to deactivate previous then activate new |
| TMPL-06 | Template version history — previously generated documents retain reference (simplified: FK only, no UI) | Add `templateId UUID` FK column to `documents` table referencing `document_templates.id`; update `uploadPdfAndSave()` to accept optional `templateId` |
</phase_requirements>

---

## Summary

Phase 39 builds on the Phase 38 Puppeteer PDF pipeline. The core insight is that a custom template (Word or Excel) is a **field mapping guide, not the rendering source**. The user's uploaded file is parsed to detect `<<field>>` placeholders; the mapping is stored in PostgreSQL; and the active custom template's mapping drives a new HTML template builder that the existing `generatePdfBuffer()` consumes. The PDF output format (Letter size, Puppeteer-rendered) does not change — what changes is that the HTML template is built from the field mapping configuration rather than the hardcoded TypeScript template builders from Phase 38.

This distinction is critical: there is no DOCX-to-PDF conversion step. The approach does not use docxtemplater to fill and output a .docx, nor does it call LibreOffice. docxtemplater's role is only to **parse the uploaded .docx** and extract `<<field>>` tag names using the `InspectModule`. After that, the .docx file is stored in S3 as a reference artifact (and optionally rendered as text for the left-panel preview), but PDF generation always goes through the Puppeteer HTML pipeline.

Two new npm packages are required: `docxtemplater` + `pizzip` for parsing .docx merge fields. `exceljs` is already installed in `apps/api/package.json` (at `^4.4.0`) and handles .xlsx cell scanning. The database requires two new additions: a `document_templates` table (new — no equivalent exists) and a `templateId` FK column on the existing `documents` table.

**Primary recommendation:** Install `docxtemplater` + `pizzip` in `apps/api`. Add a `document_templates` table and `templateId` column to `documents`. Build a `templateRouter` following the existing router pattern. For each template type (docx/xlsx), implement server-side field extraction; store the field mapping as JSONB. For PDF generation with an active custom template, build the HTML from the field mapping using sample or real data, then call the existing `generatePdfBuffer()`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| docxtemplater | ^3.68.2 (install) | Parse .docx files to extract `<<field>>` tag names via InspectModule | Only maintained library with a built-in tag extraction API (InspectModule.getAllTags()) that supports custom delimiters; actively maintained at 3.68.x |
| pizzip | ^3.x (install) | Unzip .docx binary into memory for docxtemplater | Required peer dependency for docxtemplater; .docx files are ZIP archives |
| exceljs | ^4.4.0 (already installed) | Read .xlsx workbook cells to regex-scan for `<<field>>` patterns | Already in `apps/api/package.json`; worksheet.eachRow / cell.value covers all cell types |
| puppeteer | ^24.37.3 (already installed) | PDF rendering from HTML (same as Phase 38) | Already in use; singleton `generatePdfBuffer()` is reused unchanged |
| @aws-sdk/client-s3 | ^3.988.0 (already installed) | Upload template files (.docx/.xlsx) to S3 | Already used; same presigned upload flow as document uploads |
| drizzle-orm | ^0.45.1 (already installed) | New `document_templates` table + `documents.templateId` FK | Existing ORM |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| mammoth | 1.11.0 (optional install) | Convert .docx to HTML string for the left-panel text preview | If the split-view preview needs to show a rendered version of the Word document with highlighted fields; alternatively, use raw text extraction from the docxtemplater zip |
| (none new) | — | xlsx detection via exceljs is sufficient without additional libraries | — |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| docxtemplater InspectModule | Raw XML regex on `word/document.xml` | Raw regex on XML runs is fragile — Word splits text across multiple `<w:r>` runs even within a single `<<field>>` tag, making direct regex unreliable; docxtemplater handles run merging internally |
| docxtemplater (tag extraction only) | LibreOffice headless for DOCX-to-PDF | LibreOffice requires a system binary not present in the environment; docxtemplater's role in Phase 39 is only parsing, not output |
| exceljs (already installed) | SheetJS (xlsx) | SheetJS is more permissive but adds a new dependency; exceljs is already present and sufficient for cell value iteration |
| Custom field mapping HTML builder | Adapting the docxtemplater-rendered docx to PDF via LibreOffice | LibreOffice path introduces a system dependency and fidelity issues; HTML Puppeteer path is already proven in Phase 38 |

**Installation (new packages only):**
```bash
# From apps/api directory:
npm install docxtemplater pizzip

# Optional (only if docx text preview is needed beyond field extraction):
npm install mammoth
```

---

## Architecture Patterns

### Recommended Project Structure

```
apps/api/src/
├── templates/                    # New directory for custom template logic
│   ├── extract.ts                # Field extraction: parseDocxFields(), parseXlsxFields()
│   └── render.ts                 # HTML builder from field mapping + data
├── trpc/routers/
│   └── template.ts               # New tRPC router: CRUD + activate + preview
apps/web/app/(dashboard)/settings/
└── document-templates/           # New settings sub-page
    ├── page.tsx                  # Template list per doc type
    └── [templateId]/
        └── page.tsx              # Field mapping interface (split view)
```

### Pattern 1: Docx Field Extraction with InspectModule and Custom Delimiters

**What:** Use docxtemplater's built-in InspectModule to parse a .docx Buffer and extract all `<<field>>` tag names without rendering. Custom delimiters `<<` and `>>` are set in the Docxtemplater constructor.

**When to use:** After a user uploads a .docx template file. Called server-side in the `templateRouter.upload` procedure.

**Critical note on split XML runs:** Word documents often split a seemingly-single token like `<<project_name>>` across multiple `<w:r>` (run) XML elements. Direct XML regex would miss these. docxtemplater's parser **merges runs internally** before tag detection, which is why InspectModule is preferred over raw XML scanning.

```typescript
// Source: docxtemplater docs + InspectModule API (verified)
// apps/api/src/templates/extract.ts

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
// InspectModule ships inside docxtemplater - no separate package needed
const InspectModule = require("docxtemplater/js/inspect-module.js");

/**
 * Parse a .docx Buffer and extract all <<field_name>> tags.
 *
 * Returns an array of field names exactly as the user typed them
 * (preserving case for display), deduplicated, lowercased as map keys.
 *
 * @param buffer - Raw Buffer of the uploaded .docx file
 * @returns Array of unique field names found in the document
 */
export function parseDocxFields(buffer: Buffer): string[] {
  const zip = new PizZip(buffer);
  const iModule = InspectModule();

  const doc = new Docxtemplater(zip, {
    modules: [iModule],
    delimiters: { start: "<<", end: ">>" },
    paragraphLoop: true,
    linebreaks: true,
  });

  // render() with empty object triggers parsing; InspectModule captures all tags
  // getAllTags() is called AFTER render() to get the complete tag list
  doc.render({});

  const allTags: Record<string, unknown> = iModule.getAllTags();

  // getAllTags() returns an object like { project_name: {}, total_amount: {} }
  // Keys are the field names as-parsed (lowercased by docxtemplater internals)
  return Object.keys(allTags);
}
```

**IMPORTANT NOTE on render() with missing tags:** When `doc.render({})` is called with empty data on a document with `<<field>>` tags, docxtemplater will by default throw errors for undefined tags OR silently replace them with empty strings (depending on `nullGetter` config). To suppress errors during the extraction-only flow, configure `nullGetter` to return empty string and avoid error mode:

```typescript
const doc = new Docxtemplater(zip, {
  modules: [iModule],
  delimiters: { start: "<<", end: ">>" },
  paragraphLoop: true,
  linebreaks: true,
  nullGetter(_part: unknown) { return ""; },  // Suppress undefined tag errors
});
```

**Alternative: Direct regex fallback for cases where InspectModule fails:** If the document uses non-standard XML structures that confuse docxtemplater, fall back to regex on the extracted XML text:

```typescript
// Fallback: extract word/document.xml text and regex-scan
const xmlContent = zip.files["word/document.xml"].asText();
const regex = /<<([^<>]+)>>/gi;
const matches = new Set<string>();
let m: RegExpExecArray | null;
while ((m = regex.exec(xmlContent)) !== null) {
  matches.add(m[1].toLowerCase());
}
return Array.from(matches);
```

### Pattern 2: Excel Field Extraction via exceljs Cell Scan

**What:** Load .xlsx as a Workbook, iterate all worksheets and cells, collect all cell string values, apply regex to find `<<field>>` patterns.

**When to use:** After a user uploads a .xlsx template file.

```typescript
// Source: exceljs official docs (library already installed at ^4.4.0)
// apps/api/src/templates/extract.ts

import ExcelJS from "exceljs";

/**
 * Parse an .xlsx Buffer and extract all <<field_name>> tags from cell values.
 */
export async function parseXlsxFields(buffer: Buffer): Promise<string[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const FIELD_REGEX = /<<([^<>]+)>>/gi;
  const found = new Set<string>();

  workbook.eachSheet((worksheet) => {
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        const val = cell.value;
        if (typeof val === "string") {
          let m: RegExpExecArray | null;
          FIELD_REGEX.lastIndex = 0; // Reset stateful regex before each use
          while ((m = FIELD_REGEX.exec(val)) !== null) {
            found.add(m[1].toLowerCase());
          }
        }
        // RichText cells: cell.value has { richText: [{text: "..."}] }
        if (val && typeof val === "object" && "richText" in val) {
          const richText = (val as { richText: Array<{text: string}> }).richText;
          for (const rt of richText) {
            FIELD_REGEX.lastIndex = 0;
            let m2: RegExpExecArray | null;
            while ((m2 = FIELD_REGEX.exec(rt.text)) !== null) {
              found.add(m2[1].toLowerCase());
            }
          }
        }
      });
    });
  });

  return Array.from(found);
}
```

### Pattern 3: Custom Template HTML Builder (for PDF Preview and Generation)

**What:** Given a `TemplateFieldMapping[]` (the stored mapping from field names to BIDAXIOM data keys) and a data object (real data or sample fixtures), build an HTML string that the existing `generatePdfBuffer()` can render.

**When to use:** When generating a preview PDF during field mapping, or when generating a production PDF if the active custom template is set for that doc type.

```typescript
// apps/api/src/templates/render.ts

export interface TemplateFieldMapping {
  detectedField: string;       // e.g. "project_name" (lowercased key)
  displayField: string;        // e.g. "<<Project_Name>>" (as user typed)
  mappedTo: string | null;     // e.g. "project.name" | null (unmapped) | "IGNORED"
}

export interface TemplateRenderData {
  // Company context
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_license?: string;
  primary_color?: string;
  // Project context
  project_name?: string;
  job_number?: string;
  project_address?: string;
  client_name?: string;
  lifecycle_phase?: string;
  start_date?: string;
  end_date?: string;
  // Document-specific: added per doc type
  [key: string]: string | undefined;
}

/**
 * Resolve a field value from the data object given a mapping.
 * Returns "[UNMAPPED]" for unmapped fields, "" for ignored fields.
 */
function resolveField(
  detectedField: string,
  mappings: TemplateFieldMapping[],
  data: TemplateRenderData
): string {
  const mapping = mappings.find(m => m.detectedField === detectedField);
  if (!mapping || mapping.mappedTo === null) return "[UNMAPPED]";
  if (mapping.mappedTo === "IGNORED") return "";
  return data[mapping.mappedTo] ?? "[UNMAPPED]";
}
```

**Key architectural note on line item tables:** The CONTEXT.md identifies line item tables as the most complex rendering challenge. Fields like `<<line_item_description>>` inside a repeating section require special handling. The approach is to designate fields that map to "Line Tables" context as table-context fields. The HTML builder generates an HTML `<table>` iterating over the actual data array, substituting table-context fields per row.

### Pattern 4: S3 Upload for Template Files

**What:** Template files (.docx, .xlsx) are uploaded using the **existing presigned URL flow** — the browser gets a presigned PUT URL from the tRPC procedure, uploads directly to S3, then the API records the `storageKey` in `document_templates`.

**When to use:** In `templateRouter.getUploadUrl` — generate a presigned URL scoped under a `templates/` prefix, separate from project documents.

```typescript
// Reuse existing generateUploadUrl from apps/api/src/storage/presigned.ts
// Template storage key format: tenants/{tenantId}/templates/{uuid}/{filename}

export function buildTemplateStorageKey(tenantId: string, fileName: string): string {
  const prefix = crypto.randomUUID();
  return `tenants/${tenantId}/templates/${prefix}/${fileName}`;
}
```

### Pattern 5: Active Template Lookup in PDF Generation

**What:** Modify each `pdfRouter.generate*` procedure to check for an active custom template BEFORE building the built-in HTML. If an active template exists, use the mapping-driven HTML builder instead.

```typescript
// In pdfRouter.generateProposal (and other procedures):
// After fetching companyProfile, add this check:

const [activeTemplate] = await db
  .select()
  .from(schema.documentTemplates)
  .where(
    and(
      eq(schema.documentTemplates.docType, "proposal"),
      eq(schema.documentTemplates.isActive, true)
    )
  )
  .limit(1);

let html: string;
if (activeTemplate?.fieldMappings) {
  // Use custom template renderer with real data
  html = buildCustomTemplateHtml(activeTemplate.fieldMappings, realData);
} else {
  // Fall back to built-in Phase 38 HTML builder
  html = buildProposalHtml(pdfData);
}

// templateId is stored on the document record (TMPL-06)
const result = await uploadPdfAndSave({
  ...params,
  templateId: activeTemplate?.id ?? null,
});
```

### Anti-Patterns to Avoid

- **Converting .docx to PDF via LibreOffice:** LibreOffice requires a system binary not installed in this environment. Phase 39 does NOT convert the user's Word file to PDF — it only parses it.
- **Direct XML regex on word/document.xml:** Word splits tags across XML runs. `<<project` might be in one run and `_name>>` in another. Use docxtemplater's InspectModule which handles run merging.
- **Stateful regex without resetting lastIndex:** The `g` flag on a regex object keeps state. Always reset `FIELD_REGEX.lastIndex = 0` before each new string, or use `new RegExp(...)` per iteration.
- **Storing field mappings as a JSON array of arrays:** Use an array of objects `{detectedField, displayField, mappedTo}` for clarity and easy querying.
- **Triggering field re-detection on every mapping change:** Field detection happens once on upload. The mapping is then persisted and updated separately. Never re-parse the file on every mapping UI interaction.
- **Using docxtemplater to render the final output docx:** The output pipeline remains Puppeteer HTML → PDF. docxtemplater is ONLY used for field detection on upload.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| .docx run merging before regex | Custom XML parser to merge `<w:r>` runs | docxtemplater InspectModule | Word splits a single token across multiple XML runs; InspectModule handles this internally |
| Excel cell iteration | Custom Buffer parsing | exceljs (already installed) | exceljs.Workbook.xlsx.load() + eachSheet/eachRow/eachCell handles all cell types including RichText |
| Template file storage | Custom file storage | Existing presigned URL + S3 flow | Same `generateUploadUrl()` / `buildStorageKey()` infrastructure already tested |
| PDF generation | New PDF library | Existing `generatePdfBuffer()` Puppeteer singleton | Phase 38's singleton browser + HTML-to-PDF is the established pattern |
| Atomic template activation | Custom locking logic | SELECT FOR UPDATE in a transaction | Same pattern as `getNextDocumentSequence()` — deactivate old, activate new, within one transaction |

**Key insight:** docxtemplater is used only for .docx field NAME extraction. The PDF output format is always HTML-to-Puppeteer. This keeps Phase 39 within the established Phase 38 rendering infrastructure.

---

## Common Pitfalls

### Pitfall 1: Split XML Runs in Word Documents

**What goes wrong:** A user types `<<project_name>>` in Word. Word's internal XML representation may split this across two or more `<w:r>` (run) elements at the `<<`, `-`, or any other character boundary — especially when spellcheck, autocorrect, or tracked changes are active. Direct regex on the raw XML misses these cases.

**Why it happens:** Word optimizes XML runs for formatting changes, not for token boundaries.

**How to avoid:** Use docxtemplater's InspectModule. Its internal parser merges runs before identifying tags. If InspectModule is not feasible (e.g., malformed XML), fall back to extracting the full plaintext and running regex on that.

**Warning signs:** Field extraction returns fewer fields than the user expects. User reports "I have `<<total>>` in my template but it wasn't detected."

### Pitfall 2: docxtemplater render() with Undefined Tags Throws

**What goes wrong:** When calling `doc.render({})` for tag extraction only (with empty data), docxtemplater by default throws a `TemplateError` for every undefined tag. Since ALL tags are undefined (no data passed), this throws on every template.

**Why it happens:** docxtemplater validates that tags resolve to a value. By default, undefined tags are an error.

**How to avoid:** Provide a `nullGetter` option that returns empty string for all undefined tags:
```typescript
new Docxtemplater(zip, {
  modules: [iModule],
  delimiters: { start: "<<", end: ">>" },
  nullGetter() { return ""; },  // suppress undefined tag errors
});
```

**Warning signs:** Field extraction procedure throws a tRPC INTERNAL_SERVER_ERROR on any docx upload.

### Pitfall 3: Case-Insensitive Detection Loses Display Form

**What goes wrong:** The CONTEXT.md specifies that `<<Project_Name>>` and `<<project_name>>` are treated as the same field (case-insensitive), but the display form (how the user typed it) must be preserved for the left-panel preview highlighting.

**Why it happens:** docxtemplater's InspectModule may return normalized (lowercased) keys. The original capitalization from the document needs to be preserved separately.

**How to avoid:** Store both the `detectedField` (lowercased key, used as the JSONB map key) and `displayField` (original form, used for the amber highlight in the preview). During .docx parsing, use the fallback regex on the raw XML text to capture original capitalization before it is lowercased.

**Warning signs:** User uploads `<<Project_Name>>` but the UI shows `project_name` in the highlight and mapping list.

### Pitfall 4: Template Activation Race Condition

**What goes wrong:** Two admins simultaneously toggle different templates as active for the same doc type, resulting in two rows with `isActive = true` for the same docType.

**Why it happens:** Non-atomic read-then-write: one process reads `isActive = false`, another reads `isActive = false`, both write `isActive = true`.

**How to avoid:** Wrap the activation in a transaction with a lock:
```sql
-- In a single transaction:
UPDATE document_templates SET is_active = false WHERE doc_type = 'proposal';
UPDATE document_templates SET is_active = true WHERE id = $targetId;
```
Or add a partial unique index: `CREATE UNIQUE INDEX ON document_templates (doc_type) WHERE is_active = true;` — this enforces at the DB level that only one active template exists per doc type.

**Warning signs:** PDF generation randomly uses wrong template; two templates show as active for the same type.

### Pitfall 5: exceljs RichText Cells Missed

**What goes wrong:** Excel cells can have mixed formatting within a single cell — stored as a `RichText` object, not a plain string. Treating `cell.value` as a string and calling `.match()` on it returns null for RichText cells, silently missing embedded `<<field>>` patterns.

**Why it happens:** exceljs exposes cell values as multiple types: string, number, Date, RichText `{richText: [...]}`, formula, hyperlink, etc.

**How to avoid:** Check `typeof cell.value === "object"` and handle the `richText` array separately (see Pattern 2 code above).

**Warning signs:** User uploads an Excel template with formatted cell text (bold `<<company_name>>`), but the field is not detected.

### Pitfall 6: Template File Size and Content Type Validation

**What goes wrong:** A user uploads a non-.docx or non-.xlsx file (e.g., a .doc, .pdf, or .csv). The server attempts to parse it with docxtemplater or exceljs and produces a confusing error or, worse, crashes the process.

**Why it happens:** No server-side file type validation before parsing.

**How to avoid:** Validate `contentType` in the `templateRouter.upload` procedure before attempting field extraction. Accept only `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx) and `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (.xlsx). Reject with `BAD_REQUEST` if the type does not match.

### Pitfall 7: S3 Key Namespace Collision with Project Documents

**What goes wrong:** Template files stored in S3 using the same `buildStorageKey(tenantId, projectId, fileName)` pattern as project documents. Templates are company-scoped, not project-scoped, so a `projectId` parameter is inappropriate.

**Why it happens:** Copying the `buildStorageKey()` function signature without accounting for scope difference.

**How to avoid:** Create a `buildTemplateStorageKey(tenantId, fileName)` function that uses `tenants/{tenantId}/templates/{uuid}/{fileName}` — no projectId segment.

### Pitfall 8: documents.templateId FK References Deleted Template

**What goes wrong:** A user deletes a custom template. The `documents` table rows that used that template still reference it via `templateId` FK. If `ON DELETE CASCADE` is used, the FK becomes NULL (or if RESTRICT, deletion is blocked).

**Why it happens:** FK constraint behavior must be chosen intentionally.

**How to avoid:** Set `templateId` FK on `documents` as `ON DELETE SET NULL`. This preserves the document record but clears the template reference when a template is deleted — correct behavior since the template_id is for audit traceability only, not for re-generating the document.

---

## Schema Changes Required

### New Table: `document_templates`

This is the core new table for Phase 39. No equivalent exists in the current schema.

```sql
-- In every tenant schema (via migrate-phase39.ts):
CREATE TABLE IF NOT EXISTS "${schemaName}".document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type TEXT NOT NULL,           -- "proposal" | "change_order" | "payment_app" | "rfq"
  name TEXT NOT NULL,               -- User-provided name for the template
  file_type TEXT NOT NULL,          -- "docx" | "xlsx"
  storage_key TEXT NOT NULL,        -- S3 key for the original uploaded file
  file_size INTEGER,
  detected_fields JSONB NOT NULL DEFAULT '[]',
                                    -- Array of { detectedField, displayField }
                                    -- e.g. [{ "detectedField": "project_name", "displayField": "<<Project_Name>>" }]
  field_mappings JSONB NOT NULL DEFAULT '[]',
                                    -- Array of { detectedField, displayField, mappedTo }
                                    -- mappedTo: "company.name" | "project.name" | ... | "IGNORED" | null
  is_active BOOLEAN NOT NULL DEFAULT false,
  uploaded_by TEXT NOT NULL,        -- Clerk user ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce only one active template per doc type at the DB level:
CREATE UNIQUE INDEX IF NOT EXISTS document_templates_active_per_doctype_idx
  ON "${schemaName}".document_templates (doc_type)
  WHERE is_active = true;
```

**Drizzle ORM definition (for `createTenantSchema`):**

```typescript
const documentTemplates = schema.table("document_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  docType: text("doc_type").notNull(), // "proposal" | "change_order" | "payment_app" | "rfq"
  name: text("name").notNull(),
  fileType: text("file_type").notNull(), // "docx" | "xlsx"
  storageKey: text("storage_key").notNull(),
  fileSize: integer("file_size"),
  detectedFields: jsonb("detected_fields").notNull().$type<DetectedField[]>().default([]),
  fieldMappings: jsonb("field_mappings").notNull().$type<FieldMapping[]>().default([]),
  isActive: boolean("is_active").notNull().default(false),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

### Modified Column: `documents.templateId`

Add `template_id UUID NULL` FK column to the existing `documents` table (TMPL-06):

```sql
ALTER TABLE "${schemaName}".documents
  ADD COLUMN IF NOT EXISTS template_id UUID
    REFERENCES "${schemaName}".document_templates(id)
    ON DELETE SET NULL;
```

**In Drizzle ORM schema** (update the existing `documents` table definition to add):
```typescript
templateId: uuid("template_id").references(() => documentTemplates.id, { onDelete: "set null" }),
```

**Note:** The `documents` table definition in `createTenantSchema` must be updated, AND the `documentTemplates` table must be declared BEFORE `documents` in the schema function (to avoid circular reference — but since `documentTemplates` does not reference `documents`, this ordering works).

### Shared Type Additions (`packages/shared/src/types/`)

New types needed in `packages/shared`:

```typescript
// packages/shared/src/types/templates.ts (new file)

export const TEMPLATE_DOC_TYPES = ["proposal", "change_order", "payment_app", "rfq"] as const;
export type TemplateDocType = (typeof TEMPLATE_DOC_TYPES)[number];

export interface DetectedField {
  detectedField: string;   // lowercased key (e.g., "project_name")
  displayField: string;    // as-typed in document (e.g., "<<Project_Name>>")
}

export interface FieldMapping extends DetectedField {
  mappedTo: string | null; // BIDAXIOM data key | "IGNORED" | null (unmapped)
}

// The canonical list of BIDAXIOM data keys available for field mapping.
// Used in the field picker dropdown. Grouped by context.
export const BIDAXIOM_FIELD_KEYS = {
  company: [
    { key: "company.name", label: "Company Name" },
    { key: "company.address", label: "Company Address" },
    { key: "company.phone", label: "Company Phone" },
    { key: "company.license", label: "License Number" },
    { key: "company.primaryColor", label: "Primary Color" },
  ],
  project: [
    { key: "project.name", label: "Project Name" },
    { key: "project.jobNumber", label: "Job Number" },
    { key: "project.address", label: "Project Address" },
    { key: "project.clientName", label: "Client Name" },
    { key: "project.lifecyclePhase", label: "Lifecycle Phase" },
    { key: "project.startDate", label: "Start Date" },
    { key: "project.endDate", label: "End Date" },
  ],
  proposal: [
    { key: "doc.estimateTotal", label: "Estimate Total" },
    { key: "doc.subtotalLabor", label: "Labor Subtotal" },
    { key: "doc.subtotalMaterials", label: "Materials Subtotal" },
    { key: "doc.subtotalEquipment", label: "Equipment Subtotal" },
    { key: "doc.subtotalSubcontractor", label: "Subcontractor Subtotal" },
    { key: "doc.overheadAmount", label: "Overhead Amount" },
    { key: "doc.markupAmount", label: "Markup Amount" },
    { key: "doc.preparedBy", label: "Prepared By" },
    { key: "doc.generatedDate", label: "Generated Date" },
  ],
  change_order: [
    { key: "doc.coNumber", label: "CO Number" },
    { key: "doc.coTitle", label: "CO Title" },
    { key: "doc.coDescription", label: "Description" },
    { key: "doc.costDelta", label: "Cost Delta" },
    { key: "doc.status", label: "Status" },
    { key: "doc.generatedDate", label: "Generated Date" },
  ],
  payment_app: [
    { key: "doc.applicationNumber", label: "Application Number" },
    { key: "doc.periodStart", label: "Period Start Date" },
    { key: "doc.periodEnd", label: "Period End Date" },
    { key: "doc.contractPrice", label: "Contract Price" },
    { key: "doc.retainagePercent", label: "Retainage %" },
    { key: "doc.retainageAmount", label: "Retainage Amount" },
    { key: "doc.currentAmountDue", label: "Amount Due" },
    { key: "doc.totalEarnedLessRetainage", label: "Total Earned Less Retainage" },
    { key: "doc.previousPayments", label: "Previous Payments" },
    { key: "doc.generatedDate", label: "Generated Date" },
  ],
  rfq: [
    { key: "doc.rfqNumber", label: "RFQ Number" },
    { key: "doc.rfqTitle", label: "RFQ Title" },
    { key: "doc.submissionDeadline", label: "Submission Deadline" },
    { key: "doc.paymentTerms", label: "Payment Terms" },
    { key: "doc.scopeOfWork", label: "Scope of Work" },
    { key: "doc.generatedDate", label: "Generated Date" },
  ],
  lineTable: [
    { key: "table.description", label: "Line Item Description" },
    { key: "table.quantity", label: "Quantity" },
    { key: "table.unit", label: "Unit" },
    { key: "table.unitCost", label: "Unit Cost" },
    { key: "table.lineTotal", label: "Line Total" },
    { key: "table.costType", label: "Cost Type" },
    { key: "table.itemNumber", label: "Item Number" },
    { key: "table.scheduledValue", label: "Scheduled Value" },
  ],
} as const;
```

### `uploadPdfAndSave()` Signature Extension

The `SavePdfParams` interface in `apps/api/src/pdf/generate.ts` needs an optional `templateId` field:

```typescript
export interface SavePdfParams {
  // ... existing fields ...
  templateId?: string | null; // Phase 39: FK to document_templates.id (TMPL-06)
}
```

And the insert into `schema.documents` must include `templateId` when provided.

---

## Code Examples

### Complete Field Extraction Service (docx)

```typescript
// Source: docxtemplater docs (https://docxtemplater.com/docs/api/) + InspectModule
// apps/api/src/templates/extract.ts

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

const InspectModule = require("docxtemplater/js/inspect-module.js");

export interface ExtractedField {
  detectedField: string;  // lowercased key
  displayField: string;   // "<<OriginalCase>>"
}

export function parseDocxFields(buffer: Buffer): ExtractedField[] {
  // Step 1: Unzip the docx (ZIP archive)
  const zip = new PizZip(buffer);

  // Step 2: Extract original-case display fields from raw XML
  // (InspectModule lowercases keys; we need the originals for display)
  const xmlContent = (() => {
    try {
      return zip.files["word/document.xml"].asText();
    } catch {
      return "";
    }
  })();
  const displayRegex = /<<([^<>]+)>>/gi;
  const originalCaseMap = new Map<string, string>(); // key=lowercase, value=first-seen original
  let m: RegExpExecArray | null;
  while ((m = displayRegex.exec(xmlContent)) !== null) {
    const lower = m[1].toLowerCase();
    if (!originalCaseMap.has(lower)) {
      originalCaseMap.set(lower, `<<${m[1]}>>`);
    }
  }

  // Step 3: Use InspectModule to get the authoritative list (handles split runs)
  const iModule = InspectModule();
  const doc = new Docxtemplater(zip, {
    modules: [iModule],
    delimiters: { start: "<<", end: ">>" },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter() { return ""; },
  });

  try {
    doc.render({});
  } catch {
    // Template errors are expected when unknown tags exist; InspectModule still captured them
  }

  const allTags: Record<string, unknown> = iModule.getAllTags();
  const fields: ExtractedField[] = [];

  for (const key of Object.keys(allTags)) {
    fields.push({
      detectedField: key,
      displayField: originalCaseMap.get(key) ?? `<<${key}>>`,
    });
  }

  return fields;
}
```

### tRPC Router Skeleton for Templates

```typescript
// Source: pattern from apps/api/src/trpc/routers/pdf.ts (verified in codebase)
// apps/api/src/trpc/routers/template.ts

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, isNull } from "drizzle-orm";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { generateUploadUrl } from "../../storage/presigned.js";
import { parseDocxFields, parseXlsxFields } from "../../templates/extract.js";

export const templateRouter = router({
  // TMPL-01: Get presigned URL for template file upload
  getUploadUrl: protectedProcedure
    .input(z.object({
      fileName: z.string(),
      contentType: z.enum([
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ]),
      docType: z.enum(["proposal", "change_order", "payment_app", "rfq"]),
    }))
    .mutation(async ({ ctx, input }) => {
      // Returns { uploadUrl, storageKey } — client PUTs file directly to S3
      return await generateUploadUrl(
        ctx.tenant!.tenantId as string,
        "templates", // Use "templates" as pseudo-projectId for key scoping
        input.fileName,
        input.contentType
      );
    }),

  // TMPL-01 + TMPL-02: After browser uploads to S3, register template and extract fields
  registerAndExtract: protectedProcedure
    .input(z.object({
      name: z.string(),
      docType: z.enum(["proposal", "change_order", "payment_app", "rfq"]),
      fileType: z.enum(["docx", "xlsx"]),
      storageKey: z.string(),
      fileSize: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Download file from S3 to get Buffer for field extraction
      // 2. Extract fields based on fileType
      // 3. Insert document_templates row with detectedFields
      // Returns { templateId, detectedFields }
    }),

  // TMPL-02 + TMPL-03: Save field mappings for a template
  updateMappings: protectedProcedure
    .input(z.object({
      templateId: z.string().uuid(),
      fieldMappings: z.array(z.object({
        detectedField: z.string(),
        displayField: z.string(),
        mappedTo: z.string().nullable(), // null = unmapped, "IGNORED" = ignored
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validates mappedTo values against BIDAXIOM_FIELD_KEYS
      // Updates document_templates.field_mappings JSONB
    }),

  // TMPL-04: Generate preview PDF with hybrid sample data
  generatePreview: protectedProcedure
    .input(z.object({ templateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Builds HTML from field mappings + sample data fixtures
      // Calls generatePdfBuffer() and returns a signed download URL
      // Does NOT save to documents table (preview only)
    }),

  // TMPL-05: Toggle active template for a doc type
  setActive: protectedProcedure
    .input(z.object({
      templateId: z.string().uuid(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Runs in transaction:
      // 1. UPDATE document_templates SET is_active = false WHERE doc_type = $type
      // 2. UPDATE document_templates SET is_active = true WHERE id = $templateId
      // DB partial unique index enforces single-active invariant
    }),

  // List all templates per company, grouped by doc type
  listByDocType: protectedProcedure
    .input(z.object({ docType: z.enum(["proposal", "change_order", "payment_app", "rfq"]) }))
    .query(async ({ ctx, input }) => {
      // Returns all document_templates for the tenant, ordered by created_at desc
    }),
});
```

### Sample Data Fixtures for Preview

```typescript
// apps/api/src/templates/fixtures.ts
// Hybrid preview data: real company branding + fixture project/document values

export const PREVIEW_FIXTURES = {
  company: {
    "company.name": "[FROM_REAL_DATA]",     // Replace with actual company name
    "company.address": "123 Main Street, Denver, CO 80203",
    "company.phone": "(303) 555-0100",
    "company.license": "GC-2026-001234",
    "company.primaryColor": "#3B5BDB",
  },
  project: {
    "project.name": "Project Alpha",
    "project.jobNumber": "2026-001",
    "project.address": "456 Oak Avenue, Denver, CO 80204",
    "project.clientName": "Acme Property Group",
    "project.lifecyclePhase": "construction",
    "project.startDate": "January 15, 2026",
    "project.endDate": "December 31, 2026",
  },
  proposal: {
    "doc.estimateTotal": "$125,000.00",
    "doc.subtotalLabor": "$60,000.00",
    "doc.subtotalMaterials": "$45,000.00",
    "doc.subtotalEquipment": "$10,000.00",
    "doc.subtotalSubcontractor": "$0.00",
    "doc.overheadAmount": "$6,250.00",
    "doc.markupAmount": "$3,750.00",
    "doc.preparedBy": "Jane Smith",
    "doc.generatedDate": "February 20, 2026",
  },
  change_order: {
    "doc.coNumber": "CO-2026-001",
    "doc.coTitle": "Additional Electrical Work",
    "doc.coDescription": "Install additional electrical circuits in east wing per owner request.",
    "doc.costDelta": "$8,500.00",
    "doc.status": "Approved",
    "doc.generatedDate": "February 20, 2026",
  },
  payment_app: {
    "doc.applicationNumber": "PAY-2026-003",
    "doc.periodStart": "January 1, 2026",
    "doc.periodEnd": "January 31, 2026",
    "doc.contractPrice": "$500,000.00",
    "doc.retainagePercent": "10.00%",
    "doc.retainageAmount": "$12,500.00",
    "doc.currentAmountDue": "$112,500.00",
    "doc.totalEarnedLessRetainage": "$112,500.00",
    "doc.previousPayments": "$87,500.00",
    "doc.generatedDate": "February 20, 2026",
  },
  rfq: {
    "doc.rfqNumber": "RFQ-2026-005",
    "doc.rfqTitle": "Concrete Flatwork",
    "doc.submissionDeadline": "March 15, 2026",
    "doc.paymentTerms": "Net 30",
    "doc.scopeOfWork": "Provide and install 4,000 sq ft of concrete flatwork per specs.",
    "doc.generatedDate": "February 20, 2026",
  },
};
```

---

## Field Reference Guide (Claude's Discretion Recommendation)

**Recommendation:** Implement as a **collapsible sidebar panel** in the field mapping UI (right side, below the mapping list), rather than a separate downloadable PDF. This is faster to show to the user and is always up-to-date. Provide a secondary "Download as PDF" button that generates a simple reference sheet using the Puppeteer pipeline.

The field reference guide lists all `BIDAXIOM_FIELD_KEYS` by group with the "suggested template name" the user should type. For example:

```
Company / Branding
  <<company_name>>       Company Name
  <<company_address>>    Company Address
  <<primary_color>>      Primary Brand Color

Project
  <<project_name>>       Project Name
  <<job_number>>         Job Number
  ...
```

The canonical field names in the reference guide should be lowercase with underscores to match the BIDAXIOM standard. Users may type any case; the system normalizes on detection.

---

## State of the Art

| Old Approach | Current Approach | Impact for Phase 39 |
|--------------|------------------|---------------------|
| Custom XML parsing of .docx | docxtemplater InspectModule | Handles split XML runs automatically; no hand-rolled parser |
| LibreOffice headless for DOCX→PDF | HTML→Puppeteer pipeline (Phase 38) | No system binary required; Phase 39 reuses existing pipeline |
| Per-request browser launch | Singleton browser (Phase 38 established) | `generatePdfBuffer()` is already safe to reuse |
| Separate template management system | Template metadata in tenant schema | Stays within the multi-tenant schema-per-tenant pattern |

**Deprecated/outdated (do not use):**
- `html-pdf` / PhantomJS: EOL, not installed
- `wkhtmltopdf`: requires system binary
- LibreOffice headless for DOCX-to-PDF in this project: not installed; would require Docker image changes

---

## Open Questions

1. **docxtemplater getAllTags() timing**
   - What we know: The CHANGELOG (v3.67.6) notes that calling `getAllStructuredTags()` before `.render()` previously corrupted documents; the fix landed in 3.67.6. `getAllTags()` behavior before render is less documented.
   - What's unclear: Whether `getAllTags()` can be called without `render()` in v3.68.x without side effects.
   - Recommendation: Always call `doc.render({})` first with `nullGetter() { return ""; }`, then call `iModule.getAllTags()`. This is the verified safe sequence per the official docs.

2. **Document text preview for left panel**
   - What we know: The CONTEXT.md requires a text preview of the uploaded document with detected `<<fields>>` highlighted in amber. For .docx, this requires converting the Word document to readable HTML. mammoth.js (1.11.0) can convert .docx to HTML for this purpose. For .xlsx, exceljs can extract a table representation.
   - What's unclear: Whether mammoth produces clean enough HTML for the preview panel, and whether it preserves `<<field>>` text faithfully.
   - Recommendation: Use mammoth for .docx text preview; then post-process the HTML output to wrap `<<...>>` patterns in `<mark class="amber">` spans. Install mammoth as an optional dependency (`npm install mammoth` in `apps/api`). The text preview is served via a tRPC query that returns an HTML string; the frontend renders it in a sandboxed `div` with `dangerouslySetInnerHTML`.

3. **line item table rendering in custom HTML builder**
   - What we know: Fields mapped to the `lineTable.*` group must be rendered as repeating table rows. The HTML builder needs to detect whether any mapped field is a `table.*` field, and if so, inject an `<tbody>` loop over the actual line items array.
   - What's unclear: How to handle templates that have BOTH regular fields and table fields — the table section must be isolated as a sub-template.
   - Recommendation: Identify table-context fields as those with `mappedTo` starting with `"table."`. Build the HTML in two passes: (1) substitute all non-table fields as simple string replacements; (2) for table fields, generate an HTML `<table>` iterating over the line items array and substitute per-row values. This is a custom HTML generation function, not a Handlebars/Mustache engine. MEDIUM complexity.

---

## Sources

### Primary (HIGH confidence)
- Codebase — `apps/api/src/db/schema/tenant.ts` — All existing table schemas verified; `documentNamingCounters` present; `documents` table fields confirmed
- Codebase — `apps/api/package.json` — `exceljs@^4.4.0` confirmed installed; `docxtemplater` and `pizzip` NOT yet installed
- Codebase — `apps/api/src/pdf/generate.ts` — `generatePdfBuffer()`, `uploadPdfAndSave()`, `SavePdfParams` interface verified
- Codebase — `apps/api/src/pdf/engine.ts` — Puppeteer singleton `getBrowser()` / `generatePdfBuffer()` pattern verified
- Codebase — `apps/api/src/storage/presigned.ts` — `generateUploadUrl()` pattern confirmed; reusable for template uploads
- Codebase — `apps/api/src/trpc/routers/pdf.ts` — All 4 generate procedures verified; `getNextDocumentSequence()` and `resolveFileName()` usage confirmed
- Codebase — `apps/api/src/storage/client.ts` — `buildStorageKey()` pattern confirmed; needs `buildTemplateStorageKey()` variant
- Codebase — `apps/web/app/(dashboard)/settings/` — `document-naming/` page structure confirms how to add `document-templates/` sub-page
- Official docxtemplater docs — https://docxtemplater.com/docs/api/ — `getAllTags()` API verified; `delimiters` option confirmed
- Official docxtemplater docs — https://docxtemplater.com/docs/get-started-node/ — PizZip + Docxtemplater setup pattern confirmed
- Official docxtemplater docs — https://docxtemplater.com/docs/configuration/ — `nullGetter`, `delimiters`, `paragraphLoop` options confirmed
- docxtemplater CHANGELOG — https://github.com/open-xml-templating/docxtemplater/blob/master/CHANGELOG.md — Latest version 3.68.2 confirmed; v3.67.6 InspectModule fix noted

### Secondary (MEDIUM confidence)
- WebSearch + inspect-module.js source — `InspectModule.getAllTags()` returns `Record<string, unknown>` with field name keys; must be called after `render()`
- WebSearch — exceljs eachSheet/eachRow/eachCell pattern for cell value iteration; RichText cell type handling documented
- WebSearch — mammoth 1.11.0 `convertToHtml({buffer})` API for .docx text preview
- WebSearch — docxtemplater split XML run problem — confirmed as real issue; InspectModule is the mitigation
- WebSearch — S3 presigned URL upload pattern for browser-to-S3 direct upload — same as existing document upload flow

### Tertiary (LOW confidence)
- WebSearch — "getAllStructuredTags() before render() fix in v3.67.6" — inferred from CHANGELOG entry; not directly tested. Recommendation to call render() first is conservative and safe.
- WebSearch — mammoth faithfully preserves `<<field>>` text in output HTML — not explicitly verified; likely true but should be tested during implementation.

---

## Metadata

**Confidence breakdown:**
- Standard stack (docxtemplater, exceljs): HIGH — docxtemplater is the only library with InspectModule for tag extraction; exceljs already installed; both have long-standing npm presence
- Architecture (HTML Puppeteer pipeline, not DOCX-to-PDF): HIGH — verified by reading Phase 38 code; CONTEXT.md confirms same Puppeteer pipeline
- Field extraction patterns: MEDIUM — docxtemplater InspectModule API verified; split-run behavior is well-documented concern; RichText Excel handling is library-documented
- Schema design (document_templates table): HIGH — follows established patterns from existing tables in createTenantSchema; migration pattern matches migrate-phase38.ts
- Pitfalls: HIGH — confirmed from codebase inspection and library documentation
- Preview HTML builder for line tables: MEDIUM — logical design; no directly analogous pattern in codebase to copy from

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable — docxtemplater is actively maintained but APIs are stable; exceljs API is stable)
