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

      // Create company_profiles table with effective dating
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".company_profiles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_type TEXT NOT NULL,
          trades_config JSONB NOT NULL DEFAULT '{"csiDivisions":[],"customTrades":[]}'::jsonb,
          valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          valid_to TIMESTAMPTZ,
          created_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Index for fast current-version lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_company_profiles_current
        ON "${schemaName}".company_profiles(valid_to)
        WHERE valid_to IS NULL
      `);

      // Create customers table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".customers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_name TEXT,
          contact_name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          address TEXT,
          created_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Create projects table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          job_number TEXT,
          customer_id UUID NOT NULL REFERENCES "${schemaName}".customers(id) ON DELETE RESTRICT,
          description TEXT,
          location TEXT,
          project_type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          start_date TIMESTAMPTZ,
          end_date TIMESTAMPTZ,
          budget NUMERIC(15, 2),
          cost_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Index for fast active projects lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_projects_status
        ON "${schemaName}".projects(status)
        WHERE status = 'active'
      `);

      // Create project_team_members table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".project_team_members (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES "${schemaName}".projects(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL,
          role TEXT NOT NULL,
          assigned_by TEXT NOT NULL,
          assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(project_id, user_id)
        )
      `);

      // Index for fast team membership lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_project_team_userId
        ON "${schemaName}".project_team_members(user_id)
      `);

      // Create project_phases table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".project_phases (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES "${schemaName}".projects(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          order_index INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          start_date TIMESTAMPTZ,
          end_date TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Create folders table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".folders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES "${schemaName}".projects(id) ON DELETE CASCADE,
          parent_id UUID,
          name TEXT NOT NULL,
          description TEXT,
          order_index INTEGER NOT NULL DEFAULT 0,
          created_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Create documents table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES "${schemaName}".projects(id) ON DELETE CASCADE,
          folder_id UUID REFERENCES "${schemaName}".folders(id) ON DELETE SET NULL,
          name TEXT NOT NULL,
          current_version_id UUID,
          file_size INTEGER,
          content_type TEXT,
          created_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Index for fast document listing by project and folder
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_documents_project_folder
        ON "${schemaName}".documents(project_id, folder_id)
      `);

      // Create document_versions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".document_versions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          document_id UUID NOT NULL REFERENCES "${schemaName}".documents(id) ON DELETE CASCADE,
          version_number INTEGER NOT NULL,
          storage_key TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          content_type TEXT NOT NULL,
          uploaded_by TEXT NOT NULL,
          uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          change_notes TEXT
        )
      `);

      // Create budget_line_items table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".budget_line_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES "${schemaName}".projects(id) ON DELETE CASCADE,
          cost_code_id INTEGER NOT NULL,
          description TEXT NOT NULL,
          budgeted_amount NUMERIC(15,2) NOT NULL,
          is_locked BOOLEAN NOT NULL DEFAULT false,
          locked_at TIMESTAMPTZ,
          locked_by TEXT,
          created_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Index for fast budget line items lookup by project
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_budget_line_items_project
        ON "${schemaName}".budget_line_items(project_id)
      `);

      // Create commitments table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".commitments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES "${schemaName}".projects(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          vendor_name TEXT NOT NULL,
          contract_number TEXT,
          description TEXT,
          total_amount NUMERIC(15,2) NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          executed_at TIMESTAMPTZ,
          approved_by TEXT,
          approved_at TIMESTAMPTZ,
          created_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Index for fast commitments lookup by project
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_commitments_project
        ON "${schemaName}".commitments(project_id)
      `);

      // Create commitment_line_items table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".commitment_line_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          commitment_id UUID NOT NULL REFERENCES "${schemaName}".commitments(id) ON DELETE CASCADE,
          budget_line_item_id UUID REFERENCES "${schemaName}".budget_line_items(id) ON DELETE SET NULL,
          cost_code_id INTEGER NOT NULL,
          description TEXT NOT NULL,
          amount NUMERIC(15,2) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Index for fast commitment line items lookup
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_commitment_line_items_commitment
        ON "${schemaName}".commitment_line_items(commitment_id)
      `);

      // Index for fast budget line item cross-reference
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_commitment_line_items_budget
        ON "${schemaName}".commitment_line_items(budget_line_item_id)
      `);

      // Create change_orders table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".change_orders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES "${schemaName}".projects(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          pco_number TEXT,
          co_number TEXT,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          reason TEXT,
          commitment_id UUID REFERENCES "${schemaName}".commitments(id) ON DELETE SET NULL,
          requested_by TEXT,
          total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
          related_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
          submitted_at TIMESTAMPTZ,
          submitted_by TEXT,
          approved_at TIMESTAMPTZ,
          approved_by TEXT,
          rejected_at TIMESTAMPTZ,
          rejected_by TEXT,
          rejection_reason TEXT,
          created_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Index for fast change orders lookup by project
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_change_orders_project
        ON "${schemaName}".change_orders(project_id)
      `);

      // Index for fast change orders lookup by status
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_change_orders_status
        ON "${schemaName}".change_orders(status)
      `);

      // Create change_order_line_items table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".change_order_line_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          change_order_id UUID NOT NULL REFERENCES "${schemaName}".change_orders(id) ON DELETE CASCADE,
          budget_line_item_id UUID REFERENCES "${schemaName}".budget_line_items(id) ON DELETE SET NULL,
          cost_code_id INTEGER NOT NULL,
          description TEXT NOT NULL,
          amount_change NUMERIC(15,2) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Index for fast change order line items lookup
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_change_order_line_items_co
        ON "${schemaName}".change_order_line_items(change_order_id)
      `);

      // Index for fast budget line item cross-reference
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_change_order_line_items_budget
        ON "${schemaName}".change_order_line_items(budget_line_item_id)
      `);

      // Create change_order_counters table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".change_order_counters (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES "${schemaName}".projects(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          year INTEGER NOT NULL,
          last_number INTEGER NOT NULL DEFAULT 0
        )
      `);

      // Index for fast counter lookup by project, type, and year
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_change_order_counters_lookup
        ON "${schemaName}".change_order_counters(project_id, type, year)
      `);

      // Create approval_workflow_steps table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".approval_workflow_steps (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          change_order_id UUID NOT NULL REFERENCES "${schemaName}".change_orders(id) ON DELETE CASCADE,
          step_order INTEGER NOT NULL,
          approver_role TEXT,
          approver_user_id TEXT,
          requirement_type TEXT NOT NULL DEFAULT 'all',
          status TEXT NOT NULL DEFAULT 'pending',
          approved_by TEXT,
          approved_at TIMESTAMPTZ,
          comments TEXT
        )
      `);

      // Index for fast approval steps lookup
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_approval_steps_co
        ON "${schemaName}".approval_workflow_steps(change_order_id)
      `);

      // Create change_order_history table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".change_order_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          change_order_id UUID NOT NULL REFERENCES "${schemaName}".change_orders(id) ON DELETE CASCADE,
          revision_number INTEGER NOT NULL,
          changed_by TEXT NOT NULL,
          changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          change_type TEXT NOT NULL,
          field_name TEXT,
          old_value JSONB,
          new_value JSONB,
          comments TEXT
        )
      `);

      // Index for fast change order history lookup
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_change_order_history_co
        ON "${schemaName}".change_order_history(change_order_id)
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
