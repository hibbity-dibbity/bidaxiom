---
phase: 39-custom-template-import-field-mapping
verified: 2026-02-20T12:30:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 39: Custom Template Import + Field Mapping — Verification Report

**Phase Goal:** A company admin can upload a branded Word or Excel template, map its merge fields to BIDAXIOM data, and activate it as the default for a document type — replacing the built-in layout with the company's own design.
**Verified:** 2026-02-20T12:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can upload a .docx or .xlsx file in Company Settings → Document Templates for any of the 4 document types; system detects all `<<field>>` merge fields and presents a visual split-view mapping interface. | VERIFIED | `apps/web/app/(dashboard)/settings/document-templates/page.tsx` — upload flow uses `getUploadUrl` + S3 PUT + `registerAndExtract`; `extract.ts` uses InspectModule+PizZip for docx, ExcelJS RichText for xlsx; field-mapping-client.tsx renders split-view. UAT test 2 + 3: pass. |
| 2 | The field mapping interface shows a progress indicator ("X / Y fields mapped"); save is always allowed — unmapped fields are auto-ignored with a warning toast. | VERIFIED | `field-mapping-client.tsx` line 394: `{mappedCount} / {totalFields} fields mapped`; `handleSave` is unconditionally enabled; `updateMappings` in `template.ts` returns `unmappedFields`; warning toast fires on `unmappedCount > 0`. UAT test 4 + 5: pass. |
| 3 | Admin can generate a preview PDF using hybrid data (real company branding + fixture project data); unmapped fields render as [UNMAPPED]; preview is available at any time. | VERIFIED | `generatePreview` in `template.ts`: downloads .docx from S3 → `renderTemplate(..., isPreview=true)` → `buildValuesMap` sets `[UNMAPPED]` for null mappings → PDF via LibreOffice or Puppeteer → presigned GET URL. Preview button in field-mapping-client.tsx is always enabled. UAT test 6: pass (re-verified after GAP-01). |
| 4 | A company can have one active template per document type; activating toggles via switch (instant, no dialog) deactivates all others; previously generated documents retain `template_id` FK. | VERIFIED | `setActive` in `template.ts` uses `db.transaction` — deactivates all of same `docType` then activates target. DB partial unique index enforces constraint. `uploadPdfAndSave` stores `templateId: activeTemplate?.id ?? null` on `documents` row. All 4 `generate*` procedures pass `templateId`. UAT test 7 + 8: pass. |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/db/schema/tenant.ts` | `documentTemplates` Drizzle table + `documents.templateId` FK | VERIFIED | Lines 236-260: `documentTemplates` table with 12 columns incl. `detectedFields JSONB`, `fieldMappings JSONB`, `isActive BOOLEAN`; `documents.templateId` FK with `onDelete: "set null"` at line 266. `documentTemplates` in `createTenantSchema` return at line 1309. |
| `apps/api/src/tenant/context.ts` | `documentTemplates` in tenant context | VERIFIED | Line 116: `documentTemplates: tenantDb.documentTemplates` in `buildTenantContext()`. |
| `apps/api/src/db/migrations/migrate-phase39.ts` | Idempotent SQL migration for all active tenant schemas | VERIFIED | File exists; creates `document_templates` table, partial unique index `document_templates_active_per_doctype_idx`, and `documents.template_id` FK. Commit `feat(39-01)` in git log. |
| `apps/api/src/storage/client.ts` | `buildTemplateStorageKey(tenantId, fileName)` | VERIFIED | Lines 85-88: exported function, format `tenants/{tenantId}/templates/{uuid}/{fileName}`. |
| `packages/shared/src/types/templates.ts` | `TemplateDocType`, `DetectedField`, `FieldMapping`, `BIDAXIOM_FIELD_KEYS` | VERIFIED | All 4 exports present; `BIDAXIOM_FIELD_KEYS` has 7 groups covering company, project, proposal, change_order, payment_app, rfq, lineTable. |
| `packages/shared/src/index.ts` | Re-exports all 4 types from templates | VERIFIED | Line 289: `export * from "./types/templates";` |
| `apps/api/src/templates/extract.ts` | `parseDocxFields()` + `parseXlsxFields()` | VERIFIED | `parseDocxFields`: PizZip + InspectModule with `nullGetter`, preserves display case from XML regex. `parseXlsxFields`: handles plain string and RichText cells. Both exported. |
| `apps/api/src/templates/render.ts` | `renderTemplate(buffer, fileType, mappings, data, isPreview)` returning `RenderResult` | VERIFIED | GAP-01 fix implemented. Docxtemplater fills .docx → LibreOffice PDF (preferred) or mammoth HTML fallback. ExcelJS fills .xlsx → LibreOffice or HTML table fallback. `isPreview` controls `[UNMAPPED]` vs `""`. |
| `apps/api/src/templates/fixtures.ts` | `PREVIEW_SAMPLE_DATA`, `PREVIEW_LINE_ITEMS`, `buildPreviewData()` | VERIFIED | `PREVIEW_SAMPLE_DATA` covers all 4 doc types + company + project. `buildPreviewData()` merges real company overrides. |
| `apps/api/src/trpc/routers/template.ts` | `templateRouter` with 7 procedures (+ `getById` added in Plan 04) | VERIFIED | All 8 procedures present: `getUploadUrl`, `registerAndExtract`, `updateMappings`, `generatePreview`, `setActive`, `listByDocType`, `deleteTemplate`, `getById`. Admin guard (`requireAdmin`) enforced at top of each mutation. |
| `apps/api/src/trpc/router.ts` | `template: templateRouter` registered in `appRouter` | VERIFIED | Lines 33 + 74: import and registration confirmed. |
| `apps/api/src/pdf/generate.ts` | `SavePdfParams.templateId?: string \| null` | VERIFIED | Line 187: `templateId?: string \| null` in `SavePdfParams`; line 252: `templateId: templateId ?? null` in insert. |
| `apps/api/src/trpc/routers/pdf.ts` | All 4 `generate*` procedures check active custom template | VERIFIED | `generateProposal`, `generateChangeOrder`, `generatePaymentApp`, `generateRfq` each query `schema.documentTemplates` for `isActive=true` + doc type, then call `renderTemplate()` with the downloaded .docx buffer; fallback to built-in HTML builder when no active template. `templateId` passed to `uploadPdfAndSave()`. |
| `apps/web/app/(dashboard)/settings/document-templates/page.tsx` | Template management page (list, upload, activate/delete) | VERIFIED | 399 lines; `"use client"`; 4 doc type tabs; upload flow (getUploadUrl → S3 PUT → registerAndExtract → navigate); `Switch` toggle calls `setActive`; delete with `window.confirm`; active card gets `ring-2 ring-primary`; empty state present. |
| `apps/web/app/(dashboard)/settings/document-templates/[templateId]/page.tsx` | Server wrapper passes `templateId` to client component | VERIFIED | 13 lines; passes `params.templateId` to `FieldMappingClient`. |
| `apps/web/app/(dashboard)/settings/document-templates/[templateId]/field-mapping-client.tsx` | Split-view field mapping UI | VERIFIED | 484 lines; left panel: amber-highlighted detected fields as clickable buttons that `scrollIntoView` to right panel row; right panel: progress counter `{mappedCount} / {totalFields} fields mapped`, always-enabled Save button, always-enabled Preview PDF button (`generatePreview` → `window.open`), `Combobox` per field from `BIDAXIOM_FIELD_KEYS`, `FieldReferenceSidebar` collapsible. |
| `apps/web/app/(dashboard)/settings/page.tsx` | Settings nav includes Document Templates entry | VERIFIED | Lines 112-119: Link to `/settings/document-templates` with `LayoutTemplate` icon and "Document Templates" heading in settings hub page. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/api/src/trpc/routers/template.ts` | `apps/api/src/templates/extract.ts` | `registerAndExtract` calls `parseDocxFields`/`parseXlsxFields` after streaming S3 download | WIRED | Lines 162-165: `parseDocxFields(buffer)` or `parseXlsxFields(buffer)` based on `input.fileType`. |
| `apps/api/src/trpc/routers/template.ts` | `apps/api/src/templates/render.ts` | `generatePreview` calls `renderTemplate(docxBuffer, ...)` | WIRED | Lines 314-320: `renderTemplate(docxBuffer, template.fileType, template.fieldMappings, previewData, true)`. |
| `apps/api/src/trpc/routers/pdf.ts` | `apps/api/src/db/schema/tenant.ts` | Each `generate*` queries `schema.documentTemplates` for `isActive=true` | WIRED | 4 queries confirmed: proposal (line 256), change_order (line 528), payment_app (line 853), rfq (line 1086). All use `eq(schema.documentTemplates.isActive, true)`. |
| `apps/api/src/trpc/routers/pdf.ts` | `apps/api/src/pdf/generate.ts` | `templateId: activeTemplate?.id ?? null` passed to `uploadPdfAndSave()` | WIRED | Lines 340, 606, 941, 1164: `templateId: activeTemplate?.id ?? null` in all 4 procedures. |
| `apps/api/src/trpc/routers/pdf.ts` | `apps/api/src/templates/render.ts` | `renderTemplate()` called with downloaded .docx buffer | WIRED | Lines 315, 581, 916, 1139: `htmlOrResult = await renderTemplate(docxBuffer, activeTemplate.fileType, activeTemplate.fieldMappings, realData, false)`. |
| `apps/web/app/(dashboard)/settings/document-templates/page.tsx` | `api.template.listByDocType` | `trpc.template.listByDocType.useQuery({ docType })` per section | WIRED | Line 201: query called per `DocTypeSection` component instance. |
| `apps/web/app/(dashboard)/settings/document-templates/page.tsx` | `api.template.getUploadUrl` + `api.template.registerAndExtract` | Upload flow in `handleFileChange` | WIRED | Lines 227-252: `getUploadUrlMutation.mutateAsync(...)` → S3 PUT → `registerAndExtractMutation.mutateAsync(...)`. |
| `apps/web/app/(dashboard)/settings/document-templates/[templateId]/field-mapping-client.tsx` | `api.template.updateMappings` | Save button calls `updateMappings` mutation | WIRED | Lines 173-190 + 202-211: mutation defined, `handleSave` calls `updateMappingsMutation.mutate(...)`. |
| `apps/web/app/(dashboard)/settings/document-templates/[templateId]/field-mapping-client.tsx` | `api.template.generatePreview` | Preview button calls `generatePreview` mutation, `window.open(result.previewUrl)` | WIRED | Lines 192-198 + 213-215: mutation defined, `handlePreview` calls `generatePreviewMutation.mutate(...)`, `onSuccess` opens URL. |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| TMPL-01 | 39-01, 39-03, 39-04 | Admin can upload .docx or .xlsx for any of 4 document types | SATISFIED | Upload UI in `page.tsx` (getUploadUrl → S3 → registerAndExtract); S3 key via `buildTemplateStorageKey`; `registerAndExtract` inserts `document_templates` row; field extraction confirmed. UAT test 2: pass. |
| TMPL-02 | 39-02, 39-03, 39-04 | System detects merge fields and presents visual field mapping interface | SATISFIED | `parseDocxFields`/`parseXlsxFields` detect `<<field>>` syntax; split-view mapping UI with amber highlights, grouped combobox from `BIDAXIOM_FIELD_KEYS`. UAT test 3: pass. |
| TMPL-03 | 39-03, 39-04 | Field mapping UI shows progress; (original: all fields must be mapped before save; refined: save always allowed, unmapped auto-ignored) | SATISFIED — with design refinement | Progress indicator `{mappedCount} / {totalFields} fields mapped` implemented. Save-always behavior is a documented design decision in `39-CONTEXT.md` ("Save is always allowed regardless of mapping completeness") and in ROADMAP success criteria. Unmapped fields return warning toast with field names. UAT test 4 + 5: pass. Note: original REQUIREMENTS.md text said "must be mapped before save" — CONTEXT.md explicitly overrode this decision. |
| TMPL-04 | 39-02, 39-03, 39-04 | Preview PDF from sample data; unmapped fields show [UNMAPPED]; not gated on completion | SATISFIED | `generatePreview` downloads .docx → `renderTemplate(isPreview=true)` → `[UNMAPPED]` for null mappings → signed PDF URL. Preview button always enabled. UAT test 6: pass (after GAP-01 fix). |
| TMPL-05 | 39-01, 39-03, 39-04 | One active template per doc type; toggle switch (instant, no dialog); activation deactivates others | SATISFIED | `setActive` uses `db.transaction`: deactivate-all then activate-target. DB partial unique index enforces constraint. Toggle `Switch` in UI, no `window.confirm`. UAT test 7: pass. |
| TMPL-06 | 39-01, 39-03 | Template reference maintained on generated documents (scope reduced to FK-only; no version history UI) | SATISFIED (reduced scope, documented) | `documents.templateId` FK column added (migration + Drizzle schema). All 4 `generate*` procedures pass `templateId: activeTemplate?.id ?? null` to `uploadPdfAndSave()`. No version history UI — explicitly deferred in CONTEXT.md. UAT test 8: pass. |

**Orphaned requirements check:** TMPL-01 through TMPL-06 are all claimed by phase 39 plans and verified above. No orphaned requirements.

---

### Anti-Patterns Found

No blocking anti-patterns detected.

| File | Pattern | Severity | Notes |
|------|---------|----------|-------|
| `render.ts`, `extract.ts`, `fixtures.ts` | `placeholder` word | Info | Used only in code comments/JSDoc describing template placeholder syntax — not implementation stubs. |
| `page.tsx` (document-templates) | `onActiveToggled={() => {}}` | Info | Callback prop passed to `TemplateCard` is a no-op empty arrow function — the actual invalidation is done inside `TemplateCard` via its own `setActiveMutation.onSuccess`. Not a stub; no functionality lost. |

---

### Human Verification Notes (Already Completed)

Human UAT was completed per `39-UAT.md` with 8/8 tests passing. The following were verified by a human:

1. **Visual split-view layout** — amber highlights, left/right panel scroll-sync (UAT test 3: pass)
2. **Combobox dropdown grouping** — searchable, grouped by Company/Project/Doc-type/Table (UAT test 4: pass)
3. **Warning toast content** — displays which unmapped fields were removed (UAT test 5: pass)
4. **Preview PDF in new tab** — opens signed URL, [UNMAPPED] visible in rendered PDF (UAT test 6: pass, re-verified after GAP-01)
5. **Toggle instant behavior** — no dialog, immediate visual update (UAT test 7: pass)
6. **Production PDF reflects active custom template** — mapped field values visible in generated PDF; fallback to built-in layout when deactivated (UAT test 8: pass)

---

### GAP-01 Resolution Verification

**Gap:** `render.ts` was initially a generic HTML builder that discarded the uploaded .docx file after field extraction.

**Fix applied:** Replaced with `renderTemplate(buffer, fileType, mappings, data, isPreview)` using:
- docxtemplater to fill `<<field>>` placeholders in the .docx buffer
- LibreOffice (via `libreoffice-convert`) for native PDF output (preserves Word/Excel formatting)
- Mammoth (docx) or ExcelJS HTML table (xlsx) as fallback when LibreOffice not installed
- All callers in `template.ts` (generatePreview) and `pdf.ts` (all 4 generate* procedures) updated to download .docx from S3 before calling `renderTemplate`

**Commits confirming fix:** `6ae8adf`, `1a554e6`, `114dd65`, `b7afc40`, `cc4cb62`, `9a68ca2`, `53b78a7`

**Verification:** `render.ts` exports `renderTemplate` (async, returns `RenderResult`); `buildCustomTemplateHtml` is absent from all files; `generatePreview` downloads .docx before rendering; all 4 `generate*` download .docx buffer before calling `renderTemplate`.

---

### Gaps Summary

No gaps. All 4 success criteria verified. All 6 TMPL requirements satisfied (TMPL-03 and TMPL-06 with documented scope refinements from CONTEXT.md). GAP-01 resolved and re-verified by human UAT.

---

_Verified: 2026-02-20T12:30:00Z_
_Verifier: Claude (gsd-verifier)_
