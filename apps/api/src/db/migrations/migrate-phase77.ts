import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

/** Migration: Phase 77 — domains are proven by an emailed code instead of a DNS record. */
console.log("Starting Phase 77 migration (SSO domain email codes)...");
try {
  await pool.query(`ALTER TABLE public.sso_domains ADD COLUMN IF NOT EXISTS code_hash TEXT`);
  await pool.query(`ALTER TABLE public.sso_domains ADD COLUMN IF NOT EXISTS code_expires_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE public.sso_domains ADD COLUMN IF NOT EXISTS code_attempts INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE public.sso_domains ALTER COLUMN token DROP NOT NULL`);
  console.log("Done.");
} catch (e) {
  console.error(e);
  await pool.end();
  process.exit(1);
}
await pool.end();
process.exit(0);
