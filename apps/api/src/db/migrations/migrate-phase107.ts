import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Migration: Phase 107 — project tasks (action items with reminders). Idempotent. */
console.log("Starting Phase 107 migration (project tasks)...");

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;
for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${s}".project_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES "${s}".projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        notes TEXT,
        assignee_id TEXT,
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        completed_at TIMESTAMPTZ,
        completed_by TEXT,
        remind_at TIMESTAMPTZ,
        remind_bell BOOLEAN NOT NULL DEFAULT true,
        remind_email BOOLEAN NOT NULL DEFAULT false,
        bell_acked_at TIMESTAMPTZ,
        email_sent_at TIMESTAMPTZ,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON "${s}".project_tasks(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_project_tasks_assignee_status ON "${s}".project_tasks(assignee_id, status)`);
    await client.query("COMMIT");
    ok++;
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(`Failed for ${s}:`, e);
    failed++;
  } finally {
    client.release();
  }
}
console.log(`Done. ${ok} tenants migrated, ${failed} failed.`);
await pool.end();
process.exit(failed ? 1 : 0);
