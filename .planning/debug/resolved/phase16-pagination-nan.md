---
status: resolved
trigger: "Phase 16 Test 11 - Pagination displays 'NaN-NaN' instead of correct range numbers"
created: 2026-02-15T00:00:00Z
updated: 2026-02-15T00:06:00Z
---

## Current Focus

hypothesis: CONFIRMED - Prop name mismatch causes page variable to be undefined
test: Applying fix to align prop names
expecting: Pagination to display correct range numbers
next_action: Fix prop name in page.tsx to match ProjectsTable interface

## Symptoms

expected: Bottom of table shows "1-50 of 127 projects" or "1-2 of 2 projects" with correct numbers
actual: Displays "Showing NaN-NaN of 2 projects" (or "NaN-NaN of 1 projects")
errors: No error messages, but NaN indicates calculation error (Not a Number)
reproduction: Navigate to /projects page, observe pagination display at bottom of table
started: Phase 16 test execution (this test specifically checks pagination functionality)

## Eliminated

## Evidence

- timestamp: 2026-02-15T00:01:00Z
  checked: ProjectsTable component interface (line 35-42)
  found: Interface expects prop named `page` but page.tsx passes prop named `currentPage` (line 72)
  implication: Component receives undefined for `page` prop, causing NaN in calculations

- timestamp: 2026-02-15T00:02:00Z
  checked: Pagination calculation logic (line 69-71)
  found: `const offset = (page - 1) * pageSize;` - When page is undefined, (undefined - 1) = NaN
  implication: This explains the NaN-NaN display - both startIndex and endIndex become NaN

- timestamp: 2026-02-15T00:03:00Z
  checked: page.tsx component usage (line 68-75)
  found: Passes `currentPage={filters.page ?? 1}` but interface expects `page`
  implication: Prop name mismatch - interface and usage don't align

## Resolution

root_cause: Prop name mismatch between ProjectsTable interface and page.tsx usage. Interface defines `page: number` (line 39) but page.tsx passes `currentPage` (line 72). This causes the `page` variable to be undefined inside ProjectsTable, resulting in NaN when calculating `offset = (page - 1) * pageSize`.
fix: Changed prop name from `currentPage` to `page` in page.tsx line 72 to match the ProjectsTable interface
verification: Fix aligns prop names - page.tsx now passes `page={filters.page ?? 1}` which matches interface expectation. The calculation `offset = (page - 1) * pageSize` will now receive a valid number (1) instead of undefined, producing correct range values.
files_changed: ["apps/web/app/(dashboard)/projects/page.tsx"]
