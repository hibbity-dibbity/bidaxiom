---
status: complete
phase: 42-shared-ui-primitives
source: [42-01-SUMMARY.md, 42-02-SUMMARY.md, 42-03-SUMMARY.md, 42-04-SUMMARY.md, 42-05-SUMMARY.md]
started: 2026-02-22T06:00:00Z
updated: 2026-02-22T06:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Status badge — active states render green
expected: Open any page with an "Active" or "Paid" or "Executed" status badge — projects list, payment apps list, or commitments. The badge should be GREEN (emerald/financial-positive color), not brand-blue/slate. Check light and dark mode.
result: pass

### 2. Estimate detail — status badge still works
expected: Open a project → Estimating tab → click into any estimate. The estimate's status badge (Draft, Submitted, Accepted, Under Contract) should appear correctly in the estimate detail header. No broken import or missing badge.
result: pass

### 3. Sort chevrons on tables
expected: Open the Projects list, the Change Orders list, or the Budget page. Every sortable column header should show a subtle dual-arrow icon (↑↓) when unsorted. Click a column header — the dual arrow becomes a single ↑ (ascending). Click again — becomes ↓ (descending). Clicking again stays at ↓ (no return to unsorted — 2-state cycle).
result: pass

### 4. Budget table — sticky header and frozen column
expected: Open a project → Budget tab. If there are enough line items to scroll, scroll down — the Cost Code / column header row stays pinned at the top. Scroll right (if the table is wide) — the first column (Cost Code or division) stays frozen/pinned on the left while other columns scroll under it.
result: pass

### 5. Budget table — sticky footer with totals
expected: On the Budget line items table, a totals row should appear pinned at the bottom of the table. It should show the total budgeted amount, total spent, and total variance. If the table is short (few line items), the footer may appear below all rows.
result: pass

### 6. Change order list — table layout with live footer
expected: Open a project → Change Orders tab. The change orders list should now display as a proper table (not stacked cards). There should be a sticky footer row at the bottom of the table showing the total dollar value of the visible/filtered change orders. If you filter or search COs, the footer total should update to match only the visible rows.
result: pass

### 7. Payment app list — sortable with sticky header and footer
expected: Open a project → Payment Applications tab. The list should show a sticky header that stays visible when scrolling. Column headers (Application #, Period, Current Payment Due) should be sortable with the dual-chevron icon. A footer row should show the total of the visible payment amounts.
result: pass

### 8. G703 — two frozen columns
expected: Open a payment application → view the G703 Continuation Sheet. The table is wide (many columns). When you scroll horizontally, the leftmost two columns (Item # and Description) should stay frozen/visible while the financial columns scroll under them.
result: pass

### 9. Commitment list — table layout with footer
expected: Open a project → Budget tab → Commitments section (or wherever commitment list appears). It should now display as a proper table (not card-per-row). A sticky footer should show the total committed amount for visible rows. Clicking to expand a commitment should still show its line items.
result: pass

### 10. Customers and subcontractors — sortable tables
expected: Open Settings or the Customers/Subcontractors pages. The list tables should have sortable column headers with the dual-chevron unsorted icon. Clicking a column sorts ascending then descending (2-state cycle). The first column (Customer name or Company name) should stay frozen/pinned when scrolling horizontally (if the table is wide enough to scroll).
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
