---
status: complete
phase: 50-send-to-customer-flow
source: [50-01-SUMMARY.md, 50-02-SUMMARY.md, 50-03-SUMMARY.md, 50-04-SUMMARY.md]
started: 2026-02-24T07:00:00Z
updated: 2026-02-24T07:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Proposal detail header layout
expected: Navigate to a proposal detail page (any project → Proposals tab → click a proposal). The page header shows a two-row layout: Row 1 is a ghost "← Back to Proposals" link; Row 2 has the proposal name + status badge on the left, and a 3-dot (⋮) button + "Edit Proposal" button on the right.
result: pass

### 2. Proposal 3-dot dropdown contents
expected: On the proposal detail page, click the ⋮ (3-dot) icon button. A dropdown menu opens containing exactly two items: "Generate PDF" and "Send to Customer". No other items are present.
result: pass

### 3. Proposal Send to Customer dialog
expected: Click "Send to Customer" in the dropdown. A dialog titled "Send to Customer" opens with: (1) the proposal name shown as read-only text, (2) a Recipient Email(s) field pre-populated with the project customer's email (if set), (3) a Subject field pre-populated with "Proposal: [proposal name]", and (4) an optional Note field. The Send button is disabled if the email field is empty.
result: pass

### 4. Proposal Send — status transitions
expected: With the Send to Customer dialog open, click Send. The dialog closes, a success toast appears ("Proposal sent to customer"), and the status badge on the proposal detail page updates to "Submitted" — without a full page reload.
result: pass

### 5. Proposal approval flow removed
expected: On the proposal detail page, there is no "Submit", "Approve", "Reject" button, and no "Next Steps" panel or approval workflow section anywhere on the page. The page shows the proposal details, line items, and the two-row header — nothing else.
result: pass

### 6. CO detail header layout
expected: Navigate to a change order detail page (any project → Change Orders tab → click a CO). The header shows: Row 1 is a ghost "← Back to Change Orders" link; Row 2 has the CO title + status badge + CO number on the left, and a 3-dot (⋮) button + "Edit Change Order" button on the right.
result: pass

### 7. CO 3-dot dropdown contents
expected: On the CO detail page, click the ⋮ button. A dropdown opens with exactly "Generate PDF" and "Send to Customer".
result: pass

### 8. CO Send to Customer dialog
expected: Click "Send to Customer" on a CO. The dialog opens with the CO title as the document name (read-only), Recipient Email(s) pre-populated with the project customer's email (if set), Subject pre-populated with "Change Order: [CO title]", and an optional Note field.
result: pass

### 9. CO Send — status transitions
expected: Click Send in the CO dialog. The dialog closes, a success toast appears, and the CO status badge updates to "PCO Submitted" without a page reload.
result: pass

### 10. CO approval flow removed
expected: On the CO detail page, there is no "Approve", "Reject", "Submit for Approval" button or approval workflow panel. The CO details, line items, history, and any Void/Delete actions are present, but no approval-flow UI.
result: pass

### 11. CO list filter — orphaned options removed
expected: Go to a project's Change Orders tab (list view). Open the status filter dropdown. The options shown should be: All, Draft, PCO Submitted, Void. "Pending Approval", "Approved", and "Rejected" should NOT appear as filter options.
result: pass

## Summary

total: 11
passed: 11
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
