import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 76 — single sign-on is routed by the email address's domain. A company claims
 * domains and proves ownership with a DNS TXT record. Replaces the unverified allowed-domains list.
 */
console.log("Starting Phase 76 migration (SSO domains)...");
try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.sso_domains (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      connection_id UUID NOT NULL REFERENCES public.sso_connections(id) ON DELETE CASCADE,
      domain TEXT NOT NULL,
      token TEXT NOT NULL,
      verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (connection_id, domain)
    )`);
  // One company per verified domain.
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS sso_domains_verified_unique ON public.sso_domains(domain) WHERE verified_at IS NOT NULL`);
  await pool.query(`ALTER TABLE public.sso_connections DROP COLUMN IF EXISTS allowed_domains`);
  console.log("Done.");
} catch (e) {
  console.error(e);
  await pool.end();
  process.exit(1);
}
await pool.end();
process.exit(0);
