---
phase: 42-shared-ui-primitives
plan: 04
subsystem: ui
tags: [tanstack-table, react, sticky-header, frozen-column, currency-display, sort-icons]

# Dependency graph
requires:
  - phase: 42-shared-ui-primitives
    provides: CurrencyDisplay component (42-02, 42-03), TanStack Table pattern
  - phase: 41-design-foundation
    provides: CSS token system, StatusBadge component
provides:
  - ProjectsTable with sticky header + frozen Job# column + ChevronsUpDown sort + enableSortingRemoval
  - ChangeOrderList as proper TanStack Table with sticky header/footer + frozen CO# col + CurrencyDisplay
affects: [phase-43, phase-44, any future table components in the dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TanStack Table sticky header (top-0 z-20 bg-background) + frozen first col (left-0 z-10/z-30 bg-background border-r)
    - enableSortingRemoval: false for 2-state sort cycle (asc/desc, no third unsorted state)
    - ChevronsUpDown (opacity-40) for unsorted state, ChevronUp/Down for asc/desc — replaces ChevronDown opacity-30 anti-pattern
    - Table container: div with rounded-md border relative w-full overflow-auto max-h-[70vh]
    - Footer total from table.getRowModel().rows — reflects TanStack sorted/visible rows, not raw data

key-files:
  created: []
  modified:
    - apps/web/app/(dashboard)/projects/components/projects-table.tsx
    - apps/web/components/change-order/change-order-list.tsx

key-decisions:
  - "No footer on ProjectsTable — user explicitly decided no footer needed for projects list"
  - "ChangeOrderList footer total uses table.getRowModel().rows (TanStack sorted rows) not raw changeOrders array — reflects visible sorted set"
  - "ChangeOrderList card-per-row layout fully replaced with TanStack Table — card layout cannot support frozen columns or tabular scanning"
  - "currencyFormatter (Intl.NumberFormat) removed from ChangeOrderList in favor of CurrencyDisplay component"

patterns-established:
  - "Sticky table pattern: div container with overflow-auto max-h-[70vh], TableHeader sticky top-0 z-20, first header/cell sticky left-0 z-10/z-30, TableFooter sticky bottom-0 z-20"
  - "Sort icon pattern: ChevronsUpDown opacity-40 for unsorted, ChevronUp for asc, ChevronDown for desc — consistent across all tables"

requirements-completed:
  - TABLE-01
  - TABLE-02
  - TABLE-03
  - TABLE-04
  - TABLE-05

# Metrics
duration: 5min
completed: 2026-02-22
---

# Phase 42 Plan 04: Shared UI Primitives Summary

**ProjectsTable upgraded with sticky/frozen/sort-icon fixes; ChangeOrderList fully converted from card layout to TanStack Table with sticky header, frozen CO# col, footer total, and CurrencyDisplay**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-22T05:10:20Z
- **Completed:** 2026-02-22T05:14:36Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- ProjectsTable: added `enableSortingRemoval: false`, replaced `ChevronDown opacity-30` unsorted icon with `ChevronsUpDown opacity-40`, added sticky header and frozen Job # column, wrapped in `overflow-auto max-h-[70vh]` container — no footer (user decision)
- ChangeOrderList: completely converted from card-per-row layout to a proper `<Table>` with TanStack sort, ChevronsUpDown unsorted icon, sticky header, frozen CO # first column, sticky footer showing total visible CO amount via `table.getRowModel().rows`
- Removed `Intl.NumberFormat` / `currencyFormatter` from ChangeOrderList in favor of `CurrencyDisplay` component

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade ProjectsTable — sticky + frozen col + fix sort icons + enableSortingRemoval** - `a66a2c6` (feat)
2. **Task 2: Convert ChangeOrderList to table layout — TanStack sort + sticky + frozen col + footer + CurrencyDisplay** - `96e0697` (feat)

## Files Created/Modified

- `apps/web/app/(dashboard)/projects/components/projects-table.tsx` — Added `enableSortingRemoval: false`, `ChevronsUpDown` sort icon, sticky header, frozen `jobNumber` col, `overflow-auto max-h-[70vh]` wrapper, `cn` import
- `apps/web/components/change-order/change-order-list.tsx` — Full conversion from card layout to TanStack `<Table>` with sticky/frozen/footer, `CurrencyDisplay`, `enableSortingRemoval: false`, removed `Card`/`currencyFormatter`

## Decisions Made

- No footer on ProjectsTable — user explicit decision, no footer needed for projects list
- ChangeOrderList footer total uses `table.getRowModel().rows` to reflect TanStack's sorted visible rows (server-side filter means this IS the filtered set)
- Removed card-per-row layout entirely — card layout cannot support frozen columns or proper tabular density

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

git stash (invoked during pre-existing TypeScript error investigation) caused the change-order-list.tsx write to be temporarily reverted. Re-applied the write and committed successfully. The TypeScript errors encountered (`TS2307: Cannot find module @/*`, `TS17004: --jsx not set`) are pre-existing monorepo-root tsc configuration issues, confirmed present before these changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 5 requirements (TABLE-01 through TABLE-05) for Phase 42 table upgrades are complete across plans 42-02, 42-03, and 42-04
- Phase 43 (Budget Domain Redesign) can proceed — requires `/gsd:research-phase` before planning per existing blocker note (TanStack `getGroupedRowModel` + `@tanstack/react-virtual` integration nuances)

---
*Phase: 42-shared-ui-primitives*
*Completed: 2026-02-22*
