---
phase: 34-live-currency-formatting
plan: "01"
subsystem: ui
tags: [currency, formatting, react, typescript, input-component]

# Dependency graph
requires: []
provides:
  - parseCurrencyInput utility function in apps/web/lib/utils/format.ts
  - CurrencyInput React component at apps/web/components/ui/currency-input.tsx
affects: [34-02, 34-03, 34-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CurrencyInput: type=text + inputMode=decimal + isFocusedRef prevents sync overwrite during user input"
    - "parseCurrencyInput: strips $, commas, whitespace via regex before parseFloat; returns 0 for empty/invalid"

key-files:
  created:
    - apps/web/components/ui/currency-input.tsx
  modified:
    - apps/web/lib/utils/format.ts

key-decisions:
  - "FORM-01: format-on-blur approach — raw number shown on focus, formatted on blur (not live-as-you-type masking)"
  - "type=text + inputMode=decimal avoids browser number input quirks (no spinner arrows, no locale issues)"
  - "isFocusedRef (not isFocused state) prevents re-render loop while still blocking sync useEffect during typing"

patterns-established:
  - "Currency fields: use CurrencyInput component from @/components/ui/currency-input"
  - "Parsing user currency strings: use parseCurrencyInput from @/lib/utils/format"

requirements-completed: [FORM-01]

# Metrics
duration: 3min
completed: 2026-02-18
---

# Phase 34 Plan 01: Live Currency Formatting — Infrastructure Summary

**parseCurrencyInput utility and CurrencyInput component with focus/blur format-on-blur pattern, using type="text" inputMode="decimal" and isFocusedRef to prevent sync conflicts during user typing**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-18T18:35:22Z
- **Completed:** 2026-02-18T18:38:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `parseCurrencyInput` to the shared format utility (strips $, commas, whitespace; returns 0 for empty/invalid)
- Created `CurrencyInput` component with clean focus/blur UX (raw number on focus, $X,XXX.XX on blur)
- Component syncs from parent value prop only when not focused, preventing overwrite of user-in-progress edits

## Task Commits

Each task was committed atomically:

1. **Task 1: Add parseCurrencyInput to format.ts** - `e93c0c4` (feat)
2. **Task 2: Create CurrencyInput component** - `1dce9a9` (feat)

## Files Created/Modified
- `apps/web/lib/utils/format.ts` - Added `parseCurrencyInput` export after existing format functions
- `apps/web/components/ui/currency-input.tsx` - New CurrencyInput component (77 lines)

## Decisions Made
- format-on-blur approach (not live masking): raw number shown on focus for clean editing, formatted on blur
- `type="text" inputMode="decimal"`: avoids spinner arrows, locale number parsing issues, and browser inconsistencies
- `isFocusedRef` (ref not state): tracking focus without triggering re-renders; blocks sync useEffect during typing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - pre-existing TypeScript errors in apps/api (intuit-oauth, bidGeneration, bid router) are unrelated to this plan and were out of scope.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plans 02-04 can now `import { CurrencyInput } from "@/components/ui/currency-input"` and `import { parseCurrencyInput } from "@/lib/utils/format"` without errors
- Foundation complete for all 7 currency input fields across the estimating workflow

---
*Phase: 34-live-currency-formatting*
*Completed: 2026-02-18*
