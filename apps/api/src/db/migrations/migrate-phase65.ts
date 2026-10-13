import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 65 — proposals start at Rev 0 (like orders). Projects whose proposals are
 * numbered Rev 1, Rev 2, ... are shifted down by one. Idempotent: a project that already has a
 * Rev 0 is left alone.
 */
console.log("Starting Phase 65 migration (proposals start at Rev 0)...");

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;

for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`ALTER TABLE "${s}".estimates ALTER COLUMN revision SET DEFAULT 0`);
    await client.query(`
      UPDATE "${s}".estimates e
      SET revision = e.revision - 1,
          name = CASE WHEN e.name = 'Rev ' || e.revision THEN 'Rev ' || (e.revision - 1) ELSE e.name END
      WHERE e.revision >= 1
        AND NOT EXISTS (SELECT 1 FROM "${s}".estimates z WHERE z.project_id = e.project_id AND z.revision = 0)
    `);
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
