---
status: passed
phase: 46-project-header-tabs-and-navigation-ch
source: 46-01-SUMMARY.md, 46-02-SUMMARY.md, 46-03-SUMMARY.md, 46-04-SUMMARY.md
started: 2026-02-23T17:30:00Z
updated: 2026-02-23T18:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Sticky header stays fixed while scrolling
expected: Navigate to any project detail page and go to the Budget or Commitments tab (content-heavy). Scroll down. The project header (Row 1 + Row 2 + tabs) stays fixed at the top of the viewport — it does NOT scroll away with the page content.
result: pass

### 2. Header shows customer info row (Row 2)
expected: The header shows Row 1 (job number + project name + lifecycle phase badge + mode badge + Edit button + ⋯ ellipsis menu), Row 2 (customer name/link + address + date range), and Row 3 (financial stat bar).
result: pass
fixed_by: 46-04 (commit 7adac83)

### 3. Financial stat bar shows all 5 fields
expected: A row of the header shows 5 labeled stat pairs side-by-side: "Contract Value", "Billed to Date", "Paid to Date", "Balance to Complete", "Retainage Held". Each shows a dollar value in currency format (e.g., $0.00 if no data). All 5 are visible without scrolling or expanding any control.
result: pass

### 4. Customer info row removed from header
expected: The old info row showing customer name (linked), project address, and date range is NO LONGER visible in the sticky header. You must scroll to the Overview tab to see this information.
result: pass

### 5. Budget metric grid removed from header
expected: The old 4-column grid showing "Budget Total / Committed / Actual Cost / Team Members" is NO LONGER in the sticky header. The header goes directly to the financial stat bar (Row 2), not the old metric grid.
result: pass

### 6. Mode switch in ellipsis menu
expected: The standalone "Switch to GC/Advanced" or "Switch to Simple" text button that used to appear as an inline button in the header is gone from Row 1. Click the ⋯ (three-dot) ellipsis menu in the header — the mode switch option should appear there instead.
result: pass
fixed_by: 46-04 (commit 7adac83)

### 7. All 10 tabs still navigate correctly
expected: Click through several project tabs (Overview, Budget, Commitments, Change Orders, Documents). Each tab click: (a) updates the URL to the correct path, (b) loads the correct content below the header, (c) highlights the active tab with the bottom border indicator. Browser back button returns to the previous tab.
result: pass

### 8. Lifecycle phase badge popover still works
expected: In Row 1 of the header, the lifecycle phase badge (e.g., "Opportunity", "Active", etc.) is visible and clickable. Clicking it opens the phase transition dropdown/popover at the correct position — it does NOT render off-screen or fail to open.
result: pass

### 9. Tab count badges — "(N)" suffix when N > 0
expected: Change Orders, Payment Apps, Documents, and Invoices tabs show "(N)" suffix when N > 0. Zero state shows plain label with no suffix.
result: pass

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0

## Gaps

All gaps resolved via plan 46-04.
