import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Update bids table for Phase 18
 * Phase: 18-estimating-workflow-lifecycle-and-conversion
 * Purpose: Make rfqId nullable and add projectId column to support estimate-based bids
 */

console.log("Starting Phase 18 migration (Bids Schema Update)...");
console.log("Making rfqId nullable and adding projectId to bids table");
console.log("---");

// Get all active tenant schemas
const tenants = await pool.query(
  "SELECT schema_name FROM public.tenants WHERE status = 'active'"
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

    // Check if bids table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = $1
        AND table_name = 'bids'
      )
    `, [schemaName]);

    if (!tableCheck.rows[0].exists) {
      console.log(`  - Bids table does not exist, skipping...`);
      await client.query("COMMIT");
      successCount++;
      client.release();
      continue;
    }

    // Check if projectId column already exists
    const columnCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = $1
        AND table_name = 'bids'
        AND column_name = 'project_id'
      )
    `, [schemaName]);

    if (!columnCheck.rows[0].exists) {
      // Step 1: Add projectId column (nullable initially)
      console.log(`  - Adding project_id column...`);
      await client.query(`
        ALTER TABLE "${schemaName}".bids
        ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES "${schemaName}".projects(id) ON DELETE CASCADE
      `);

      // Step 2: Populate projectId from rfqs for existing bids
      console.log(`  - Populating project_id from rfqs...`);
      await client.query(`
        UPDATE "${schemaName}".bids b
        SET project_id = r.project_id
        FROM "${schemaName}".rfqs r
        WHERE b.rfq_id = r.id
        AND b.project_id IS NULL
      `);
    } else {
      console.log(`  - project_id column already exists`);
    }

    // Step 3: Make rfqId nullable (drop NOT NULL constraint)
    console.log(`  - Making rfq_id nullable...`);
    await client.query(`
      ALTER TABLE "${schemaName}".bids
      ALTER COLUMN rfq_id DROP NOT NULL
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
