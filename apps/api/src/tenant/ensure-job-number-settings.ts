import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Ensure all company_profiles have valid job_number_settings
 * Phase: 20-01 (Configuration Foundation)
 * Purpose: Backfill NULL or invalid job_number_settings in existing company profiles
 *
 * This migration ensures data integrity for the job number configuration UI.
 * Without valid settings, the UI may crash or show undefined values.
 */

const DEFAULT_SETTINGS = {
  enabled: false,
  template: "{YYYY}-{NNN}",
  nextSequenceNumber: 1,
  lastGeneratedFormat: null,
};

export async function ensureJobNumberSettings() {
  console.log("Starting Phase 20-01 job_number_settings integrity check...");
  console.log("Ensuring all company_profiles have valid job_number_settings");
  console.log("---");

  // Get all active tenant schemas
  const tenants = await pool.query(
    "SELECT schema_name FROM tenants WHERE status = 'active'"
  );

  let successCount = 0;
  let failureCount = 0;
  let updatedCount = 0;
  const failures: Array<{ schema: string; error: string }> = [];

  for (const row of tenants.rows) {
    const schemaName = row.schema_name;
    console.log(`\nChecking schema: ${schemaName}`);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Check if company_profiles table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = '${schemaName}'
          AND table_name = 'company_profiles'
        )
      `);
      const tableExists = tableCheck.rows[0].exists;

      if (!tableExists) {
        console.log(`  - Skipping (company_profiles table does not exist)`);
        successCount++;
        await client.query("COMMIT");
        client.release();
        continue;
      }

      // Update rows where job_number_settings is NULL or missing required fields
      const updateResult = await client.query(`
        UPDATE "${schemaName}".company_profiles
        SET job_number_settings = $1::jsonb
        WHERE job_number_settings IS NULL
           OR NOT (job_number_settings ? 'enabled')
           OR NOT (job_number_settings ? 'template')
           OR NOT (job_number_settings ? 'nextSequenceNumber')
      `, [JSON.stringify(DEFAULT_SETTINGS)]);

      const rowsUpdated = updateResult.rowCount || 0;
      if (rowsUpdated > 0) {
        console.log(`  ✓ Updated ${rowsUpdated} company profile(s) with default settings`);
        updatedCount += rowsUpdated;
      } else {
        console.log(`  ✓ All company profiles already have valid settings`);
      }

      await client.query("COMMIT");
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
  console.log(`  Total rows updated: ${updatedCount}`);

  if (failures.length > 0) {
    console.log("\nFailed migrations:");
    failures.forEach(({ schema, error }) => {
      console.log(`  - ${schema}: ${error}`);
    });
  }

  return failureCount === 0;
}

// Auto-run when executed directly
const success = await ensureJobNumberSettings();
await pool.end();
process.exit(success ? 0 : 1);
