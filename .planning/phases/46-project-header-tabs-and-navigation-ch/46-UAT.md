---
status: complete
phase: 46-project-header-tabs-and-navigation-ch
source: 46-01-SUMMARY.md, 46-02-SUMMARY.md
started: 2026-02-23T17:30:00Z
updated: 2026-02-23T17:30:00Z
note: 46-03 (tab count badges) not yet executed — tests 1-8 cover 46-01 and 46-02 only
---

## Current Test

[testing complete]

## Tests

### 1. Sticky header stays fixed while scrolling
expected: Navigate to any project detail page and go to the Budget or Commitments tab (content-heavy). Scroll down. The project header (Row 1 + Row 2 + tabs) stays fixed at the top of the viewport — it does NOT scroll away with the page content.
result: pass

### 2. Header is compact — 2 rows only
expected: The header shows exactly 2 rows: Row 1 (job number + project name + lifecycle phase badge + mode badge + Edit button + ⋯ ellipsis menu) and Row 2 (financial stat bar). Total visible height should be approximately 80px. It is noticeably more compact than the old header.
result: issue
reported: "That is what's showing up, but I wanted to keep the company name/link and project address in the second line of the header as well."
severity: major

### 3. Financial stat bar shows all 5 fields
expected: Row 2 of the header shows 5 labeled stat pairs side-by-side: "Contract Value", "Billed to Date", "Paid to Date", "Balance to Complete", "Retainage Held". Each shows a dollar value in currency format (e.g., $0.00 if no data). All 5 are visible without scrolling or expanding any control.
result: pass

### 4. Customer info row removed from header
expected: The old info row showing customer name (linked), project address, and date range is NO LONGER visible in the sticky header. You must scroll to the Overview tab to see this information.
result: pass

### 5. Budget metric grid removed from header
expected: The old 4-column grid showing "Budget Total / Committed / Actual Cost / Team Members" is NO LONGER in the sticky header. The header goes directly to the financial stat bar (Row 2), not the old metric grid.
result: pass

### 6. Mode switch moved into ellipsis menu
expected: The standalone "Switch to GC/Advanced" or "Switch to Simple" text button that used to appear as an inline button in the header is gone from Row 1. Click the ⋯ (three-dot) ellipsis menu in the header — the mode switch option should appear there instead.
result: issue
reported: "the 3-dots drop down menu is empty"
severity: major

### 7. All 10 tabs still navigate correctly
expected: Click through several project tabs (Overview, Budget, Commitments, Change Orders, Documents). Each tab click: (a) updates the URL to the correct path, (b) loads the correct content below the header, (c) highlights the active tab with the bottom border indicator. Browser back button returns to the previous tab.
result: pass

### 8. Lifecycle phase badge popover still works
expected: In Row 1 of the header, the lifecycle phase badge (e.g., "Opportunity", "Active", etc.) is visible and clickable. Clicking it opens the phase transition dropdown/popover at the correct position — it does NOT render off-screen or fail to open.
result: pass

## Summary

total: 8
passed: 6
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Header Row 2 shows company name/link and project address alongside the financial stat bar"
  status: failed
  reason: "User reported: That is what's showing up, but I wanted to keep the company name/link and project address in the second line of the header as well."
  severity: major
  test: 2
  artifacts: []
  missing: []

- truth: "The ellipsis (⋯) dropdown menu in the project header contains a mode switch option (Switch to GC/Advanced or Switch to Simple)"
  status: failed
  reason: "User reported: the 3-dots drop down menu is empty"
  severity: major
  test: 6
  artifacts: []
  missing: []
