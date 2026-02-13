import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Add actualCost to budget_line_items and retainageConfig to company_profiles
 * Phase: 06-05 (Payment Applications - Gap Closure)
 * Purpose: Enable payment app approval to update budget actuals and support configurable retainage rates
 */

console.log("Starting Phase 06-05 migration...");
console.log("Adding actualCost column to budget_line_items table");
console.log("Adding retainageConfig column to company_profiles table");
console.log("---");

// Get all active tenant schemas
const tenants = await pool.query(
  "SELECT schema_name FROM tenants WHERE status = 'active'"
);

let successCount = 0;
let failureCount = 0;
const failures: Array<{ schema: string; error: string }> = [];

for (const row of tenants.rows) {
  const schemaName = row.schema_name;
  console.log(`\nMigrating schema: ${schemaName}`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if budget_line_items table exists
    const budgetTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = '${schemaName}'
        AND table_name = 'budget_line_items'
      )
    `);
    const budgetTableExists = budgetTableCheck.rows[0].exists;

    if (budgetTableExists) {
      // Add actualCost column to budget_line_items
      console.log(`  - Adding actual_cost to budget_line_items...`);
      await client.query(`
        ALTER TABLE "${schemaName}".budget_line_items
        ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(15,2) DEFAULT 0 NOT NULL
      `);
    } else {
      console.log(`  - Skipping budget_line_items (table does not exist - pre-Phase 4 tenant)`);
    }

    // Add retainageConfig column to company_profiles (all tenants have this table)
    console.log(`  - Adding retainage_config to company_profiles...`);
    await client.query(`
      ALTER TABLE "${schemaName}".company_profiles
      ADD COLUMN IF NOT EXISTS retainage_config JSONB DEFAULT '{"defaultRate":10,"progressiveRates":[],"releaseConditions":{"substantialCompletion":true,"punchListComplete":false,"finalAcceptance":false,"lienWaiversRequired":true}}'::jsonb
    `);

    // Add job_number_settings column if missing (from Phase 02-02)
    console.log(`  - Adding job_number_settings to company_profiles (if missing)...`);
    await client.query(`
      ALTER TABLE "${schemaName}".company_profiles
      ADD COLUMN IF NOT EXISTS job_number_settings JSONB DEFAULT '{"enabled":false,"template":"{YYYY}-{NNN}","nextSequenceNumber":1,"lastGeneratedFormat":null}'::jsonb
    `);

    await client.query("COMMIT");
    console.log(`  ✓ Migration successful for ${schemaName}`);
    successCount++;
  } catch (error) {
    await client.query("ROLLBACK");
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  ✗ Migration failed for ${schemaName}: ${errorMessage}`);
    failures.push({ schema: schemaName, error: errorMessage });
    failureCount++;
  } finally {
    client.release();
  }
}

console.log("\n---");
console.log("Migration Summary:");
console.log(`  Total tenants: ${tenants.rows.length}`);
console.log(`  Successful: ${successCount}`);
console.log(`  Failed: ${failureCount}`);

if (failures.length > 0) {
  console.log("\nFailed migrations:");
  failures.forEach(({ schema, error }) => {
    console.log(`  - ${schema}: ${error}`);
  });
}

await pool.end();

process.exit(failureCount > 0 ? 1 : 0);
