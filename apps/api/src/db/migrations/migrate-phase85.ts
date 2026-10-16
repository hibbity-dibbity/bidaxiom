import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Phase 85 — company recycle bin (organizations.deleted_at) and one company per account
 * (unique membership per user). Idempotent.
 */
console.log("Starting Phase 85 migration (recycle bin, one company per account)...");
await pool.query(`ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
try {
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_org_memberships_one_company ON public.organization_memberships(user_id)`);
} catch (err) {
  console.warn("Could not enforce one company per account (some accounts already belong to several). Skipped:", (err as Error).message);
}
console.log("Phase 85 migration complete.");
await pool.end();
