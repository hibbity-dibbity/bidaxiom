---
phase: 36-project-lifecycle-state-machine-simple-gc-mode
plan: "02"
subsystem: api-migration + api-lib
tags: [lifecycle, state-machine, migration, drizzle, postgres, typescript]

dependency_graph:
  requires:
    - 36-01 (lifecyclePhaseEnum, LifecyclePhase, LIFECYCLE_ORDER from @construction/shared; projectLifecycleTransitions Drizzle table)
  provides:
    - apps/api/src/db/migrations/migrate-phase36.ts (runnable idempotent migration)
    - apps/api/src/lib/lifecycle-state-machine.ts (isValidTransition, tryAutoAdvance, LIFECYCLE_ORDER)
    - lifecycle_phase and project_mode columns on projects in every active tenant schema
    - project_lifecycle_transitions table in every active tenant schema
    - default_project_mode column on user_profiles in every active tenant schema
  affects:
    - packages/shared/src/index.ts (now exports lifecycle types — previously missing)
    - apps/api/src/db/migrations/migrate-phase36.ts
    - apps/api/src/lib/lifecycle-state-machine.ts

tech_stack:
  added: []
  patterns:
    - Per-tenant migration pattern (BEGIN/COMMIT/ROLLBACK per schema, idempotent via IF NOT EXISTS)
    - State machine guard pattern (index-based ordinal comparison for O(1) transition validation)
    - tryAutoAdvance silent-return pattern (no error on already-at-or-past-target)
    - Fire-and-forget audit log pattern via createAuditLog helper

key_files:
  created:
    - apps/api/src/db/migrations/migrate-phase36.ts
    - apps/api/src/lib/lifecycle-state-machine.ts
  modified:
    - packages/shared/src/index.ts

decisions:
  - "isValidTransition uses index-based comparison (LIFECYCLE_ORDER.indexOf) for O(1) ordinal arithmetic — no switch/case needed"
  - "tryAutoAdvance silently returns (no throw) when project is already at or past target phase — callers never need try/catch"
  - "db and schema params typed as any in tryAutoAdvance to avoid circular import with TenantContext type"
  - "AuditAction imported from @construction/shared directly (not re-exported from logger.ts)"

metrics:
  duration: "~2 minutes"
  completed: "2026-02-18"
  tasks_completed: 2
  files_modified: 3
---

# Phase 36 Plan 02: Database Migration and Lifecycle State Machine Summary

**One-liner:** Idempotent Phase 36 migration adds lifecycle columns to all tenant schemas; lifecycle-state-machine.ts encapsulates isValidTransition() and tryAutoAdvance() for Plan 03 router use.

## What Was Built

### apps/api/src/db/migrations/migrate-phase36.ts

Runnable migration script following the established per-tenant pattern (same structure as migrate-tenant.ts). Executed against 1 active tenant schema (`tenant_vpa_g9edvkmrj3ao2oebusov`) with zero failures.

Operations per schema (all idempotent):
1. `ADD COLUMN IF NOT EXISTS lifecycle_phase TEXT NOT NULL DEFAULT 'opportunity'` on projects
2. `UPDATE projects SET lifecycle_phase = CASE ... END` — backfills from existing `status` values (bidding→estimating, active→active, on_hold→active, completed→closed, archived→archived, else opportunity). The `WHERE lifecycle_phase = 'opportunity'` guard makes re-runs safe.
3. `ADD COLUMN IF NOT EXISTS project_mode TEXT NOT NULL DEFAULT 'gc_advanced'` on projects
4. `CREATE TABLE IF NOT EXISTS project_lifecycle_transitions (...)` — 9 columns matching Drizzle schema
5. `CREATE INDEX IF NOT EXISTS idx_plt_project_id ON project_lifecycle_transitions(project_id)`
6. `ADD COLUMN IF NOT EXISTS default_project_mode TEXT DEFAULT 'gc_advanced'` on user_profiles

### apps/api/src/lib/lifecycle-state-machine.ts

Reusable business logic module. Three exports:

**`isValidTransition(from, to, reason?): void`**
- Throws `TRPCError(BAD_REQUEST)` on same-phase
- Throws `TRPCError(BAD_REQUEST)` on skip-forward (`toIdx > fromIdx + 1`)
- Throws `TRPCError(BAD_REQUEST)` on backward without reason (`toIdx < fromIdx && !reason?.trim()`)
- Silent success on one-step-forward or backward with reason

**`tryAutoAdvance(db, schema, projectId, targetPhase, eventSource, actorId): Promise<void>`**
- Fetches current `lifecyclePhase` from DB
- Returns silently if project not found or `targetIdx !== currentIdx + 1`
- On valid advance: runs DB transaction (UPDATE projects + INSERT projectLifecycleTransitions), then writes audit log
- Never throws (fire-and-forget safe for system event hooks)

**`LIFECYCLE_ORDER` (re-export)**
- Passes through from `@construction/shared` so callers don't need two imports

### packages/shared/src/index.ts (deviation fix)

Added missing exports: `lifecyclePhaseEnum`, `LifecyclePhase`, `projectModeEnum`, `ProjectMode`, `LIFECYCLE_ORDER`, `LIFECYCLE_PHASE_LABELS`, `BILLING_CATEGORIES`, `BillingCategory`, `transitionLifecyclePhaseSchema`, `setProjectModeSchema`.

These were defined in `types/project.ts` by Plan 01 but not wired into the package's public API. This caused tsc errors in `lifecycle-state-machine.ts` until fixed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shared/src/index.ts missing lifecycle type exports**
- **Found during:** Task 2 verification (tsc errors on `lifecycle-state-machine.ts` line 3)
- **Issue:** `LIFECYCLE_ORDER` and `LifecyclePhase` were defined in `packages/shared/src/types/project.ts` (Plan 01) but not exported from the package's public `index.ts`. Import of `{ LIFECYCLE_ORDER, type LifecyclePhase }` from `@construction/shared` failed with TS2305.
- **Fix:** Added 10 missing lifecycle-related exports to `packages/shared/src/index.ts`
- **Files modified:** `packages/shared/src/index.ts`
- **Commit:** 1e6563b

### Pre-existing Errors (Out of Scope — carried over from 36-01)

The following errors existed before this plan and were not introduced by these changes:
- `check-search-data.ts` — Cannot find module `./db/pool.js`
- `migrations/add-sov-grouping-column.ts` — Expected 2 arguments, got 1
- `integrations/quickbooks/client.ts` + `oauth.ts` — Missing type declarations for node-quickbooks / intuit-oauth
- `services/bidGeneration.ts` — Missing TenantContext export, implicit any parameters
- `services/estimateLifecycle.ts` — Invalid bid status literals
- `trpc/routers/bid.ts` — SQL overload errors with nullable rfqId

## Verification Results

- [x] Migration ran with zero failures; 1 tenant migrated
- [x] `lifecycle_phase` column exists in `tenant_vpa_g9edvkmrj3ao2oebusov.projects` (TEXT, default 'opportunity')
- [x] `project_mode` column exists in `tenant_vpa_g9edvkmrj3ao2oebusov.projects` (TEXT, default 'gc_advanced')
- [x] `project_lifecycle_transitions` table exists with correct structure
- [x] `user_profiles.default_project_mode` column exists (TEXT, default 'gc_advanced')
- [x] `tsc` compiles `lifecycle-state-machine.ts` with zero errors
- [x] `isValidTransition` contains `toIdx > fromIdx + 1` skip-forward guard
- [x] `tryAutoAdvance` contains `if (targetIdx !== currentIdx + 1) return;` guard
- [x] `LIFECYCLE_ORDER` exported from lifecycle-state-machine.ts
- [x] `isValidTransition` and `tryAutoAdvance` exported from lifecycle-state-machine.ts

## Self-Check: PASSED

Files verified:
- FOUND: apps/api/src/db/migrations/migrate-phase36.ts
- FOUND: apps/api/src/lib/lifecycle-state-machine.ts
- FOUND: packages/shared/src/index.ts (modified)

Commits verified:
- FOUND: baa2270 (Task 1 — migration script)
- FOUND: 1e6563b (Task 2 — state machine module + shared exports)
