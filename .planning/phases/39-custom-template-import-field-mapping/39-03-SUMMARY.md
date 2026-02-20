---
phase: 39-custom-template-import-field-mapping
plan: 03
subsystem: api
tags: [trpc, s3, presigned-url, docx, xlsx, pdf, templates, custom-template]

# Dependency graph
requires:
  - phase: 39-01
    provides: document_templates Drizzle table, FieldMapping/DetectedField shared types, BIDAXIOM_FIELD_KEYS, buildTemplateStorageKey
  - phase: 39-02
    provides: parseDocxFields, parseXlsxFields, buildCustomTemplateHtml, buildPreviewData, PREVIEW_LINE_ITEMS

provides:
  - templateRouter with 7 procedures registered in appRouter as template:
  - getUploadUrl: presigned S3 PUT URL for browser direct upload (5min expiry)
  - registerAndExtract: downloads file from S3, extracts fields, inserts documentTemplates row
  - updateMappings: save-always field mapping (never blocks on unmapped)
  - generatePreview: buildCustomTemplateHtml + generatePdfBuffer + presigned GET URL (5min, no document row)
  - setActive: atomic deactivate-all-same-docType then activate target
  - listByDocType: all tenant templates optionally filtered by docType
  - deleteTemplate: S3 DeleteObjectCommand + DB delete
  - SavePdfParams.templateId optional field; uploadPdfAndSave stores templateId on document row
  - All 4 pdfRouter generate* procedures check active custom template before built-in HTML fallback

affects:
  - 39-04-PLAN (frontend UI — calls templateRouter procedures via tRPC client)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - requireAdmin() helper function reads ctx.orgRole directly (not ctx.session) — matches codebase pattern
    - Active custom template lookup uses and(eq(docType), eq(isActive, true)) before HTML build
    - buildCustomTemplateHtml isPreview=false for production generation; isPreview=true for preview-only
    - S3 DeleteObjectCommand failure swallowed non-fatally in deleteTemplate (file may already be gone)
    - Preview PDF uploaded to tenants/{tenantId}/previews/{templateId}/preview.pdf (throw-away key)

key-files:
  created:
    - apps/api/src/trpc/routers/template.ts
  modified:
    - apps/api/src/trpc/router.ts (added templateRouter import and template: templateRouter)
    - apps/api/src/pdf/generate.ts (added templateId to SavePdfParams + insert)
    - apps/api/src/trpc/routers/pdf.ts (active-template check + buildCustomTemplateHtml fallback in all 4 procedures)

key-decisions:
  - "ctx.orgRole accessed directly (not ctx.session?.orgRole) — consistent with all other routers in codebase"
  - "requireAdmin() takes full ctx object rather than string parameter for direct type-safe access to ctx.orgRole"
  - "deleteTemplate swallows S3 DeleteObjectCommand errors non-fatally — DB row must be cleaned up even if file already gone"
  - "Preview PDF uploaded to tenants/{tenantId}/previews/{templateId}/preview.pdf — predictable throwaway path, overwritten on each preview"
  - "generateRfq custom template called with empty lineItems array — RFQs have no line item table in scope"
  - "realData mapping in pdf.ts covers all BIDAXIOM_FIELD_KEYS for each doc type using doc-specific pdfData fields"

requirements-completed: [TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05, TMPL-06]

# Metrics
duration: 5min
completed: 2026-02-20
---

# Phase 39 Plan 03: templateRouter and PDF Active-Template Integration Summary

**templateRouter (7 procedures) registered in appRouter; uploadPdfAndSave extended with templateId; all 4 pdfRouter generate* procedures check for active custom template before falling back to built-in HTML — completing the full server-side template lifecycle API**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-20T17:04:07Z
- **Completed:** 2026-02-20T17:09:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `apps/api/src/trpc/routers/template.ts` with all 7 procedures (getUploadUrl, registerAndExtract, updateMappings, generatePreview, setActive, listByDocType, deleteTemplate)
- All template procedures use protectedProcedure with inline `ctx.orgRole !== "org:admin"` FORBIDDEN guard
- getUploadUrl: validates MIME type (docx/xlsx only), uses buildTemplateStorageKey, returns presigned PUT URL (5min)
- registerAndExtract: streams S3 GetObjectCommand body to Buffer via AsyncIterable, calls parseDocxFields/parseXlsxFields, inserts documentTemplates row with null mappedTo for all detected fields
- updateMappings: save-always (never blocks), returns unmappedCount + unmappedFields for UI display only
- generatePreview: buildPreviewData (real company branding + fixture data) → buildCustomTemplateHtml (isPreview=true) → generatePdfBuffer → S3 upload → presigned GET URL (5min, no document row inserted)
- setActive: atomic db.transaction — deactivates all same-docType then activates target when isActive=true; just deactivates when isActive=false
- listByDocType: optional docType filter, ordered by createdAt
- deleteTemplate: non-fatal S3 delete then DB delete
- Registered `template: templateRouter` in apps/api/src/trpc/router.ts
- Added `templateId?: string | null` to SavePdfParams; `uploadPdfAndSave()` stores it on documents row
- All 4 pdfRouter procedures (generateProposal, generateChangeOrder, generatePaymentApp, generateRfq) now query documentTemplates for active template before building HTML
- When active template found: buildCustomTemplateHtml with doc-specific realData mapped to BIDAXIOM_FIELD_KEYS format
- When no active template: falls back to existing built-in HTML builder (unchanged behavior)
- Zero TypeScript errors in all 4 modified files

## Task Commits

Each task was committed atomically:

1. **Task 1: Create templateRouter with all 7 procedures and register in appRouter** - `098b3fb` (feat)
2. **Task 2: Extend uploadPdfAndSave with templateId and update pdfRouter generate* procedures** - `cfdbace` (feat)

## Files Created/Modified

- `apps/api/src/trpc/routers/template.ts` - New: templateRouter with 7 procedures (479 lines)
- `apps/api/src/trpc/router.ts` - Added templateRouter import + `template: templateRouter` registration
- `apps/api/src/pdf/generate.ts` - Added `templateId?: string | null` to SavePdfParams; stores on insert
- `apps/api/src/trpc/routers/pdf.ts` - Added buildCustomTemplateHtml import + active-template fallback in all 4 generate* procedures (+192 lines, -17 lines)

## Decisions Made

- `ctx.orgRole` accessed directly (not `ctx.session?.orgRole`) — TypeScript error revealed the codebase pattern; all other routers use `ctx.orgRole` directly from the context object
- `requireAdmin()` takes full `ctx` object with `{ orgRole: string | null }` type rather than a string — cleaner and directly type-safe
- `deleteTemplate` swallows S3 `DeleteObjectCommand` errors non-fatally — the DB row must be cleaned up even if the file has already been deleted from S3 (e.g., manual cleanup, bucket lifecycle)
- Preview PDF uploaded to `tenants/{tenantId}/previews/{templateId}/preview.pdf` — predictable key that gets overwritten on each preview generation (no accumulation), separate from document storage path
- `generateRfq` custom template called with `[]` empty lineItems array — RFQs have no line item table context in the current schema
- realData mapping in pdf.ts covers all BIDAXIOM_FIELD_KEYS entries for each doc type, using the already-fetched `pdfData` object fields with `String(val ?? "")` type safety

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ctx.session?.orgRole does not exist on the context type**
- **Found during:** Task 1 (TypeScript check after template.ts creation)
- **Issue:** TypeScript reported `Property 'session' does not exist on type '{ userId: string | null; orgId: string | null; orgRole: string | null; ... }'` — the context object exposes `orgRole` directly, not nested under `session`
- **Fix:** Changed `requireAdmin(ctx.session?.orgRole)` to `requireAdmin(ctx)` with function signature accepting `{ orgRole: string | null }` — matches the pattern used by all existing routers (e.g., `ctx.orgRole ?? "org:member"` in audit.ts, bid.ts)
- **Files modified:** apps/api/src/trpc/routers/template.ts
- **Verification:** `tsc --noEmit` passes with 0 errors in template.ts and router.ts
- **Committed in:** 098b3fb (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Single-line fix to match existing codebase pattern. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviation above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `apps/api/src/trpc/routers/template.ts` fully implemented — tRPC client can now perform the full template lifecycle
- `template: templateRouter` registered in appRouter — available for frontend type inference
- `uploadPdfAndSave()` stores `templateId` for per-document template traceability (TMPL-06)
- All 4 PDF generation procedures check for active custom template before falling back to built-in HTML
- Plan 39-04 (frontend UI — upload, field mapping, template list, preview, activate) can now be implemented against this router

## Self-Check: PASSED

- FOUND: apps/api/src/trpc/routers/template.ts
- FOUND: apps/api/src/pdf/generate.ts
- FOUND: apps/api/src/trpc/routers/pdf.ts
- FOUND: .planning/phases/39-custom-template-import-field-mapping/39-03-SUMMARY.md
- FOUND: 098b3fb feat(39-03): templateRouter with 7 procedures and register in appRouter
- FOUND: cfdbace feat(39-03): extend uploadPdfAndSave with templateId; pdf.ts active-template fallback

---
*Phase: 39-custom-template-import-field-mapping*
*Completed: 2026-02-20*
