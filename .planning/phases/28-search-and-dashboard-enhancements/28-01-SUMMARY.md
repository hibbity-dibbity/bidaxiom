---
phase: 28-search-and-dashboard-enhancements
plan: "01"
subsystem: ui, api
tags: [trpc, drizzle, zod, lucide-react, command-palette, search]

# Dependency graph
requires:
  - phase: 27-slug-routing
    provides: Customer and project slug fields used in URL construction
  - phase: 17-estimating-workflow-setup-core
    provides: Estimates table with slug, projectId, name columns
provides:
  - Estimate type in searchResultSchema (shared types)
  - Estimate search results via JOIN query with isNotNull slug guard
  - Customer URL bug fix (slug instead of UUID in search results)
  - Estimates CommandGroup in global search command palette
affects:
  - search, command-palette, estimates, customers

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Search result type enum extended for new entity types via Zod z.enum"
    - "innerJoin with isNotNull guard to exclude incomplete records from search"

key-files:
  created: []
  modified:
    - packages/shared/src/types/search.ts
    - apps/api/src/trpc/routers/search.ts
    - apps/web/components/search/command-palette.tsx

key-decisions:
  - "Use .some() guard on Estimates CommandGroup to avoid rendering empty section headings when no estimate results match"
  - "isNotNull(estimates.slug) guard in query prevents stale/migrated estimates without slugs from appearing in search"
  - "Customer URL uses c.slug not c.id — consistent with slug-based routing established in Phase 27"

patterns-established:
  - "Estimate search: innerJoin projects on projectId to get projectSlug for URL and projectName for subtitle"

requirements-completed:
  - SRCH-01
  - SRCH-02

# Metrics
duration: 8min
completed: 2026-02-17
---

# Phase 28 Plan 01: Global Search Estimate Results + Customer URL Fix Summary

**Estimate results added to global search command palette via Drizzle innerJoin query; customer UUID-based 404 bug fixed with slug routing**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-17T19:44:34Z
- **Completed:** 2026-02-17T19:52:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Extended `searchResultSchema` type enum to include `"estimate"` alongside `"project"` and `"customer"`
- Added estimate search query with `innerJoin` on projects and `isNotNull(estimates.slug)` guard; returns up to `limit` results with project name as subtitle and nested URL `/projects/{projectSlug}/estimates/{estimateSlug}`
- Fixed customer search URL bug: was using `c.id` (UUID) producing 404s; now correctly uses `c.slug` matching the `/customers/[customerSlug]` route
- Added Estimates `CommandGroup` with `Calculator` icon and `.some()` empty-guard to command palette, satisfying SRCH-02 group heading requirement

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend search type enum and fix customer URL bug in search router** - `a140f53` (feat)
2. **Task 2: Add Estimates CommandGroup to command palette** - `b4de65d` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `packages/shared/src/types/search.ts` - Added "estimate" to type enum in searchResultSchema
- `apps/api/src/trpc/routers/search.ts` - Added estimate query with JOIN; fixed customer slug URL; imported and, isNotNull, eq from drizzle-orm
- `apps/web/components/search/command-palette.tsx` - Added Calculator import; added Estimates CommandGroup with .some() guard

## Decisions Made
- Applied `.some()` guard for the Estimates CommandGroup (unlike Projects/Customers which always render) — prevents empty heading when no estimates match while project/customer results exist
- Used `isNotNull(estimates.slug)` in the DB query rather than post-filtering in JS — avoids fetching data we'd immediately discard and prevents URL construction failures
- Customer slug was already in the schema (added in Phase 27); only needed to add it to the SELECT list

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in unrelated files (bid.ts, bidGeneration.ts, quickbooks integration, check-search-data.ts) were observed during the API type check. These are pre-existing issues outside the scope of this plan and were not introduced by these changes. The shared package and command-palette.tsx compile cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Search now returns estimates alongside projects and customers
- Customer links no longer 404
- Ready for Phase 28-02 (dashboard enhancements or next plan in phase)

---
*Phase: 28-search-and-dashboard-enhancements*
*Completed: 2026-02-17*
