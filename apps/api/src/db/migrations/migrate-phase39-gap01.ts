import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 39 Gap-01 — Company contact info columns
 *
 * Adds company contact info columns to company_profiles in every active tenant schema.
 * These columns power company.* field mappings in custom document templates.
 *
 * All operations idempotent (ADD COLUMN IF NOT EXISTS).
 *
 * Changes per schema:
 *   company_profiles: phone, license, street1, street2, city, state, zip
 */

console.log("Starting Phase 39 Gap-01 migration...");
console.log("Adding company contact columns to company_profiles");
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
      ALTER TABLE "${schemaName}".company_profiles
        ADD COLUMN IF NOT EXISTS phone TEXT,
        ADD COLUMN IF NOT EXISTS license TEXT,
        ADD COLUMN IF NOT EXISTS street1 TEXT,
        ADD COLUMN IF NOT EXISTS street2 TEXT,
        ADD COLUMN IF NOT EXISTS city TEXT,
        ADD COLUMN IF NOT EXISTS state TEXT,
        ADD COLUMN IF NOT EXISTS zip TEXT
    `);

    await client.query("COMMIT");
    successCount++;
    console.log(`✓ ${schemaName}`);
  } catch (err) {
    await client.query("ROLLBACK");
    failureCount++;
    const errMsg = err instanceof Error ? err.message : String(err);
    failures.push({ schema: schemaName, error: errMsg });
    console.error(`✗ ${schemaName}: ${errMsg}`);
  } finally {
    client.release();
  }
}

console.log("---");
console.log(`Done: ${successCount} succeeded, ${failureCount} failed`);
if (failures.length > 0) {
  console.error("Failures:", failures);
  process.exit(1);
}
await pool.end();
