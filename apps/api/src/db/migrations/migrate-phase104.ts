import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Migration: Phase 104 — QuickBooks vendor sync (qbo link on subcontractor_directory, settings on company_profiles). Idempotent. */
console.log("Starting Phase 104 migration (QuickBooks vendor sync)...");

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;
for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`ALTER TABLE "${s}".subcontractor_directory ADD COLUMN IF NOT EXISTS qbo_vendor_id TEXT`);
    await client.query(`ALTER TABLE "${s}".subcontractor_directory ADD COLUMN IF NOT EXISTS qbo_synced_at TIMESTAMPTZ`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_subcontractor_directory_qbo_vendor ON "${s}".subcontractor_directory(qbo_vendor_id)`);
    await client.query(`ALTER TABLE "${s}".company_profiles ADD COLUMN IF NOT EXISTS qbo_read_vendors BOOLEAN NOT NULL DEFAULT false`);
    await client.query(`ALTER TABLE "${s}".company_profiles ADD COLUMN IF NOT EXISTS qbo_vendors_last_check_at TIMESTAMPTZ`);
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
