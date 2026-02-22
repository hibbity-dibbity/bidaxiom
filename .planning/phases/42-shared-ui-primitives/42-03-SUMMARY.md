---
phase: 42
plan: "03"
subsystem: payment-app
tags: [sticky-table, tanstack-table, currency-display, g703, payment-app-list]
dependency_graph:
  requires:
    - "42-01 (CurrencyDisplay shared component)"
  provides:
    - "G703Continuation with sticky header/footer + frozen Item+Description cols"
    - "PaymentAppList with TanStack sort + sticky header/footer + frozen Application # col"
  affects:
    - "apps/web/components/payment-app/g703-continuation.tsx"
    - "apps/web/components/payment-app/payment-app-list.tsx"
tech_stack:
  added:
    - "@tanstack/react-table (useReactTable, getCoreRowModel, getSortedRowModel, flexRender)"
  patterns:
    - "sticky top-0 z-20 bg-background on TableHeader"
    - "sticky left-0 / left-[60px] z-30 on frozen header cells"
    - "sticky bottom-0 z-20 bg-muted/50 on TableFooter"
    - "enableSortingRemoval: false for 2-state sort cycle"
    - "ChevronsUpDown icon for unsorted sort state"
key_files:
  modified:
    - "apps/web/components/payment-app/g703-continuation.tsx"
    - "apps/web/components/payment-app/payment-app-list.tsx"
decisions:
  - "G703 freezes both Item AND Description columns (left-0 and left-[60px]) — 11-col wide table requires both columns frozen for context"
  - "G703 has no TanStack sort — rows are naturally ordered by SOV item number; sort would be confusing"
  - "PaymentAppList visibleTotal computed from table.getRowModel().rows — reflects sort order but same data as tRPC filtered set"
  - "balanceToFinish error color (text-financial-negative) applied via wrapping span, not CurrencyDisplay colorize — preserves the existing hasError detection pattern"
metrics:
  duration: "~18 minutes"
  completed: "2026-02-22"
  tasks_completed: 2
  files_modified: 2
---

# Phase 42 Plan 03: G703 + PaymentAppList Sticky Table Upgrade Summary

G703Continuation and PaymentAppList upgraded with sticky headers, frozen first columns, sticky footer totals, TanStack sort (PaymentAppList only), and CurrencyDisplay replacing all raw Intl.NumberFormat instances.

## What Was Built

### Task 1: G703Continuation Upgrade (`5fd0f02`)

Rewrote `g703-continuation.tsx` with:

- **Outer container**: `relative w-full overflow-auto max-h-[70vh] rounded-md border` — constrains height and enables scroll
- **Sticky TableHeader**: `sticky top-0 z-20 bg-background`
- **Frozen columns in header**: Item col at `left-0 z-30`, Description col at `left-[60px] z-30` — both get `border-r` separator
- **Frozen columns in body rows**: Same offsets with `z-10`
- **Removed**: `const currencyFormatter = new Intl.NumberFormat(...)` — all calls replaced with `<CurrencyDisplay />`
- **Sticky TableFooter**: `sticky bottom-0 z-20 bg-muted/50` — shows AIA G702 totals: scheduledValue, workThisPeriod, materialsStored, totalCompleted, balanceToFinish, retainageAmount
- **Moved totals row**: From `<TableBody>` inline row to proper `<TableFooter>` semantic element

### Task 2: PaymentAppList Upgrade (`6c75a89`)

Upgraded `payment-app-list.tsx` with:

- **TanStack Table**: `useReactTable` with `getCoreRowModel` + `getSortedRowModel`
- **5 columns defined**: applicationNumber (sortable), period (not sortable), currentPaymentDue (sortable, sortingFn: basic), status (sortable), actions (not sortable)
- **`enableSortingRemoval: false`**: 2-state sort cycle (asc/desc only, no removal)
- **Sort icons**: ChevronsUpDown (unsorted), ChevronUp (asc), ChevronDown (desc)
- **Container**: `relative w-full overflow-auto max-h-[600px]`
- **Sticky TableHeader**: `sticky top-0 z-20 bg-background`
- **Frozen Application # column**: `sticky top-0 left-0 z-30 bg-background min-w-[120px] border-r` in header, `font-mono sticky left-0 z-10 bg-background border-r` in body
- **Sticky TableFooter**: `sticky bottom-0 z-20 bg-muted/50` with `visibleTotal` (sum of visible rows' currentPaymentDue)
- **CurrencyDisplay**: Replaces all `currencyFormatter.format()` calls — summary cards (totalApproved, totalPending, totalPaid, totalHeld) and table body
- **Preserved**: `statusVariantMap` and `PaymentAppStatus` type at module scope

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `apps/web/components/payment-app/g703-continuation.tsx` — commit `5fd0f02`
- [x] `apps/web/components/payment-app/payment-app-list.tsx` — commit `6c75a89`
- [x] No `Intl.NumberFormat` / `currencyFormatter` in either file
- [x] `enableSortingRemoval` present in payment-app-list
- [x] `TableFooter` present in both files
- [x] TypeScript: no errors in either file (`tsc --noEmit | grep "g703\|payment-app-list"` = empty)

## Self-Check: PASSED
