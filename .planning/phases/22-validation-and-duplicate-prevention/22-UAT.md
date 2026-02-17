---
status: complete
phase: 22-validation-and-duplicate-prevention
source: [22-01-SUMMARY.md, 22-02-SUMMARY.md, 22-03-SUMMARY.md]
started: 2026-02-17T10:00:00Z
updated: 2026-02-17T11:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Format validation on create form
expected: Type misformatted job number (e.g., "BADFORMAT") in manual entry mode and tab away. Inline error "Job number doesn't match the required format" appears. Submit disabled. Typing a valid format clears the error.
result: pass

### 2. Duplicate detection on create form
expected: Enter a job number belonging to an existing project and tab away. Spinner shows "Checking availability...", then inline error appears: "[number] is already assigned to [Project Name]" with a clickable link. Clicking the link opens that project in a new tab. Submit button stays disabled until field is cleared.
result: issue
reported: "pass but when I start to edit the number the error should go away and not wait for on blur"
severity: minor
note: "Root cause: server restart required to load 22-01 changes (stale code caused initial failure). UX issue: duplicate error persists while user is typing; should clear on onChange not wait for next blur."

### 3. Case-insensitive duplicate detection
expected: Enter an existing job number in different case (e.g., if "26-5001" exists, try "26-5001" or any case variation). Duplicate error fires regardless of case difference.
result: pass

### 4. Edit form loads and self-exclusion
expected: Navigate to an existing project with a job number → click "Edit Project" button. Page must load at /projects/[slug]/edit (NOT 404). Tab through the job number field without changing it — NO duplicate error should appear (self-exclusion working). Then change it to match a different project's number and tab away — duplicate error should fire.
result: pass

### 5. Save on edit form
expected: On the edit form, change the project name or description. Click Save. App navigates back to project overview with a "Project updated" success toast.
result: issue
reported: "Pass. But, when I click Edit Project the Customer field and all other fields should be pre-populated with existing project details, not blank."
severity: major

## Summary

total: 5
passed: 3
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "When user starts editing the job number after a duplicate error, the error clears immediately on change (not waiting for next blur)"
  status: resolved
  reason: "User reported: when I start to edit the number the error should go away and not wait for on blur"
  severity: minor
  test: 2
  root_cause: "handleJobNumberBlur only fires on blur; no onChange handler clears duplicateProject state and form errors while user is typing"
  fix: "Added onChange to job number Input on both forms — calls form.clearErrors and setDuplicateProject(null) when value changes"
  commit: edcadd2

- truth: "Edit form pre-fills all fields (customer, status, location, etc.) from existing project data"
  status: resolved
  reason: "User reported: Customer field and all other fields should be pre-populated with existing project details, not blank"
  severity: major
  test: 5
  root_cause: "form.reset() fired when project loaded but before customersData loaded — Radix Select had no matching SelectItem in DOM, so trigger showed blank placeholder"
  fix: "Added hasReset ref; useEffect now waits for both project AND customersData before calling form.reset(), ensuring Select options are present when value is applied"
  commit: edcadd2
