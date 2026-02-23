---
plan: 45-02
status: complete
phase: 45-estimates-redesign
subsystem: currency-input
tags: [forms, currency, react-number-format, live-masking]
dependency_graph:
  requires: []
  provides: [currency-input-live-masking]
  affects: [budget-line-item-table, commitment-form, change-order-form, EstimateLineItemsTable, SOVLineItemCard, sov-editor]
tech_stack:
  added: [react-number-format NumericFormat]
  patterns: [customInput pattern for NumericFormat with shadcn Input]
key_files:
  modified:
    - apps/web/components/ui/currency-input.tsx
    - apps/web/components/bidding/bid-comparison-table.tsx
decisions:
  - "value === 0 passes empty string to NumericFormat so empty field shows blank (not $0.00)"
  - "fixedDecimalScale=false so user sees $1,234 without forced .00 trailing zeros while typing"
  - "allowNegative kept for budget adjustment parity with old implementation"
  - "bid-comparison-table adjustmentAmount state changed from number|undefined to number (0) — undefined sent to mutation when value is 0"
metrics:
  duration: 8m
  completed: 2026-02-23
  tasks_completed: 2
  files_modified: 2
---

# Phase 45 Plan 02: CurrencyInput NumericFormat Live Masking Summary

NumericFormat replaces manual focus/blur/parse cycle in CurrencyInput with live $ prefix, thousands separators, and 2-decimal masking; bid-comparison-table leveling amount migrated from CurrencyInput to direct NumericFormat usage.

## What was done

- Rewrote `CurrencyInput` internals to use `NumericFormat` from react-number-format v5. External prop interface unchanged — all 6 call sites (budget-line-item-table, commitment-form, change-order-form, EstimateLineItemsTable, SOVLineItemCard, sov-editor) work without modification. Key behavior: blank empty field when value=0, live formatting as user types ($1,234.56), `onValueChange` provides `floatValue` as JS number to `onChange`.
- Removed old implementation: `useState`, `useRef`, `formatCurrency`, `parseCurrencyInput` imports gone. The `parseCurrencyInput` function in `lib/utils/format.ts` was NOT removed — only the import in `currency-input.tsx`.
- Migrated `bid-comparison-table.tsx` leveling amount input from `<CurrencyInput>` to direct `<NumericFormat customInput={Input}>` usage. State type updated from `number | undefined` to `number` (initial 0). Mutation passes `adjustmentAmount === 0 ? undefined : adjustmentAmount` to preserve the optional field semantics.

## Files modified

- `apps/web/components/ui/currency-input.tsx` — complete internals rewrite; interface preserved
- `apps/web/components/bidding/bid-comparison-table.tsx` — leveling amount migrated to NumericFormat directly; CurrencyInput import removed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] bid-comparison-table already used CurrencyInput, not plain Input**
- **Found during:** Task 2
- **Issue:** Plan assumed the leveling amount used a plain `<Input type="number">`. It already used `<CurrencyInput>`. The artifact requirement stated `bid-comparison-table.tsx` must contain `NumericFormat` directly.
- **Fix:** Replaced `<CurrencyInput>` with inline `<NumericFormat customInput={Input}>`. Removed the `CurrencyInput` import. Updated state type from `number | undefined` to `number` with initial `0`. Reset mutation `adjustmentAmount` to `undefined` when value is 0 to preserve optional field semantics.
- **Files modified:** `apps/web/components/bidding/bid-comparison-table.tsx`

## Verification

- TypeScript compiles without errors for CurrencyInput and all call sites (pre-existing api errors are unrelated)
- `currency-input.tsx` contains `NumericFormat`, `customInput={Input}`, `onValueChange`; does NOT contain `useState`, `useRef`, `parseCurrencyInput`
- `bid-comparison-table.tsx` contains `NumericFormat` import and uses it for leveling amount input
- 6 call sites confirmed unchanged via `grep -rl CurrencyInput`

## Self-Check: PASSED

- `apps/web/components/ui/currency-input.tsx` — verified written correctly
- `apps/web/components/bidding/bid-comparison-table.tsx` — verified NumericFormat present, CurrencyInput removed
- TypeScript check produced no errors in web components (only pre-existing api errors)
