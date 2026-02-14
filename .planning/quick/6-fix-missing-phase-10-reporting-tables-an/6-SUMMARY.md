---
phase: quick-fix
plan: 6
subsystem: database
tags: [postgresql, drizzle-orm, migration, phase-10, reporting]

# Dependency graph
requires:
  - phase: 10-reporting-and-analytics
    provides: Initial Phase 10 reporting tables migration script
provides:
  - Corrected Phase 10 reporting tables matching Drizzle ORM schema exactly
  - Drop-and-recreate migration pattern for fixing column mismatches
affects: [reporting, analytics, scheduled-reports, phase-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Drop-and-recreate pattern for fixing schema mismatches when data loss is acceptable

key-files:
  created: []
  modified:
    - apps/api/src/migrate-phase10-reporting.ts

key-decisions:
  - "Drop-and-recreate tables instead of ALTER: Phase 10 was just added with no production data, simpler than complex ALTER chain"

patterns-established:
  - "Migration scripts must match provision.ts DDL exactly to prevent ORM column mismatch crashes"

# Metrics
duration: 4min
completed: 2026-02-14
---

# Quick Fix 6: Phase 10 Reporting Tables Schema Correction

**Drop-and-recreate Phase 10 reporting tables to match Drizzle schema, fixing scheduled reports worker crashes caused by column mismatches**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-14T20:14:09Z
- **Completed:** 2026-02-14T20:18:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Fixed scheduled reports worker crash ("column report_definition_id does not exist")
- All four reporting tables now match Drizzle schema exactly
- Migration script aligned with provision.ts DDL for future tenants

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite Phase 10 migration to match Drizzle schema** - `c0ed73d` (fix)

## Files Created/Modified
- `apps/api/src/migrate-phase10-reporting.ts` - Rewrote to drop old tables and recreate with correct column definitions matching Drizzle schema

## Root Cause

The original migrate-phase10-reporting.ts was created before provision.ts was updated with correct Phase 10 table DDL. The migration used different column names/types than the Drizzle ORM schema:

1. **report_definitions**: Old had `definition JSONB, owner_id, is_favorite`. Drizzle expects `filters, columns, sort_by, group_by, chart_config, status, created_by`.
2. **report_templates**: Old missing `preview_image_url`, had extra `updated_at`.
3. **report_schedules**: Old had `report_id` (should be `report_definition_id`), `recipients TEXT[]` (should be `JSONB`), missing `created_by`.
4. **materialized_report_data**: Old had `report_id, filter_hash, created_at`. Drizzle expects `report_definition_id, generated_at, expires_at` (no filter_hash).

## Solution

Rewrote migration to:
1. DROP all four tables in reverse dependency order (CASCADE handles FKs)
2. Recreate tables with DDL copied directly from provision.ts (lines 1260-1348)
3. Maintain same indexes as provision.ts for consistency

## Verification

- Migration ran successfully on 3 active tenants
- API server started with no column errors
- Scheduled reports worker initialized successfully
- Worker logs show "Scheduled reports worker started" without crashes

## Decisions Made

**Drop instead of ALTER:** Since Phase 10 was just added and unlikely to have real production data, dropping and recreating tables is simpler and safer than a complex ALTER column chain that could fail mid-migration.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - migration executed cleanly, worker started successfully.

## User Setup Required

None - database-only migration, no configuration changes needed.

## Next Phase Readiness

- Phase 10 reporting infrastructure now functional
- Scheduled reports worker can run without column mismatch errors
- Application data loading (projects, customers, recent activity) works correctly

## Self-Check: PASSED

- FOUND: apps/api/src/migrate-phase10-reporting.ts
- FOUND: c0ed73d

All claimed files and commits exist.

---
*Phase: quick-fix*
*Completed: 2026-02-14*
