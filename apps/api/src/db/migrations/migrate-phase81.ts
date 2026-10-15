import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 81 — takeoff links on proposals (purchase orders follow the accepted proposal) and
 * customer e-signature (signing links in the public schema, signatures per company). Idempotent.
 */
console.log("Starting Phase 81 migration (takeoff links, e-signature)...");

await pool.query(`
  CREATE TABLE IF NOT EXISTS public.signing_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL,
    estimate_id UUID NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    recipient_email TEXT,
    recipient_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    viewed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
await pool.query(`CREATE INDEX IF NOT EXISTS idx_signing_links_estimate ON public.signing_links(estimate_id)`);

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let ok = 0;
let failed = 0;

for (const row of tenants.rows) {
  const s = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${s}".proposal_takeoff_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        estimate_id UUID NOT NULL REFERENCES "${s}".estimates(id) ON DELETE CASCADE,
        line_id UUID NOT NULL,
        takeoff_id UUID NOT NULL,
        mode TEXT NOT NULL,
        snapshot JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await client.query(`CREATE INDEX IF NOT EXISTS proposal_takeoff_links_estimate_idx ON "${s}".proposal_takeoff_links(estimate_id)`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${s}".proposal_signatures (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        estimate_id UUID NOT NULL REFERENCES "${s}".estimates(id) ON DELETE CASCADE,
        outcome TEXT NOT NULL,
        signer_name TEXT NOT NULL,
        signer_email TEXT,
        signature_type TEXT,
        signature_image TEXT,
        accepted_option_ids JSONB NOT NULL DEFAULT '[]',
        contract_value_cents NUMERIC(18,0),
        document_hash TEXT,
        terms_version INTEGER,
        ip TEXT,
        user_agent TEXT,
        decline_reason TEXT,
        pdf_document_id UUID,
        signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await client.query(`CREATE INDEX IF NOT EXISTS proposal_signatures_estimate_idx ON "${s}".proposal_signatures(estimate_id)`);
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
