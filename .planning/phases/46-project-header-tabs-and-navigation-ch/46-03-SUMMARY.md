---
phase: 46-project-header-tabs-and-navigation-ch
plan: 03
subsystem: ui
tags: [react, nextjs, tailwind, project-tabs, tab-badges]

# Dependency graph
requires:
  - phase: 46-01
    provides: getHeaderStats tRPC procedure with changeOrdersPendingCount, paymentAppsPendingCount, documentsCount, invoicesCount
  - phase: 46-02
    provides: headerStats fetched in layout.tsx
provides:
  - Tab count badges: inline "(N)" suffix on Change Orders, Payment Apps, Documents, Invoices tabs
  - getBadgeCount() helper mapping href → count from headerStats
  - headerStats prop pass-through from layout.tsx to ProjectTabs
affects: [project detail page tabs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getBadgeCount: switch on section.href — maps 4 hrefs to headerStats fields, default returns 0"
    - "badge > 0 ? `${section.name} (${badge})` : section.name — zero-state shows plain label"
    - "headerStats passed from layout as prop — no separate useQuery in ProjectTabs"

key-files:
  created: []
  modified:
    - apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx

key-decisions:
  - "headerStats reuses the existing useQuery from layout.tsx — ProjectTabs receives it as prop"
  - "Badge is inline text (not a visual badge component) — same font/color as tab label"
  - "Zero state: badge count of 0 shows plain label with no suffix"
  - "scroll={false} and all 10 sectionPrefetchMap handlers confirmed unchanged"

patterns-established:
  - "Tab badge pattern: getBadgeCount(section.href) switch + conditional label interpolation inside sections.map()"

requirements-completed:
  - CHROME-03
  - CHROME-04

# Metrics
duration: 5min
completed: 2026-02-23
---

# Phase 46 Plan 03: Tab Count Badges Summary

**Added inline "(N)" count badges to Change Orders, Payment Apps, Documents, and Invoices tabs — hidden at zero, sourced from existing headerStats query**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-02-23
- **Tasks:** 1 of 2 (Task 2 is human-verify checkpoint — pending user review)
- **Files modified:** 2

## Accomplishments

- `project-tabs.tsx`: Extended `ProjectTabsProps` with optional `headerStats` (4 count fields); added `getBadgeCount()` helper after `sectionPrefetchMap`; updated `sections.map()` to compute badge/label before returning Link; `scroll={false}` and all 10 sectionPrefetchMap handlers confirmed unchanged
- `layout.tsx`: Added `headerStats={headerStats ?? null}` to `<ProjectTabs>` call — reuses existing query from plan 46-02

## Task Commits

1. **Task 1: Add headerStats prop and badge labels to ProjectTabs** - `36770db` (feat)
2. **Task 2: Checkpoint: Visual verification** — awaiting human verification

## Files Modified

- `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx` — headerStats prop, getBadgeCount helper, badge label in render
- `apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx` — headerStats passed to ProjectTabs

## Decisions Made

- headerStats arrives as a prop (not a new useQuery) — avoids duplicate fetching; layout already owns the query
- Inline text badge: `"Change Orders (3)"` style — matches user-confirmed design (no pill, no dot, no colored badge)

## Deviations from Plan

None.

## User Setup Required

None.

## Next Phase Readiness

- After checkpoint approval: Phase 46 all plans complete (01–04)
- Ready for phase verifier and STATE.md update

---
*Phase: 46-project-header-tabs-and-navigation-ch*
*Completed: 2026-02-23*
