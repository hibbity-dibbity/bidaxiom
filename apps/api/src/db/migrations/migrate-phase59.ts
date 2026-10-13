import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 59 — master terms versions and the terms version pinned on a sent proposal. Idempotent.
 */

console.log("Starting Phase 59 migration (terms versions)...");

const tenants = await pool.query(
  "SELECT schema_name FROM tenants WHERE status = 'active'"
);

let ok = 0;
let failed = 0;

for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      ALTER TABLE "${s}".estimates ADD COLUMN IF NOT EXISTS terms_version_id UUID
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${s}".terms_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version INTEGER NOT NULL UNIQUE,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${s}".terms_sections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version_id UUID NOT NULL REFERENCES "${s}".terms_versions(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_terms_sections_version ON "${s}".terms_sections(version_id)
    `);
    await client.query("COMMIT");
    ok++;
    console.log(`  OK ${s}`);
  } catch (err) {
    await client.query("ROLLBACK");
    failed++;
    console.error(`  FAIL ${s}:`, err);
  } finally {
    client.release();
  }
}

console.log("---");
console.log(`Done. ${ok} succeeded, ${failed} failed.`);
await pool.end();
process.exit(failed > 0 ? 1 : 0);
