---
phase: 15-dashboard-redesign
plan: 03
subsystem: ui
tags: [react, dashboard, widgets, kpi, trpc]

# Dependency graph
requires:
  - phase: 15-01
    provides: Dashboard tRPC router with aggregation endpoints
provides:
  - Reusable KpiCard base component with status-based styling
  - MyActiveProjects user-scoped widget
  - MyOpenBids user-scoped widget
  - MyTodo user-scoped widget with approval breakdown
affects: [15-04, 15-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Status-based color mapping for KPI widgets
    - Consistent loading/error state handling across widgets
    - Router navigation from widget onClick

key-files:
  created:
    - apps/web/components/dashboard/kpi-card.tsx
    - apps/web/components/dashboard/user-widgets.tsx
  modified: []

key-decisions:
  - "KpiCard uses status prop (success/warning/error/neutral) for color-coded values"
  - "Loading states use KpiCardSkeleton matching card dimensions"
  - "Error states show '--' value with 'Unable to load' description"
  - "MyTodo breakdown shows non-zero approval counts in description"

patterns-established:
  - "Widget pattern: tRPC query with loading/error/data states"
  - "Status color mapping via const object (not inline conditionals)"
  - "Skeleton matches component dimensions for layout stability"

# Metrics
duration: 2 min
completed: 2026-02-15
---

# Phase 15 Plan 03: KPI Card Component & User Widgets Summary

**Reusable KpiCard component with status-based styling and three user-scoped dashboard widgets using tRPC endpoints from 15-01**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-15T17:22:10Z
- **Completed:** 2026-02-15T17:23:59Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created reusable KpiCard base component with status color support
- Implemented MyActiveProjects widget with overdue count and project navigation
- Implemented MyOpenBids widget with count display
- Implemented MyTodo widget with breakdown of approval types (change orders, payment apps, workflows)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create reusable KPI card component** - `0fc6845` (feat)
2. **Task 2: Create user-scoped dashboard widgets** - `515238e` (feat)

**Plan metadata:** (to be committed in state update)

## Files Created/Modified

- `apps/web/components/dashboard/kpi-card.tsx` - Reusable KPI card with title, value, description, icon, status color, optional onClick
- `apps/web/components/dashboard/user-widgets.tsx` - Three user-scoped widgets (MyActiveProjects, MyOpenBids, MyTodo)

## Decisions Made

1. **Status-based color mapping** - KpiCard accepts `status` prop (success/warning/error/neutral) that maps to Tailwind color classes. Keeps color logic centralized.

2. **Skeleton matching dimensions** - KpiCardSkeleton uses same spacing as KpiCard to prevent layout shift during loading.

3. **Error state pattern** - All widgets show `--` value with "Unable to load" description on error instead of hiding the widget.

4. **MyTodo breakdown formatting** - Description shows count breakdown with pluralization (e.g., "2 approvals, 1 payment, 3 workflows") when items exist, "All caught up" when zero.

5. **Router navigation** - MyActiveProjects has onClick that navigates to /projects page. Other widgets don't navigate (no clear destination yet).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. All components created successfully and follow established patterns from BudgetSummaryCards.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 15-04 (Company-level widgets). KpiCard is ready for reuse across all remaining dashboard widgets.

## Self-Check: PASSED

All created files verified on disk:
- FOUND: apps/web/components/dashboard/kpi-card.tsx
- FOUND: apps/web/components/dashboard/user-widgets.tsx

All commits verified in git history:
- FOUND: 0fc6845 (Task 1: Create reusable KPI card component)
- FOUND: 515238e (Task 2: Create user-scoped dashboard widgets)

---
*Phase: 15-dashboard-redesign*
*Completed: 2026-02-15*
