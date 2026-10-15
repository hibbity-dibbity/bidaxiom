import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 75 — single sign-on moves to one OpenID Connect app registration per company
 * (issuer, client id, encrypted secret) instead of one shared registration. Nothing could have been
 * connected under the shared design, so the tables are rebuilt. Idempotent.
 */
console.log("Starting Phase 75 migration (per-company SSO)...");
try {
  const col = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sso_connections' AND column_name='issuer'`);
  if (col.rowCount === 0) {
    await pool.query(`DROP TABLE IF EXISTS public.sso_identities`);
    await pool.query(`DROP TABLE IF EXISTS public.sso_connections`);
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.sso_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      issuer TEXT NOT NULL,
      client_id TEXT NOT NULL,
      client_secret_enc TEXT NOT NULL,
      verified BOOLEAN NOT NULL DEFAULT FALSE,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      enforce_sso BOOLEAN NOT NULL DEFAULT FALSE,
      auto_provision BOOLEAN NOT NULL DEFAULT FALSE,
      default_role TEXT NOT NULL DEFAULT 'org:member',
      allowed_domains JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.sso_identities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      connection_id UUID NOT NULL REFERENCES public.sso_connections(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (connection_id, subject)
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sso_identities_user ON public.sso_identities(user_id)`);
  console.log("Done.");
} catch (e) {
  console.error(e);
  await pool.end();
  process.exit(1);
}
await pool.end();
process.exit(0);
