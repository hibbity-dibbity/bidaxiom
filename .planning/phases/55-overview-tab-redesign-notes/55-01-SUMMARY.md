---
phase: 55-overview-tab-redesign-notes
plan: 01
subsystem: api
tags: [trpc, drizzle, postgres, multi-tenant, notes, migration]

# Dependency graph
requires:
  - phase: 54-date-pickers-stat-bar
    provides: project header foundation this extends (Overview tab context)
provides:
  - project_notes table in all active tenant schemas (idempotent migration)
  - notesRouter with list (reverse-chron + author name), create (500 char limit), delete (own or org:admin)
  - notes key registered in appRouter for client-side type inference
affects:
  - 55-02: Plan 02 will build the Overview tab UI calling notes.list, notes.create, notes.delete

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Multi-tenant migration pattern: createTenantSchema table def + migrate-phaseXX.ts idempotent script + context.ts manual mapping

key-files:
  created:
    - apps/api/src/db/migrations/migrate-phase55.ts
    - apps/api/src/trpc/routers/notes.ts
  modified:
    - apps/api/src/db/schema/tenant.ts
    - apps/api/src/trpc/router.ts
    - apps/api/src/tenant/context.ts

key-decisions:
  - "Hard delete for notes (no soft delete): notes are ephemeral team communication, no audit trail needed"
  - "Author name computed in JS from LEFT JOIN result: firstName + ' ' + lastName || 'Unknown'"
  - "500-char content limit enforced at zod input layer (not DB constraint)"

patterns-established:
  - "New table = three-file change: schema/tenant.ts + db/migrations/migrate-phaseXX.ts + tenant/context.ts mapping"

requirements-completed:
  - OVERVIEW-05
  - OVERVIEW-06
  - OVERVIEW-07
  - OVERVIEW-08
  - OVERVIEW-09
  - OVERVIEW-10

# Metrics
duration: 6min
completed: 2026-02-25
---

# Phase 55 Plan 01: Notes API Foundation Summary

**project_notes table + tRPC notesRouter (list/create/delete) with per-tenant migration and author attribution via LEFT JOIN on userProfiles**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-02-25T13:45:19Z
- **Completed:** 2026-02-25T13:50:43Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created `project_notes` table in all active tenant schemas via idempotent migration (1 tenant, 0 failures)
- Built `notesRouter` with list (reverse-chrono + author name LEFT JOIN), create (500 char max), and delete (own or org:admin) procedures
- Registered `notes` key in `appRouter` for full end-to-end tRPC type safety in Plan 02 UI

## Task Commits

Each task was committed atomically:

1. **Task 1: Add projectNotes table to Drizzle schema + create migration script** - `40e6394` (feat)
2. **Task 2: Create notesRouter with list, create, delete + register in appRouter** - `d8d1ee2` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `apps/api/src/db/schema/tenant.ts` - Added projectNotes table definition inside createTenantSchema + added to return object
- `apps/api/src/db/migrations/migrate-phase55.ts` - Idempotent CREATE TABLE IF NOT EXISTS + index on project_id
- `apps/api/src/trpc/routers/notes.ts` - notesRouter with list, create, delete procedures
- `apps/api/src/trpc/router.ts` - Import + notes key in appRouter
- `apps/api/src/tenant/context.ts` - Added projectNotes to schema mapping (required by TenantSchema type)

## Decisions Made
- Hard delete chosen for notes: no soft delete needed — notes are transient team communication with no regulatory audit requirement
- Author name computed in JavaScript (not SQL): `firstName + ' ' + lastName || 'Unknown'` — avoids SQL string concatenation complexity
- 500-character limit enforced at the Zod input layer only — DB uses unconstrained TEXT (consistent with existing codebase pattern)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added projectNotes to tenant/context.ts schema mapping**
- **Found during:** Task 2 (TypeScript compile check)
- **Issue:** `context.ts` has a manual schema object that maps each table; TenantSchema type requires all tables to be listed. After adding projectNotes to tenant.ts return, context.ts had a type error: "Property 'projectNotes' is missing"
- **Fix:** Added `projectNotes: tenantDb.projectNotes` to the schema mapping in buildTenantContext
- **Files modified:** `apps/api/src/tenant/context.ts`
- **Verification:** `npx tsc --noEmit` shows no errors in notes.ts, router.ts, tenant.ts, or context.ts
- **Committed in:** `d8d1ee2` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required fix — context.ts must match TenantSchema type. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in unrelated files (bid.ts, estimates.ts, quickbooks client) — out of scope, not touched. Filed to deferred-items scope boundary.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Notes API is complete and type-safe. Plan 02 (Overview tab UI) can now call `trpc.notes.list`, `trpc.notes.create`, and `trpc.notes.delete` with full type inference.
- No blockers.

---
*Phase: 55-overview-tab-redesign-notes*
*Completed: 2026-02-25*

## Self-Check: PASSED

All files confirmed present:
- FOUND: apps/api/src/db/schema/tenant.ts
- FOUND: apps/api/src/db/migrations/migrate-phase55.ts
- FOUND: apps/api/src/trpc/routers/notes.ts
- FOUND: apps/api/src/trpc/router.ts
- FOUND: apps/api/src/tenant/context.ts
- FOUND: .planning/phases/55-overview-tab-redesign-notes/55-01-SUMMARY.md

All commits confirmed:
- FOUND: 40e6394 (Task 1: schema + migration)
- FOUND: d8d1ee2 (Task 2: notes router + appRouter)
