---
phase: quick-fix
plan: 6
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/api/src/migrate-phase10-reporting.ts
autonomous: true
must_haves:
  truths:
    - "Scheduled reports worker no longer crashes with 'column report_definition_id does not exist'"
    - "Existing tenant report_schedules table has report_definition_id column (not report_id)"
    - "Existing tenant report_definitions table has filters, columns, sort_by, group_by, chart_config, status, created_by columns (not definition, owner_id, is_favorite)"
    - "Existing tenant materialized_report_data table has report_definition_id and generated_at columns (not report_id, filter_hash, created_at)"
    - "Existing tenant report_templates table has preview_image_url column and no extraneous updated_at column"
    - "Recent activity, project list, and customer list load correctly after fix"
  artifacts:
    - path: "apps/api/src/migrate-phase10-reporting.ts"
      provides: "Updated migration script that drops old Phase 10 tables and recreates them matching Drizzle schema"
  key_links:
    - from: "apps/api/src/db/schema/tenant.ts (Drizzle schema)"
      to: "PostgreSQL report_* tables in tenant schemas"
      via: "migrate-phase10-reporting.ts recreates tables to match"
      pattern: "report_definition_id|report_schedules|report_definitions"
---

<objective>
Fix the scheduled reports worker crash caused by Phase 10 reporting tables being out of sync with the Drizzle schema. The old migrate-phase10-reporting.ts created tables with different column names/types than what the Drizzle ORM expects, causing "column report_definition_id does not exist" errors that crash the worker and block all tenant data loading.

Purpose: The root cause is that the old migration script (run before provision.ts was updated with correct Phase 10 tables) used different column names than the Drizzle schema. For example: `report_id` instead of `report_definition_id`, `definition JSONB` instead of separate `filters`/`columns`/`chart_config` columns, `owner_id` instead of `created_by`, etc. The provision.ts already has the correct DDL, but existing tenants were migrated with the old script.

Output: Updated migration script that drops and recreates Phase 10 tables to match the Drizzle schema exactly.
</objective>

<execution_context>
@C:/Users/erict/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/erict/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/api/src/db/schema/tenant.ts (Drizzle schema - source of truth, lines 861-937 define report tables)
@apps/api/src/tenant/provision.ts (lines 1259-1348 - correct DDL for new tenants)
@apps/api/src/migrate-phase10-reporting.ts (old migration script - WRONG column definitions)
@apps/api/src/jobs/scheduled-reports.ts (worker that crashes due to column mismatch)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite Phase 10 migration to drop and recreate report tables matching Drizzle schema</name>
  <files>apps/api/src/migrate-phase10-reporting.ts</files>
  <action>
Rewrite the migrate-phase10-reporting.ts script to fix all four reporting tables.

The approach: Since these tables are from Phase 10 which was recently added and unlikely to have real user data in them, DROP the old tables and recreate them with the correct schema. Use CASCADE on drops since report_schedules and materialized_report_data reference report_definitions.

**Key mismatches to fix (old migration vs Drizzle schema):**

1. **report_definitions**: Old has `definition JSONB, owner_id TEXT, is_favorite BOOLEAN`. Drizzle expects `filters JSONB NOT NULL DEFAULT '[]', columns JSONB NOT NULL, sort_by JSONB, group_by TEXT, chart_config JSONB, status TEXT NOT NULL DEFAULT 'active', created_by TEXT NOT NULL`.

2. **report_templates**: Old has `updated_at`. Drizzle expects `preview_image_url TEXT` and no `updated_at`. Also old is missing `preview_image_url`.

3. **report_schedules**: Old has `report_id`. Drizzle expects `report_definition_id`. Old has `recipients TEXT[]`. Drizzle expects `recipients JSONB`. Old is missing `created_by TEXT NOT NULL`.

4. **materialized_report_data**: Old has `report_id, filter_hash TEXT, created_at`. Drizzle expects `report_definition_id, generated_at TIMESTAMPTZ, expires_at TIMESTAMPTZ` and no filter_hash or created_at.

**Script structure** (follow existing pattern from migrate-phase10-reporting.ts):
1. Load env from `../../.env.local` and `../../.env` using dotenv
2. Import pool from `./db/client.js`
3. Query all active tenants
4. For each tenant schema:

```sql
-- Drop old tables (CASCADE handles FK deps)
DROP TABLE IF EXISTS "{schema}".materialized_report_data CASCADE;
DROP TABLE IF EXISTS "{schema}".report_schedules CASCADE;
DROP TABLE IF EXISTS "{schema}".report_templates CASCADE;
DROP TABLE IF EXISTS "{schema}".report_definitions CASCADE;

-- Recreate report_definitions (matching Drizzle schema and provision.ts lines 1260-1277)
CREATE TABLE IF NOT EXISTS "{schema}".report_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  data_source TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '[]'::jsonb,
  columns JSONB NOT NULL,
  sort_by JSONB,
  group_by TEXT,
  chart_config JSONB,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_report_definitions_type ON "{schema}".report_definitions(type);
CREATE INDEX IF NOT EXISTS idx_report_definitions_status ON "{schema}".report_definitions(status);

-- Recreate report_templates (matching Drizzle schema and provision.ts lines 1292-1303)
CREATE TABLE IF NOT EXISTS "{schema}".report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  definition JSONB NOT NULL,
  preview_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recreate report_schedules (matching Drizzle schema and provision.ts lines 1306-1324)
CREATE TABLE IF NOT EXISTS "{schema}".report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_definition_id UUID NOT NULL REFERENCES "{schema}".report_definitions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL,
  day_of_week INTEGER,
  day_of_month INTEGER,
  time TEXT NOT NULL,
  recipients JSONB NOT NULL,
  format TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run ON "{schema}".report_schedules(next_run_at) WHERE is_active = true;

-- Recreate materialized_report_data (matching Drizzle schema and provision.ts lines 1334-1342)
CREATE TABLE IF NOT EXISTS "{schema}".materialized_report_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_definition_id UUID NOT NULL REFERENCES "{schema}".report_definitions(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_materialized_report_data_expires ON "{schema}".materialized_report_data(expires_at);
```

5. Log progress for each tenant (drop phase, create phase).
6. End with pool.end().

IMPORTANT: Cross-reference every column definition with the Drizzle schema in tenant.ts (lines 861-937) and the provision.ts DDL (lines 1259-1348) to ensure exact match. The provision.ts already has the correct DDL -- use it as the reference.
  </action>
  <verify>
Run from apps/api directory: `cd apps/api && npx tsx src/migrate-phase10-reporting.ts`
Script should output drop + recreate progress for each tenant and complete without errors.

Then verify columns match by querying the database:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema LIKE 'tenant_%' AND table_name = 'report_schedules'
ORDER BY ordinal_position;
```
Confirm `report_definition_id` column exists (not `report_id`).

Then restart the API server and confirm the scheduled reports worker no longer crashes:
`cd apps/api && npx tsx src/server.ts`
Check logs -- no more "column report_definition_id does not exist" errors.
  </verify>
  <done>
All four Phase 10 reporting tables (report_definitions, report_templates, report_schedules, materialized_report_data) in existing tenant schemas match the Drizzle ORM schema exactly. The scheduled reports worker runs without column mismatch errors. Recent activity, project list, and customer list load correctly.
  </done>
</task>

</tasks>

<verification>
After task completes:
1. Run migration: `cd apps/api && npx tsx src/migrate-phase10-reporting.ts` -- completes without error
2. Start API: `cd apps/api && npx tsx src/server.ts` -- no "column does not exist" errors in logs
3. Load the app in browser -- recent activity, project list, customer list all display correctly
4. Check that the schedule checker log shows "No due scheduled reports found" instead of crashing
</verification>

<success_criteria>
- Migration script runs successfully on all existing tenants
- All four report tables match the Drizzle schema column definitions exactly
- Scheduled reports worker no longer crashes on startup/polling
- Application data loading (recent activity, projects, customers) works without errors
</success_criteria>

<output>
After completion, create `.planning/quick/6-fix-missing-phase-10-reporting-tables-an/6-SUMMARY.md`
</output>
