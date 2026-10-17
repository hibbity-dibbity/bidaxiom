import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 98 — QuickBooks purchase order push: company_profiles order push settings, qbo_bills.qbo_po_ids. Idempotent.
 */
console.log("Starting Phase 98 migration (QuickBooks purchase orders)...");

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;
for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE "${s}".company_profiles ADD COLUMN IF NOT EXISTS qbo_order_push BOOLEAN NOT NULL DEFAULT FALSE`);
    await client.query(`ALTER TABLE "${s}".company_profiles ADD COLUMN IF NOT EXISTS qbo_order_push_from TEXT`);
    await client.query(`ALTER TABLE "${s}".company_profiles ADD COLUMN IF NOT EXISTS qbo_order_accounts JSONB NOT NULL DEFAULT '{}'`);
    await client.query(`ALTER TABLE "${s}".qbo_bills ADD COLUMN IF NOT EXISTS qbo_po_ids JSONB NOT NULL DEFAULT '[]'`);
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
