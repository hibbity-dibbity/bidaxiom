---
status: complete
phase: 39-custom-template-import-field-mapping
source: 39-01-SUMMARY.md, 39-02-SUMMARY.md, 39-03-SUMMARY.md, 39-04-SUMMARY.md
started: 2026-02-20T00:00:00Z
updated: 2026-02-20T12:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Document Templates settings page loads
expected: Navigate to http://localhost:3000/settings/document-templates — page shows 4 sections (Proposal, Change Order, Payment Application, RFQ), each with an "Upload Template" button and empty state. "Document Templates" appears in Settings nav.
result: pass

### 2. Upload a .docx template
expected: Create a Word doc containing text like `Dear <<client_name>>, your project <<project_name>> has a total of <<estimate_total>>.` — upload it via the Proposal section's Upload Template button. After upload completes, the page navigates to `/settings/document-templates/[new-templateId]` (the field mapping page).
result: pass (fix: shared/index.ts used .js extension on templates export — removed to match codebase pattern)

### 3. Split-view field mapping page — amber highlights + progress
expected: On the field mapping page: left panel shows the detected fields (<<client_name>>, <<project_name>>, <<estimate_total>>) highlighted in amber. Right panel header shows "0 / 3 fields mapped". Clicking an amber field in the left panel scrolls the right panel to that field's mapping row.
result: pass

### 4. Map fields and update progress counter
expected: In the right panel, use the dropdown on <<client_name>> to select "Project / Client Name" and <<project_name>> to select "Project / Project Name". Leave <<estimate_total>> unmapped. Progress counter updates to "2 / 3 fields mapped".
result: pass

### 5. Save with unmapped fields — always succeeds with warning toast
expected: Click "Save Mappings" with <<estimate_total>> still unmapped. The save succeeds (no blocking error). A warning toast appears mentioning the unmapped field was removed from output.
result: pass

### 6. Preview PDF — available at any time, shows [UNMAPPED] for unmapped fields
expected: Click "Preview PDF". A new tab opens with a PDF. In the PDF: <<client_name>> shows "Acme Property Group", <<project_name>> shows "Project Alpha", <<estimate_total>> shows "[UNMAPPED]". Company branding (name, color) comes from the real company profile.
result: pass (re-verified after GAP-01 fix — docxtemplater → mammoth pipeline now renders uploaded .docx template correctly)

### 7. Activation toggle — instant, no confirmation dialog
expected: Navigate back to /settings/document-templates. Toggle the Proposal template's Active switch on. The toggle is instant with no confirmation dialog. The card shows an "Active" badge.
result: pass

### 8. Production PDF uses active custom template; falls back when deactivated
expected: Go to any project with an estimate and generate a Proposal PDF. The PDF output reflects the mapped field values (real project name, client name). Then toggle the template inactive, generate another Proposal PDF — this one uses the standard Phase 38 built-in layout.
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

### GAP-01: render.ts generates generic layout instead of rendering the uploaded .docx template

**Affected tests:** 6, 8

**Root cause:** `apps/api/src/templates/render.ts` (`buildCustomTemplateHtml`) was implemented as a generic BIDAXIOM-branded HTML builder (definition-list layout). It reads field mappings but completely ignores the uploaded `.docx` file after field extraction. The user's template formatting and prose are discarded.

**Expected behavior:** The `.docx` template should drive the PDF output. After field mapping, generating a PDF should:
1. Download the `.docx` from S3 using the stored `storageKey`
2. Use `docxtemplater` to fill `<<field_name>>` placeholders with resolved values (mapped value, `[UNMAPPED]` in preview, `""` in production)
3. Use `mammoth` to convert the filled `.docx` buffer → HTML
4. Pass the HTML to the existing `generatePdfBuffer()` Puppeteer pipeline

**Fix scope:**
- Replace `buildCustomTemplateHtml` in `render.ts` with `renderDocxTemplate(storageKey, mappings, data, isPreview)` that performs the docxtemplater → mammoth → HTML pipeline
- Update `generatePreview` in `template.ts` to call the new function (already downloads from S3 — pass buffer directly)
- Update all 4 `generate*` procedures in `pdf.ts` to call `renderDocxTemplate` instead of `buildCustomTemplateHtml`
- `render.ts` generic HTML builder can be deleted

**Files affected:**
- `apps/api/src/templates/render.ts` (replace implementation)
- `apps/api/src/trpc/routers/template.ts` (update generatePreview call)
- `apps/api/src/trpc/routers/pdf.ts` (update all 4 generate* procedures)
