---
phase: 42-shared-ui-primitives
plan: "05"
subsystem: shared-ui
tags:
  - tanstack-table
  - sticky-header
  - frozen-column
  - currency-display
  - table-footer
dependency_graph:
  requires:
    - "42-01 (CurrencyDisplay component)"
    - "42-02 (sticky table pattern established)"
  provides:
    - "Customers table with TanStack sort + sticky header + frozen Customer column"
    - "Subcontractors table with TanStack sort + sticky header + frozen Company Name column"
    - "CommitmentList as proper table (not card-per-row) + sticky header/footer + CurrencyDisplay"
    - "CO line items table with sticky layout + frozen Cost Code + sticky footer + CurrencyDisplay"
    - "EstimateLineItemsTable with sticky header + frozen first col + sticky footer with grand totals"
  affects:
    - "apps/web/app/(dashboard)/customers/page.tsx"
    - "apps/web/app/(dashboard)/subcontractors/page.tsx"
    - "apps/web/components/budget/commitment-list.tsx"
    - "apps/web/components/change-order/change-order-detail.tsx"
    - "apps/web/components/estimates/line-items/EstimateLineItemsTable.tsx"
tech_stack:
  added: []
  patterns:
    - "TanStack useReactTable + getSortedRowModel + enableSortingRemoval: false"
    - "Sticky TableHeader: className='sticky top-0 z-20 bg-background'"
    - "Frozen first column header: className='sticky left-0 z-30 bg-background min-w-[160px] border-r'"
    - "Frozen first body cell: className='sticky left-0 z-10 bg-background border-r'"
    - "Sticky TableFooter: className='sticky bottom-0 z-20 bg-muted/50'"
    - "Frozen footer cell: className='sticky left-0 z-30 bg-muted/50 font-bold border-r'"
    - "CurrencyDisplay replaces Intl.NumberFormat in commitment-list and change-order-detail"
key_files:
  modified:
    - "apps/web/app/(dashboard)/customers/page.tsx"
    - "apps/web/app/(dashboard)/subcontractors/page.tsx"
    - "apps/web/components/budget/commitment-list.tsx"
    - "apps/web/components/change-order/change-order-detail.tsx"
    - "apps/web/components/estimates/line-items/EstimateLineItemsTable.tsx"
decisions:
  - "CommitmentList converted from Card-per-row layout to Table — card layout removed entirely; expandable line items panel preserved as colSpan=7 TableRow"
  - "CO line items table: no TanStack sort added (no sort UX requirement); sticky layout only"
  - "EstimateLineItemsTable: no TanStack sort added (grouped section rendering via lineItemsByDivision incompatible); sticky layout only"
  - "grandTotalCost and grandTotalMargin computed from lineItems prop via useMemo — not from TanStack row model to preserve correctness with grouped rendering"
  - "Footer colspan math: GC/Advanced mode has CSI Code column (colSpan=5); Simple mode omits it (colSpan=4)"
metrics:
  duration: "~6 min"
  completed: "2026-02-21"
  tasks_completed: 4
  files_modified: 5
---

# Phase 42 Plan 05: Remaining Tables Sticky Upgrade Summary

Upgraded 5 remaining tables to Procore-level density — sticky headers, frozen first columns, TanStack sort where applicable, and sticky footers with financial totals.

## What Was Built

**Task 1 — Customers + Subcontractors TanStack Sort (commit 0f8f514)**
Both contact-record list pages migrated from plain static tables to TanStack `useReactTable` with `getSortedRowModel`. Added `enableSortingRemoval: false` (2-state cycle), `ChevronsUpDown` unsorted icon, `ChevronUp`/`ChevronDown` for sort direction. Frozen first columns: Customer (customers page) and Company Name (subcontractors page). No footer — contact-record lists have no financial totals.

**Task 2 — CommitmentList Card-to-Table Conversion (commit 6baf1e7)**
Converted the CommitmentList from a card-per-row layout (`<Card>` wrapping each commitment) to a proper `<Table>` with TanStack sort. Frozen Vendor column. Sticky `TableFooter` shows filtered total commitment amount via `CurrencyDisplay`. Expandable line items sub-panel preserved as a `<TableRow colSpan={7}>`. `Intl.NumberFormat` removed entirely; all amounts use `CurrencyDisplay`.

**Task 3 — CO Line Items Sticky Layout (commit ce3bacf)**
Updated `change-order-detail.tsx` Line Items section with sticky `TableHeader`, frozen Cost Code column, and sticky `TableFooter` showing `co.totalAmount`. Removed `currencyFormatter` (Intl.NumberFormat); replaced with `CurrencyDisplay`. No TanStack sort — CO line items have no sort UX requirement. Standalone totals div below table removed (replaced by footer).

**Task 4 — EstimateLineItemsTable Sticky Layout (commit ec6e6e6)**
Added sticky `TableHeader` (z-20), frozen first column via `cell.column.getIndex() === 0` check (handles both CSI Code in GC/Advanced mode and Description in Simple mode as first col). Added `grandTotalCost` and `grandTotalMargin` computations via `useMemo` from the `lineItems` prop. Sticky `TableFooter` with `CurrencyDisplay` for both cost and margin (with `colorize showSign`). Column span math accounts for mode difference: `isSimpleMode ? 4 : 5`. All existing `EditableCell`, `SelectCell`, `SectionSubtotal`, and mutation handlers preserved unchanged. No TanStack sort added — grouped section rendering via `lineItemsByDivision` is incompatible with `getSortedRowModel` data flow.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified present:
- apps/web/app/(dashboard)/customers/page.tsx: FOUND
- apps/web/app/(dashboard)/subcontractors/page.tsx: FOUND
- apps/web/components/budget/commitment-list.tsx: FOUND
- apps/web/components/change-order/change-order-detail.tsx: FOUND
- apps/web/components/estimates/line-items/EstimateLineItemsTable.tsx: FOUND

Commits verified:
- 0f8f514: customers + subcontractors TanStack sort
- 6baf1e7: CommitmentList card-to-table conversion
- ce3bacf: CO line items sticky layout
- ec6e6e6: EstimateLineItemsTable sticky layout

Pattern verification:
- enableSortingRemoval: present in customers, subcontractors, commitment-list
- sticky top-0: present in all 5 files
- Intl.NumberFormat: absent from commitment-list and change-order-detail
