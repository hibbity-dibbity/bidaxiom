---
status: complete
phase: 37-project-deletion-with-safeguards
source: [37-01-SUMMARY.md, 37-02-PLAN.md]
started: 2026-02-19T00:00:00Z
updated: 2026-02-19T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Admin trash icon on project table rows
expected: Go to /projects as admin. Hover over any project row. A red trash icon appears on the right side of the row (fades in on hover, out on mouse-out). Non-admin users see nothing.
result: pass

### 2. Blocking modal for non-deletable projects
expected: Click the trash icon on a project in Active phase (or any project with change orders / payment apps / committed costs). A modal appears titled "Cannot Delete Project" listing ALL the blocking reasons as a bullet list. The confirmation dialog does NOT appear.
result: pass

### 3. Confirmation dialog for deletable projects
expected: Click the trash icon on a project in Opportunity, Estimating, or Submitted phase with no financial records. A confirmation dialog appears with: warning text about 30-day recovery, a "Reason for deletion" textarea, and a red Delete button that starts DISABLED.
result: pass

### 4. Reason enables Delete button, deletion removes row
expected: Type any text in the Reason textarea. The Delete button becomes enabled. Click Delete — a success toast fires and the project row disappears from the list immediately.
result: pass

### 5. Deleted Projects card in Settings
expected: Go to /settings. A "Deleted Projects" card is visible in the settings grid alongside other cards (has a trash icon and description "Recover projects removed within the last 30 days").
result: pass

### 6. Deleted Projects recovery page
expected: Go to /settings/deleted-projects. The recently deleted project appears with: project name, deleted date, who deleted it, the reason text in italics, and days remaining (~30).
result: issue
reported: "Pass, but add job number to the view (job number-project name) and add 'Reason: ' before the displayed reason text"
severity: minor

### 7. Restore from deleted list
expected: Click Restore on the deleted project. A success toast fires and the project disappears from the deleted projects list.
result: pass

### 8. Restored project shows amber banner
expected: Navigate to the restored project's detail page. An amber banner appears below the header reading "This project was deleted and restored." with a Dismiss button.
result: pass

### 9. Dismiss banner via acknowledgeRestore
expected: Click Dismiss on the amber banner. It disappears immediately. After a page refresh, the banner is still gone (not just client-side hidden).
result: pass

### 10. Delete action in project header kebab (admin)
expected: On any project detail page as admin, a kebab/ellipsis (⋮) button is visible next to the lifecycle badge area. Clicking it opens a dropdown containing "Delete Project" as a menu item.
result: pass

### 11. Non-admin sees no delete options
expected: Log in as a non-admin member. Go to /projects — no trash icon on any row even on hover. Go to a project detail page — no kebab/ellipsis button is visible next to the lifecycle badge.
result: pass

## Summary

total: 11
passed: 10
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Deleted Projects page shows job number alongside project name (format: JOB-NUMBER — Project Name) and prefixes reason text with 'Reason: '"
  status: failed
  reason: "User reported: Pass, but add job number to the view (job number-project name) and add 'Reason: ' before the displayed reason text"
  severity: minor
  test: 6
  artifacts: []
  missing: []
