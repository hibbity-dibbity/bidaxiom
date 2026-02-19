import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 37 — Project Deletion with Safeguards
 *
 * Adds 4 soft-delete columns to projects table in every active tenant schema.
 * All operations idempotent (ADD COLUMN IF NOT EXISTS).
 *
 * Columns added:
 *   - deleted_at  TIMESTAMPTZ  (null = not deleted)
 *   - deleted_by  TEXT         (Clerk user ID of deleting admin)
 *   - deletion_reason TEXT     (admin-provided reason)
 *   - restored_at TIMESTAMPTZ  (set on restore, cleared on acknowledgement)
 */

console.log("Starting Phase 37 migration...");
console.log("Adding soft-delete columns to projects table");
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
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`ALTER TABLE "${schemaName}".projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
    await client.query(`ALTER TABLE "${schemaName}".projects ADD COLUMN IF NOT EXISTS deleted_by TEXT`);
    await client.query(`ALTER TABLE "${schemaName}".projects ADD COLUMN IF NOT EXISTS deletion_reason TEXT`);
    await client.query(`ALTER TABLE "${schemaName}".projects ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ`);

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
