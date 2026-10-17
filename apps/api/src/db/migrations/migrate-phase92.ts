import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 92 — QuickBooks invoice push: company_profiles settings and qbo_receipts.links. Idempotent.
 */
console.log("Starting Phase 92 migration (QuickBooks invoice push settings)...");

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;
for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE "${s}".company_profiles ADD COLUMN IF NOT EXISTS qbo_invoice_push BOOLEAN NOT NULL DEFAULT FALSE`);
    await client.query(`ALTER TABLE "${s}".company_profiles ADD COLUMN IF NOT EXISTS qbo_invoice_push_from TEXT`);
    await client.query(`ALTER TABLE "${s}".company_profiles ADD COLUMN IF NOT EXISTS qbo_income_item_id TEXT`);
    await client.query(`ALTER TABLE "${s}".company_profiles ADD COLUMN IF NOT EXISTS qbo_income_item_name TEXT`);
    await client.query(`ALTER TABLE "${s}".qbo_receipts ADD COLUMN IF NOT EXISTS links JSONB`);
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
