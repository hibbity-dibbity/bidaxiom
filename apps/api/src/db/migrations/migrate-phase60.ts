import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 60 — proposal revisions (revision number and the proposal revised). Idempotent.
 */

console.log("Starting Phase 60 migration (proposal revisions)...");

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
      ALTER TABLE "${s}".estimates
        ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS revision_of_id UUID
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
