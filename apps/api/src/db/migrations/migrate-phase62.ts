import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 62 — orders and order lines (generated when a proposal is accepted). Idempotent.
 */

console.log("Starting Phase 62 migration (orders and order lines)...");

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
      CREATE TABLE IF NOT EXISTS "${s}".orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES "${s}".projects(id) ON DELETE CASCADE,
        estimate_id UUID NOT NULL REFERENCES "${s}".estimates(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        number TEXT NOT NULL,
        vendor_id UUID,
        status TEXT NOT NULL DEFAULT 'draft',
        revision INTEGER NOT NULL DEFAULT 1,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (project_id, number)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_estimate ON "${s}".orders(estimate_id)
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${s}".order_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES "${s}".orders(id) ON DELETE CASCADE,
        source_line_id UUID,
        description TEXT NOT NULL,
        cost_code_id INTEGER,
        budget_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
        projected_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
        exclusions TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_order_lines_order ON "${s}".order_lines(order_id)
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
