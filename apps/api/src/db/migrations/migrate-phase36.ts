import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 36 — Project Lifecycle State Machine (Simple GC Mode)
 *
 * Adds the following to every active tenant schema:
 *   1. lifecycle_phase column on projects (NOT NULL DEFAULT 'opportunity')
 *   2. Maps existing status values to nearest lifecycle_phase
 *   3. project_mode column on projects (NOT NULL DEFAULT 'gc_advanced')
 *   4. project_lifecycle_transitions table (immutable audit trail)
 *   5. Index on project_lifecycle_transitions(project_id)
 *   6. default_project_mode column on user_profiles
 *
 * All operations are idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
 */

console.log("Starting Phase 36 migration...");
console.log("Adding lifecycle_phase, project_mode columns to projects");
console.log("Creating project_lifecycle_transitions table");
console.log("Adding default_project_mode to user_profiles");
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

    // 1. Add lifecycle_phase column to projects
    console.log(`  - Adding lifecycle_phase to projects...`);
    await client.query(`
      ALTER TABLE "${schemaName}".projects
      ADD COLUMN IF NOT EXISTS lifecycle_phase TEXT NOT NULL DEFAULT 'opportunity'
    `);

    // 2. Map existing status values to nearest lifecycle_phase
    console.log(`  - Backfilling lifecycle_phase from status...`);
    await client.query(`
      UPDATE "${schemaName}".projects SET lifecycle_phase = CASE
        WHEN status = 'bidding'   THEN 'estimating'
        WHEN status = 'active'    THEN 'active'
        WHEN status = 'on_hold'   THEN 'active'
        WHEN status = 'completed' THEN 'closed'
        WHEN status = 'archived'  THEN 'archived'
        ELSE 'opportunity'
      END
      WHERE lifecycle_phase = 'opportunity'
    `);

    // 3. Add project_mode column to projects
    console.log(`  - Adding project_mode to projects...`);
    await client.query(`
      ALTER TABLE "${schemaName}".projects
      ADD COLUMN IF NOT EXISTS project_mode TEXT NOT NULL DEFAULT 'gc_advanced'
    `);

    // 4. Create project_lifecycle_transitions table
    console.log(`  - Creating project_lifecycle_transitions table...`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".project_lifecycle_transitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES "${schemaName}".projects(id) ON DELETE CASCADE,
        from_phase TEXT NOT NULL,
        to_phase TEXT NOT NULL,
        triggered_by TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        reason TEXT,
        event_source TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 5. Create index for efficient history lookups
    console.log(`  - Creating index on project_lifecycle_transitions(project_id)...`);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_plt_project_id
        ON "${schemaName}".project_lifecycle_transitions(project_id)
    `);

    // 6. Add default_project_mode to user_profiles
    console.log(`  - Adding default_project_mode to user_profiles...`);
    await client.query(`
      ALTER TABLE "${schemaName}".user_profiles
      ADD COLUMN IF NOT EXISTS default_project_mode TEXT DEFAULT 'gc_advanced'
    `);

    await client.query("COMMIT");
    console.log(`  SUCCESS: Migration successful for ${schemaName}`);
    successCount++;
  } catch (error) {
    await client.query("ROLLBACK");
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  FAILURE: Migration failed for ${schemaName}: ${errorMessage}`);
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
