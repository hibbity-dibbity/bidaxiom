---
status: complete
phase: 20-configuration-foundation
source: [20-01-SUMMARY.md, 20-02-SUMMARY.md]
started: 2026-02-17T00:15:00Z
updated: 2026-02-17T00:25:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Access Job Number Configuration Section
expected: Log in as admin user, navigate to /settings/company. Job Numbering section appears below Custom Specialty Trades with toggle, template input, sequence input, and preview area visible.
result: pass

### 2. Enable Job Numbering Toggle
expected: Click the toggle switch to enable job numbering. Fields for template and sequence become active/editable (not disabled). Preview section appears.
result: pass
note: "User feedback: Prefer 1 next job number instead of 3, template and sequence fields side-by-side on desktop/tablet"

### 3. Configure Custom Template
expected: Enter custom template like "{YY}-{NNNN}" in template input field. Field accepts input, character count updates, no errors appear for valid pattern.
result: pass

### 4. Template Validation - Invalid Pattern
expected: Enter invalid template "{YYYY}" (missing sequence pattern) in template field, then tab/blur. Red error text appears below input: "Template must contain at least one sequence pattern like {NN} or {NNN}". Toast notification appears.
result: pass

### 5. Configure Starting Sequence Number
expected: Enter "1001" in the "Next Sequence Number" input field. Field accepts numeric input, shows value correctly.
result: pass

### 6. Preview Next Job Numbers
expected: With template "{YY}-{NNNN}" and sequence 1001, preview section shows next 3 job numbers: "26-1001, 26-1002, 26-1003" (year 2026 = YY 26).
result: pass

### 7. Character Count Display
expected: As you type in template field, character count updates showing "X/50 characters" below the input. Count reflects current template length.
result: pass

### 8. Dynamic Token Help Text
expected: Below template input, available tokens are displayed: {YYYY}, {YY}, {MM}, {DD}, {NNN} as styled code elements. Hovering or examining shows token descriptions.
result: pass

### 9. Settings Persistence After Save
expected: Set template to "{YY}-{NNNN}", sequence to 1001, enable toggle ON. Click "Save Configuration" button. Refresh the page. Settings persist exactly as entered (toggle ON, template "{YY}-{NNNN}", sequence 1001).
result: issue
reported: "Failed - when clicking save configuration I get error: Failed query: insert into \"tenant_vpa_g9edvkmrj3ao2oebusov\".\"company_profiles\" (\"id\", \"company_type\", \"trades_config\", \"job_number_settings\", \"retainage_config\", \"allow_personal_templates\", \"sov_grouping_method\", \"valid_from\", \"valid_to\", \"created_by\", \"created_at\", \"updated_at\") values (default, $1, $2, $3, default, default, default, $4, default, $5, default, default) returning \"id\", \"company_type\", \"trades_config\", \"job_number_settings\", \"retainage_config\", \"allow_personal_templates\", \"sov_grouping_method\", \"valid_from\", \"valid_to\", \"created_by\", \"created_at\", \"updated_at\" params: gc_only,{\"csiDivisions\":[],\"customTrades\":[]},{\"enabled\":true,\"template\":\"{YY}{NNNN}\",\"nextSequenceNumber\":1000,\"lastGeneratedFormat\":null},2026-02-17T02:13:35.396Z,edd55e62-309c-4ce0-9315-cb3c2066cb91"
severity: blocker

### 10. Validation Feedback Clears on Typing
expected: Enter invalid template to trigger error. Error message appears. Start typing to modify the template. Error message clears immediately as you type (onChange behavior).
result: pass

## Summary

total: 10
passed: 9
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Configuration changes save and persist across sessions"
  status: failed
  reason: "User reported: Failed - when clicking save configuration I get error: Failed query: insert into \"tenant_vpa_g9edvkmrj3ao2oebusov\".\"company_profiles\" (\"id\", \"company_type\", \"trades_config\", \"job_number_settings\", \"retainage_config\", \"allow_personal_templates\", \"sov_grouping_method\", \"valid_from\", \"valid_to\", \"created_by\", \"created_at\", \"updated_at\") values (default, $1, $2, $3, default, default, default, $4, default, $5, default, default) returning \"id\", \"company_type\", \"trades_config\", \"job_number_settings\", \"retainage_config\", \"allow_personal_templates\", \"sov_grouping_method\", \"valid_from\", \"valid_to\", \"created_by\", \"created_at\", \"updated_at\" params: gc_only,{\"csiDivisions\":[],\"customTrades\":[]},{\"enabled\":true,\"template\":\"{YY}{NNNN}\",\"nextSequenceNumber\":1000,\"lastGeneratedFormat\":null},2026-02-17T02:13:35.396Z,edd55e62-309c-4ce0-9315-cb3c2066cb91"
  severity: blocker
  test: 9
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
