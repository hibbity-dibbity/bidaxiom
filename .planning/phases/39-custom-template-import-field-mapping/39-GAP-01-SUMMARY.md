---
phase: 39-custom-template-import-field-mapping
plan: GAP-01
subsystem: template-rendering
tags: [docxtemplater, mammoth, pdf-generation, gap-closure, esm-cjs]
dependency_graph:
  requires: [39-01, 39-02, 39-03, 39-04]
  provides: [correct-docx-template-rendering, preview-pdf-uses-user-layout]
  affects: [template.ts, pdf.ts, render.ts]
tech_stack:
  added: []
  patterns: [createRequire-for-cjs-in-esm, docxtemplater-fill-then-mammoth-convert]
key_files:
  created: []
  modified:
    - apps/api/src/templates/render.ts
    - apps/api/src/trpc/routers/template.ts
    - apps/api/src/trpc/routers/pdf.ts
decisions:
  - Reuse s3/bucket variables in generatePreview rather than declaring duplicates (avoids TS2451 redeclaration)
  - Use createRequire for mammoth same as docxtemplater/pizzip — all three are CJS packages
  - Rename previewGetCmd to avoid clash with getCmd used for .docx download in generatePreview
metrics:
  duration: ~8 min
  completed: 2026-02-20
  tasks: 2
  files: 3
---

# Phase 39 GAP-01: Fix Template Rendering — docxtemplater+mammoth Pipeline Summary

**One-liner:** Replace generic BIDAXIOM-branded HTML builder with docxtemplater→mammoth pipeline that preserves user's .docx formatting end-to-end.

## What Was Built

The custom template preview and PDF generation pipeline was completely broken — `render.ts` built a generic definition-list HTML layout that ignored the uploaded .docx file after field extraction. The user's formatting, branding, and document structure were discarded.

This gap closure replaces the entire rendering approach:

1. `render.ts` — Removed `buildCustomTemplateHtml` entirely. Exported `renderDocxTemplate(docxBuffer, mappings, data, isPreview)` which:
   - Resolves field values from mappings (null → [UNMAPPED] in preview, "" in production)
   - Fills `<<field>>` placeholders in the .docx via docxtemplater
   - Converts the filled .docx to HTML via mammoth (preserving user formatting)
   - Adds a preview banner when `isPreview=true`
   - Wraps in a complete HTML document for Puppeteer

2. `template.ts` `generatePreview` — Now downloads the .docx from S3 using `template.storageKey`, then calls `renderDocxTemplate` with the downloaded buffer.

3. `pdf.ts` all 4 generate* procedures — Each now downloads the .docx from S3 using `activeTemplate.storageKey` inside the `if (activeTemplate?.fieldMappings?.length)` block, then calls `renderDocxTemplate`.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Replace render.ts with docxtemplater+mammoth pipeline | 6ae8adf | render.ts |
| 2 | Update generatePreview and all 4 generate* in pdf.ts | 1a554e6 | template.ts, pdf.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Variable redeclaration in generatePreview after S3 download insertion**

- **Found during:** Task 2 TypeScript check
- **Issue:** The existing `generatePreview` code already declared `s3`, `bucket`, and `getCmd` for the PDF upload step (lines 325-343). Inserting the .docx download block at the top of the procedure created duplicate `const` declarations (TS2451).
- **Fix:** Removed the duplicate `s3` and `bucket` declarations from the upload step (reuses the ones declared for the download), renamed `getCmd` for the presigned GET URL to `previewGetCmd` to avoid the clash.
- **Files modified:** apps/api/src/trpc/routers/template.ts
- **Commit:** 1a554e6 (included in Task 2 commit)

## Self-Check: PASSED

- [x] `apps/api/src/templates/render.ts` exports `renderDocxTemplate` (async function)
- [x] Old `buildCustomTemplateHtml` is gone from render.ts, template.ts, pdf.ts
- [x] `generatePreview` downloads .docx from S3 before calling `renderDocxTemplate`
- [x] All 4 `generate*` procedures in pdf.ts download .docx before calling `renderDocxTemplate`
- [x] `tsc --noEmit` passes with 0 errors in render.ts, template.ts, pdf.ts
- [x] Both task commits exist in git log (6ae8adf, 1a554e6)
