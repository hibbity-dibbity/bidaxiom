import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 63 — order line cost category; renumber orders as PO/WO<job number>-NN. Idempotent.
 */
console.log("Starting Phase 63 migration (order categories and numbering)...");

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;

for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`ALTER TABLE "${s}".order_lines ADD COLUMN IF NOT EXISTS category TEXT`);
    await client.query(`
      UPDATE "${s}".order_lines ol SET category = CASE
        WHEN pcl.type = 'material' THEN 'COGS: Materials & Supplies'
        WHEN pcl.type = 'equipment' THEN 'COGS: Equipment Rental'
        WHEN pcl.type IN ('labor','subcontractor') THEN 'COGS: Subcontract Labor'
        ELSE NULL END
      FROM "${s}".proposal_cost_lines pcl
      WHERE pcl.id = ol.source_line_id AND ol.category IS NULL
    `);
    // Renumber to PO<job>-01 / WO<job>-01, in creation order per project and kind.
    // Two passes avoid colliding with the UNIQUE (project_id, number) constraint.
    await client.query(`UPDATE "${s}".orders SET number = 'tmp-' || id::text WHERE number !~ '^(PO|WO).+-[0-9]{2}$' OR number ~ '^(PO|WO)-[0-9]+$'`);
    await client.query(`
      UPDATE "${s}".orders o SET number = (CASE WHEN o.kind = 'purchase' THEN 'PO' ELSE 'WO' END)
        || COALESCE(p.job_number, '') || '-' || LPAD(r.rn::text, 2, '0')
      FROM (
        SELECT id, project_id, ROW_NUMBER() OVER (PARTITION BY project_id, kind ORDER BY created_at, id) AS rn FROM "${s}".orders
      ) r JOIN "${s}".projects p ON p.id = r.project_id
      WHERE o.id = r.id AND o.number LIKE 'tmp-%'
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
