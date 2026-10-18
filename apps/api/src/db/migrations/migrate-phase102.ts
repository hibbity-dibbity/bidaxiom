import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Migration: Phase 102 — free trials. A company with trial_ends_at is switched off automatically when that time passes. Idempotent. */
console.log("Starting Phase 102 migration (free trials)...");
await pool.query(`ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ`);
await pool.query(`ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS trial_warned_at TIMESTAMPTZ`);
console.log("Done.");
await pool.end();
