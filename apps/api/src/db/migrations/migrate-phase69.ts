import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 69 — change orders get their own master text (the extra work authorization),
 * kept beside the proposal terms. Terms versions are numbered per kind. Idempotent.
 */
console.log("Starting Phase 69 migration (change order authorization text)...");

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;

for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`ALTER TABLE "${s}".terms_versions ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'proposal'`);
    await client.query(`ALTER TABLE "${s}".terms_versions DROP CONSTRAINT IF EXISTS terms_versions_version_key`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_terms_versions_kind_version ON "${s}".terms_versions(kind, version)`);
    await client.query("COMMIT");
    ok++;
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(`Failed for ${s}:`, e);
    failed++;
  } finally {
    client.release();
  }
}
console.log(`Done. ${ok} tenants migrated, ${failed} failed.`);
await pool.end();
process.exit(failed ? 1 : 0);
