import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Migration: Phase 101 — operator can switch off the authenticator/passkey requirement per company or per person. Idempotent. */
console.log("Starting Phase 101 migration (second factor exemption)...");
await pool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS second_factor_exempt BOOLEAN NOT NULL DEFAULT FALSE`);
await pool.query(`ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS second_factor_exempt BOOLEAN NOT NULL DEFAULT FALSE`);
console.log("Done.");
await pool.end();
