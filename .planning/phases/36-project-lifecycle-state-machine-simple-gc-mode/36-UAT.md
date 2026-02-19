---
status: complete
phase: 36-project-lifecycle-state-machine-simple-gc-mode
source: 36-01-SUMMARY.md, 36-02-SUMMARY.md, 36-03-SUMMARY.md, 36-04-SUMMARY.md, 36-05-SUMMARY.md, 36-06-SUMMARY.md
started: 2026-02-19T00:00:00Z
updated: 2026-02-19T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Lifecycle phase badge on project header
expected: Open any project. The project header shows a color-coded badge displaying the current lifecycle phase (e.g. "Opportunity", "Estimating"). Each phase has a distinct color. The old "Status" field is gone.
result: pass

### 2. Interactive phase transition via popover
expected: Click the lifecycle phase badge in the project header (as an admin/estimator). A popover opens listing all 9 lifecycle phases. The current phase is disabled. Other phases are clickable.
result: pass

### 3. Forward transition confirmation
expected: In the popover, click a phase ahead of the current one (e.g. Opportunity → Estimating). The phase advances immediately with no confirmation dialog. Badge updates and toast appears.
result: pass

### 4. Backward transition requires reason
expected: In the popover, click a phase behind the current one. An AlertDialog appears with a required text input for reason. The Confirm button stays disabled until you type something. After entering a reason and confirming, the badge reverts and a toast appears.
result: pass

### 5. Mode badge visible in project header
expected: In the project header, next to the lifecycle badge, a small badge shows the project mode — either "Simple" or "GC/Advanced".
result: pass

### 6. Lifecycle History card on project overview
expected: On the project overview (main tab), a "Lifecycle History" section appears at the bottom. It shows a timeline of phase transitions with timestamps ("2 hours ago"), from/to phase labels, and reason text for backward transitions.
result: pass
notes: Added "by <Name>" or "by System" to each entry. Removed Recent Activity feed. Master activity feed deferred to future phase.

### 7. Phase column in project list
expected: In the /projects list table, the old "Status" column is replaced by a "Phase" column showing a color-coded lifecycle phase badge for each project.
result: pass

### 8. Project Mode dropdown in create form
expected: When creating a new project, the Basic Information section includes a "Project Mode" dropdown with "GC / Advanced" and "Simple" options, defaulting to "GC / Advanced".
result: pass

### 9. SOV and RFQs tabs hidden in Simple mode
expected: Open a project in Simple mode. The project tab navigation shows 8 tabs — no SOV tab and no RFQs tab. Open a GC/Advanced project — all 10 tabs are present including SOV and RFQs.
result: pass

### 10. Mode switch button in project header
expected: In the project header, next to the mode badge, a small text button reads "Switch to Simple" (or "Switch to GC/Advanced"). Clicking it toggles the mode, updates the badge, and the tab count changes accordingly.
result: pass

### 11. Billing Category dropdown in Simple mode estimates
expected: Open an estimate on a Simple mode project. In the line items table, instead of a "CSI Code" column there is a "Billing Category" dropdown column with options: Labor, Materials, Subcontractors, Equipment, Other.
result: issue
reported: "Pass, but there is Billing Category and Cost Type, which is redundant. If we're already capturing Cost Type on both GC/Advanced and Simple mode, then we do not need Billing Category on Simple Mode."
severity: major

### 12. CSI Code column in GC/Advanced estimate line items
expected: Open an estimate on a GC/Advanced project. The line items table shows the CSI Code column (not Billing Category). Standard CSI code entry is available.
result: pass

### 13. Lien Waivers tab gating by mode
expected: Open a payment application on a Simple mode project — the Lien Waivers tab does not appear. Open one on a GC/Advanced project — the Lien Waivers tab is visible.
result: issue
reported: "Fail. Lien waivers tab does not show up on GC/Advanced"
severity: major

## Summary

total: 13
passed: 11
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "Project Manager role can manually transition lifecycle phases (same permissions as Estimator)"
  status: failed
  reason: "User reported: I am a project manager by default so I cannot test. Make the project manager role have the same permissions as the estimator."
  severity: major
  test: 2
  artifacts: []
  missing: []

- truth: "Simple mode estimate line items replace CSI Code column with Billing Category"
  status: failed
  reason: "User reported: Billing Category and Cost Type are redundant. Cost Type is sufficient — remove Billing Category from Simple mode."
  severity: major
  test: 11
  root_cause: "Billing Category column was added to Simple mode but Cost Type already captures the same info on all estimates"
  artifacts:
    - path: "apps/web/components/estimates/line-items/EstimateLineItemsTable.tsx"
      issue: "billingCategoryColumn defined and shown in Simple mode — removed entirely"
  missing: []

- truth: "Lien Waivers tab is visible on a GC/Advanced payment application"
  status: failed
  reason: "User reported: Lien waivers tab does not show up on GC/Advanced"
  severity: major
  test: 13
  root_cause: "No payment apps exist in the DB — user had no payment application detail page to open. Cannot verify Lien Waivers tab visibility without test data. Code logic (isSimpleMode = project.projectMode === 'simple') is correct: tab shows when !isSimpleMode. All DB projects have project_mode='gc_advanced'."
  artifacts:
    - path: "apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/[paymentAppId]/page.tsx"
      issue: "Needs a payment app to exist before the Lien Waivers tab can be verified"
  missing:
    - "Create a test payment application on a GC/Advanced project and re-verify"
