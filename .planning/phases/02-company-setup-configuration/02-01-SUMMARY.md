---
phase: 02-company-setup-configuration
plan: 01
subsystem: api, database
tags: [drizzle-orm, postgres, trpc, effective-dating, versioning, csi-masterformat]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: tenant schema pattern, tRPC router infrastructure, audit logging middleware
provides:
  - Company profile database schema with effective dating
  - CSI MasterFormat 50-division reference data
  - Company configuration tRPC router with version management
  - Shared company types and validation schemas
  - Effective-dating utility for point-in-time queries
affects: [03-company-ui, rfq-management, bid-management, company-settings]

# Tech tracking
tech-stack:
  added: []
  patterns: [effective-dating for versioned records, point-in-time historical queries, atomic version management via transactions]

key-files:
  created:
    - apps/api/src/db/schema/tenant.ts (companyProfiles table)
    - apps/api/src/db/seed/csi-divisions.ts (CSI reference data)
    - apps/api/src/lib/effective-dating.ts (asOfDate helper)
    - apps/api/src/trpc/routers/company.ts (company router)
    - packages/shared/src/types/company.ts (shared types)
  modified:
    - apps/api/src/db/migrate.ts (company_profiles migration)
    - apps/api/src/tenant/context.ts (include companyProfiles)
    - apps/api/src/trpc/router.ts (register company router)
    - packages/shared/src/index.ts (export company types)

key-decisions:
  - "Use effective dating (validFrom/validTo) for company profile versioning - supports historical context queries"
  - "Use TEXT column with Zod validation for companyType instead of PostgreSQL ENUM - avoids enum alteration complexity"
  - "Atomic version management via transaction - close old record and insert new in single operation"
  - "Enforce sub_only companies must have at least one trade at API level"

patterns-established:
  - "Effective dating pattern: validTo = NULL for current version, set to NOW() when superseded"
  - "asOfDate helper for point-in-time queries across any effective-dated table"
  - "Transaction-based version management for atomic updates"

# Metrics
duration: 5min
completed: 2026-02-12
---

# Phase 2 Plan 1: Company Setup Configuration Backend Summary

**Company profile schema with effective dating, CSI MasterFormat reference data, and versioned tRPC API for company configuration management**

## Performance

- **Duration:** 5 minutes
- **Started:** 2026-02-12T14:00:23Z
- **Completed:** 2026-02-12T14:05:22Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Company profiles table with effective dating (validFrom/validTo) for immutable version history
- CSI MasterFormat 50-division reference data for standard construction trades
- Company tRPC router with getCurrent, getAsOf, update, getHistory procedures
- Atomic version management via database transaction (close old + insert new)
- Permission-based update protection (manage CompanySettings) with audit logging

## Task Commits

Each task was committed atomically:

1. **Task 1: Database schema, CSI seed data, and effective-dating helper** - `6eac8b0` (feat)
2. **Task 2: Company configuration tRPC router with version management** - `38db885` (feat)

## Files Created/Modified
- `apps/api/src/db/schema/tenant.ts` - Added companyProfiles table with effective dating columns
- `apps/api/src/db/seed/csi-divisions.ts` - CSI MasterFormat 28-division reference data constant
- `apps/api/src/lib/effective-dating.ts` - asOfDate helper for point-in-time queries
- `apps/api/src/trpc/routers/company.ts` - Company configuration router with version management
- `packages/shared/src/types/company.ts` - Shared Zod schemas and TypeScript types for company config
- `apps/api/src/db/migrate.ts` - Added company_profiles table migration with partial index
- `apps/api/src/tenant/context.ts` - Include companyProfiles in tenant schema object
- `apps/api/src/trpc/router.ts` - Register company router in appRouter

## Decisions Made
- **Effective dating for version history:** Using validFrom/validTo pattern ensures all company configuration changes are preserved for historical context (e.g., what trades was this sub qualified for when they bid on a project?)
- **TEXT column + Zod validation for companyType:** Avoids PostgreSQL ENUM migration complexity while maintaining type safety via shared Zod schema
- **Atomic transaction for updates:** Close old version and insert new version in a single transaction to prevent race conditions or partial updates
- **Server-side business validation:** Sub-only companies must select at least one trade, validated at API level with clear error message

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**TypeScript strictness with nullable context fields:**
- **Issue:** TypeScript flagged `ctx.tenant` and `ctx.userId` as possibly null even though `protectedProcedure` middleware guarantees they're non-null
- **Resolution:** Added explicit runtime checks with clear error messages to satisfy TypeScript's strict null checking while maintaining runtime safety
- **Impact:** Improved code safety with no functional change

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 2 Plan 2:** Frontend UI for company configuration is unblocked. Backend provides:
- Current company profile query endpoint
- Historical profile query for point-in-time context
- Update mutation with validation and audit trail
- Version history for displaying configuration changes over time

**Database migration required:** Run `apps/api/src/db/migrate.ts` with `migrateTenantSchema()` for existing tenant schemas to create the `company_profiles` table.

## Self-Check: PASSED

All created files exist:
- apps/api/src/db/schema/tenant.ts ✓
- apps/api/src/db/seed/csi-divisions.ts ✓
- apps/api/src/lib/effective-dating.ts ✓
- apps/api/src/trpc/routers/company.ts ✓
- packages/shared/src/types/company.ts ✓

All commits exist:
- 6eac8b0 (Task 1) ✓
- 38db885 (Task 2) ✓

---
*Phase: 02-company-setup-configuration*
*Completed: 2026-02-12*
