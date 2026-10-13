import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 61 — one active proposal per project, per-project revision numbers, company website. Idempotent.
 */

console.log("Starting Phase 61 migration (active proposal, revision numbering, company website)...");

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
      ALTER TABLE "${s}".estimates ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await client.query(`
      ALTER TABLE "${s}".company_profiles ADD COLUMN IF NOT EXISTS website TEXT
    `);
    // Number proposals within each project in creation order (Rev 1, Rev 2, ...), name them to match,
    // and make the latest one the active proposal. Runs only for projects not yet numbered this way.
    await client.query(`
      WITH ranked AS (
        SELECT id, project_id,
               ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at, id) AS n,
               COUNT(*) OVER (PARTITION BY project_id) AS total
        FROM "${s}".estimates
      )
      UPDATE "${s}".estimates e
      SET revision = r.n,
          name = 'Rev ' || r.n,
          is_active = (r.n = r.total)
      FROM ranked r
      WHERE e.id = r.id
        AND NOT EXISTS (
          SELECT 1 FROM "${s}".estimates x WHERE x.project_id = e.project_id AND x.is_active
        )
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
