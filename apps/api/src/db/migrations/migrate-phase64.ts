import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 64 — order details and revision history. Idempotent.
 * Revision numbering: Rev 0 is the first issue; existing drafts move from default 1 to 0.
 */
console.log("Starting Phase 64 migration (order details and revisions)...");

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;

for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const ddl of [
      "issued_at TIMESTAMPTZ",
      "order_date TEXT",
      "delivery_date TEXT",
      "ship_to TEXT",
      "shipping TEXT",
      "start_date TEXT",
      "finish_date TEXT",
      "payment_terms TEXT",
      "insurance_required BOOLEAN NOT NULL DEFAULT TRUE",
      "lien_waiver_required BOOLEAN NOT NULL DEFAULT FALSE",
      "notes TEXT",
    ]) {
      await client.query(`ALTER TABLE "${s}".orders ADD COLUMN IF NOT EXISTS ${ddl}`);
    }
    await client.query(`ALTER TABLE "${s}".orders ALTER COLUMN revision SET DEFAULT 0`);
    await client.query(`UPDATE "${s}".orders SET revision = 0 WHERE revision = 1 AND status = 'draft' AND issued_at IS NULL`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${s}".order_revisions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES "${s}".orders(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL,
        snapshot JSONB NOT NULL,
        reason TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (order_id, revision)
      )
    `);
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
