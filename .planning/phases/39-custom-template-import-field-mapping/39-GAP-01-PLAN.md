---
phase: 39-custom-template-import-field-mapping
plan: GAP-01
type: execute
gap_closure: true
wave: 1
depends_on: []
files_modified:
  - apps/api/src/templates/render.ts
  - apps/api/src/trpc/routers/template.ts
  - apps/api/src/trpc/routers/pdf.ts
---

# Phase 39 GAP-01: Fix template rendering — use actual .docx via docxtemplater + mammoth

## Context

`render.ts` was implemented as a generic BIDAXIOM-branded HTML builder (definition list layout).
It ignores the uploaded .docx file after field extraction — the user's formatting and prose are
completely discarded. The PDF output looks nothing like the uploaded template.

**Correct approach:** docxtemplater fills `<<field>>` placeholders in the .docx, mammoth converts
the filled .docx to HTML, Puppeteer renders to PDF. The user's layout is preserved end-to-end.

## Gap

GAP-01 in 39-UAT.md: Preview PDF renders generic layout instead of uploaded .docx template.
Affects tests 6 and 8.

## Tasks

### Task 1: Replace render.ts with docxtemplater → mammoth pipeline

**File:** `apps/api/src/templates/render.ts`

Replace the entire file. Export a single async function:

```typescript
export async function renderDocxTemplate(
  docxBuffer: Buffer,
  mappings: FieldMapping[],
  data: Record<string, string>,
  isPreview: boolean
): Promise<string>
```

**Implementation steps inside `renderDocxTemplate`:**

1. **Build values object** — for each mapping, key = `mapping.detectedField`, value = resolved:
   - `mapping.mappedTo === null` → `isPreview ? "[UNMAPPED]" : ""`
   - `mapping.mappedTo === "IGNORED"` → `""`
   - else → `data[mapping.mappedTo] ?? (isPreview ? "[UNMAPPED]" : "")`

2. **Fill .docx with docxtemplater** — use createRequire (CJS module, same pattern as extract.ts):
   ```typescript
   import { createRequire } from "module";
   const require = createRequire(import.meta.url);
   const Docxtemplater = require("docxtemplater");
   const PizZip = require("pizzip");

   const zip = new PizZip(docxBuffer);
   const doc = new Docxtemplater(zip, {
     paragraphLoop: true,
     linebreaks: true,
     delimiters: { start: "<<", end: ">>" },
     nullGetter: () => "",   // docxtemplater nullGetter for missing keys (already resolved above)
   });
   doc.render(values);
   const filledBuffer: Buffer = doc.getZip().generate({ type: "nodebuffer" });
   ```

3. **Convert filled .docx to HTML with mammoth:**
   ```typescript
   import mammoth from "mammoth";
   const { value: bodyHtml } = await mammoth.convertToHtml({ buffer: filledBuffer });
   ```
   Note: if mammoth does not have an ESM default export, use createRequire same as above.

4. **Add preview watermark banner** (if isPreview):
   ```html
   <div style="background:#FEF3C7;border:1px solid #F59E0B;padding:8px 12px;margin-bottom:16px;font-size:12px;color:#92400E;">
     <strong>Preview Mode</strong> — Sample data used. [UNMAPPED] fields have no mapping configured.
   </div>
   ```

5. **Wrap in full HTML document** for Puppeteer:
   ```html
   <!DOCTYPE html>
   <html lang="en">
   <head>
     <meta charset="UTF-8">
     <title>Document Preview</title>
     <style>
       body { font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #111827;
              padding: 32px 48px; margin: 0; background: #fff; line-height: 1.6; }
       table { border-collapse: collapse; width: 100%; }
       td, th { border: 1px solid #E5E7EB; padding: 6px 10px; }
       th { background: #F3F4F6; font-weight: 600; }
       p { margin: 0 0 8px; }
     </style>
   </head>
   <body>
     {previewBanner}
     {bodyHtml}
   </body>
   </html>
   ```

6. Return the complete HTML string.

**Remove** the old `buildCustomTemplateHtml` export entirely. Also remove the old `TemplateRenderData`
type export if it was only used internally.

**Keep** the `FieldMapping` re-export (`export type { FieldMapping }`) if still needed downstream,
otherwise remove it (callers can import from @construction/shared directly).

**TypeScript:** Run `tsc --noEmit` on render.ts. Fix any type errors — the mammoth types may need
`@types/mammoth` checked; if not installed, use `// @ts-expect-error` comment or add the types.

---

### Task 2: Update callers — template.ts (generatePreview) and pdf.ts (all 4 generate*)

#### 2a. `apps/api/src/trpc/routers/template.ts` — generatePreview procedure

Current: downloads nothing, calls `buildCustomTemplateHtml`.

Replace the "Build HTML" step inside `generatePreview`:

1. **Download .docx from S3** using `template.storageKey`:
   ```typescript
   const s3 = getStorageClient();
   const bucket = getBucketName();
   const getCmd = new GetObjectCommand({ Bucket: bucket, Key: template.storageKey });
   const s3Response = await s3.send(getCmd);
   const chunks: Uint8Array[] = [];
   for await (const chunk of s3Response.Body as AsyncIterable<Uint8Array>) {
     chunks.push(chunk);
   }
   const docxBuffer = Buffer.concat(chunks);
   ```

2. **Build preview data** (keep existing `buildPreviewData` call with real branding).

3. **Render HTML** via `renderDocxTemplate`:
   ```typescript
   const html = await renderDocxTemplate(
     docxBuffer,
     template.fieldMappings as FieldMapping[],
     previewData,
     true // isPreview
   );
   ```

4. Remove the old `buildCustomTemplateHtml` import from template.ts; remove `PREVIEW_LINE_ITEMS` import
   if no longer needed.

5. Add import: `import { renderDocxTemplate } from "../../templates/render.js";`

---

#### 2b. `apps/api/src/trpc/routers/pdf.ts` — all 4 generate* procedures

For each procedure (generateProposal, generateChangeOrder, generatePaymentApp, generateRfq),
inside the `if (activeTemplate?.fieldMappings?.length)` block:

1. **Download the .docx from S3** using `activeTemplate.storageKey`:
   ```typescript
   const s3 = getStorageClient();
   const bucket = getBucketName();
   const getCmd = new GetObjectCommand({ Bucket: bucket, Key: activeTemplate.storageKey });
   const s3Res = await s3.send(getCmd);
   const chunks: Uint8Array[] = [];
   for await (const chunk of s3Res.Body as AsyncIterable<Uint8Array>) {
     chunks.push(chunk);
   }
   const docxBuffer = Buffer.concat(chunks);
   ```

2. **Render HTML** via `renderDocxTemplate`:
   ```typescript
   html = await renderDocxTemplate(
     docxBuffer,
     activeTemplate.fieldMappings as FieldMapping[],
     realData,
     false // isPreview=false — production
   );
   ```
   (The `lineItems` parameter is no longer needed — docxtemplater handles table loops natively
   via the template's own loop syntax, or the template simply has no table if not designed for one.)

3. Remove `buildCustomTemplateHtml` import from pdf.ts.

4. Add needed imports to pdf.ts:
   ```typescript
   import { GetObjectCommand } from "@aws-sdk/client-s3";
   import { getStorageClient, getBucketName } from "../../storage/client.js";
   import { renderDocxTemplate } from "../../templates/render.js";
   ```
   Check if `GetObjectCommand` and S3 helpers are already imported — if so, don't re-import.

**TypeScript:** Run `tsc --noEmit` on both files. Fix any errors.

---

## Commit Strategy

- **Task 1 commit:** `fix(39-gap01): replace render.ts with docxtemplater+mammoth pipeline`
- **Task 2 commit:** `fix(39-gap01): update generatePreview and all generate* to use renderDocxTemplate`

## Self-Check

After completion verify:
- [ ] `apps/api/src/templates/render.ts` exports `renderDocxTemplate` (async function)
- [ ] Old `buildCustomTemplateHtml` is gone from render.ts, template.ts, pdf.ts
- [ ] `generatePreview` downloads .docx from S3 before calling `renderDocxTemplate`
- [ ] All 4 `generate*` procedures in pdf.ts download .docx before calling `renderDocxTemplate`
- [ ] `tsc --noEmit` passes with 0 errors in render.ts, template.ts, pdf.ts
- [ ] Both task commits exist in git log
