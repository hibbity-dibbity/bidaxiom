# 52-04 Summary: List Page, Detail Page, Command Palette & UAT

## What Was Done

Overhauled all subcontractor-facing UI surfaces to use the new SIMPLE_TRADES string system, and resolved a browser-freeze bug discovered during human verification.

### Task 1 — Subcontractors List Page (`subcontractors/page.tsx`)
- Replaced `CSI_DIVISIONS` number filter with `SIMPLE_TRADES` string filter
- Changed `tradeFilter` state type from `number | null` to `string | null`
- Replaced `getTradeBadges()` with inline IIFE rendering `StatusBadge` from `trade` array (first trade + overflow count)
- Updated Select items to render SIMPLE_TRADES strings
- Updated filter chip label to `Trade: ${tradeFilter}`
- Updated CSV export `formatTrades` to read from `trade` array with `tradeOther` fallback

### Task 2 — Subcontractor Detail Page (`[subcontractorSlug]/page.tsx`)
- Removed `CSI_DIVISIONS` import
- Replaced Trade Specialties section to read from `(subcontractor as any).trade` array
- Added `trade` and `tradeOther` to edit dialog's `SubcontractorForm` defaultValues

### Task 3 — Command Palette (`command-palette.tsx`)
- Added subtitle rendering to Subcontractors CommandGroup (trade list, comma-separated)

### Bug Fix — TanStack Table Infinite Render Loop
During UAT, selecting a trade filter caused the browser to freeze ("This page isn't responding"). Root cause: `getCoreRowModel()` and `getSortedRowModel()` were called inline inside the component, creating new factory function references on every render. When the filter changed, the query cache missed (`data = undefined`), and `subcontractors = data || []` created a new empty array reference — triggering TanStack Table's `useLayoutEffect` to call `rerender()` infinitely.

**Fix applied (commit f8beb26):**
- Moved both row model factories to module level as `stableCoreRowModel` / `stableSortedRowModel`
- Replaced `const subcontractors = data || []` with `React.useMemo(() => data ?? [], [data])`

## Human Verification Results

All 8 checks passed after the bug fix:
1. ✅ Add Subcontractor form shows trade multi-select combobox
2. ✅ Can select multiple trades; "Other" shows free-text input
3. ✅ List table shows trade badge (first trade + overflow count)
4. ✅ Edit dialog pre-populates selected trades
5. ✅ Trade filter dropdown filters list correctly (after freeze fix)
6. ✅ Filter chip appears when trade selected
7. ✅ Command palette search shows trade subtitle
8. ✅ No CSI division references visible anywhere in UI

## Commits
- `3c14429` feat(phase-52): overhaul list/detail pages and command palette for simple trades
- `f8beb26` fix(phase-52): stabilize TanStack Table row model factories to fix filter freeze
