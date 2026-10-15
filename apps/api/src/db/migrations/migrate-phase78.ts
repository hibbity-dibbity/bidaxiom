import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

/** Migration: Phase 78 — passkeys (WebAuthn credentials). */
console.log("Starting Phase 78 migration (passkeys)...");
try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.passkeys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      credential_id TEXT NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      alg INTEGER NOT NULL,
      counter BIGINT NOT NULL DEFAULT 0,
      transports JSONB NOT NULL DEFAULT '[]',
      backed_up BOOLEAN NOT NULL DEFAULT FALSE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_passkeys_user ON public.passkeys(user_id)`);
  console.log("Done.");
} catch (e) {
  console.error(e);
  await pool.end();
  process.exit(1);
}
await pool.end();
process.exit(0);
