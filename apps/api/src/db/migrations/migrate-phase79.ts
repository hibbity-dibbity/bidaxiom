import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

/** Migration: Phase 79 — an admin can require a member to set up a second factor again. */
console.log("Starting Phase 79 migration (require MFA setup flag)...");
try {
  await pool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS require_mfa_setup BOOLEAN NOT NULL DEFAULT FALSE`);
  console.log("Done.");
} catch (e) {
  console.error(e);
  await pool.end();
  process.exit(1);
}
await pool.end();
process.exit(0);
