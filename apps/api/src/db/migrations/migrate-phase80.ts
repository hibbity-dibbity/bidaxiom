import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Migration: Phase 80 — purchase orders from takeoffs (vendor per takeoff line, link from order lines). Idempotent. */
console.log("Starting Phase 80 migration (purchase orders from takeoffs)...");

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;

for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`ALTER TABLE "${s}".material_takeoffs ADD COLUMN IF NOT EXISTS vendor_assignments JSONB NOT NULL DEFAULT '{}'`);
    await client.query(`ALTER TABLE "${s}".order_lines ADD COLUMN IF NOT EXISTS takeoff_id UUID`);
    await client.query(`ALTER TABLE "${s}".order_lines ADD COLUMN IF NOT EXISTS takeoff_key TEXT`);
    await client.query(`CREATE INDEX IF NOT EXISTS order_lines_takeoff_idx ON "${s}".order_lines(takeoff_id)`);
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
