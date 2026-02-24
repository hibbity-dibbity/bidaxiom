---
phase: 49-project-tabs-redesign
plan: 03
subsystem: ui
tags: [next.js, react, navigation, tabs, phase-gate]

# Dependency graph
requires:
  - phase: 49-project-tabs-redesign
    provides: ALL_SECTIONS tab configuration in project-tabs.tsx
provides:
  - Change Orders tab visible on all projects regardless of lifecycle phase
affects: [project tabs, change order routing, lifecycle phase display]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx

key-decisions:
  - "Removed phaseGated: change_orders from tab config only — PHASE_FEATURE_GATES in packages/shared left intact as server-side mutation guard"

patterns-established: []

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-02-24
---

# Phase 49 Plan 03: Remove Change Orders phase gate Summary

**Removed `phaseGated: "change_orders"` from the Change Orders tab entry so it appears on all projects regardless of lifecycle phase (opportunity, estimating, submitted, awarded).**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-24T05:23:00Z
- **Completed:** 2026-02-24T05:23:43Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Change Orders tab now visible on all projects, including pre-award lifecycle phases (opportunity, estimating, submitted)
- Server-side `PHASE_FEATURE_GATES["change_orders"]` in `packages/shared` left intact as a mutation guard
- Consistent with the simplified UX pattern where tab visibility is not gated by lifecycle phase

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove phaseGated from Change Orders entry in project-tabs.tsx** - `9f729d3` (fix)

**Plan metadata:** (this docs commit)

## Files Created/Modified
- `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx` - Removed `phaseGated: "change_orders"` from Change Orders entry in ALL_SECTIONS

## Decisions Made
- Only the tab visibility gate was removed; `PHASE_FEATURE_GATES["change_orders"]` in `packages/shared/src/types/project.ts` was intentionally left untouched — it may still serve as a server-side mutation guard for change order creation/editing.

## Deviations from Plan

None - plan executed exactly as written. The code change was already committed at `9f729d3` as part of earlier UAT fixes; this SUMMARY documents that completed work.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Change Orders tab is now uniformly visible across all project lifecycle phases
- No blockers for subsequent plans in Phase 49

---
*Phase: 49-project-tabs-redesign*
*Completed: 2026-02-24*
