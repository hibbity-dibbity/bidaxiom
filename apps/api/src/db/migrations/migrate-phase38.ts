import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 38 — PDF Generation and Document Naming
 *
 * Adds document naming infrastructure to every active tenant schema.
 * All operations idempotent (ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS).
 *
 * Changes per schema:
 *   1. company_profiles: Add document_naming_settings JSONB column
 *      (per-doc-type naming templates; null = use default pattern)
 *   2. document_naming_counters: New table for company-scoped sequential
 *      PDF document numbering counters (one counter per doc type per tenant)
 */

console.log("Starting Phase 38 migration...");
console.log("Adding document naming settings column and counters table");
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

    // Add documentNamingSettings column to company_profiles
    await client.query(`
      ALTER TABLE "${schemaName}".company_profiles
        ADD COLUMN IF NOT EXISTS document_naming_settings JSONB
    `);

    // Create document_naming_counters table (company-scoped, no projectId)
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".document_naming_counters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doc_type TEXT NOT NULL,
        current_number INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT document_naming_counters_doc_type_unique UNIQUE (doc_type)
      )
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
