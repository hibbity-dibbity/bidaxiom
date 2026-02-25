import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 53 — New Project Form Cleanup + Schema
 *
 * Adds customer_budget and building dimension columns to the projects table
 * on every active tenant schema. building_sqft is computed server-side as
 * width × length during project create/update.
 *
 * All operations are idempotent (ADD COLUMN IF NOT EXISTS).
 */

console.log("Starting Phase 53 migration...");
console.log("Adding customer_budget, building_width, building_length, building_height, building_sqft to projects");
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
      ALTER TABLE "${schemaName}".projects
        ADD COLUMN IF NOT EXISTS customer_budget NUMERIC(15, 2)
    `);

    await client.query(`
      ALTER TABLE "${schemaName}".projects
        ADD COLUMN IF NOT EXISTS building_width NUMERIC(10, 2)
    `);

    await client.query(`
      ALTER TABLE "${schemaName}".projects
        ADD COLUMN IF NOT EXISTS building_length NUMERIC(10, 2)
    `);

    await client.query(`
      ALTER TABLE "${schemaName}".projects
        ADD COLUMN IF NOT EXISTS building_height NUMERIC(10, 2)
    `);

    await client.query(`
      ALTER TABLE "${schemaName}".projects
        ADD COLUMN IF NOT EXISTS building_sqft NUMERIC(12, 2)
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
