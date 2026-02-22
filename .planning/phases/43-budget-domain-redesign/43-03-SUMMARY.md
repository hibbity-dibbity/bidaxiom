---
phase: 43-budget-domain-redesign
plan: "03"
subsystem: ui
tags: [react, tanstack-table, inline-editing, budget, sov, trpc]

# Dependency graph
requires:
  - phase: 43-02
    provides: TanStack tables with sticky headers and column visibility in BudgetLineItemTable and SovEditor

provides:
  - Dialog-free inline add row in BudgetLineItemTable (TABLE-07)
  - Dialog-free inline add row in SovEditor (TABLE-07)
  - CurrencyInput onKeyDown prop support

affects:
  - 43-04 and later plans using BudgetLineItemTable or SovEditor

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline draft row pattern: separate useState<DraftRow | null> appended after TanStack rows in TableBody — keeps draft outside row model, preventing footer total contamination"
    - "shouldFocusDraft + useEffect auto-focus: set flag on click, useEffect fires after render with draftRow set, refs .focus() then clears flag"
    - "handleDraftKeyDown: Enter calls save, Escape clears draftRow — applied to every field in draft row"
    - "handleDraftSave: validates required fields, calls mutate, clears draftRow immediately (optimistic clear)"

key-files:
  created: []
  modified:
    - apps/web/components/budget/budget-line-item-table.tsx
    - apps/web/components/payment-app/sov-editor.tsx
    - apps/web/components/ui/currency-input.tsx

key-decisions:
  - "43-03: Draft row state is separate from TanStack row model — footer totals computed from lineItems/items server array only, draft row excluded by construction"
  - "43-03: CurrencyInput onKeyDown added to props interface and passed through to underlying Input — required for Enter/Escape keyboard handling in draft rows"
  - "43-03: Empty state (dashed box / Alert) hidden when draftRow is set — table renders with just the draft row even when server data is empty"

patterns-established:
  - "Inline add row pattern: appended after table.getRowModel().rows.map() inside TableBody with bg-muted/20 background to distinguish from data rows"
  - "Draft row cancel button: Button variant=ghost with X icon, placed in the Actions column"

requirements-completed:
  - TABLE-07

# Metrics
duration: 8min
completed: 2026-02-22
---

# Phase 43 Plan 03: Inline Draft Rows for Budget and SOV Add Flows Summary

**Dialog-free inline add rows in BudgetLineItemTable and SovEditor: auto-focus, Enter saves, Escape cancels, footer totals unaffected**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-22T17:09:20Z
- **Completed:** 2026-02-22T17:17:43Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Removed the add Dialog from BudgetLineItemTable; replaced with an inline draft row that auto-focuses the cost code select on click
- Removed the add Dialog from SovEditor; replaced with an inline draft row that auto-focuses the description input on click
- Draft rows live in separate state from the TanStack/server data arrays — footer totals (budgeted amount, total scheduled value) are computed from server data only and are never contaminated by open draft rows
- Enter key triggers save; Escape cancels and removes the row; blur on amount field also saves
- Edit Dialogs preserved in both components unchanged
- CurrencyInput component extended with `onKeyDown` prop to support keyboard handling in draft rows

## Task Commits

1. **Task 1: Replace add Dialog with inline draft row in BudgetLineItemTable** - `9ca3166` (feat)
2. **Task 2: Replace add Dialog with inline draft row in SovEditor** - `d07a182` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/web/components/budget/budget-line-item-table.tsx` - Removed addDialogOpen/Dialog JSX; added DraftBudgetRow state, auto-focus effect, handleAddClick/handleDraftSave/handleDraftKeyDown, inline draft TableRow in TableBody
- `apps/web/components/payment-app/sov-editor.tsx` - Removed addDialogOpen/Dialog JSX; added DraftSovRow state, auto-focus effect, handleDraftSave/handleDraftKeyDown, inline draft TableRow in TableBody
- `apps/web/components/ui/currency-input.tsx` - Added optional onKeyDown prop to CurrencyInputProps interface; passed through to underlying Input element

## Decisions Made

- Draft row state kept entirely separate from TanStack row model — `lineItems.reduce(...)` and `items.reduce(...)` in footer calculations never see the draft row, so totals are correct by construction (no filtering needed)
- CurrencyInput `onKeyDown` added as Rule 1 auto-fix — the prop was missing from the interface, blocking the keyboard handling requirement; the fix is minimal (interface + passthrough)
- Empty state condition updated from `items.length === 0` to `items.length === 0 && !draftRow` in both components — allows draft row to display on an otherwise-empty table without flicker between states

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added onKeyDown to CurrencyInput interface**
- **Found during:** Task 1 (Replace add Dialog in BudgetLineItemTable)
- **Issue:** CurrencyInput did not accept onKeyDown in its props interface, causing a TypeScript error when the draft row tried to pass handleDraftKeyDown to the CurrencyInput
- **Fix:** Added `onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void` to CurrencyInputProps; passed through to the underlying Input element in the render
- **Files modified:** apps/web/components/ui/currency-input.tsx
- **Verification:** `tsc --noEmit` on apps/web — zero errors in budget-line-item-table.tsx and currency-input.tsx after fix
- **Committed in:** 9ca3166 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — missing prop blocking keyboard behavior)
**Impact on plan:** Fix was necessary to satisfy the Enter/Escape keyboard requirement. No scope creep — onKeyDown was always needed; the interface just didn't declare it.

## Issues Encountered

None beyond the CurrencyInput onKeyDown prop gap documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TABLE-07 is satisfied for both BudgetLineItemTable and SovEditor
- Inline add row pattern is now established and can be reused for other tables in Phase 43 if needed
- Edit Dialogs are unchanged; all existing edit flows remain functional

## Self-Check: PASSED

- FOUND: apps/web/components/budget/budget-line-item-table.tsx
- FOUND: apps/web/components/payment-app/sov-editor.tsx
- FOUND: apps/web/components/ui/currency-input.tsx
- FOUND: .planning/phases/43-budget-domain-redesign/43-03-SUMMARY.md
- FOUND commit: 9ca3166 feat(43-03): replace add Dialog with inline draft row in BudgetLineItemTable
- FOUND commit: d07a182 feat(43-03): replace add Dialog with inline draft row in SovEditor

---
*Phase: 43-budget-domain-redesign*
*Completed: 2026-02-22*
