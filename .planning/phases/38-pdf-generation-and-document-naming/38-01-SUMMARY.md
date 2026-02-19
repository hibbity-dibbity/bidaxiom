---
phase: 38-pdf-generation-and-document-naming
plan: 01
subsystem: schema
tags: [schema, migration, shared-types, pdf, document-naming]
dependency_graph:
  requires: []
  provides:
    - documentNamingCounters table (all active tenant schemas)
    - documentNamingSettings JSONB column on companyProfiles
    - DocumentNamingSettings, PdfDocType, PDF_DOC_TYPES, DocumentNamingConvention types in @construction/shared
  affects:
    - apps/api/src/db/schema/tenant.ts
    - apps/api/src/tenant/context.ts
    - apps/api/src/db/migrations/migrate-phase38.ts
    - packages/shared/src/types/company.ts
    - packages/shared/src/index.ts
tech_stack:
  added: []
  patterns:
    - Drizzle ORM schema extension with unique constraint on new counter table
    - Idempotent migration (ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS)
    - TypeScript const-as-const tuple for PdfDocType union (PDF_DOC_TYPES)
key_files:
  created:
    - apps/api/src/db/migrations/migrate-phase38.ts
  modified:
    - apps/api/src/db/schema/tenant.ts
    - apps/api/src/tenant/context.ts
    - packages/shared/src/types/company.ts
    - packages/shared/src/index.ts
decisions:
  - documentNamingSettings uses nullable JSONB (no .default()) following the same pattern as chartConfig and sortBy columns — null means use platform default naming pattern
  - documentNamingCounters has unique constraint on doc_type (not project-scoped) so one counter per doc type per company for sequential PDF numbering
  - DocumentNamingSettings is Partial<Record<PdfDocType, DocumentNamingConvention>> allowing per-type opt-in
metrics:
  duration: ~4 min
  completed: 2026-02-19
  tasks_completed: 2
  files_created: 1
  files_modified: 4
---

# Phase 38 Plan 01: Document Naming Schema and Shared Types Summary

**One-liner:** Drizzle schema extension adding company-scoped document naming counters table and JSONB settings column, with PDF_DOC_TYPES / DocumentNamingSettings types in the shared package.

## What Was Built

Added the foundational database schema and TypeScript types for Phase 38's PDF generation and document naming system:

1. **`documentNamingSettings` JSONB column** on `companyProfiles` — stores per-doc-type naming templates (null = use platform default). No default value set, matching the codebase's pattern for optional JSONB config columns.

2. **`documentNamingCounters` table** — company-scoped (no `projectId`) sequential counter table with a UNIQUE constraint on `doc_type`. Supports atomic increments via `SELECT FOR UPDATE` for race-free PDF sequence numbering across proposals, change orders, payment apps, and RFQs.

3. **Phase 38 migration script** — follows the established `migrate-phase37.ts` pattern: dotenv config, Pool, iterate active tenant schemas, transaction per schema, idempotent SQL, success/failure counters, `process.exit`. Ran against 1 active tenant schema with 0 failures.

4. **Shared types** in `packages/shared/src/types/company.ts`:
   - `PDF_DOC_TYPES = ["proposal", "change_order", "payment_app", "rfq"] as const`
   - `PdfDocType` — union type from the const tuple
   - `DocumentNamingConvention` — interface with `template: string`
   - `DocumentNamingSettings` — `Partial<Record<PdfDocType, DocumentNamingConvention>>`
   All four exported from `packages/shared/src/index.ts`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add document naming schema to tenant.ts and shared types | 0cd3d37 | tenant.ts, context.ts, company.ts, index.ts |
| 2 | Write Phase 38 migration script and run it | 7b01500 | migrate-phase38.ts |

## Verification Results

- `packages/shared` TypeScript check: PASS (0 errors)
- `apps/api` TypeScript check: 0 errors in modified files (pre-existing unrelated errors in other files)
- Migration output: "Done: 1 succeeded, 0 failed"
- DB verification: `document_naming_settings` column confirmed in `company_profiles`, `document_naming_counters` table confirmed in `tenant_%` schema
- Grep checks: Both `document_naming_counters` and `documentNamingSettings` appear in `tenant.ts`; both `DocumentNamingSettings` and `PDF_DOC_TYPES` appear in `company.ts`
- `documentNamingCounters` exported from `createTenantSchema` return object (line 1276)
- All four new types re-exported from `packages/shared/src/index.ts`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added documentNamingCounters to tenant context builder**
- **Found during:** Task 1 TypeScript verification
- **Issue:** `src/tenant/context.ts` maintains a manually-enumerated copy of all tables returned by `createTenantSchema`. Adding `documentNamingCounters` to the schema caused TS error TS2741 (property missing from required type).
- **Fix:** Added `documentNamingCounters: tenantDb.documentNamingCounters` to the schema object in `buildTenantContext()`.
- **Files modified:** `apps/api/src/tenant/context.ts`
- **Commit:** 0cd3d37 (included in Task 1 commit)

## Self-Check: PASSED

All files exist and all commits found.

| Check | Result |
|-------|--------|
| apps/api/src/db/migrations/migrate-phase38.ts | FOUND |
| apps/api/src/db/schema/tenant.ts | FOUND |
| packages/shared/src/types/company.ts | FOUND |
| .planning/phases/38-pdf-generation-and-document-naming/38-01-SUMMARY.md | FOUND |
| Commit 0cd3d37 (Task 1) | FOUND |
| Commit 7b01500 (Task 2) | FOUND |
