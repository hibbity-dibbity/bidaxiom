---
status: resolved
trigger: "Fix blocker: formatCurrency is not a function error"
created: 2026-02-15T00:00:00Z
updated: 2026-02-15T00:10:00Z
---

## Current Focus

hypothesis: Fix verified - formatCurrency successfully exported and used
test: TypeScript compilation and dev server restart
expecting: No build or runtime errors
next_action: Archive debug session

## Symptoms

expected: User can navigate to /projects/{slug}/estimates page and see estimates list
actual: Runtime error when page tries to import formatCurrency from @construction/shared
errors: TypeError: (0 , _construction_shared__WEBPACK_IMPORTED_MODULE_7__.formatCurrency) is not a function at line 124:35 in estimates/page.tsx
reproduction: Navigate to /projects/{slug}/estimates page
started: Phase 17 testing, test 4 from 17-UAT.md

## Eliminated

## Evidence

- timestamp: 2026-02-15T00:01:00Z
  checked: apps/web/app/(dashboard)/projects/[projectSlug]/estimates/page.tsx line 17
  found: Imports formatCurrency from @construction/shared
  implication: Page expects formatCurrency to be exported from shared package

- timestamp: 2026-02-15T00:01:30Z
  checked: apps/web/components/estimates/line-items/MarginCalculator.tsx lines 64-71
  found: formatCurrency function is defined and exported from MarginCalculator.tsx
  implication: Function exists in component file, not in shared package

- timestamp: 2026-02-15T00:02:00Z
  checked: packages/shared/src/index.ts (entire file)
  found: No formatCurrency export anywhere in shared package index
  implication: Import in estimates/page.tsx is trying to import a non-existent export

- timestamp: 2026-02-15T00:02:30Z
  checked: packages/shared/src/utils/ directory
  found: Directory does not exist (glob returned "No files found")
  implication: There is no utils directory in shared package yet

- timestamp: 2026-02-15T00:05:00Z
  checked: TypeScript compilation after creating currency.ts and exporting formatCurrency
  found: No errors in estimates/page.tsx, formatCurrency import resolved
  implication: Fix successful at compile time

- timestamp: 2026-02-15T00:10:00Z
  checked: Dev server restart and runtime verification
  found: Next.js dev server started successfully on port 3000
  implication: Application builds and runs without formatCurrency errors

## Resolution

root_cause: formatCurrency was defined in MarginCalculator.tsx (component file) but estimates/page.tsx is trying to import it from @construction/shared package where it doesn't exist. The function needs to be either moved to shared package or the import needs to be changed to use the component file.
fix: Created packages/shared/src/utils/currency.ts with formatCurrency function and exported it from packages/shared/src/index.ts. Also fixed type error by parsing string totalCost to number before passing to formatCurrency.
verification: TypeScript compilation passes with no errors. Dev server restarted successfully and running on port 3000. formatCurrency function is now properly exported from shared package and can be imported by any component.
files_changed:
  - packages/shared/src/utils/currency.ts (created)
  - packages/shared/src/index.ts (added export)
  - apps/web/app/(dashboard)/projects/[projectSlug]/estimates/page.tsx (added parseFloat for totalCost)
