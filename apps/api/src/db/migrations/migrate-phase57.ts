import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 57 — Proposal builder data model
 *
 * - estimates: sales_tax_percent, payment_terms, valid_days
 * - proposal_cost_lines, proposal_global_costs, invoice_milestones
 *
 * The old estimate_line_items table is left untouched until the old estimate
 * screens are retired. All statements are idempotent.
 */

console.log("Starting Phase 57 migration (proposal builder data model)...");

const tenants = await pool.query(
  "SELECT schema_name FROM tenants WHERE status = 'active'"
);

let ok = 0;
let failed = 0;

for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      ALTER TABLE "${s}".estimates
        ADD COLUMN IF NOT EXISTS sales_tax_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS payment_terms TEXT NOT NULL DEFAULT 'Net 30',
        ADD COLUMN IF NOT EXISTS valid_days INTEGER NOT NULL DEFAULT 30
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${s}".proposal_cost_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        estimate_id UUID NOT NULL REFERENCES "${s}".estimates(id) ON DELETE CASCADE,
        parent_id UUID,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        cost_code_id INTEGER,
        quantity NUMERIC(15,4) NOT NULL DEFAULT 1,
        unit TEXT NOT NULL DEFAULT 'ea',
        unit_cost NUMERIC(15,4) NOT NULL DEFAULT 0,
        margin_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
        visibility TEXT NOT NULL DEFAULT 'price',
        is_optional BOOLEAN NOT NULL DEFAULT FALSE,
        option_accepted BOOLEAN,
        vendor_id UUID,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_proposal_cost_lines_estimate
      ON "${s}".proposal_cost_lines(estimate_id)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${s}".proposal_global_costs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        estimate_id UUID NOT NULL REFERENCES "${s}".estimates(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        amount NUMERIC(15,2) NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_proposal_global_costs_estimate
      ON "${s}".proposal_global_costs(estimate_id)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${s}".invoice_milestones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        estimate_id UUID NOT NULL REFERENCES "${s}".estimates(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        percent NUMERIC(5,2) NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_invoice_milestones_estimate
      ON "${s}".invoice_milestones(estimate_id)
    `);

    await client.query("COMMIT");
    ok++;
    console.log(`  OK ${s}`);
  } catch (err) {
    await client.query("ROLLBACK");
    failed++;
    console.error(`  FAIL ${s}:`, err);
  } finally {
    client.release();
  }
}

console.log("---");
console.log(`Done. ${ok} succeeded, ${failed} failed.`);
await pool.end();
process.exit(failed > 0 ? 1 : 0);
