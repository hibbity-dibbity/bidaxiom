import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 52 — Trade Simplification
 *
 * Adds trade (text[]) and trade_other columns to subcontractor_directory
 * on every active tenant schema. Clears old CSI trades[] to [] since
 * new UI uses the plain-text trade column instead.
 *
 * All operations are idempotent (ADD COLUMN IF NOT EXISTS).
 */

console.log("Starting Phase 52 migration...");
console.log("Adding trade and trade_other columns to subcontractor_directory");
console.log("Clearing old CSI trades[] data (RFQ compat: column stays)");
console.log("---");

const tenants = await pool.query(
  "SELECT schema_name FROM tenants WHERE status = 'active'"
);

let successCount = 0;
let failureCount = 0;
const failures: Array<{ schema: string; error: string }> = [];

for (const row of tenants.rows) {
  const schemaName = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      ALTER TABLE "${schemaName}".subcontractor_directory
        ADD COLUMN IF NOT EXISTS trade JSONB NOT NULL DEFAULT '[]'::jsonb
    `);

    await client.query(`
      ALTER TABLE "${schemaName}".subcontractor_directory
        ADD COLUMN IF NOT EXISTS trade_other TEXT
    `);

    // Clear old CSI number[] data — new UI uses the text[] trade column
    await client.query(`
      UPDATE "${schemaName}".subcontractor_directory
      SET trades = '[]'::jsonb
    `);

    await client.query("COMMIT");
    successCount++;
    console.log(`  OK ${schemaName}`);
  } catch (err) {
    await client.query("ROLLBACK");
    failureCount++;
    failures.push({ schema: schemaName, error: String(err) });
    console.error(`  FAIL ${schemaName}:`, err);
  } finally {
    client.release();
  }
}

console.log(`\nDone: ${successCount} succeeded, ${failureCount} failed`);
if (failures.length > 0) {
  console.error("Failures:", failures);
}
await pool.end();

process.exit(failureCount > 0 ? 1 : 0);
