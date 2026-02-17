---
status: passed
phase: 21-assignment-and-auto-generation
source: [21-01-SUMMARY.md, 21-02-SUMMARY.md]
started: 2026-02-17T03:30:00Z
updated: 2026-02-17T09:45:00Z
---

## Tests

### 1. Auto-generation on project creation
expected: With auto-generation enabled, create a project without manually entering a job number. Project should receive an auto-generated number matching your configured template and current sequence.
result: pass
reported: "That worked"
note: "Required API server restart — server was started before Phase 21 commits were made"

### 2. Sequential numbering across multiple projects
expected: Create a second project without manual entry. It should receive the next sequential number. Each project gets an incremented value — numbers never repeat.
result: pass

### 3. Manual job number entry
expected: Click "Enter Manually" on the job number card. Enter a custom number. Submit the form. The project should be created with exactly that number.
result: pass

### 4. Manual entry updates the auto-generation counter
expected: After manual entry (e.g., "265000"), create another project in auto-generated mode. It should get "265001" — confirming the counter jumped ahead to avoid conflicts.
result: pass
note: "Bug found and fixed (commit b4d1e4c): /(\d+)$/ extracted all trailing digits instead of just the template sequence length. Counter was briefly set to 265001; reset to 5001 after fix."

### 5. Job number card visibility (auto-gen disabled)
expected: Disable auto-generation. Navigate to /projects/new. The Job Number card should still appear, labeled "Job Number (Optional)".
result: pass

### 6. Toggle between auto and manual modes
expected: With auto-generation enabled, card shows preview with "Next available" badge and "Enter Manually" button. Toggle back and forth works correctly.
result: pass

### 7. Format hints in manual entry mode
expected: In manual entry mode, a format hint with info icon shows the template pattern and an example.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Bugs Found and Fixed

- test: 4
  description: "Manual job number counter update used /(\d+)$/ which extracted all trailing digits (e.g., '265000' from '265000') instead of only the template sequence portion (e.g., '5000' for {NNNN}). This caused the counter to jump to 265001, and the next auto-generated number prepended {YY} to get '26265001'."
  fix: "Use template {N+} length to build a fixed-length digit regex for sequence extraction."
  commit: b4d1e4c
  severity: minor
