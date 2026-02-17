---
status: complete
phase: 24-year-rollover-logic
source: 24-01-SUMMARY.md
started: 2026-02-17T15:30:00Z
updated: 2026-02-17T15:35:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Starting Sequence Number field visible in company settings
expected: Navigate to Settings → Company, scroll to the Job Numbering card. A "Starting Sequence Number" input field should be visible with a label and descriptive help text (e.g., explaining this is the value the sequence resets to on year rollover).
result: pass

### 2. Starting Sequence Number saves and persists
expected: Enter a value like 1001 in the Starting Sequence Number field, save settings, then reload the page. The field should still show 1001 after reload — confirming the value persists to the database.
result: pass

### 3. Default value is 1 for existing tenants
expected: If Starting Sequence Number was never explicitly set, the field should show 1 as the default value (not blank, not 0). This preserves existing behavior for tenants that predate this feature.
result: pass

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
