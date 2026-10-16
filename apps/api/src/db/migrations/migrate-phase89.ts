import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 89 - action_prompts, the "needs your attention" items with one-click answers
 * (send the deposit invoice, mark the project Active, mark it Closed). dedupe_key is unique and rows
 * are never deleted when answered, so an answered question is not asked again for the same event. Idempotent.
 */
console.log("Starting Phase 89 migration (action prompts)...");

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;
for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${s}".action_prompts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES "${s}".projects(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        dedupe_key TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        body TEXT,
        actions JSONB NOT NULL DEFAULT '[]'::jsonb,
        status TEXT NOT NULL DEFAULT 'open',
        resolution TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        resolved_by TEXT
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_action_prompts_open ON "${s}".action_prompts(status, created_at)`);
    ok++;
  } catch (e) {
    console.error(`Failed for ${s}:`, e);
    failed++;
  } finally {
    client.release();
  }
}
console.log(`Done. ${ok} tenants migrated, ${failed} failed.`);
await pool.end();
process.exit(failed ? 1 : 0);
