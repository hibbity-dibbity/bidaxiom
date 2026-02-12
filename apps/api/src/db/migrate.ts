import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

// Load .env.local from project root
config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;

/**
 * Run public schema migrations.
 * Creates the tenants and user_company_mappings tables.
 * Safe to run multiple times (IF NOT EXISTS).
 */
async function migratePublicSchema(pool: pg.Pool): Promise<void> {
  console.log("Migrating public schema...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      schema_name TEXT UNIQUE NOT NULL,
      clerk_org_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_company_mappings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clerk_user_id TEXT NOT NULL,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_ucm_clerk_user_id
    ON user_company_mappings(clerk_user_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_ucm_tenant_id
    ON user_company_mappings(tenant_id);
  `);

  console.log("Public schema migration complete.");
}

/**
 * Create tenant-specific tables within a given schema.
 * Used during tenant provisioning (Plan 03).
 *
 * @param pool - Database connection pool
 * @param schemaName - The tenant's PostgreSQL schema name
 */
export async function migrateTenantSchema(
  pool: pg.Pool,
  schemaName: string
): Promise<void> {
  // Sanitize schema name to prevent SQL injection
  const safeName = schemaName.replace(/[^a-z0-9_]/gi, "");
  if (safeName !== schemaName) {
    throw new Error(`Invalid schema name: ${schemaName}`);
  }

  console.log(`Migrating tenant schema: ${schemaName}...`);

  // Create schema
  await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);

  // Create audit_logs table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_email TEXT,
      changes JSONB NOT NULL,
      ip_address TEXT,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Make audit_logs immutable - revoke UPDATE and DELETE
  await pool.query(`
    REVOKE UPDATE, DELETE ON "${schemaName}".audit_logs FROM PUBLIC;
  `);

  // Create user_profiles table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".user_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clerk_user_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Create company_profiles table with effective dating
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".company_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_type TEXT NOT NULL,
      trades_config JSONB NOT NULL DEFAULT '{"csiDivisions":[],"customTrades":[]}'::jsonb,
      valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      valid_to TIMESTAMPTZ,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Index for fast current-version lookups
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_company_profiles_current
    ON "${schemaName}".company_profiles(valid_to)
    WHERE valid_to IS NULL;
  `);

  console.log(`Tenant schema ${schemaName} migration complete.`);
}

/**
 * Main migration entry point.
 * Run with: npx tsx apps/api/src/db/migrate.ts
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await migratePublicSchema(pool);
    console.log("All migrations complete.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if executed directly
main();
