---
phase: 42-shared-ui-primitives
plan: 02
subsystem: ui
tags: [react, tanstack-table, table, sticky, frozen-columns, currency, budget, payment-app]

# Dependency graph
requires:
  - phase: 42-shared-ui-primitives
    provides: CurrencyDisplay component from Plan 01
provides:
  - BudgetLineItemTable with TanStack sort (enableSortingRemoval: false), sticky header/footer, frozen Cost Code column
  - SovEditor with sticky header/footer, frozen Item # column, CurrencyDisplay for amounts
affects:
  - phase 43 (Budget Domain Redesign inherits BudgetLineItemTable as base)
  - any component importing from budget/budget-line-item-table or payment-app/sov-editor

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sticky table pattern: overflow-auto + max-h-[600px] on wrapper div (NOT Radix ScrollArea)"
    - "Z-index layering: frozen header corner = z-30, sticky header row = z-20, frozen body cells = z-10"
    - "All sticky cells must have explicit bg-background or bg-muted/50 — never transparent"
    - "TanStack sort cycle: enableSortingRemoval: false ensures 2-state only (asc/desc, no unsorted after first click)"
    - "ChevronsUpDown (opacity-40) = unsorted, ChevronUp = asc, ChevronDown = desc — all h-3.5 w-3.5"
    - "TableFooter sticky bottom-0 with bg-muted/50 for totals row (replaces totals row inside TableBody)"
    - "SOV editor intentionally no TanStack sort — up/down reorder buttons control row order; sort would conflict"
    - "option element exception: inline toLocaleString acceptable since CurrencyDisplay JSX cannot go inside option"

key-files:
  created: []
  modified:
    - apps/web/components/budget/budget-line-item-table.tsx
    - apps/web/components/payment-app/sov-editor.tsx

key-decisions:
  - "BudgetLineItemTable uses TanStack useReactTable with getSortedRowModel and enableSortingRemoval: false (2-state sort cycle only)"
  - "SovEditor intentionally omits TanStack sort — row order is controlled by manual up/down mutation buttons; adding sort would conflict with this UX"
  - "Sticky table layout uses plain div with overflow-auto + max-h-[600px], NOT Radix ScrollArea (confirmed open GitHub issue radix-ui/primitives #2783)"
  - "TableFooter replaces inline totals TableRow inside TableBody — semantic HTML improvement plus enables sticky bottom positioning"
  - "option element text uses inline toLocaleString instead of CurrencyDisplay — JSX elements cannot be rendered inside native option elements"

patterns-established:
  - "Sticky table wrapper: <div className='border rounded-lg relative w-full overflow-auto max-h-[600px]'>"
  - "Sticky header: <TableHeader className='sticky top-0 z-20 bg-background'>"
  - "Frozen first header cell: className='sticky left-0 z-30 bg-background border-r'"
  - "Frozen first body cell: className='sticky left-0 z-10 bg-background border-r'"
  - "Sticky footer: <TableFooter className='sticky bottom-0 z-20 bg-muted/50'>"
  - "Frozen footer first cell: className='sticky left-0 z-30 bg-muted/50 font-bold border-r'"

requirements-completed:
  - TABLE-01
  - TABLE-02
  - TABLE-03
  - TABLE-04
  - TABLE-05

# Metrics
duration: 8min
completed: 2026-02-22
---

# Phase 42 Plan 02: Shared UI Primitives — Sticky Table Surfaces Summary

**BudgetLineItemTable upgraded with TanStack sort (2-state, asc/desc), sticky header, frozen Cost Code column, sticky totals footer, and CurrencyDisplay; SovEditor upgraded with sticky header, frozen Item # column, sticky totals tfoot, and CurrencyDisplay — both components eliminating all Intl.NumberFormat inline usage.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-22T05:05:00Z
- **Completed:** 2026-02-22T05:13:46Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- BudgetLineItemTable: Added TanStack `useReactTable` with `getSortedRowModel` and `enableSortingRemoval: false` (2-state sort cycle); sort icons ChevronsUpDown/ChevronUp/ChevronDown; sticky header (z-20); frozen Cost Code column (z-30 header, z-10 body); sticky TableFooter totals (z-20 bg-muted/50); CurrencyDisplay replaces all `Intl.NumberFormat` usage
- SovEditor: Added sticky header (z-20); frozen Item # column (z-30 header, z-10 body); migrated inline totals `TableRow` inside `TableBody` to proper `TableFooter` with sticky bottom-0; CurrencyDisplay for Scheduled Value cells; intentionally no TanStack sort (up/down reorder buttons control row order)
- Both components pass TypeScript strict check with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade BudgetLineItemTable** - `62f8860` (feat)
2. **Task 2: Upgrade SovEditor** - `969bf86` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `apps/web/components/budget/budget-line-item-table.tsx` - TanStack sort + sticky header/footer + frozen col + CurrencyDisplay
- `apps/web/components/payment-app/sov-editor.tsx` - Sticky header/footer + frozen col + CurrencyDisplay (no TanStack sort)

## Decisions Made

- **BudgetLineItemTable uses TanStack sort with `enableSortingRemoval: false`:** Ensures 2-state cycle only (asc/desc). Once sorted, clicking again reverses but never returns to "unsorted" — matches Procore-level table UX expectations.
- **SovEditor intentionally omits TanStack sort:** The component uses up/down mutation buttons to control row order (persisted to DB via `sov.reorder`). Adding TanStack sort would conflict with this manual ordering UX since sorted state would override the user's custom ordering.
- **Plain div overflow-auto instead of Radix ScrollArea:** Confirmed decision from 42-RESEARCH — Radix ScrollArea has an open GitHub issue (radix-ui/primitives #2783) that breaks sticky headers inside its viewport.
- **TableFooter replaces inline totals TableRow:** Semantic HTML improvement — totals belong in `tfoot`, not `tbody`. Also enables sticky bottom-0 positioning without affecting sort row model.
- **`toLocaleString` in option elements:** CurrencyDisplay is a JSX element and cannot be rendered inside native `<option>` text nodes. Inline `toLocaleString` is the documented exception — all table display cells use CurrencyDisplay.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both core budget surface components are now Phase 43-ready: sticky layout, TanStack integration pattern, CurrencyDisplay, semantic tfoot
- Phase 43 (Budget Domain Redesign) can inherit BudgetLineItemTable as base and extend with TanStack `getGroupedRowModel` + `@tanstack/react-virtual` for large datasets
- Sticky table pattern is fully established and documented in patterns-established — future tables in Phase 43 should follow the same z-index and bg class conventions

---
*Phase: 42-shared-ui-primitives*
*Completed: 2026-02-22*

## Self-Check: PASSED

- FOUND: apps/web/components/budget/budget-line-item-table.tsx
- FOUND: apps/web/components/payment-app/sov-editor.tsx
- FOUND: .planning/phases/42-shared-ui-primitives/42-02-SUMMARY.md
- FOUND commit: 62f8860 (BudgetLineItemTable upgrade)
- FOUND commit: 969bf86 (SovEditor upgrade)
