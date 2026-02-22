---
phase: 43-budget-domain-redesign
plan: "05"
subsystem: web-ui
tags: [search, filter-chips, empty-state, change-orders, payment-apps, estimates, rfqs, list-views]
dependency_graph:
  requires:
    - 43-01  # FilterChips, EmptyState, useColumnVisibility shared primitives
  provides:
    - LIST-01  # all 7 list views have search bars
    - LIST-02  # filter chips on ChangeOrderList, PaymentAppList, RFQs
    - LIST-03  # all 7 list views use shared EmptyState
  affects:
    - apps/web/components/change-order/change-order-list.tsx
    - apps/web/components/payment-app/payment-app-list.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/estimates/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/rfqs/page.tsx
tech_stack:
  added: []
  patterns:
    - client-side debounced search (useDebounce 300ms) layered on top of server-filtered tRPC data
    - FilterChips derived from existing filter state — no new server requests
    - EmptyState with icon branching (SearchX vs contextual icon) for filter vs genuinely-empty states
    - Unified render path replacing dual early-return + inline empty JSX pattern
key_files:
  created: []
  modified:
    - apps/web/components/change-order/change-order-list.tsx
    - apps/web/components/payment-app/payment-app-list.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/estimates/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/rfqs/page.tsx
decisions:
  - EstimatesPage search bar is shown conditionally (only when estimates.length > 0) — avoids showing a search bar on an empty page that already shows EmptyState
  - hasActiveFilters boolean derived from all active filter state to simplify EmptyState icon/heading/action branching
  - RFQs filteredRfqs derivation converted from simple ternary to useMemo with multi-condition filter — enables adding debouncedSearch without duplicating filter logic
  - PaymentAppList search bar placed above the Filters and Actions row (not inside it) — search is a page-level control, status filter is a secondary refinement
metrics:
  duration: "5 min"
  completed_date: "2026-02-22"
  tasks_completed: 2
  files_modified: 4
---

# Phase 43 Plan 05: Project-Scoped List Search, Filter Chips, and Empty States — Summary

**One-liner:** Client-side debounced search bars, removable filter chips, and shared EmptyState added to ChangeOrderList, PaymentAppList, Estimates page, and RFQs page — completing LIST-01/02/03 requirements.

## What Was Built

Four project-scoped list views were updated with consistent search, filtering, and empty state UX:

**ChangeOrderList** (`apps/web/components/change-order/change-order-list.tsx`)
- Added `searchInput` state + `useDebounce(300ms)` → `displayedChangeOrders` useMemo filtering on `title` and CO number
- Added inline search `<Input>` with `<Search>` icon above the status/type filter selects
- Added `FilterChips` for active status and type filters; `clearAllFilters` resets all three
- Replaced ad-hoc two-branch empty JSX with `<EmptyState>`: `SearchX` icon + "No change orders match your filters" when filters active; `FilePlus` + "No change orders yet" when genuinely empty
- `useReactTable` data prop updated from `changeOrders ?? []` to `displayedChangeOrders`

**PaymentAppList** (`apps/web/components/payment-app/payment-app-list.tsx`)
- Added `searchInput` state + `useDebounce(300ms)` → `displayedPaymentApps` useMemo filtering on `applicationNumber`
- Added inline search `<Input>` (max-w-sm) above the Filters and Actions row
- Added `FilterChips` for active status filter; `clearAllFilters` resets status + search
- Replaced ad-hoc empty div block with `<EmptyState>`: `SearchX` when filters active; `Receipt` when genuinely empty; respects `hasSovItems` for description and CTA visibility
- `useReactTable` data prop + `CardDescription` count updated to use `displayedPaymentApps`

**EstimatesPage** (`apps/web/app/(dashboard)/projects/[projectSlug]/estimates/page.tsx`)
- Added `searchInput` state + `useDebounce(300ms)` → `displayedEstimates` useMemo filtering on `name`
- Converted dual early-return pattern (empty-state return + full table return) to unified render path
- Search bar (max-w-md) shown conditionally only when `estimates.length > 0` — avoids rendering search on empty page
- Replaced `<Card><CardContent>` empty block with `<EmptyState>`: `SearchX` + "No estimates match your search" when search active; `FileText` + "No estimates yet" with New Estimate CTA when genuinely empty

**RFQsPage** (`apps/web/app/(dashboard)/projects/[projectSlug]/rfqs/page.tsx`)
- Added `searchInput` state + `useDebounce(300ms)`
- Converted `filteredRfqs` from inline ternary to `useMemo` with multi-condition filter (status + search on `title` and `rfqNumber`)
- Added `FilterChips` for active status filter; `clearAllFilters` resets status + search
- Added inline search `<Input>` above status filter select in a `space-y-2` wrapper
- Replaced `<Card><CardContent>` empty block with `<EmptyState>`: `SearchX` when filters active; `FileQuestion` + "No RFQs yet" with New RFQ CTA when genuinely empty
- Removed redundant `<ChevronLeft>` back-to-project button from page header (redundant with sidebar navigation); removed `ChevronLeft` from lucide-react import

## Requirements Satisfied

- **LIST-01:** All 7 list views now have search bars (projects, customers, subcontractors already had search; ChangeOrderList, PaymentAppList, EstimatesPage, RFQsPage added in this plan)
- **LIST-02:** Filter chips (FilterChips component) on ChangeOrderList (status + type chips), PaymentAppList (status chip), RFQsPage (status chip); plus Projects/Subcontractors from prior plans
- **LIST-03:** All 7 list views use shared `<EmptyState>` with contextual content distinguishing genuinely-empty state from no-match-for-filter state

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files Exist
- [x] `apps/web/components/change-order/change-order-list.tsx` — modified
- [x] `apps/web/components/payment-app/payment-app-list.tsx` — modified
- [x] `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/page.tsx` — modified
- [x] `apps/web/app/(dashboard)/projects/[projectSlug]/rfqs/page.tsx` — modified

### Commits Exist
- Task 1: `84f334c` — feat(43-05): add search + filter chips + EmptyState to ChangeOrderList and PaymentAppList
- Task 2: `acb0b76` — feat(43-05): add search + filter chips + EmptyState to Estimates and RFQs pages

### TypeScript
- Zero new errors in modified web files (verified with `tsc --noEmit` grep filter)

## Self-Check: PASSED
