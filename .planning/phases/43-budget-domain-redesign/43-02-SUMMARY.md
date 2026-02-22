---
phase: 43-budget-domain-redesign
plan: "02"
subsystem: web/table-components
tags: [tanstack-table, column-visibility, localStorage, column-picker, empty-state]

dependency_graph:
  requires:
    - phase: 43-01
      provides: "useColumnVisibility hook, ColumnPicker component, EmptyState component"
  provides:
    - "BudgetLineItemTable with gear icon column picker (key: budget-line-items)"
    - "ProjectsTable with gear icon column picker (key: projects-list) + EmptyState isFiltered variants"
    - "G703Continuation converted to TanStack Table with gear icon column picker (key: g703-continuation)"
    - "CommitmentList with gear icon column picker (key: commitment-list)"
  affects:
    - "43-03 through 43-05: all 4 financial tables now have TABLE-06 column picker satisfied"

tech-stack:
  added: []
  patterns:
    - "enableHiding: false on first/identifier column to pin it out of column picker"
    - "Manual cell rendering tables: wrap each non-pinned TableCell in table.getColumn(id)?.getIsVisible() check"
    - "G703 pattern: convert plain Table to useReactTable + row.getVisibleCells() + colId switch per cell"
    - "Footer colSpan: use table.getVisibleLeafColumns().length for dynamic expand rows"
    - "ColumnPicker placement: next to existing header actions (BudgetLineItemTable/ProjectsTable) or in filter toolbar row (CommitmentList)"

key-files:
  created: []
  modified:
    - apps/web/components/budget/budget-line-item-table.tsx
    - apps/web/app/(dashboard)/projects/components/projects-table.tsx
    - apps/web/app/(dashboard)/projects/components/columns.tsx
    - apps/web/components/payment-app/g703-continuation.tsx
    - apps/web/components/budget/commitment-list.tsx

key-decisions:
  - "G703Continuation converted from plain Table to useReactTable to enable column visibility state — plain Table has no column model"
  - "G703 rowIndex computed via lineItems.indexOf(item) to preserve onLineItemChange index semantics after TanStack row reordering"
  - "ProjectsTable isFiltered changed from optional (isFiltered?) to required (isFiltered) — page already passes it correctly; required ensures type safety"
  - "CommitmentList expand row colSpan uses table.getVisibleLeafColumns().length for dynamic column count"

requirements-completed:
  - TABLE-06

duration: ~9min
completed: "2026-02-22"
---

# Phase 43 Plan 02: Column Picker Integration Summary

**Gear icon column picker wired into all 4 financial tables (BudgetLineItemTable, ProjectsTable, G703Continuation, CommitmentList) with localStorage-scoped persistence and pinned identity columns; ProjectsTable EmptyState replaces ad-hoc empty JSX.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-02-22T16:57:44Z
- **Completed:** 2026-02-22T17:07:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- All 4 financial tables now have a gear icon (`Settings2`) that opens a popover listing hideable columns; clicking any checkbox toggles that column across header, body, and footer
- Each table's identity/first column is pinned with `enableHiding: false` (costCode, jobNumber, item+description, vendorName) — these never appear in the picker
- Column visibility persists in localStorage per table under separate keys (`col-picker:budget-line-items`, `col-picker:projects-list`, `col-picker:g703-continuation`, `col-picker:commitment-list`) — hiding a column on one table never affects another
- G703Continuation converted from plain `<Table>` to full `useReactTable` instance enabling column visibility state
- ProjectsTable now renders shared `EmptyState` component (FolderOpen when no data, SearchX when filters active) replacing the ad-hoc bordered div with inline JSX

## Task Commits

Each task was committed atomically:

1. **Task 1: Add column picker to BudgetLineItemTable and ProjectsTable** - `5534cac` (feat)
2. **Task 2: Add column picker to G703Continuation and CommitmentList** - `e3de800` (feat)

## Files Created/Modified

- `apps/web/components/budget/budget-line-item-table.tsx` - Added useColumnVisibility + ColumnPicker; enableHiding:false on costCode; body/footer use getIsVisible() guards per cell
- `apps/web/app/(dashboard)/projects/components/projects-table.tsx` - Added useColumnVisibility + ColumnPicker; isFiltered changed to required; EmptyState replaces inline empty JSX; Link/Plus removed (EmptyState handles link)
- `apps/web/app/(dashboard)/projects/components/columns.tsx` - Added enableHiding: false to jobNumber column definition
- `apps/web/components/payment-app/g703-continuation.tsx` - Full rewrite using useReactTable; 11 columns defined; item+description pinned; row rendering via getVisibleCells() + colId switch; footer conditionally renders per visible column
- `apps/web/components/budget/commitment-list.tsx` - Added useColumnVisibility + ColumnPicker in filter toolbar; vendorName pinned; body cells wrapped in getIsVisible() guards; expand row colSpan = getVisibleLeafColumns().length; footer cells conditional

## Decisions Made

- G703Continuation had to be converted to useReactTable (plain HTML Table has no column model for visibility state)
- G703 rowIndex for `onLineItemChange` computed via `lineItems.indexOf(item)` since TanStack's row.index reflects post-sort order — safer to use original array index
- CommitmentList `ColumnPicker` placed at the end of the filter toolbar row (flex justify-between with filters on left, picker on right) for compact layout
- ProjectsTable `isFiltered` hardened from optional (`?`) to required since `projects/page.tsx` already passes it — required catches future consumers forgetting to pass it

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TABLE-06 fully satisfied for all 4 tables in scope
- Each table's localStorage key is independent — no cross-table state collision possible
- ProjectsTable EmptyState ready for Plan 04 which wires advanced filter chips
- G703 now uses TanStack row model — future plans can add sorting if needed without architectural change

---

## Self-Check: PASSED

- FOUND: apps/web/components/budget/budget-line-item-table.tsx
- FOUND: apps/web/app/(dashboard)/projects/components/projects-table.tsx
- FOUND: apps/web/app/(dashboard)/projects/components/columns.tsx
- FOUND: apps/web/components/payment-app/g703-continuation.tsx
- FOUND: apps/web/components/budget/commitment-list.tsx
- FOUND commit: 5534cac (Task 1)
- FOUND commit: e3de800 (Task 2)
- Zero TypeScript errors in all 5 modified files

---
*Phase: 43-budget-domain-redesign*
*Completed: 2026-02-22*
