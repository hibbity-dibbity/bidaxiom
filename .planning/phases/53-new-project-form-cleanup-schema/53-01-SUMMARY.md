---
phase: 53-new-project-form-cleanup-schema
plan: "01"
subsystem: database-schema
tags: [migration, drizzle, zod, projects, building-dimensions]
dependency_graph:
  requires: []
  provides:
    - customer_budget column on projects table (all active tenants)
    - building_width column on projects table (all active tenants)
    - building_length column on projects table (all active tenants)
    - building_height column on projects table (all active tenants)
    - building_sqft column on projects table (all active tenants)
    - createProjectSchema accepts 4 new optional numeric fields
    - updateProjectSchema accepts 4 new nullable optional numeric fields
    - project.create mutation persists new fields; server-computes building_sqft
  affects:
    - apps/api/src/db/schema/tenant.ts
    - packages/shared/src/types/project.ts
    - apps/api/src/trpc/routers/project.ts
tech_stack:
  added: []
  patterns:
    - Idempotent ADD COLUMN IF NOT EXISTS migration (same as phase 52 pattern)
    - Drizzle numeric columns with no .notNull() for nullable fields
    - Server-side computed column (buildingSqft = width * length)
    - String(number) for Drizzle numeric precision preservation
key_files:
  created:
    - apps/api/src/db/migrations/migrate-phase53.ts
  modified:
    - apps/api/src/db/schema/tenant.ts
    - packages/shared/src/types/project.ts
    - apps/api/src/trpc/routers/project.ts
decisions:
  - buildingSqft not in Zod schema; computed server-side as width * length on project create
  - All new columns nullable (no DEFAULT, no NOT NULL) to support existing projects
  - customerBudget separate from existing budget column (customer's budget vs contract value)
metrics:
  duration: "~8 minutes"
  completed: "2026-02-25"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 3
---

# Phase 53 Plan 01: DB Migration + Schema for Customer Budget and Building Dimensions

**One-liner:** Idempotent migration adding 5 nullable NUMERIC columns to projects table, with Drizzle schema, Zod validation, and server-side sqft computation in the create mutation.

## What Was Done

### Task 1: DB Migration
Created `apps/api/src/db/migrations/migrate-phase53.ts` following the exact pattern of migrate-phase52.ts. The migration:
- Loads dotenv from monorepo root
- Queries all active tenants
- For each tenant schema, runs BEGIN + 5x ADD COLUMN IF NOT EXISTS + COMMIT (ROLLBACK on error)
- Tracks success/failure counts and exits 1 if any failures

**Migration result:** 1 succeeded, 0 failed (tenant_vpa_g9edvkmrj3ao2oebusov)

The 5 columns added to `projects`:
- `customer_budget NUMERIC(15, 2)` — client's stated budget for the project
- `building_width NUMERIC(10, 2)` — building width in feet
- `building_length NUMERIC(10, 2)` — building length in feet
- `building_height NUMERIC(10, 2)` — building height in feet
- `building_sqft NUMERIC(12, 2)` — floor area (server-computed: width * length)

### Task 2: Schema + Router Updates

**A. Drizzle tenant schema (`tenant.ts`):**
Added all 5 new columns after the existing `budget` column in the `projects` table definition. All without `.notNull()` — nullable by default.

**B. Shared Zod schema (`project.ts`):**
- `createProjectSchema`: Added `customerBudget`, `buildingWidth`, `buildingLength`, `buildingHeight` as `z.number().nonnegative().optional()`. Note: `buildingSqft` is excluded — it is computed server-side and not submitted from the form.
- `updateProjectSchema`: Added the same 4 fields as `.nullable().optional()` to allow clearing values on update.

**C. Project router (`project.ts`):**
In the `create` mutation's `tx.insert(schema.projects).values({...})` block, added after `projectMode`:
- `customerBudget`: `String(input.customerBudget)` if non-null, else null
- `buildingWidth`: `String(input.buildingWidth)` if non-null, else null
- `buildingLength`: `String(input.buildingLength)` if non-null, else null
- `buildingHeight`: `String(input.buildingHeight)` if non-null, else null
- `buildingSqft`: `String(width * length)` if both are non-null, else null

## Verification

- Migration exit code: 0
- Output: "1 succeeded, 0 failed" — all active tenant schemas updated
- TypeScript (apps/api): No errors in modified files (pre-existing errors in unrelated files unchanged)
- TypeScript (packages/shared): Clean — no output

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `apps/api/src/db/migrations/migrate-phase53.ts` — exists (created)
- [x] `apps/api/src/db/schema/tenant.ts` — contains `customerBudget` (modified)
- [x] `packages/shared/src/types/project.ts` — contains `customerBudget` in both schemas (modified)
- [x] `apps/api/src/trpc/routers/project.ts` — contains `input.customerBudget` (modified)
- [x] Commit `11fd868` — migration file
- [x] Commit `cdea58d` — schema + router changes

## Self-Check: PASSED
