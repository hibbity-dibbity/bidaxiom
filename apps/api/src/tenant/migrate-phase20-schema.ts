import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Add allow_personal_templates and sov_grouping_method to company_profiles
 * Phase: 20-03 (Configuration Foundation - Schema Migration)
 * Purpose: Fix schema mismatch causing settings save failure by adding columns defined in Drizzle schema
 */

console.log("Starting Phase 20-03 migration...");
console.log("Adding allow_personal_templates column to company_profiles table");
console.log("Adding sov_grouping_method column to company_profiles table");
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
  console.log(`\nMigrating tenant: ${schemaName}`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if allow_personal_templates column exists
    const allowPersonalTemplatesCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = '${schemaName}'
        AND table_name = 'company_profiles'
        AND column_name = 'allow_personal_templates'
      )
    `);
    const allowPersonalTemplatesExists = allowPersonalTemplatesCheck.rows[0].exists;

    if (!allowPersonalTemplatesExists) {
      console.log(`  - Adding allow_personal_templates column...`);
      await client.query(`
        ALTER TABLE "${schemaName}".company_profiles
        ADD COLUMN allow_personal_templates BOOLEAN DEFAULT true
      `);
      console.log(`  ✓ Added allow_personal_templates column`);
    } else {
      console.log(`  - allow_personal_templates column already exists`);
    }

    // Check if sov_grouping_method column exists
    const sovGroupingMethodCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = '${schemaName}'
        AND table_name = 'company_profiles'
        AND column_name = 'sov_grouping_method'
      )
    `);
    const sovGroupingMethodExists = sovGroupingMethodCheck.rows[0].exists;

    if (!sovGroupingMethodExists) {
      console.log(`  - Adding sov_grouping_method column...`);
      await client.query(`
        ALTER TABLE "${schemaName}".company_profiles
        ADD COLUMN sov_grouping_method TEXT DEFAULT 'csi'
      `);
      console.log(`  ✓ Added sov_grouping_method column`);
    } else {
      console.log(`  - sov_grouping_method column already exists`);
    }

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
