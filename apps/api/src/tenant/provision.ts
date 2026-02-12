import pg from "pg";

export interface TenantRecord {
  id: string;
  schemaName: string;
  clerkOrgId: string;
  name: string;
  status: string;
}

/**
 * Generate a safe PostgreSQL schema name from a Clerk org ID.
 * Strips the "org_" prefix and sanitizes to lowercase alphanumeric + underscore.
 */
function generateSchemaName(orgId: string): string {
  const base = orgId.replace(/^org_/, "");
  const sanitized = base.toLowerCase().replace(/[^a-z0-9_]/g, "");
  return `tenant_${sanitized}`;
}

/**
 * Hash a string to a 32-bit integer for PostgreSQL advisory locks.
 */
function hashToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Provision a new tenant schema with advisory lock protection.
 *
 * Idempotent: if the tenant already exists, returns the existing record.
 * Uses PostgreSQL advisory locks to prevent race conditions from duplicate
 * webhook deliveries.
 *
 * @param orgId - Clerk organization ID
 * @param orgName - Organization display name
 * @param pool - PostgreSQL connection pool
 * @returns The tenant record (new or existing)
 */
export async function provisionTenantSchema(
  orgId: string,
  orgName: string,
  pool: pg.Pool
): Promise<TenantRecord> {
  const schemaName = generateSchemaName(orgId);
  const lockId = hashToInt(orgId);

  const client = await pool.connect();

  try {
    // Acquire advisory lock to prevent race conditions
    await client.query("SELECT pg_advisory_lock($1)", [lockId]);

    // Check if tenant already exists (idempotent)
    const existing = await client.query(
      'SELECT id, schema_name, clerk_org_id, name, status FROM tenants WHERE clerk_org_id = $1',
      [orgId]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      console.log(`Tenant already exists for org ${orgId}: ${row.schema_name}`);
      return {
        id: row.id,
        schemaName: row.schema_name,
        clerkOrgId: row.clerk_org_id,
        name: row.name,
        status: row.status,
      };
    }

    // Begin provisioning transaction
    await client.query("BEGIN");

    try {
      // Create the PostgreSQL schema
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

      // Create audit_logs table (immutable)
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          action TEXT NOT NULL,
          actor_id TEXT NOT NULL,
          actor_email TEXT,
          changes JSONB NOT NULL DEFAULT '{}',
          ip_address TEXT,
          timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Make audit_logs immutable
      await client.query(
        `REVOKE UPDATE, DELETE ON "${schemaName}".audit_logs FROM PUBLIC`
      );

      // Create user_profiles table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".user_profiles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          clerk_user_id TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL,
          first_name TEXT,
          last_name TEXT,
          role TEXT NOT NULL DEFAULT 'member',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Register tenant in public schema
      const insertResult = await client.query(
        `INSERT INTO tenants (schema_name, clerk_org_id, name, status)
         VALUES ($1, $2, $3, 'active')
         RETURNING id, schema_name, clerk_org_id, name, status`,
        [schemaName, orgId, orgName]
      );

      await client.query("COMMIT");

      const row = insertResult.rows[0];
      console.log(`Provisioned tenant schema "${schemaName}" for org ${orgId}`);

      return {
        id: row.id,
        schemaName: row.schema_name,
        clerkOrgId: row.clerk_org_id,
        name: row.name,
        status: row.status,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } finally {
    // Always release advisory lock
    await client.query("SELECT pg_advisory_unlock($1)", [lockId]).catch(() => {
      // Ignore unlock errors during cleanup
    });
    client.release();
  }
}
