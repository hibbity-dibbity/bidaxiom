---
phase: 29-ux-polish-and-tech-debt
plan: "01"
subsystem: ui
tags: [react-query, tanstack-query, sonner, toast, error-handling, trpc]

# Dependency graph
requires:
  - phase: 13-navigation-and-theme-foundation
    provides: Sonner Toaster already mounted in providers.tsx
provides:
  - Global tRPC query error handler via QueryCache.onError surfacing errors as toast notifications
affects: [all-future-phases, trpc-queries, error-observability]

# Tech tracking
tech-stack:
  added: []
  patterns: [QueryCache.onError global error handler, toast.error for query failure notifications]

key-files:
  created: []
  modified:
    - apps/web/app/providers.tsx

key-decisions:
  - "QueryCache.onError (v5 API) used instead of defaultOptions.queries.onError (v4 API that silently no-ops in v5)"
  - "No MutationCache.onError added — mutations already handle errors individually via onError callbacks; global handler would cause double-toasting"

patterns-established:
  - "Global query error handling: QueryCache.onError in providers.tsx is the single catch point for all tRPC query failures"

requirements-completed: [UX-03]

# Metrics
duration: 3min
completed: 2026-02-18
---

# Phase 29 Plan 01: UX Polish and Tech Debt — Global Query Error Handler Summary

**QueryCache.onError wired to sonner toast.error in providers.tsx, surfacing all silent tRPC query failures as 'Failed to load data' toast notifications**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-18T02:16:26Z
- **Completed:** 2026-02-18T02:19:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `QueryCache` import and instantiation in `providers.tsx` using the correct react-query v5 API
- Added `import { toast } from "sonner"` for direct toast invocation in the error handler
- `QueryCache.onError` handler calls `toast.error("Failed to load data", { description: error.message })` for all query failures
- No `MutationCache` added — avoids double-toasting since mutations handle errors individually

## Task Commits

Each task was committed atomically:

1. **Task 1: Add QueryCache global error handler to providers.tsx** - `6a049fc` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `apps/web/app/providers.tsx` - Added QueryCache with onError handler and toast import; all tRPC query errors now surface as toast notifications

## Decisions Made
- Used `QueryCache.onError` (v5 API) instead of `defaultOptions.queries.onError` (v4 API, silently no-ops in v5) — plan specified this explicitly
- Deliberately omitted `MutationCache.onError` — mutations already have per-mutation `onError` callbacks; global mutation handler would double-toast every mutation failure

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Pre-existing TypeScript errors in `apps/api` files (intuit-oauth, bidGeneration.ts, estimateLifecycle.ts, bid.ts) are unrelated to this plan and were not touched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Global error handler is active; all subsequent tRPC queries that fail will surface toast notifications automatically
- Phase 29 Plans 02-04 can proceed — error observability foundation is now in place

---
*Phase: 29-ux-polish-and-tech-debt*
*Completed: 2026-02-18*
