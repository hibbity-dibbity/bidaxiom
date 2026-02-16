---
status: complete
phase: 17-estimating-workflow-setup-core
source: 17-02-SUMMARY.md, 17-05-SUMMARY.md, 17-06-SUMMARY.md, 17-07-SUMMARY.md
started: 2026-02-16T04:30:00Z
updated: 2026-02-16T04:35:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Create new estimate from project
expected: Navigate to a project detail page → click "Estimates" tab (or navigate to /projects/{slug}/estimates). Page shows empty state with "New Estimate" button. Click "New Estimate" → form loads with name and projectType fields. Fill form, click "Start Estimating" → redirects to workflow page with sidebar showing 6 steps.
result: issue
reported: "Failed. There is no link to Estimates onthe Project Detail page. I can navigate manually to /projects/{slug}/estimates. I can click New Estimate and fill out the estimate info. When I click Start Estimating I get the following error: Failed query: insert into \"tenant_vpa_g9edvkmrj3ao2oebusov\".\"estimates\" (\"id\", \"project_id\", \"name\", \"description\", \"status\", \"project_type\", \"applied_cost_code_template_id\", \"applied_labor_rate_template_id\", \"overhead_type\", \"overhead_value\", \"markup_base\", \"direct_costs\", \"overhead_amount\", \"markup_amount\", \"total_cost\", \"current_version\", \"submitted_at\", \"accepted_at\", \"created_by\", \"created_at\", \"updated_at\") values (default, $1, $2, default, $3, $4, default, default, default, default, default, default, default, default, default, $5, default, default, $6, default, default) returning \"id\", \"project_id\", \"name\", \"description\", \"status\", \"project_type\", \"applied_cost_code_template_id\", \"applied_labor_rate_template_id\", \"overhead_type\", \"overhead_value\", \"markup_base\", \"direct_costs\", \"overhead_amount\", \"markup_amount\", \"total_cost\", \"current_version\", \"submitted_at\", \"accepted_at\", \"created_by\", \"created_at\", \"updated_at\" params: a17fb662-9a2b-440c-b4c0-374877bd92bf,Base Bid Option A,draft,commercial,1,edd55e62-309c-4ce0-9315-cb3c2066cb91"
severity: blocker

### 2. Workflow sidebar shows all 6 steps
expected: Workflow page shows vertical sidebar with 6 steps organized into 3 groups: Setup (1-2), Cost Entry (3-5), Finalization (6). Step 1 is unlocked and highlighted. Steps 2-6 show lock icons. Each step has a title: Basic Information, Template Selection, Line Items, Labor Rates, Markup Configuration, SOV Builder.
result: skipped
reason: Cannot test - blocked by Test 1 (estimate creation fails, cannot reach workflow page)

### 3. Step 1 auto-saves after editing
expected: In Step 1, fill the "Name" field with test text. Wait 1 second. You should see a brief "Saving..." indicator appear then disappear. Change the "Project Type" dropdown. After 500ms, you should see the saving indicator again. Refresh the page → workflow loads with your changes preserved.
result: skipped
reason: Cannot test - blocked by Test 1

### 4. Step 2 unlocks when Step 1 has name and project type
expected: In Step 1, fill both "Name" and "Project Type" fields completely. After auto-save completes, Step 2 in the sidebar should unlock (lock icon disappears, text becomes clickable, green checkmark may appear on Step 1). Click Step 2 in sidebar → navigates to Template Selection step.
result: skipped
reason: Cannot test - blocked by Test 1

### 5. Template selection displays available templates
expected: In Step 2, you should see a section titled "Cost Code Templates" with template cards (if templates exist in company) OR an empty state message "No templates available". Each template card shows: name, description, scope badge (Company/Personal). Templates have an "Apply Template" button.
result: skipped
reason: Cannot test - blocked by Test 1

### 6. Applying template unlocks Step 3
expected: If templates exist: Click "Apply Template" on any template card → mutation triggers, template loads line items into estimate, Step 3 unlocks in sidebar (lock icon removed). If no templates: there should be a "Skip" or "Continue" option to proceed to Step 3. Either way, Step 3 becomes accessible after this step completes.
result: skipped
reason: Cannot test - blocked by Test 1

### 7. Step 3 shows line items table with inline editing
expected: Navigate to Step 3. Page shows a table with columns: CSI Code, Description, Quantity, Unit, Unit Cost, Cost Type, Markup %, Cost (calculated), Margin $ (calculated), Margin % (calculated), Actions. Click any Description cell → cursor appears, you can edit text. Click away (blur) → auto-saves the change. An "Add Line Item" button appears at the bottom.
result: skipped
reason: Cannot test - blocked by Test 1

### 8. Line items show color-coded margin indicators
expected: In the line items table (Step 3), the "Margin %" column displays percentages with color coding: red for < 10%, yellow for 10-20%, green for >= 20%. Add or edit line items with different markup percentages to see the color changes. The margin updates in real-time as you edit unit cost or markup.
result: skipped
reason: Cannot test - blocked by Test 1

### 9. Section subtotals group line items by CSI division
expected: If line items have different CSI codes/divisions: The table displays bold subtotal rows between sections showing "Division X Subtotal" with rolled-up Cost, Markup, and Margin totals for that division. Line items are visually grouped by their CSI code. (May not be visible if all items share same CSI code.)
result: skipped
reason: Cannot test - blocked by Test 1

### 10. Step 4 shows labor rates application
expected: Navigate to Step 4 (Labor Rates). Page shows labor rate templates as clickable cards (similar to Step 2). An "Apply Labor Rates" button applies the template to all labor-type line items. A table displays current labor line items with: description, quantity, rate, total. A "Skip Labor Rates" button allows bypassing this step.
result: skipped
reason: Cannot test - blocked by Test 1

### 11. Step 5 shows markup configuration
expected: Navigate to Step 5 (Markup Configuration). Page shows overhead settings (percentage or fixed amount toggle), markup base selection (direct costs vs direct + overhead), and tiered markup inputs by cost type (labor %, material %, equipment %, subcontractor %). Changes auto-save after 500ms. A live margin summary displays: Overhead Amount, Markup Amount, Selling Price, Margin %.
result: skipped
reason: Cannot test - blocked by Test 1

### 12. Step 6 shows SOV builder with generation
expected: Navigate to Step 6 (SOV Builder). Page shows a "Generate SOV" button with grouping method dropdown (CSI/Phase/Payment Schedule). Click "Generate SOV" → SOV line items appear as cards below. Each card shows description, amount, cost code references (as chips/badges), and completion percentage. Running totals display: Estimate Total, SOV Total, Variance.
result: skipped
reason: Cannot test - blocked by Test 1

### 13. SOV variance validation prevents finalization
expected: In Step 6, after generating SOV, if the SOV Total doesn't match Estimate Total (variance > $1.00), a red alert appears warning of the mismatch. The "Finalize SOV" button is disabled. Edit SOV line item amounts to make totals match (variance <= $1.00) → green alert appears, "Finalize SOV" button becomes enabled.
result: skipped
reason: Cannot test - blocked by Test 1

### 14. SOV finalization locks and versions the SOV
expected: In Step 6, with variance <= $1.00, click "Finalize SOV" button → mutation triggers, success message appears. Note in UI should indicate "Once finalized, the SOV will be locked and versioned" or similar. (Actual versioning behavior may not be visible in UI, but button should work without errors.)
result: skipped
reason: Cannot test - blocked by Test 1

### 15. All 6 workflow steps are accessible and functional
expected: Navigate through all 6 steps using the sidebar: Step 1 (Basic Info), Step 2 (Template Selection), Step 3 (Line Items), Step 4 (Labor Rates), Step 5 (Markup Config), Step 6 (SOV Builder). Each step loads without errors, shows the expected components (forms, tables, cards), and navigation works smoothly. No placeholder text like "Step not implemented" appears.
result: skipped
reason: Cannot test - blocked by Test 1

## Summary

total: 15
passed: 0
issues: 1
pending: 0
skipped: 14

## Gaps

- truth: "User can create estimate and navigate to workflow page"
  status: failed
  reason: "User reported: Failed. There is no link to Estimates onthe Project Detail page. I can navigate manually to /projects/{slug}/estimates. I can click New Estimate and fill out the estimate info. When I click Start Estimating I get the following error: Failed query: insert into \"tenant_vpa_g9edvkmrj3ao2oebusov\".\"estimates\" (\"id\", \"project_id\", \"name\", \"description\", \"status\", \"project_type\", \"applied_cost_code_template_id\", \"applied_labor_rate_template_id\", \"overhead_type\", \"overhead_value\", \"markup_base\", \"direct_costs\", \"overhead_amount\", \"markup_amount\", \"total_cost\", \"current_version\", \"submitted_at\", \"accepted_at\", \"created_by\", \"created_at\", \"updated_at\") values (default, $1, $2, default, $3, $4, default, default, default, default, default, default, default, default, default, $5, default, default, $6, default, default) returning \"id\", \"project_id\", \"name\", \"description\", \"status\", \"project_type\", \"applied_cost_code_template_id\", \"applied_labor_rate_template_id\", \"overhead_type\", \"overhead_value\", \"markup_base\", \"direct_costs\", \"overhead_amount\", \"markup_amount\", \"total_cost\", \"current_version\", \"submitted_at\", \"accepted_at\", \"created_by\", \"created_at\", \"updated_at\" params: a17fb662-9a2b-440c-b4c0-374877bd92bf,Base Bid Option A,draft,commercial,1,edd55e62-309c-4ce0-9315-cb3c2066cb91"
  severity: blocker
  test: 1
  root_cause: "Phase 17 estimating tables were defined in schema but never added to tenant provisioning. The provisionTenantSchema function in apps/api/src/tenant/provision.ts ended at calendar_sync_state table and did not include any Phase 17 tables (estimates, estimate_line_items, cost_code_templates, template_line_items, labor_rate_templates, estimate_versions, sov_versions)."
  artifacts:
    - path: "apps/api/src/tenant/provision.ts"
      issue: "Missing Phase 17 table creation SQL"
    - path: "apps/api/src/migrate-phase17-estimates.ts"
      issue: "Migration script for existing tenants (created by debugger)"
  missing:
    - "Add Phase 17 table creation to provision.ts (FIXED)"
    - "Run migration for existing tenant (FIXED)"
    - "Add 'Estimates' tab to project detail layout"
  debug_session: ".planning/debug/phase17-estimate-creation-fails.md"
