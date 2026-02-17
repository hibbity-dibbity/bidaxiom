---
phase: 22-validation-and-duplicate-prevention
plan: "01"
subsystem: api
tags: [trpc, drizzle-orm, ilike, validation, job-numbers, shared-package]

# Dependency graph
requires:
  - phase: 21-assignment-and-auto-generation
    provides: checkJobNumberAvailability procedure and job number generation
  - phase: 20-configuration-foundation
    provides: validateJobNumberTemplate and jobNumberSettingsSchema in shared package
provides:
  - Case-insensitive duplicate detection via ilike() in checkJobNumberAvailability
  - excludeProjectId support to prevent false positives on edit
  - existingProjectName and existingProjectSlug in availability response
  - validateJobNumberFormat exported from @construction/shared for web client
  - parseTemplatePattern exported from @construction/shared for web client
affects: [22-02, 22-03, project-form, any component using checkJobNumberAvailability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - ilike() for case-insensitive column matching in Drizzle ORM
    - and(...conditions) pattern for conditional WHERE clauses
    - Pure utility functions co-located in shared/types/ for cross-package reuse

key-files:
  created:
    []
  modified:
    - apps/api/src/trpc/routers/company.ts
    - packages/shared/src/types/company.ts
    - packages/shared/src/index.ts

key-decisions:
  - "ilike() over eq() for case-insensitive job number matching — ABC-001 and abc-001 are the same number; case-insensitive check prevents duplicates with different casing"
  - "validateJobNumberFormat and parseTemplatePattern added to shared/types/company.ts not api utils — pure regex functions with no server-only deps; co-located with other job-number utilities for discoverability"
  - "excludeProjectId uses ne() in WHERE conditions array — allows edit flow to exclude the project's own number without separate query path"

patterns-established:
  - "Conditional WHERE conditions: build conditions array, append ne() exclusion only when excludeProjectId provided, spread into and()"
  - "Availability response shape: { available, existingProjectName, existingProjectSlug } provides enough data for UX messaging without extra queries"

requirements-completed: [JOBVAL-01, JOBVAL-02, JOBVAL-03]

# Metrics
duration: 5min
completed: 2026-02-17
---

# Phase 22 Plan 01: Backend Availability Check and Shared Validation Utilities Summary

**Case-insensitive job number duplicate detection with ilike(), excludeProjectId for edit flows, and validateJobNumberFormat/parseTemplatePattern exported from @construction/shared**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-17T04:13:41Z
- **Completed:** 2026-02-17T04:18:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Upgraded `checkJobNumberAvailability` to use `ilike()` for case-insensitive matching (ABC-001 matches abc-001)
- Added optional `excludeProjectId` parameter so editing a project's own job number does not self-report as duplicate
- Updated response to include `existingProjectName` and `existingProjectSlug` for rich UX error messaging
- Added `validateJobNumberFormat` and `parseTemplatePattern` to `packages/shared/src/types/company.ts` as pure functions
- Exported both functions from `@construction/shared` for web client use

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade checkJobNumberAvailability in company router** - `97f1530` (feat)
2. **Task 2: Export validateJobNumberFormat and parseTemplatePattern from shared package** - `10ae344` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `apps/api/src/trpc/routers/company.ts` - Added ilike/and/ne imports, updated input schema with excludeProjectId, case-insensitive query with conditional exclusion, new response shape
- `packages/shared/src/types/company.ts` - Added parseTemplatePattern and validateJobNumberFormat functions (copied verbatim from api utils, zero server-only deps)
- `packages/shared/src/index.ts` - Added validateJobNumberFormat and parseTemplatePattern to company export block

## Decisions Made
- Used `ilike()` over `eq()` for case-insensitive job number matching — ABC-001 and abc-001 are the same number; case-insensitive check prevents duplicates with different casing
- `validateJobNumberFormat` and `parseTemplatePattern` added to `shared/types/company.ts` (not API utils) — pure regex functions with no server-only deps; co-located with other job-number utilities for discoverability
- `excludeProjectId` uses `ne()` in a conditions array — allows edit flow to exclude the project's own number without a separate query path

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors exist in other files (bid.ts, bidGeneration.ts, estimateLifecycle.ts, quickbooks oauth.ts) — all out of scope. No new errors were introduced by changes in this plan. `packages/shared` compiles clean with no errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `checkJobNumberAvailability` is ready for consumption by the project-form frontend validation plans (22-02, 22-03)
- `validateJobNumberFormat` and `parseTemplatePattern` are importable from `@construction/shared` in the web app
- The tRPC type inference will automatically surface the new return shape to the frontend client

## Self-Check: PASSED

- FOUND: apps/api/src/trpc/routers/company.ts
- FOUND: packages/shared/src/types/company.ts
- FOUND: packages/shared/src/index.ts
- FOUND: .planning/phases/22-validation-and-duplicate-prevention/22-01-SUMMARY.md
- Commit 97f1530 verified: feat(22-01): upgrade checkJobNumberAvailability with ilike and excludeProjectId
- Commit 10ae344 verified: feat(22-01): export validateJobNumberFormat and parseTemplatePattern from shared package

---
*Phase: 22-validation-and-duplicate-prevention*
*Completed: 2026-02-17*
