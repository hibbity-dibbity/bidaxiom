import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 91 — QuickBooks deposits/payments read-back: qbo_receipts, qbo_receipt_allocations, and two company_profiles columns (off by default).
 * Idempotent.
 */
console.log("Starting Phase 91 migration (QuickBooks deposits and payments read-back)...");

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;
for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE "${s}".company_profiles ADD COLUMN IF NOT EXISTS qbo_read_payments BOOLEAN NOT NULL DEFAULT FALSE`);
    await client.query(`ALTER TABLE "${s}".company_profiles ADD COLUMN IF NOT EXISTS qbo_receipts_last_check_at TIMESTAMPTZ`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${s}".qbo_receipts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        qbo_type TEXT NOT NULL,
        qbo_id TEXT NOT NULL,
        line_no INTEGER NOT NULL DEFAULT 0,
        txn_date TEXT NOT NULL,
        amount NUMERIC(15,2) NOT NULL,
        qbo_customer_id TEXT,
        qbo_customer_name TEXT,
        memo TEXT,
        reference TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        no_auto BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (qbo_type, qbo_id, line_no)
      )`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${s}".qbo_receipt_allocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        receipt_id UUID NOT NULL REFERENCES "${s}".qbo_receipts(id) ON DELETE CASCADE,
        invoice_id UUID NOT NULL REFERENCES "${s}".invoices(id) ON DELETE CASCADE,
        invoice_payment_id UUID REFERENCES "${s}".invoice_payments(id) ON DELETE SET NULL,
        amount NUMERIC(15,2) NOT NULL,
        source TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await client.query(`CREATE INDEX IF NOT EXISTS qbo_receipt_alloc_receipt_idx ON "${s}".qbo_receipt_allocations (receipt_id)`);
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
