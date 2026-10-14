import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 68 — change orders are built like proposals (estimates.kind = 'change_order'),
 * and merged invoices keep their parts in invoice_items. Idempotent.
 */
console.log("Starting Phase 68 migration (change orders, merged invoices)...");

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;

for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`ALTER TABLE "${s}".estimates ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'proposal'`);
    await client.query(`ALTER TABLE "${s}".estimates ADD COLUMN IF NOT EXISTS number TEXT`);
    await client.query(`ALTER TABLE "${s}".estimates ADD COLUMN IF NOT EXISTS base_estimate_id UUID`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${s}".invoice_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID NOT NULL REFERENCES "${s}".invoices(id) ON DELETE CASCADE,
        estimate_id UUID NOT NULL,
        milestone_id UUID,
        label TEXT NOT NULL,
        source_label TEXT NOT NULL,
        percent NUMERIC(5,2) NOT NULL DEFAULT 0,
        amount NUMERIC(15,2) NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON "${s}".invoice_items(invoice_id)`);
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
