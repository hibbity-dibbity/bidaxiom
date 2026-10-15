import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

/** Migration: Phase 74 — single sign-on (OIDC) connections and identities. Public schema. Idempotent. */
console.log("Starting Phase 74 migration (SSO)...");
try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.sso_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      tenant_ref TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      enforce_sso BOOLEAN NOT NULL DEFAULT FALSE,
      auto_provision BOOLEAN NOT NULL DEFAULT FALSE,
      default_role TEXT NOT NULL DEFAULT 'org:member',
      allowed_domains JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (provider, tenant_ref),
      UNIQUE (organization_id, provider)
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.sso_identities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      tenant_ref TEXT NOT NULL,
      subject TEXT NOT NULL,
      email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (provider, tenant_ref, subject)
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
