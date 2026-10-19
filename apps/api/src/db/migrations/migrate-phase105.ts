import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 105 — the vendor list now goes to QuickBooks one way only. Vendors that an earlier version brought IN from
 * QuickBooks are grouped into one "QuickBooks vendor sync" batch per company, so they show under Earlier imports on the import
 * page and can be undone there (undo keeps any vendor that is already used on a bid, proposal line or order). Idempotent.
 */
console.log("Starting Phase 105 migration (vendor list one way)...");

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;
for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(`
      WITH first_sync AS (
        SELECT min(qbo_synced_at) AS at FROM "${s}".subcontractor_directory WHERE qbo_vendor_id IS NOT NULL
      ), batch AS (SELECT gen_random_uuid() AS id)
      UPDATE "${s}".subcontractor_directory d
         SET import_batch_id = (SELECT id FROM batch), import_source = 'QuickBooks vendor sync'
        FROM first_sync
       WHERE d.import_batch_id IS NULL
         AND d.qbo_vendor_id IS NOT NULL
         AND first_sync.at IS NOT NULL
         AND d.created_at >= first_sync.at - interval '1 second'
         AND NOT EXISTS (SELECT 1 FROM "${s}".qbo_entity_mappings m WHERE m.entity_type = 'vendor' AND m.platform_id = d.id)
    `);
    if (r.rowCount) console.log(`${s}: grouped ${r.rowCount} vendors that came from QuickBooks`);
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
