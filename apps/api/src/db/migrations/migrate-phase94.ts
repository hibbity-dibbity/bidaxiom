import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 94 — proposal templates: proposal_templates and proposal_template_lines. Idempotent.
 */
console.log("Starting Phase 94 migration (proposal templates)...");

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;
for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${s}".proposal_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${s}".proposal_template_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID NOT NULL REFERENCES "${s}".proposal_templates(id) ON DELETE CASCADE,
        parent_id UUID,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        quantity NUMERIC(15,4) NOT NULL DEFAULT 1,
        unit TEXT NOT NULL DEFAULT 'ea',
        unit_cost NUMERIC(15,4) NOT NULL DEFAULT 0,
        margin_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
        contingency_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
        notes TEXT,
        visibility TEXT NOT NULL DEFAULT 'price',
        sort_order INTEGER NOT NULL DEFAULT 0
      )`);
    await client.query(`CREATE INDEX IF NOT EXISTS proposal_template_lines_template_idx ON "${s}".proposal_template_lines (template_id)`);
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
