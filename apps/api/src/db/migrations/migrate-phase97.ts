import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 97 — QuickBooks vendor bills and bill payments read-back: qbo_bills, qbo_bill_payments, order_payments.qbo_key, company_profiles.qbo_bills_last_check_at. Idempotent.
 */
console.log("Starting Phase 97 migration (vendor bills read-back)...");

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;
for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE "${s}".order_payments ADD COLUMN IF NOT EXISTS qbo_key TEXT`);
    await client.query(`ALTER TABLE "${s}".company_profiles ADD COLUMN IF NOT EXISTS qbo_bills_last_check_at TIMESTAMPTZ`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${s}".qbo_bills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        qbo_id TEXT NOT NULL UNIQUE,
        doc_number TEXT,
        txn_date TEXT NOT NULL,
        due_date TEXT,
        qbo_vendor_id TEXT,
        vendor_name TEXT,
        total NUMERIC(15,2) NOT NULL,
        balance NUMERIC(15,2) NOT NULL DEFAULT 0,
        qbo_customer_ids JSONB NOT NULL DEFAULT '[]',
        memo TEXT,
        order_id UUID REFERENCES "${s}".orders(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'open',
        link_source TEXT,
        no_auto BOOLEAN NOT NULL DEFAULT FALSE,
        relevant BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${s}".qbo_bill_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        qbo_id TEXT NOT NULL UNIQUE,
        txn_date TEXT NOT NULL,
        reference TEXT,
        total NUMERIC(15,2) NOT NULL,
        links JSONB NOT NULL DEFAULT '[]',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await client.query(`CREATE INDEX IF NOT EXISTS qbo_bills_order_idx ON "${s}".qbo_bills (order_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS order_payments_qbo_key_idx ON "${s}".order_payments (qbo_key)`);
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
