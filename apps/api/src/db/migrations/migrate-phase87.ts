import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 87 — remove RFQs and payment applications.
 * Drops their tables (and the bid columns that pointed at RFQs) and clears leftover settings,
 * templates and report entries. Old data in them is intentionally discarded. Idempotent.
 */
console.log("Starting Phase 87 migration (remove RFQs and payment applications)...");

const DROP_TABLES = [
  "bid_leveling_notes",
  "payment_app_approval_steps",
  "lien_waivers",
  "retainage_held",
  "payment_app_line_items",
  "payment_app_counters",
  "payment_apps",
  "rfq_invitations",
  "rfq_amendments",
  "rfqs",
];

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;
for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Columns first, so nothing depends on the tables when they go.
    await client.query(`ALTER TABLE IF EXISTS "${s}".bids DROP COLUMN IF EXISTS rfq_id CASCADE`);
    await client.query(`ALTER TABLE IF EXISTS "${s}".bids DROP COLUMN IF EXISTS invitation_id CASCADE`);
    await client.query(`ALTER TABLE IF EXISTS "${s}".bid_versions DROP COLUMN IF EXISTS trigger_amendment_id CASCADE`);
    for (const t of DROP_TABLES) await client.query(`DROP TABLE IF EXISTS "${s}"."${t}" CASCADE`);

    await client.query(`DELETE FROM "${s}".document_templates WHERE doc_type IN ('payment_app', 'rfq')`);
    await client.query(`DELETE FROM "${s}".document_naming_counters WHERE doc_type IN ('payment_app', 'rfq')`);
    await client.query(`UPDATE "${s}".company_profiles SET document_naming_settings = document_naming_settings - 'payment_app' - 'rfq' WHERE document_naming_settings IS NOT NULL`);
    await client.query(`DELETE FROM "${s}".report_definitions WHERE data_source = 'payment_apps' OR type = 'payment_status'`);
    await client.query(`DELETE FROM "${s}".report_templates WHERE type = 'payment_status'`);
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
