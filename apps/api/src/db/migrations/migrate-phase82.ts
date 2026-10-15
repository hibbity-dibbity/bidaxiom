import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Migration: Phase 82 — company countersignature applied automatically when a customer signs. Idempotent. */
console.log("Starting Phase 82 migration (company signature)...");

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;
for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${s}".company_signature (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        signer_name TEXT NOT NULL,
        signer_title TEXT,
        signature_type TEXT NOT NULL,
        signature_image TEXT,
        authorized_by TEXT NOT NULL,
        authorized_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    for (const col of ["company_signer_name", "company_signer_title", "company_signature_type", "company_signature_image"]) {
      await client.query(`ALTER TABLE "${s}".proposal_signatures ADD COLUMN IF NOT EXISTS ${col} TEXT`);
    }
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
