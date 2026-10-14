import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 67 — customer invoices and invoice payments. Idempotent.
 */
console.log("Starting Phase 67 migration (customer invoices)...");

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;

for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${s}".invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES "${s}".projects(id) ON DELETE CASCADE,
        estimate_id UUID NOT NULL REFERENCES "${s}".estimates(id) ON DELETE CASCADE,
        milestone_id UUID,
        number TEXT NOT NULL,
        milestone_name TEXT NOT NULL,
        percent NUMERIC(5,2) NOT NULL,
        amount NUMERIC(15,2) NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        sent_on TEXT,
        due_on TEXT,
        payment_terms TEXT,
        notes TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (project_id, number)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_invoices_estimate ON "${s}".invoices(estimate_id)`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${s}".invoice_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID NOT NULL REFERENCES "${s}".invoices(id) ON DELETE CASCADE,
        amount NUMERIC(15,2) NOT NULL,
        received_at TEXT NOT NULL,
        reference TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON "${s}".invoice_payments(invoice_id)`);
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
