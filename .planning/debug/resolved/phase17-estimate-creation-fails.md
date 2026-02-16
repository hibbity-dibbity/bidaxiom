---
status: resolved
trigger: "Estimate creation fails with database insert error"
created: 2026-02-15T00:00:00Z
updated: 2026-02-16T08:30:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: Fix applied - tables created in existing tenant via migration, provision.ts updated for new tenants
test: Attempt to create estimate via UI to verify database insert now works
expecting: Estimate creation succeeds, redirects to estimate detail page
next_action: User needs to test estimate creation via /projects/{slug}/estimates/new

## Symptoms

expected: Creating estimate via /projects/{slug}/estimates/new should insert record and redirect to estimate detail page
actual: Database insert fails with error on estimates table
errors: Failed query: insert into "tenant_vpa_g9edvkmrj3ao2oebusov"."estimates" ... (full error in problem_statement)
reproduction: Navigate to project, click "Start Estimating", fill form, submit
started: Phase 17 testing - likely never worked (new feature)

## Eliminated

## Evidence

- timestamp: 2026-02-15T00:01:00Z
  checked: apps/api/src/db/schema/tenant.ts
  found: estimates table IS defined in schema (lines 1040-1062) with all required columns
  implication: Schema definition exists and is correct

- timestamp: 2026-02-15T00:02:00Z
  checked: apps/api/src/tenant/provision.ts (full file)
  found: NO estimates table creation in provisionTenantSchema function - ends at calendar_sync_state (line 1428), does NOT create estimates, estimate_line_items, cost_code_templates, template_line_items, labor_rate_templates, estimate_versions, or sov_versions tables
  implication: ROOT CAUSE - Estimates table exists in schema definition but provision.ts never creates it when provisioning new tenants

- timestamp: 2026-02-15T00:03:00Z
  checked: Migration execution
  found: Created migrate-phase17-estimates.ts and executed successfully - all 7 tables created in tenant_vpa_g9edvkmrj3ao2oebusov
  implication: Existing tenant now has estimates tables

- timestamp: 2026-02-15T00:04:00Z
  checked: provision.ts updated
  found: Added all 7 Phase 17 table creations after calendar_sync_state, before tenant registration
  implication: Future tenants will have estimates tables created during provisioning

## Resolution

root_cause: Estimates table and related tables (estimate_line_items, cost_code_templates, template_line_items, labor_rate_templates, estimate_versions, sov_versions) are defined in schema/tenant.ts but NEVER created in tenant/provision.ts. The provisionTenantSchema function ends at calendar_sync_state table creation and never adds Phase 17 estimating tables. No migration file existed to add these tables retroactively.
fix: 1) Created migrate-phase17-estimates.ts migration script and executed successfully - added all 7 tables to existing tenant schema. 2) Updated tenant/provision.ts to include Phase 17 table creation after calendar_sync_state - future tenants will have tables created during provisioning.
verification: AWAITING USER TEST - User must attempt to create estimate via /projects/{slug}/estimates/new to confirm database insert now succeeds
files_changed:
  - apps/api/src/tenant/provision.ts (added Phase 17 table creation SQL)
  - apps/api/src/migrate-phase17-estimates.ts (created migration script)
