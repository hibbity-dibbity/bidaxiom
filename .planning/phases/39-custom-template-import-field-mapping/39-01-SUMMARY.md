---
phase: 39-custom-template-import-field-mapping
plan: 01
subsystem: database
tags: [drizzle, postgres, migration, shared-types, s3, typescript]

# Dependency graph
requires:
  - phase: 38-pdf-generation-and-document-naming
    provides: documents table, document_naming_counters, documentNamingCounters in context

provides:
  - document_templates Drizzle table with 11 columns (id, doc_type, name, file_type, storage_key, file_size, detected_fields, field_mappings, is_active, uploaded_by, created/updated_at)
  - documents.templateId FK column (nullable, ON DELETE SET NULL) for PDF audit traceability
  - Partial unique index document_templates_active_per_doctype_idx (is_active=true) enforcing one active template per doc type at DB level
  - migrate-phase39.ts — idempotent migration running against all active tenant schemas
  - DetectedField, FieldMapping, BIDAXIOM_FIELD_KEYS, TemplateDocType exported from @construction/shared
  - buildTemplateStorageKey(tenantId, fileName) for company-scoped S3 keys (no projectId in path)
  - documentTemplates in createTenantSchema return object and buildTenantContext() schema

affects:
  - 39-02-PLAN (template upload + field extraction tRPC router — needs documentTemplates schema)
  - 39-03-PLAN (field mapping UI — needs BIDAXIOM_FIELD_KEYS and FieldMapping types)
  - 39-04-PLAN (PDF generation with active template — needs documentTemplates in context)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - documentTemplates declared BEFORE documents in createTenantSchema (FK ordering: templates must precede documents to allow FK reference)
    - buildTemplateStorageKey() follows buildStorageKey() but omits projectId (company-scoped path)
    - Partial unique index (WHERE is_active = true) enforces at-most-one active template per doc type at the PostgreSQL level — no application-level locking needed for read-then-write race

key-files:
  created:
    - packages/shared/src/types/templates.ts
    - apps/api/src/db/migrations/migrate-phase39.ts
  modified:
    - apps/api/src/db/schema/tenant.ts
    - apps/api/src/tenant/context.ts
    - apps/api/src/storage/client.ts
    - packages/shared/src/index.ts

key-decisions:
  - "BIDAXIOM_FIELD_KEYS uses dot-notation group keys (company.name, project.name, doc.estimateTotal, table.description) matching the canonical field reference from RESEARCH.md"
  - "documentTemplates table placed BEFORE documents table in createTenantSchema to allow FK reference from documents.templateId to documentTemplates.id without circular dependency"
  - "buildTemplateStorageKey omits projectId — templates are company-scoped, stored at tenants/{tenantId}/templates/{uuid}/{fileName}"
  - "Partial unique index on (doc_type WHERE is_active=true) enforces the one-active-template-per-type invariant at the DB level, matching RESEARCH.md recommendation to avoid race conditions"
  - "DetectedField and FieldMapping imported as TypeScript types in tenant.ts for JSONB column type annotations (.$type<DetectedField[]>())"

patterns-established:
  - "Pattern: Company-scoped S3 keys omit projectId — buildTemplateStorageKey(tenantId, fileName) vs buildStorageKey(tenantId, projectId, fileName)"
  - "Pattern: Partial unique index (WHERE is_active = true) for at-most-one-active semantics without application locking"

requirements-completed: [TMPL-01, TMPL-05, TMPL-06]

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 39 Plan 01: Schema Foundation Summary

**document_templates table with partial unique index, documents.templateId FK, shared FieldMapping/BIDAXIOM_FIELD_KEYS types, and buildTemplateStorageKey() helper across all tenant schemas**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-20T16:49:04Z
- **Completed:** 2026-02-20T16:52:22Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created `document_templates` table (11 columns) in all active tenant schemas via idempotent migration
- Added `documents.template_id` FK (ON DELETE SET NULL) with partial unique index enforcing one active template per doc type
- Published 4 shared types (TemplateDocType, DetectedField, FieldMapping, BIDAXIOM_FIELD_KEYS) to @construction/shared
- Added `buildTemplateStorageKey()` for company-scoped template S3 paths

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema columns, shared types, and storage key helper** - `4420c5a` (feat)
2. **Task 2: migrate-phase39.ts migration** - `d0a1037` (feat)

**Plan metadata:** (created below)

## Files Created/Modified

- `packages/shared/src/types/templates.ts` - New file: TemplateDocType, DetectedField, FieldMapping, BIDAXIOM_FIELD_KEYS with all 7 groups and 38 fields
- `packages/shared/src/index.ts` - Added `export * from "./types/templates.js"`
- `apps/api/src/db/schema/tenant.ts` - Added documentTemplates table before documents; added templateId FK on documents; added documentTemplates to return object
- `apps/api/src/tenant/context.ts` - Added documentTemplates to buildTenantContext() schema object
- `apps/api/src/storage/client.ts` - Added buildTemplateStorageKey(tenantId, fileName) export
- `apps/api/src/db/migrations/migrate-phase39.ts` - New file: idempotent migration for all active tenant schemas

## Decisions Made

- BIDAXIOM_FIELD_KEYS uses dot-notation group keys (`company.name`, `project.name`, `doc.estimateTotal`, `table.description`) matching the canonical field reference from RESEARCH.md
- `documentTemplates` table placed BEFORE `documents` table in `createTenantSchema` to allow FK reference from `documents.templateId` to `documentTemplates.id` without circular dependency
- `buildTemplateStorageKey` omits `projectId` — templates are company-scoped, stored at `tenants/{tenantId}/templates/{uuid}/{fileName}`
- Partial unique index on `(doc_type WHERE is_active=true)` enforces the one-active-template-per-type invariant at the DB level, matching RESEARCH.md recommendation to avoid race conditions

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- DB foundation for Phase 39 complete: `document_templates` table live in all tenant schemas
- All shared types available in `@construction/shared` for both API and frontend consumption
- `documentTemplates` accessible via `ctx.tenant.schema.documentTemplates` in any tRPC procedure
- Ready for Plan 39-02: template upload tRPC router with S3 presigned URL and field extraction

---
*Phase: 39-custom-template-import-field-mapping*
*Completed: 2026-02-20*
