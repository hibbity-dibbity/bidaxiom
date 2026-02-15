---
phase: 13-navigation-and-theme-foundation
plan: 09
subsystem: database
tags: [migration, drizzle, postgres, company-branding]

# Dependency graph
requires:
  - phase: 13-06
    provides: Company branding integration with logo upload UI and tRPC mutations
provides:
  - Database migration adding logoStorageKey column to company_profiles across all tenant schemas
  - Column definition matches Drizzle schema for logo upload persistence
affects: [branding, company-settings]

# Tech tracking
tech-stack:
  added: []
  patterns: [tenant-migration-script, column-existence-check]

key-files:
  created:
    - apps/api/src/migrate-phase13-logo.ts
  modified: []

key-decisions:
  - "Migration script pattern follows Phase 8 QBO migration: dotenv config, pool.query, active tenant iteration"
  - "Column existence check prevents duplicate column errors on re-run"

patterns-established:
  - "Migration scripts in apps/api/src/migrate-phase{N}-{feature}.ts for retroactive schema changes"
  - "Check information_schema.columns before ALTER TABLE to support idempotent migrations"

# Metrics
duration: 2min
completed: 2026-02-15
---

# Phase 13 Plan 09: Logo Upload Database Fix

**Database migration adding logoStorageKey column to company_profiles resolves "column does not exist" error during logo upload**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-15T00:49:20Z
- **Completed:** 2026-02-15T00:51:06Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created migration script to add logo_storage_key column to existing tenant schemas
- Successfully migrated 3 active tenant schemas
- Verified column exists with correct TEXT data type
- Resolved logo upload database error blocking Phase 13-06 functionality

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix logo upload column name mismatch** - `56f24cf` (fix)

## Files Created/Modified
- `apps/api/src/migrate-phase13-logo.ts` - Migration script to add logoStorageKey column to all active tenant schemas

## Decisions Made

**Migration script pattern follows Phase 8 QBO migration:**
- Load .env.local from project root (two levels up from apps/api)
- Import pool from db/client.js
- Query public.tenants for active schemas
- Check column existence before ALTER TABLE
- Safe to re-run (idempotent)

**Column definition:**
- Type: TEXT (matches Drizzle schema definition)
- Nullable: Yes (existing company profiles have no logo initially)
- Storage key format: tenants/{tenantId}/branding/logo.{ext}

## Deviations from Plan

None - plan executed exactly as written. The plan correctly identified that the column was missing from the database and provided the migration script pattern.

## Issues Encountered

**Initial diagnostic script path issue:**
- Created check script with wrong import path (./db/pool.js instead of ./src/db/client.js)
- Resolved by examining existing migration scripts (migrate-phase8-qbo.ts) to identify correct pattern
- No impact on migration execution

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Logo upload functionality is now fully operational:
- Column exists in all tenant schemas
- Drizzle schema matches database structure
- Logo upload mutation can successfully persist storage keys
- Ready for verification via manual testing (upload logo → displays in sidebar/topbar/signin)

## Self-Check: PASSED

All claims verified:
- ✓ File exists: apps/api/src/migrate-phase13-logo.ts
- ✓ Commit exists: 56f24cf

---
*Phase: 13-navigation-and-theme-foundation*
*Completed: 2026-02-15*
