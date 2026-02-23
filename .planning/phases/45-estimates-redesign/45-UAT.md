---
status: complete
phase: 45-estimates-redesign
source: 45-01-SUMMARY.md, 45-02-SUMMARY.md, 45-03-SUMMARY.md, 45-04-SUMMARY.md
started: 2026-02-23T00:00:00Z
updated: 2026-02-23T01:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Stepper bar visible in workflow page
expected: Navigate to an estimate workflow page. A horizontal stepper bar with 6 labeled steps appears above the step content area. No sidebar visible on the left — full-width layout.
result: pass

### 2. Stepper visual states
expected: On the stepper bar — the active step shows a teal filled circle with the step number. Completed steps (any you've passed) show a teal filled circle with a checkmark. Future steps show a gray outline circle with a step number. Only the active step shows a text label below its circle.
result: pass

### 3. Stepper free navigation
expected: Click a future step circle in the stepper (e.g., click step 4 while on step 1). The wizard navigates directly to step 4 with no error or "you must complete previous steps" restriction.
result: pass

### 4. Connecting lines fill with progress
expected: After navigating forward past step 1 (to step 2 or beyond), the connecting line between steps 1 and 2 turns teal. Lines ahead of the current step remain gray.
result: pass

### 5. Currency input live masking
expected: Open any currency input field (e.g., budget line item unit cost, change order amount, or an estimate line item). Start typing a number — the $ prefix and thousands separators appear immediately as you type (e.g., typing "12345" shows "$12,345"). Formatting does not wait until you click away.
result: pass

### 6. Currency field blank when empty
expected: A currency field that has no value shows a completely blank input (no $0.00, no placeholder text, no $ sign). When you start typing, the $ sign appears with the number.
result: pass

### 7. Next buttons on all steps
expected: On each wizard step (1 through 5), a "Next" button is visible at the bottom of the step content. Clicking it advances to the next step. Step 6 has a "Finalize Estimate" button instead.
result: pass

### 8. Enter key advances on Steps 1 and 5
expected: On Step 1, press Enter while the cursor is in the Description field — the wizard advances to Step 2. On Step 5, press Enter in the last markup % field — the wizard advances to Step 6. (Shift+Enter in Step 1's description field inserts a newline instead of advancing.)
result: pass

### 9. Finalize Estimate navigates to detail page
expected: On Step 6 (SOV Builder), a "Finalize Estimate" button is visible at the bottom. Clicking it navigates to the estimate detail page (/projects/[slug]/estimates/[slug]) without showing a loading spinner or calling any save mutation — data is already persisted via auto-save.
result: pass

### 10. Step 1 section grouping
expected: Step 1 (Basic Info) shows two labeled section groups separated by horizontal divider lines. "ESTIMATE IDENTITY" heading appears above the Estimate Name and Description fields. "PROJECT CLASSIFICATION" heading appears above the Project Type field. Headings are small, uppercase, in muted gray.
result: pass

### 11. Step 2 section headings with dividers
expected: Step 2 (Template Selection) shows "COST CODE TEMPLATES" and "LABOR RATE TEMPLATES" as small uppercase muted headings, each followed by a horizontal divider line before the template card grid below it.
result: pass

### 12. Step 4 section grouping
expected: Step 4 (Labor Rates) shows two labeled section groups. "TEMPLATE SELECTION" heading appears above the template cards. "CURRENT LABOR LINE ITEMS" heading appears above the line items table. Both headings are small, uppercase, in muted gray, each with a horizontal divider below.
result: pass

### 13. Steps 3, 5, 6 have no new section headings
expected: Navigate to Steps 3, 5, and 6. None of them show new uppercase divider-style section headings. Their existing layout is unchanged from before Phase 45.
result: pass

## Summary

total: 13
passed: 13
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
