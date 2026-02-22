---
status: complete
phase: 41-design-foundation
source: [41-01-SUMMARY.md, 41-02-SUMMARY.md, 41-03-SUMMARY.md, 41-04-SUMMARY.md, 41-05-SUMMARY.md, 41-06-SUMMARY.md]
started: 2026-02-21T22:00:00Z
updated: 2026-02-21T22:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Dark mode — no white cards or harsh palette colors
expected: Enable dark mode. Navigate to any page — settings, a project, or the dashboard. No elements should show bright white card backgrounds against the dark background. Cards, panels, and tables should all use the dark token surface. No jarring green/red/amber palette text.
result: pass

### 2. Financial positive color (green amounts)
expected: Open any page with positive financial indicators — Budget page remaining balance (when positive), a change order with positive value, or retainage released amount. The amount text should appear in a clear emerald/green color. In dark mode it should be slightly lighter green (still readable, higher contrast).
result: pass
note: Initially showed white in dark mode — resolved after server restart (stale HMR cache from live migration)

### 3. Financial negative color (red amounts)
expected: Find a negative financial indicator — budget overage (spent > budget), a negative change order, retainage held amount, or aging report 90+ day overdue cells. The amount text should appear in a rose/red color. In dark mode it should be a lighter rose (readable against dark background).
result: pass
note: Same HMR cache artifact as test 2 — resolved after restart

### 4. Financial pending color (amber amounts)
expected: Find a committed/pending amount — Budget page "Committed" card amount, or a pending change order total. The amount should appear in amber/orange. In dark mode it should be a slightly brighter amber (still readable).
result: pass
note: Badges colorize correctly after server restart — confirmed by user

### 5. VISUAL-03 — Approve/Reject buttons in change order header
expected: Open a change order that has a pending approval step and you have permission to approve. The Approve and Reject buttons should appear in the page header area (top right, alongside Edit and other header actions). They should NOT require scrolling down into the Approval Workflow section to find — the buttons in the header card should be visible immediately on page load.
result: skipped
reason: No pending change order with approval permission available to test

### 6. VISUAL-03 — Submit for Approval / Mark as Paid in payment app header
expected: Open a payment application in Draft status. A "Submit for Approval" button should appear in the page header (not at the bottom of the G702 form). Open an Approved payment app — a "Mark as Paid" button should appear in the page header. The G702 form itself should not have action buttons at the bottom.
result: pass

### 7. Auth page — password requirement checkmarks
expected: Go to the sign-up page or reset-password page and start typing a password. As each password requirement is met (length, uppercase, number, etc.), the checkmark or indicator next to that requirement should turn green. The green should look natural in both light and dark mode (not a fixed hex green that clashes with dark backgrounds).
result: pass

### 8. Settings — muted info callouts (no amber/yellow backgrounds)
expected: Go to Settings → Company or Settings → Document Naming. Any read-only informational notices (e.g., "Only admins can change this setting") should show a neutral muted background (gray-ish, matches card surface). There should be NO bright yellow or amber tinted boxes on these pages.
result: pass

### 9. Status badges — consistent appearance across surfaces
expected: Check several different status badge instances: project status on projects list, change order status on the CO list, payment app status, estimate status. All badges should use a consistent visual pattern — gray for draft/inactive, amber/yellow-ish for pending/in-review, green for approved/active/complete, red for rejected/void. They should NOT be a mix of different colored raw Badges with inline className strings.
result: pass

## Summary

total: 9
passed: 8
issues: 0
pending: 0
skipped: 1

## Gaps

- truth: "Financial tokens and status badge colors work correctly in dark mode after a clean server start"
  status: likely_stale_build
  reason: "Tests 2-4 showed white/uncolored tokens in dark mode, but user confirmed badges colorize correctly after api/web server restart — likely a HMR cache artifact from the live token migration, not a code defect"
  severity: minor
  test: 2
  artifacts: []
  missing: []
