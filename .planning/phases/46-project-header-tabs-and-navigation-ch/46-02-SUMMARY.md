---
phase: 46-project-header-tabs-and-navigation-ch
plan: 02
subsystem: ui
tags: [react, nextjs, trpc, tailwind, sticky-header, financial-display]

# Dependency graph
requires:
  - phase: 46-01
    provides: getHeaderStats tRPC procedure returning 5 financial metrics
provides:
  - Compact sticky 2-row project header (≤80px) with financial stat bar
  - layout.tsx sticky chrome wrapper (-mx-6 -mt-6 edge bleed, sticky top-0 z-10)
  - project-header.tsx 2-row layout with CurrencyDisplay stat bar
affects: [46-03, any project detail page tab]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sticky chrome wrapper: -mx-6 -mt-6 px-6 pt-4 on sticky div to bleed to container edges while preserving padding for content"
    - "Financial stat bar: flex items-center gap-6 overflow-x-auto with CurrencyDisplay for each metric"
    - "Mode switch moved from inline text button to DropdownMenuItem inside ellipsis menu"

key-files:
  created: []
  modified:
    - apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx

key-decisions:
  - "budgetSummary query preserved in layout.tsx (not passed to ProjectHeader) — Overview tab reads from React Query cache"
  - "void budgetSummary used to silence unused-variable lint warning without removing the query"
  - "Mode switch button moved from Row 1 inline to DropdownMenuItem inside ellipsis menu — satisfies CHROME-01 compact Row 1 requirement"
  - "Restored banner placed above Row 1 inside sticky wrapper — accepted transient height overflow when visible per plan spec"

patterns-established:
  - "Sticky project chrome: sticky top-0 z-10 bg-background -mx-6 -mt-6 wraps ProjectHeader + ProjectTabs"
  - "getHeaderStats passed as headerStats prop; layout fetches, header displays"

requirements-completed:
  - CHROME-01
  - CHROME-02

# Metrics
duration: 8min
completed: 2026-02-23
---

# Phase 46 Plan 02: Compact Sticky Header Summary

**Compressed project layout chrome into sticky 2-row header (≤80px) with 5-field financial stat bar using CurrencyDisplay — removed customer info row and budget metric grid**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-23T17:17:16Z
- **Completed:** 2026-02-23T17:25:00Z
- **Tasks:** 2 of 3 (paused at human-verify checkpoint)
- **Files modified:** 2

## Accomplishments
- layout.tsx: added sticky chrome wrapper with `-mx-6 -mt-6` edge bleed; added `getHeaderStats` useQuery (enabled when project loads); removed old props passed to ProjectHeader
- project-header.tsx: rewrote to 2-row compact layout — Row 1 (job#/name/badges/actions), Row 2 (5-field financial stat bar with CurrencyDisplay); removed info row and budget metric grid; moved mode switch into DropdownMenu
- TypeScript compiles cleanly with no errors in either file

## Task Commits

Each task was committed atomically:

1. **Task 1: Update layout.tsx — sticky wrapper and getHeaderStats fetch** - `63de7ec` (feat)
2. **Task 2: Rewrite project-header.tsx — 2-row compact layout with financial stat bar** - `925a502` (feat)
3. **Task 3: Checkpoint: Visual verification** - awaiting human verification

## Files Created/Modified
- `apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx` - Added sticky chrome wrapper, getHeaderStats query, simplified ProjectHeader props
- `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx` - 2-row compact layout with financial stat bar; removed info row, budget metric grid, standalone mode switch button

## Decisions Made
- budgetSummary query preserved in layout.tsx even though it's no longer passed to ProjectHeader — Overview tab reads from React Query cache; `void budgetSummary` used to signal intentional no-op
- Mode switch button moved from Row 1 inline text to DropdownMenuItem in the ellipsis menu — satisfies CHROME-01 compact Row 1 (Row 1 no longer has an extra inline text control)
- Restored banner placed above Row 1 inside the sticky wrapper per plan spec ("accepted: transient height overflow when visible")

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Task 1 showed a TypeScript error when compiled in isolation (before Task 2 rewrote the ProjectHeaderProps interface). Both tasks were written before running the final combined compile check, which passed cleanly. Not a deviation — just execution order.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- After checkpoint approval: 46-02 is fully complete and 46-03 (tab badges) can proceed
- Sticky header and financial stat bar are visually live; human reviewer verifies scroll behavior, stat bar rendering, and removal of old rows

---
*Phase: 46-project-header-tabs-and-navigation-ch*
*Completed: 2026-02-23*
