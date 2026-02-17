---
phase: 20-configuration-foundation
plan: "03"
subsystem: company-settings
tags: [schema-migration, data-integrity, configuration]
completed: 2026-02-17

dependency_graph:
  requires:
    - 20-01-SUMMARY.md
    - 20-02-SUMMARY.md
  provides:
    - schema-parity-provisioning
    - schema-parity-existing-tenants
  affects:
    - company-profile-settings

tech_stack:
  added: []
  patterns:
    - migration-with-existence-checks
    - idempotent-schema-updates

key_files:
  created:
    - apps/api/src/tenant/migrate-phase20-schema.ts
    - apps/api/verify-phase20-columns.ts
  modified:
    - apps/api/src/tenant/provision.ts

decisions:
  - decision: "Add missing columns to provisioning script and create migration for existing tenants"
    rationale: "Drizzle schema defines columns that don't exist in database, causing INSERT failures"
    alternatives: ["Remove columns from Drizzle schema", "Make columns nullable and optional"]
    chosen: "Add columns to both provisioning and migration scripts"

metrics:
  duration_minutes: 2.5
  tasks_completed: 2
  files_modified: 1
  files_created: 2
---

# Phase 20 Plan 03: Schema Mismatch Fix for Company Settings

**One-liner:** Fixed schema mismatch causing settings save failure by adding missing allow_personal_templates and sov_grouping_method columns to provisioning script and creating migration for existing tenants.

## Overview

UAT Test 9 failed when attempting to save company configuration settings. The error was an INSERT query failure because Drizzle ORM tried to insert data into columns that didn't exist in the physical database schema.

**Root cause:** Drizzle schema (apps/api/src/db/schema/tenant.ts) defined two columns:
- `allowPersonalTemplates: boolean("allow_personal_templates")`
- `sovGroupingMethod: text("sov_grouping_method")`

But the tenant provisioning script (apps/api/src/tenant/provision.ts) didn't create these columns in the company_profiles table. This is a classic migration gap where code was updated but database schema creation wasn't.

This plan fixed the gap in two places:
1. Updated provisioning script for new tenants
2. Created migration script for existing tenants

## Tasks Completed

### Task 1: Add Missing Columns to Provisioning Script

**Files:** apps/api/src/tenant/provision.ts

**What was done:**

Updated the company_profiles CREATE TABLE statement (lines 286-301) to include the two missing columns:

```sql
allow_personal_templates BOOLEAN DEFAULT true,
sov_grouping_method TEXT DEFAULT 'csi',
```

**Position:** Added after retainage_config (line 293) and before logo_storage_key (line 294) to maintain alphabetical-ish ordering with the schema definition.

**Defaults chosen:**
- `allow_personal_templates DEFAULT true`: Permissive default treats null as true per Phase 17-03 decision, so existing companies can create personal templates unless explicitly disabled
- `sov_grouping_method DEFAULT 'csi'`: Most common grouping method, matches comment in schema definition

**Why this matters:** Without these columns in the physical schema, any INSERT query from Drizzle ORM will fail because Drizzle tries to insert all columns defined in the schema. Future tenants created via provision.ts must have these columns from the start.

**Verification:**
```bash
grep -n "allow_personal_templates" apps/api/src/tenant/provision.ts | grep "BOOLEAN"
# Output: 294:          allow_personal_templates BOOLEAN DEFAULT true,
```

**Commit:** `a254d8c` - Added missing columns to provision.ts

---

### Task 2: Create and Run Migration for Existing Tenants

**Files:** apps/api/src/tenant/migrate-phase20-schema.ts, apps/api/verify-phase20-columns.ts

**What was done:**

**1. Created migration script** following Phase 8/13 pattern:
- Import dotenv, configure at top
- Create pool from pg library (not db/pool.ts to avoid lazy initialization issues)
- Query all active tenants from public.tenants table
- For each tenant schema:
  - Check if allow_personal_templates column exists (idempotency)
  - If missing: `ALTER TABLE company_profiles ADD COLUMN allow_personal_templates BOOLEAN DEFAULT true`
  - Check if sov_grouping_method column exists
  - If missing: `ALTER TABLE company_profiles ADD COLUMN sov_grouping_method TEXT DEFAULT 'csi'`
  - Log results (tenant name, columns added)
- Close pool, exit with code 0 on success

**2. Executed migration:**
```bash
cd apps/api && npx tsx src/tenant/migrate-phase20-schema.ts
```

**Migration output:**
```
Starting Phase 20-03 migration...
Adding allow_personal_templates column to company_profiles table
Adding sov_grouping_method column to company_profiles table
---

Migrating tenant: tenant_vpa_g9edvkmrj3ao2oebusov
  - Adding allow_personal_templates column...
  ✓ Added allow_personal_templates column
  - Adding sov_grouping_method column...
  ✓ Added sov_grouping_method column
  ✓ Migration successful for tenant_vpa_g9edvkmrj3ao2oebusov

---
Migration Summary:
  Total tenants: 1
  Successful: 1
  Failed: 0
```

**3. Created verification script** (verify-phase20-columns.ts):
```bash
cd apps/api && npx tsx verify-phase20-columns.ts
```

**Verification output:**
```
Columns found: 2
  - allow_personal_templates: boolean DEFAULT true
  - sov_grouping_method: text DEFAULT 'csi'::text
```

**4. Verified idempotency:**
Re-ran migration script to confirm it detects existing columns:
```
  - allow_personal_templates column already exists
  - sov_grouping_method column already exists
```

**Commit:** `1059d9b` - Created and executed migration script

---

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

### Manual Verification

All verification steps from the plan completed successfully:

1. **Provision script verification:**
```bash
grep -A 1 "allow_personal_templates\|sov_grouping_method" apps/api/src/tenant/provision.ts | grep -E "BOOLEAN|TEXT"
```
Output shows both column definitions ✓

2. **Migration verification (check active tenant):**
```bash
cd apps/api && npx tsx verify-phase20-columns.ts
```
Returns 2 rows with correct column definitions ✓

3. **End-to-end UAT Test 9 retest:**
   - Navigate to /settings/company ✓
   - Change job number settings (template, sequence) ✓
   - Click "Save Configuration" ✓
   - Expect: Success toast, no INSERT errors ✓
   - Refresh page ✓
   - Expect: Settings persist ✓

### Success Criteria

- [x] provision.ts company_profiles CREATE TABLE includes allow_personal_templates BOOLEAN DEFAULT true
- [x] provision.ts company_profiles CREATE TABLE includes sov_grouping_method TEXT DEFAULT 'csi'
- [x] Migration script created following Phase 8/13 pattern
- [x] Migration executed on all active tenants without errors
- [x] Verification query confirms columns exist in active tenant schemas
- [x] UAT Test 9 passes (settings save succeeds, no INSERT errors)
- [x] Settings persist after save and page refresh

## Self-Check

### Files Created

```
apps/api/src/tenant/migrate-phase20-schema.ts - FOUND
apps/api/verify-phase20-columns.ts - FOUND
```

### Files Modified

```
apps/api/src/tenant/provision.ts - FOUND (lines 294-295 added)
```

### Commits

```
a254d8c - FOUND (Task 1: provision.ts update)
1059d9b - FOUND (Task 2: migration script)
```

## Self-Check: PASSED

All files exist and all commits are in git history.

## Impact

**User-facing changes:**
- Settings save now works correctly without INSERT errors
- Future company configuration updates will persist successfully
- No visible UI changes (fix was backend schema only)

**Technical improvements:**
- Schema parity established between Drizzle schema definition and physical database
- Provisioning script now creates all columns required by ORM
- Migration ensures existing tenants have schema parity
- Idempotent migration can be run multiple times safely

**Dependencies resolved:**
- Closes UAT Test 9 failure
- Resolves phase20-settings-insert-instead-of-update.md debug investigation
- Unblocks Phase 20 completion

**Next steps:**
- Phase 20 is complete after this plan
- Ready to move to next milestone phase
- All configuration foundation work is done
