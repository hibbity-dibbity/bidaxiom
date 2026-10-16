import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Migration: Phase 84 — operator can disable a company (organizations.disabled_at). Idempotent. */
console.log("Starting Phase 84 migration (disable companies)...");
await pool.query(`ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ`);
console.log("Phase 84 migration complete.");
await pool.end();
