---
phase: 36-project-lifecycle-state-machine-simple-gc-mode
plan: "01"
subsystem: shared-types + api-schema
tags: [lifecycle, state-machine, project-mode, drizzle, typescript]

dependency_graph:
  requires: []
  provides:
    - lifecyclePhaseEnum, projectModeEnum, LIFECYCLE_ORDER, LIFECYCLE_PHASE_LABELS, BILLING_CATEGORIES from @construction/shared
    - projectLifecycleTransitions table in Drizzle tenant schema
    - lifecyclePhase + projectMode columns on projects table
    - defaultProjectMode column on user_profiles table
    - transitionLifecyclePhaseSchema, setProjectModeSchema Zod schemas
  affects:
    - packages/shared/src/types/project.ts
    - apps/api/src/db/schema/tenant.ts
    - apps/api/src/tenant/context.ts

tech_stack:
  added: []
  patterns:
    - Zod enum + type inference for lifecycle and mode enums
    - Drizzle text() columns with .notNull().default() for schema-only type definitions (no migration here)
    - TenantSchema return-object map pattern (all tables explicitly listed in context.ts)

key_files:
  created: []
  modified:
    - packages/shared/src/types/project.ts
    - apps/api/src/db/schema/tenant.ts
    - apps/api/src/tenant/context.ts

decisions:
  - "defaultProjectMode defaults to gc_advanced (not simple) to preserve backward compatibility with existing tenants"
  - "lifecyclePhase defaults to opportunity on new projects; migration plan (02) will handle existing rows"
  - "projectLifecycleTransitions has no updatedAt — transitions are immutable audit records only"
  - "project_administrator and project_assistant added to projectRoleEnum for lifecycle-gate permission checks in later plans"

metrics:
  duration: "2 minutes"
  completed: "2026-02-18"
  tasks_completed: 2
  files_modified: 3
---

# Phase 36 Plan 01: Lifecycle Types and Schema Foundation Summary

**One-liner:** 9-phase lifecycle state machine types, project mode enum (simple/gc_advanced), and Drizzle schema columns for the v1.5 Project Lifecycle Redesign.

## What Was Built

Defined the complete type foundation for the Phase 36 lifecycle state machine feature. All downstream plans (02–06) can now import types from `@construction/shared` and reference `schema.projectLifecycleTransitions` in tRPC mutations.

### packages/shared/src/types/project.ts

- `lifecyclePhaseEnum` — 9-value Zod enum: opportunity, estimating, submitted, awarded, active, substantial_completion, closed, warranty, archived
- `LifecyclePhase` — TypeScript type inferred from enum
- `projectModeEnum` — Zod enum: simple | gc_advanced
- `ProjectMode` — TypeScript type inferred from enum
- `projectRoleEnum` — Updated: added `project_administrator` and `project_assistant`
- `LIFECYCLE_ORDER` — Ordered `LifecyclePhase[]` array (index = ordinal position for transition validation)
- `LIFECYCLE_PHASE_LABELS` — `Record<LifecyclePhase, string>` for display
- `BILLING_CATEGORIES` — `as const` array of 5 simple-mode categories: Labor, Materials, Subcontractors, Equipment, Other
- `BillingCategory` — TypeScript type from `typeof BILLING_CATEGORIES[number]`
- `transitionLifecyclePhaseSchema` — Zod input schema for phase transition mutations
- `setProjectModeSchema` — Zod input schema for mode-setting mutations
- `createProjectSchema` — Extended with optional `projectMode` field

### apps/api/src/db/schema/tenant.ts

- `projects` table — Added `lifecyclePhase` (text, notNull, default "opportunity") and `projectMode` (text, notNull, default "gc_advanced") columns
- `user_profiles` table — Added `defaultProjectMode` (text, nullable, default "gc_advanced") column
- `projectLifecycleTransitions` table — New table: id, projectId (FK→projects cascade), fromPhase, toPhase, triggeredBy, actorId, reason, eventSource, createdAt

### apps/api/src/tenant/context.ts

- Added `projectLifecycleTransitions: tenantDb.projectLifecycleTransitions` to the schema map in `buildTenantContext()` to satisfy the `TenantSchema` type constraint

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] context.ts required update after tenant.ts schema addition**
- **Found during:** Task 2 verification (tsc)
- **Issue:** `apps/api/src/tenant/context.ts` explicitly maps every table in a `TenantSchema` object literal. Adding `projectLifecycleTransitions` to `createTenantSchema()` return caused a TS2741 error because the context map was not updated.
- **Fix:** Added `projectLifecycleTransitions: tenantDb.projectLifecycleTransitions` to the schema object in `buildTenantContext()`
- **Files modified:** `apps/api/src/tenant/context.ts`
- **Commit:** 9e9e1cc

### Pre-existing Errors (Out of Scope)

The following errors existed before this plan and are documented for awareness. They were NOT introduced by these changes:
- `check-search-data.ts` — Cannot find module `./db/pool.js`
- `migrations/add-sov-grouping-column.ts` — Expected 2 arguments, got 1
- `integrations/quickbooks/client.ts` + `oauth.ts` — Missing type declarations for node-quickbooks / intuit-oauth
- `services/bidGeneration.ts` — Missing TenantContext export, implicit any parameters
- `services/estimateLifecycle.ts` — Invalid bid status literals
- `trpc/routers/bid.ts` — SQL overload errors with nullable rfqId

These were deferred and logged. They do not affect this plan's deliverables.

## Success Criteria Check

- [x] TypeScript compiler resolves LifecyclePhase, ProjectMode, and LIFECYCLE_ORDER from @construction/shared with no errors
- [x] The projectRoleEnum includes project_administrator as a valid value
- [x] The BILLING_CATEGORIES constant lists exactly 5 simple-mode categories
- [x] createTenantSchema() has a projectLifecycleTransitions table with all required columns
- [x] The projects Drizzle table object exposes lifecyclePhase and projectMode columns
- [x] The user_profiles Drizzle table object exposes defaultProjectMode column

## Self-Check: PASSED

Files verified:
- FOUND: packages/shared/src/types/project.ts
- FOUND: apps/api/src/db/schema/tenant.ts
- FOUND: apps/api/src/tenant/context.ts

Commits verified:
- FOUND: c5875d2 (Task 1 — shared types)
- FOUND: 9e9e1cc (Task 2 — tenant schema)
