import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 100 — QuickBooks expenses by job: qbo_bills.lines and qbo_expenses. Idempotent.
 */
console.log("Starting Phase 100 migration (QuickBooks expenses)...");

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;
for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE "${s}".qbo_bills ADD COLUMN IF NOT EXISTS lines JSONB`);
    await client.query(`CREATE TABLE IF NOT EXISTS "${s}".qbo_expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      qbo_id TEXT NOT NULL UNIQUE,
      payment_type TEXT,
      doc_number TEXT,
      txn_date TEXT NOT NULL,
      vendor_name TEXT,
      total NUMERIC(15,2) NOT NULL,
      lines JSONB NOT NULL DEFAULT '[]',
      memo TEXT,
      ignored BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
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
