import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const tenants = await pool.query(
  "SELECT schema_name FROM tenants WHERE status = 'active'"
);

for (const row of tenants.rows) {
  const s = row.schema_name;
  console.log(`Migrating ${s} with Phase 9 document columns and tables...`);

  // Add missing columns to documents table
  await pool.query(`
    ALTER TABLE "${s}".documents ADD COLUMN IF NOT EXISTS category TEXT
  `);

  await pool.query(`
    ALTER TABLE "${s}".documents ADD COLUMN IF NOT EXISTS description TEXT
  `);

  // Create document_tags table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${s}".document_tags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL REFERENCES "${s}".documents(id) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Create document_access_logs table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${s}".document_access_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL REFERENCES "${s}".documents(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      ip_address TEXT,
      accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Create document_workflows table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${s}".document_workflows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL UNIQUE REFERENCES "${s}".documents(id) ON DELETE CASCADE,
      workflow_type TEXT NOT NULL,
      workflow_number TEXT NOT NULL,
      project_id UUID NOT NULL REFERENCES "${s}".projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      priority TEXT,
      due_date TIMESTAMPTZ,
      submitted_by TEXT,
      submitted_at TIMESTAMPTZ,
      response_document_id UUID REFERENCES "${s}".documents(id) ON DELETE SET NULL,
      responded_by TEXT,
      responded_at TIMESTAMPTZ,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_document_workflows_project
    ON "${s}".document_workflows(project_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_document_workflows_type
    ON "${s}".document_workflows(workflow_type)
  `);

  // Create workflow_approvals table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${s}".workflow_approvals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workflow_id UUID NOT NULL REFERENCES "${s}".document_workflows(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL,
      approver_user_id TEXT,
      approver_role TEXT,
      requirement_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by TEXT,
      reviewed_at TIMESTAMPTZ,
      comments TEXT
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_workflow_approvals_workflow
    ON "${s}".workflow_approvals(workflow_id)
  `);

  // Create workflow_counters table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${s}".workflow_counters (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES "${s}".projects(id) ON DELETE CASCADE,
      workflow_type TEXT NOT NULL,
      current_number INTEGER NOT NULL DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_workflow_counters_lookup
    ON "${s}".workflow_counters(project_id, workflow_type)
  `);

  // Create workflow_history table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${s}".workflow_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workflow_id UUID NOT NULL REFERENCES "${s}".document_workflows(id) ON DELETE CASCADE,
      changed_by TEXT NOT NULL,
      changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      from_status TEXT,
      to_status TEXT NOT NULL,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      comment TEXT
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_workflow_history_workflow
    ON "${s}".workflow_history(workflow_id)
  `);

  // Create document_permissions table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${s}".document_permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL REFERENCES "${s}".documents(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      permission_level TEXT NOT NULL,
      granted_by TEXT NOT NULL,
      granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS document_permissions_document_id_user_id_key
    ON "${s}".document_permissions(document_id, user_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS document_permissions_document_id_user_id_idx
    ON "${s}".document_permissions(document_id, user_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS document_permissions_user_id_idx
    ON "${s}".document_permissions(user_id)
  `);

  // Create folder_permissions table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${s}".folder_permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      folder_id UUID NOT NULL REFERENCES "${s}".folders(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      permission_level TEXT NOT NULL,
      include_subfolders BOOLEAN NOT NULL DEFAULT true,
      granted_by TEXT NOT NULL,
      granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS folder_permissions_folder_id_user_id_key
    ON "${s}".folder_permissions(folder_id, user_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS folder_permissions_folder_id_user_id_idx
    ON "${s}".folder_permissions(folder_id, user_id)
  `);

  console.log(`  ✓ ${s} migrated`);
}

await pool.end();
console.log("Done.");
