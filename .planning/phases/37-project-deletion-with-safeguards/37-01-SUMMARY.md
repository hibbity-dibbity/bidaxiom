---
phase: 37-project-deletion-with-safeguards
plan: 01
subsystem: api
tags: [trpc, drizzle, postgres, soft-delete, audit-log]

# Dependency graph
requires:
  - phase: 36-lifecycle-and-modes
    provides: lifecyclePhase, LIFECYCLE_ORDER, LIFECYCLE_PHASE_LABELS on projects table and shared types
provides:
  - 4 soft-delete columns on projects table (deleted_at, deleted_by, deletion_reason, restored_at) in all tenant schemas
  - 5 new tRPC procedures on projectRouter (checkDeletable, softDelete, restore, listDeleted, acknowledgeRestore)
  - BLOCKED_DELETION_PHASES constant and DeletableCheckResult interface in @construction/shared
  - Idempotent migrate-phase37.ts migration script
  - Soft-delete filter on project.list, project.getBySlug, project.getById
affects:
  - 37-02 (frontend deletion UI depends on this API surface)
  - any future phase reading project lists (soft-deleted projects now hidden from all normal queries)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy purge: listDeleted hard-deletes rows older than 30 days before returning the live list"
    - "Parallel financial record checks: Promise.all for change orders + payment apps + commitments in checkDeletable"
    - "Soft-delete filter: isNull(schema.projects.deletedAt) added to all project list/get queries"
    - "Restore acknowledgment pattern: restoredAt column drives banner visibility, cleared by acknowledgeRestore"

key-files:
  created:
    - apps/api/src/db/migrations/migrate-phase37.ts
  modified:
    - apps/api/src/db/schema/tenant.ts
    - apps/api/src/trpc/routers/project.ts
    - packages/shared/src/types/project.ts
    - packages/shared/src/index.ts

key-decisions:
  - "checkDeletable checks ALL blocking factors simultaneously (lifecycle phase + all financial record types) and returns the complete reasons array — frontend can display every blocker at once"
  - "listDeleted lazy-purges rows older than 30 days inline before returning results — no background job needed"
  - "acknowledgeRestore has no admin gate — any project member can dismiss the restore banner"
  - "softDelete and restore both write audit log entries (DELETE and UPDATE action respectively)"
  - "paymentApplications table in tenant schema is named paymentApps (Drizzle variable), adjusted from plan spec"

patterns-established:
  - "Soft-delete: isNull(schema.projects.deletedAt) is the canonical filter for hiding deleted projects"
  - "Lazy purge on listDeleted: delete rows where deletedAt <= thirtyDaysAgo before SELECT"

requirements-completed:
  - DEL-02
  - DEL-04
  - DEL-05

# Metrics
duration: 15min
completed: 2026-02-19
---

# Phase 37 Plan 01: Project Deletion Backend — Schema, Migration, and 5 tRPC Procedures Summary

**Soft-delete infrastructure for projects: 4 nullable DB columns, idempotent migration, 5 tRPC procedures (checkDeletable with parallel financial checks, softDelete, restore with audit log, listDeleted with lazy purge, acknowledgeRestore), and soft-delete filter on all existing list/get queries.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-19T~14:15Z
- **Completed:** 2026-02-19T~14:30Z
- **Tasks:** 2
- **Files modified:** 4 (+ 1 created)

## Accomplishments
- Added 4 nullable soft-delete columns to projects table in all tenant schemas via idempotent migration (ADD COLUMN IF NOT EXISTS)
- Implemented 5 new tRPC procedures: checkDeletable (parallel financial record checks), softDelete (audit-logged), restore (audit-logged), listDeleted (lazy purge + deleter enrichment), acknowledgeRestore
- Added `isNull(schema.projects.deletedAt)` filter to list, getBySlug, and getById — soft-deleted projects are invisible in all normal project queries
- Exported `BLOCKED_DELETION_PHASES` and `DeletableCheckResult` from `@construction/shared`

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema columns, shared type, and migration** - `e2ebe88` (feat)
2. **Task 2: Five new tRPC procedures on project router** - `90a6858` (feat)

## Files Created/Modified
- `apps/api/src/db/migrations/migrate-phase37.ts` - Idempotent multi-tenant ALTER TABLE migration adding 4 columns
- `apps/api/src/db/schema/tenant.ts` - Added deletedAt, deletedBy, deletionReason, restoredAt columns to projects table definition
- `apps/api/src/trpc/routers/project.ts` - Added 5 procedures + soft-delete filters on list/getBySlug/getById
- `packages/shared/src/types/project.ts` - Added BLOCKED_DELETION_PHASES constant and DeletableCheckResult interface
- `packages/shared/src/index.ts` - Exported BLOCKED_DELETION_PHASES and DeletableCheckResult

## Decisions Made
- checkDeletable checks lifecycle phase AND all financial record types (change orders, payment apps, commitments) in parallel via Promise.all, returning all blocking reasons simultaneously — frontend can display the complete list at once rather than one at a time
- listDeleted uses lazy purge (hard-delete rows older than 30 days inline before SELECT) rather than a background job — simpler, no cron needed
- acknowledgeRestore has no admin gate — any authenticated user with project access can dismiss the restore banner (not an admin action)
- The plan referenced `schema.paymentApplications` — actual Drizzle table variable is `schema.paymentApps` (adjusted inline)

## Deviations from Plan

None — plan executed exactly as written, with one naming correction: `paymentApplications` → `paymentApps` (Drizzle variable name) confirmed from schema, handled inline.

## Issues Encountered

None. TypeScript compiles cleanly for project.ts (pre-existing errors in bid.ts, bidGeneration.ts, and quickbooks integration files are out of scope).

## User Setup Required

None — no external service configuration required. Migration already ran against dev DB.

## Next Phase Readiness
- Plan 02 (frontend deletion UI) has a complete, typed API surface: checkDeletable for pre-flight, softDelete for deletion, restore for recovery, listDeleted for trash bin, acknowledgeRestore for banner dismissal
- All procedures are admin-gated (org:admin) except acknowledgeRestore
- Soft-delete filter is active — Plan 02 can render the trash bin UI immediately using listDeleted

---

## Self-Check

**Created files exist:**
- `apps/api/src/db/migrations/migrate-phase37.ts` — FOUND (committed in e2ebe88)
- `apps/api/src/db/schema/tenant.ts` — FOUND (4 columns at lines 166-169)
- `apps/api/src/trpc/routers/project.ts` — FOUND (5 procedures + filters)
- `packages/shared/src/types/project.ts` — FOUND (BLOCKED_DELETION_PHASES + DeletableCheckResult)
- `packages/shared/src/index.ts` — FOUND (exports present)

**Commits exist:**
- e2ebe88 — FOUND (feat(37-01): schema columns, shared types, and Phase 37 migration)
- 90a6858 — FOUND (feat(37-01): five new tRPC procedures and soft-delete filter on existing queries)

## Self-Check: PASSED

---
*Phase: 37-project-deletion-with-safeguards*
*Completed: 2026-02-19*
