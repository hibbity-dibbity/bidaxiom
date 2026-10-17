import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 95 — proposal templates: personal or shared (scope), group or add-on (kind), applies_to. Existing templates become shared. Idempotent.
 */
console.log("Starting Phase 95 migration (template scope and add-ons)...");

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;
for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE "${s}".proposal_templates ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'global'`);
    await client.query(`ALTER TABLE "${s}".proposal_templates ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'group'`);
    await client.query(`ALTER TABLE "${s}".proposal_templates ADD COLUMN IF NOT EXISTS applies_to TEXT`);
    ok++;
  } catch (e) {
    console.error(`Failed for ${s}:`, e);
    failed++;
  } finally {
    client.release();
  }
}
console.log(`Done. ${ok} tenants migrated, ${failed} failed.`);
await pool.end();
process.exit(failed ? 1 : 0);
