import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Migration: Phase 73 — material takeoffs (concrete and metal building estimators). Idempotent. */
console.log("Starting Phase 73 migration (material takeoffs)...");

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;

for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${s}".material_takeoffs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES "${s}".projects(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        inputs JSONB NOT NULL,
        qty_overrides JSONB NOT NULL DEFAULT '{}',
        cost_overrides JSONB NOT NULL DEFAULT '{}',
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await client.query(`CREATE INDEX IF NOT EXISTS material_takeoffs_project_idx ON "${s}".material_takeoffs(project_id)`);
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
