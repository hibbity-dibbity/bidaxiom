import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Migration: Phase 103 — Subs & Vendors spreadsheet import (batch id + source file on subcontractor_directory). Idempotent. */
console.log("Starting Phase 103 migration (vendor import)...");

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;
for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`ALTER TABLE "${s}".subcontractor_directory ADD COLUMN IF NOT EXISTS import_batch_id UUID`);
    await client.query(`ALTER TABLE "${s}".subcontractor_directory ADD COLUMN IF NOT EXISTS import_source TEXT`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_subcontractor_directory_import_batch ON "${s}".subcontractor_directory(import_batch_id)`);
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
