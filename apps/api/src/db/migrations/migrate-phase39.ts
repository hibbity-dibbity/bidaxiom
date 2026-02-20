import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 39 — Custom Template Import + Field Mapping
 *
 * Adds document template infrastructure to every active tenant schema.
 * All operations idempotent (ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS /
 * CREATE UNIQUE INDEX IF NOT EXISTS).
 *
 * Changes per schema:
 *   1. document_templates: New table for company-scoped custom .docx/.xlsx templates
 *      with detected fields, field mappings, and activation state.
 *   2. document_templates_active_per_doctype_idx: Partial unique index enforcing
 *      at most one active template per doc type.
 *   3. documents.template_id: Nullable UUID FK column referencing document_templates.id
 *      (ON DELETE SET NULL) for audit traceability of which template generated a PDF.
 */

console.log("Starting Phase 39 migration...");
console.log("Adding document_templates table and documents.template_id FK column");
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

    // 1. Create document_templates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".document_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doc_type TEXT NOT NULL,
        name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        file_size INTEGER,
        detected_fields JSONB NOT NULL DEFAULT '[]',
        field_mappings JSONB NOT NULL DEFAULT '[]',
        is_active BOOLEAN NOT NULL DEFAULT false,
        uploaded_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // 2. Partial unique index: one active template per doc type
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS document_templates_active_per_doctype_idx
        ON "${schemaName}".document_templates (doc_type)
        WHERE is_active = true
    `);

    // 3. Add template_id FK column to documents (nullable, ON DELETE SET NULL)
    await client.query(`
      ALTER TABLE "${schemaName}".documents
        ADD COLUMN IF NOT EXISTS template_id UUID
        REFERENCES "${schemaName}".document_templates(id)
        ON DELETE SET NULL
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
