---
phase: quick-fix
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/api/src/tenant/provision.ts
  - apps/api/src/migrate-phase9-documents.ts
autonomous: true
must_haves:
  truths:
    - "Document upload INSERT query succeeds without column mismatch errors"
    - "Existing tenant schemas have category and description columns on documents table"
    - "Existing tenant schemas have all Phase 9 document tables (document_tags, document_access_logs, document_workflows, workflow_approvals, workflow_counters, workflow_history, document_permissions)"
    - "New tenants provisioned after fix include all Phase 9 columns and tables"
  artifacts:
    - path: "apps/api/src/tenant/provision.ts"
      provides: "Updated documents table DDL with category and description columns, plus all Phase 9 tables"
    - path: "apps/api/src/migrate-phase9-documents.ts"
      provides: "Migration script to add missing columns and tables to existing tenants"
  key_links:
    - from: "apps/api/src/db/schema/tenant.ts (Drizzle schema)"
      to: "apps/api/src/tenant/provision.ts (DDL SQL)"
      via: "Column definitions must match exactly"
      pattern: "category.*TEXT|description.*TEXT"
---

<objective>
Fix document upload failure caused by missing `category` and `description` columns in the actual PostgreSQL `documents` table.

Purpose: The Drizzle ORM schema (tenant.ts) defines `category` and `description` columns on the `documents` table, but the provisioning SQL (provision.ts) and Phase 3 migration never created these columns. When Drizzle generates an INSERT, it includes all schema-defined columns -- PostgreSQL rejects the query because `category` and `description` don't exist in the real table. Additionally, several Phase 9 tables (document_tags, document_access_logs, document_workflows, workflow_approvals, workflow_counters, workflow_history, document_permissions) exist in the Drizzle schema but were never added to provisioning or migrated.

Output: Updated provision.ts + migration script for existing tenants.
</objective>

<execution_context>
@C:/Users/erict/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/erict/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/api/src/db/schema/tenant.ts (Drizzle schema - source of truth for column definitions)
@apps/api/src/tenant/provision.ts (DDL SQL for new tenants - MISSING category/description columns and Phase 9 tables)
@apps/api/src/migrate-phase3.ts (example migration pattern for existing tenants)
@apps/api/src/trpc/routers/document.ts (INSERT query that fails)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create migration script for existing tenants</name>
  <files>apps/api/src/migrate-phase9-documents.ts</files>
  <action>
Create a migration script following the pattern from migrate-phase3.ts.

The script must:
1. Load env from `../../.env.local` using dotenv
2. Query all active tenant schemas from `tenants` table
3. For EACH tenant schema, run these ALTER/CREATE statements (all using IF NOT EXISTS / IF NOT EXISTS patterns for idempotency):

**Add missing columns to documents table:**
```sql
ALTER TABLE "{s}".documents ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE "{s}".documents ADD COLUMN IF NOT EXISTS description TEXT;
```

IMPORTANT: The column order matters for Drizzle. `category` must come after `name` and `description` after `category`. PostgreSQL ADD COLUMN always appends to the end, but Drizzle maps by column name not position, so append order is fine.

**Create missing Phase 9 tables:**

a) document_tags:
```sql
CREATE TABLE IF NOT EXISTS "{s}".document_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES "{s}".documents(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

b) document_access_logs:
```sql
CREATE TABLE IF NOT EXISTS "{s}".document_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES "{s}".documents(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  ip_address TEXT,
  details JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

c) document_workflows:
```sql
CREATE TABLE IF NOT EXISTS "{s}".document_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES "{s}".projects(id) ON DELETE CASCADE,
  document_id UUID REFERENCES "{s}".documents(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  workflow_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  priority TEXT NOT NULL DEFAULT 'normal',
  due_date TIMESTAMPTZ,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  ball_in_court TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_document_workflows_project ON "{s}".document_workflows(project_id);
CREATE INDEX IF NOT EXISTS idx_document_workflows_type ON "{s}".document_workflows(type);
```

d) workflow_approvals:
```sql
CREATE TABLE IF NOT EXISTS "{s}".workflow_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES "{s}".document_workflows(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  approver_role TEXT,
  approver_user_id TEXT,
  requirement_type TEXT NOT NULL DEFAULT 'all',
  status TEXT NOT NULL DEFAULT 'pending',
  responded_by TEXT,
  responded_at TIMESTAMPTZ,
  comments TEXT
);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_workflow ON "{s}".workflow_approvals(workflow_id);
```

e) workflow_counters:
```sql
CREATE TABLE IF NOT EXISTS "{s}".workflow_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES "{s}".projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_workflow_counters_lookup ON "{s}".workflow_counters(project_id, type, year);
```

f) workflow_history:
```sql
CREATE TABLE IF NOT EXISTS "{s}".workflow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES "{s}".document_workflows(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  comments TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflow_history_workflow ON "{s}".workflow_history(workflow_id);
```

g) document_permissions:
```sql
CREATE TABLE IF NOT EXISTS "{s}".document_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES "{s}".documents(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES "{s}".folders(id) ON DELETE CASCADE,
  granted_to TEXT NOT NULL,
  permission_level TEXT NOT NULL DEFAULT 'view',
  include_subfolders BOOLEAN NOT NULL DEFAULT false,
  granted_by TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_document_permissions_document ON "{s}".document_permissions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_permissions_folder ON "{s}".document_permissions(folder_id);
CREATE INDEX IF NOT EXISTS idx_document_permissions_granted_to ON "{s}".document_permissions(granted_to);
```

IMPORTANT: Cross-reference each CREATE TABLE with the Drizzle schema definitions in `apps/api/src/db/schema/tenant.ts` to ensure column names, types, and constraints match exactly. The column names above are derived from the Drizzle schema -- verify them during implementation.

4. Log progress for each tenant.
5. End pool connection.
  </action>
  <verify>
Run from apps/api directory: `npx tsx src/migrate-phase9-documents.ts`
Script should output migration progress for each tenant and complete without errors.
Then verify the columns exist: connect to PostgreSQL and run:
`SELECT column_name FROM information_schema.columns WHERE table_schema = 'tenant_9v4cu94gpm198ism_cj8h9n' AND table_name = 'documents' ORDER BY ordinal_position;`
Confirm `category` and `description` columns are present.
  </verify>
  <done>All active tenant schemas have category and description columns on documents table, plus all Phase 9 document tables created.</done>
</task>

<task type="auto">
  <name>Task 2: Update provision.ts for new tenants</name>
  <files>apps/api/src/tenant/provision.ts</files>
  <action>
Update the documents table CREATE TABLE statement in provision.ts (around line 399-413) to include the missing `category` and `description` columns:

Change from:
```sql
CREATE TABLE IF NOT EXISTS "${schemaName}".documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES "${schemaName}".projects(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES "${schemaName}".folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  current_version_id UUID,
  file_size INTEGER,
  content_type TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

To:
```sql
CREATE TABLE IF NOT EXISTS "${schemaName}".documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES "${schemaName}".projects(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES "${schemaName}".folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  current_version_id UUID,
  file_size INTEGER,
  content_type TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

Then add CREATE TABLE statements for ALL Phase 9 tables after the document_versions table creation (after line 434):
- document_tags
- document_access_logs
- document_workflows (with indexes)
- workflow_approvals (with index)
- workflow_counters (with index)
- workflow_history (with index)
- document_permissions (with indexes)

Use the exact same DDL as Task 1 but with "${schemaName}" instead of "{s}".

This ensures any future tenants provisioned will have all required tables and columns from the start.
  </action>
  <verify>
Read provision.ts and confirm:
1. documents table CREATE TABLE includes `category TEXT` and `description TEXT` columns between `name` and `current_version_id`
2. All 7 Phase 9 tables (document_tags, document_access_logs, document_workflows, workflow_approvals, workflow_counters, workflow_history, document_permissions) have CREATE TABLE statements
3. TypeScript compiles: `cd apps/api && npx tsc --noEmit` (no new errors introduced)
  </verify>
  <done>provision.ts creates documents table with category and description columns, plus all Phase 9 document tables, matching the Drizzle schema exactly.</done>
</task>

</tasks>

<verification>
After both tasks complete:
1. Run migration: `cd apps/api && npx tsx src/migrate-phase9-documents.ts`
2. Test document upload via the UI at `/projects/{projectId}/documents` -- upload any file and confirm it succeeds
3. Verify no regression: existing documents still display correctly in the document list
</verification>

<success_criteria>
- Document upload INSERT query no longer fails with column mismatch
- Migration script runs successfully on all existing tenants
- provision.ts matches Drizzle schema for all document-related tables
- Uploading a PDF through the UI succeeds end-to-end
</success_criteria>

<output>
After completion, create `.planning/quick/1-fix-document-upload-error-failed-insert-/1-SUMMARY.md`
</output>
