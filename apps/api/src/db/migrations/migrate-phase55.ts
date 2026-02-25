import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 55 — Overview Tab Redesign + Notes
 *
 * Creates the project_notes table in every active tenant schema.
 * Also creates an index on project_id for efficient per-project queries.
 *
 * All operations are idempotent (CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS).
 */

console.log("Starting Phase 55 migration...");
console.log("Creating project_notes table in all active tenant schemas");
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
      CREATE TABLE IF NOT EXISTS "${schemaName}".project_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES "${schemaName}".projects(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS project_notes_project_id_idx
      ON "${schemaName}".project_notes(project_id)
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
