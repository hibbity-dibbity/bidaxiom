import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 56 — Subs & Vendors directory
 *
 * Extends subcontractor_directory so one table holds both subcontractors and
 * suppliers, with terms, credit and compliance fields. Existing rows become
 * kind = 'subcontractor'. All statements are idempotent.
 */

console.log("Starting Phase 56 migration (Subs & Vendors directory)...");

const tenants = await pool.query(
  "SELECT schema_name FROM tenants WHERE status = 'active'"
);

let ok = 0;
let failed = 0;

for (const row of tenants.rows) {
  const schemaName = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      ALTER TABLE "${schemaName}".subcontractor_directory
        ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'subcontractor',
        ADD COLUMN IF NOT EXISTS category TEXT,
        ADD COLUMN IF NOT EXISTS payment_terms TEXT,
        ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(15,2),
        ADD COLUMN IF NOT EXISTS tax_id_last4 TEXT,
        ADD COLUMN IF NOT EXISTS w9_on_file BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS w9_received_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS insurance_expires_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS is_1099 BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_subcontractor_directory_kind
      ON "${schemaName}".subcontractor_directory(kind)
    `);
    await client.query("COMMIT");
    ok++;
    console.log(`  OK ${schemaName}`);
  } catch (err) {
    await client.query("ROLLBACK");
    failed++;
    console.error(`  FAIL ${schemaName}:`, err);
  } finally {
    client.release();
  }
}

console.log("---");
console.log(`Done. ${ok} succeeded, ${failed} failed.`);
await pool.end();
process.exit(failed > 0 ? 1 : 0);
