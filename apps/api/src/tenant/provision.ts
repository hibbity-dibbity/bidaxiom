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

      // Create sov_items table (Schedule of Values)
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".sov_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES "${schemaName}".projects(id) ON DELETE CASCADE,
          budget_line_item_id UUID REFERENCES "${schemaName}".budget_line_items(id) ON DELETE SET NULL,
          item_number TEXT NOT NULL,
          description TEXT NOT NULL,
          scheduled_value NUMERIC(15,2) NOT NULL,
          order_index INTEGER NOT NULL DEFAULT 0,
          created_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Index for fast SOV items lookup by project
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sov_items_project
        ON "${schemaName}".sov_items(project_id)
      `);

      // Index for fast SOV items lookup by budget line item
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sov_items_budget
        ON "${schemaName}".sov_items(budget_line_item_id)
      `);

      // Create payment_apps table (AIA G702 summary)
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".payment_apps (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES "${schemaName}".projects(id) ON DELETE CASCADE,
          application_number TEXT NOT NULL,
          period_start TIMESTAMPTZ NOT NULL,
          period_end TIMESTAMPTZ NOT NULL,
          original_contract_sum NUMERIC(15,2) NOT NULL,
          net_change_by_change_orders NUMERIC(15,2) DEFAULT 0,
          contract_sum_to_date NUMERIC(15,2) NOT NULL,
          total_completed_and_stored NUMERIC(15,2) NOT NULL DEFAULT 0,
          retainage_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
          total_earned_less_retainage NUMERIC(15,2) NOT NULL DEFAULT 0,
          previous_payments NUMERIC(15,2) DEFAULT 0,
          current_payment_due NUMERIC(15,2) NOT NULL DEFAULT 0,
          balance_to_finish NUMERIC(15,2) NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'draft',
          submitted_at TIMESTAMPTZ,
          approved_at TIMESTAMPTZ,
          approved_by TEXT,
          paid_at TIMESTAMPTZ,
          created_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Index for fast payment apps lookup by project
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_payment_apps_project
        ON "${schemaName}".payment_apps(project_id)
      `);

      // Index for fast payment apps lookup by status
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_payment_apps_status
        ON "${schemaName}".payment_apps(status)
      `);

      // Create payment_app_line_items table (AIA G703 continuation sheet)
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".payment_app_line_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          payment_app_id UUID NOT NULL REFERENCES "${schemaName}".payment_apps(id) ON DELETE CASCADE,
          sov_item_id UUID NOT NULL REFERENCES "${schemaName}".sov_items(id) ON DELETE RESTRICT,
          previous_percent_complete NUMERIC(5,2) NOT NULL DEFAULT 0,
          current_percent_complete NUMERIC(5,2) NOT NULL,
          work_completed_this_period NUMERIC(15,2) NOT NULL,
          materials_stored_this_period NUMERIC(15,2) NOT NULL DEFAULT 0,
          total_completed_and_stored NUMERIC(15,2) NOT NULL,
          retainage_percent NUMERIC(5,2) NOT NULL,
          retainage_amount NUMERIC(15,2) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Index for fast payment app line items lookup by payment app
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_payment_app_line_items_app
        ON "${schemaName}".payment_app_line_items(payment_app_id)
      `);

      // Index for fast payment app line items lookup by SOV item
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_payment_app_line_items_sov
        ON "${schemaName}".payment_app_line_items(sov_item_id)
      `);

      // Create payment_app_counters table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".payment_app_counters (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES "${schemaName}".projects(id) ON DELETE CASCADE,
          year INTEGER NOT NULL,
          last_number INTEGER NOT NULL DEFAULT 0
        )
      `);

      // Index for fast counter lookup by project and year
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_payment_app_counters_lookup
        ON "${schemaName}".payment_app_counters(project_id, year)
      `);

      // Create retainage_held table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".retainage_held (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES "${schemaName}".projects(id) ON DELETE CASCADE,
          payment_app_id UUID NOT NULL REFERENCES "${schemaName}".payment_apps(id) ON DELETE CASCADE,
          amount_held NUMERIC(15,2) NOT NULL,
          retainage_rate NUMERIC(5,2) NOT NULL,
          status TEXT NOT NULL DEFAULT 'held',
          released_amount NUMERIC(15,2) DEFAULT 0,
          released_at TIMESTAMPTZ,
          released_by TEXT,
          release_notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Index for fast retainage held lookup by project
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_retainage_held_project
        ON "${schemaName}".retainage_held(project_id)
      `);

      // Index for fast retainage held lookup by payment app
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_retainage_held_app
        ON "${schemaName}".retainage_held(payment_app_id)
      `);

      // Create lien_waivers table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".lien_waivers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES "${schemaName}".projects(id) ON DELETE CASCADE,
          payment_app_id UUID NOT NULL REFERENCES "${schemaName}".payment_apps(id) ON DELETE CASCADE,
          waiver_type TEXT NOT NULL,
          party_name TEXT NOT NULL,
          party_type TEXT NOT NULL,
          through_date TIMESTAMPTZ NOT NULL,
          amount_waived NUMERIC(15,2) NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          received_at TIMESTAMPTZ,
          received_by TEXT,
          requires_notarization BOOLEAN NOT NULL DEFAULT false,
          is_notarized BOOLEAN NOT NULL DEFAULT false,
          uses_statutory_form BOOLEAN NOT NULL DEFAULT false,
          document_id UUID REFERENCES "${schemaName}".documents(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Index for fast lien waivers lookup by project
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_lien_waivers_project
        ON "${schemaName}".lien_waivers(project_id)
      `);

      // Index for fast lien waivers lookup by payment app
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_lien_waivers_app
        ON "${schemaName}".lien_waivers(payment_app_id)
      `);

      // Create payment_app_approval_steps table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".payment_app_approval_steps (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          payment_app_id UUID NOT NULL REFERENCES "${schemaName}".payment_apps(id) ON DELETE CASCADE,
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

      // Index for fast payment app approval steps lookup
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_payment_app_approval_steps_app
        ON "${schemaName}".payment_app_approval_steps(payment_app_id)
      `);

      // Create subcontractor_directory table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".subcontractor_directory (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_name TEXT NOT NULL,
          contact_name TEXT,
          contact_email TEXT,
          contact_phone TEXT,
          address TEXT,
          trades JSONB NOT NULL DEFAULT '[]'::jsonb,
          notes TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          created_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Index for fast subcontractor directory lookup by status
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_subcontractor_directory_status
        ON "${schemaName}".subcontractor_directory(status)
      `);

      // Create rfqs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".rfqs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES "${schemaName}".projects(id) ON DELETE CASCADE,
          rfq_number TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          scope_of_work TEXT NOT NULL,
          trades JSONB NOT NULL DEFAULT '[]'::jsonb,
          due_date TIMESTAMPTZ NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          issued_at TIMESTAMPTZ,
          issued_by TEXT,
          closed_at TIMESTAMPTZ,
          attachment_ids JSONB DEFAULT '[]'::jsonb,
          created_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Index for fast RFQ lookup by project
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_rfqs_project
        ON "${schemaName}".rfqs(project_id)
      `);

      // Index for fast RFQ lookup by status
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_rfqs_status
        ON "${schemaName}".rfqs(status)
      `);

      // Create rfq_amendments table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".rfq_amendments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          rfq_id UUID NOT NULL REFERENCES "${schemaName}".rfqs(id) ON DELETE CASCADE,
          amendment_number INTEGER NOT NULL,
          description TEXT NOT NULL,
          scope_changes TEXT,
          due_date_change TIMESTAMPTZ,
          created_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Index for fast RFQ amendments lookup
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_rfq_amendments_rfq
        ON "${schemaName}".rfq_amendments(rfq_id)
      `);

      // Create rfq_invitations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".rfq_invitations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          rfq_id UUID NOT NULL REFERENCES "${schemaName}".rfqs(id) ON DELETE CASCADE,
          subcontractor_id UUID REFERENCES "${schemaName}".subcontractor_directory(id) ON DELETE SET NULL,
          external_email TEXT,
          external_company_name TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          sent_at TIMESTAMPTZ,
          viewed_at TIMESTAMPTZ,
          responded_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Index for fast RFQ invitations lookup
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_rfq_invitations_rfq
        ON "${schemaName}".rfq_invitations(rfq_id)
      `);

      // Create bids table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".bids (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          rfq_id UUID NOT NULL REFERENCES "${schemaName}".rfqs(id) ON DELETE CASCADE,
          invitation_id UUID REFERENCES "${schemaName}".rfq_invitations(id) ON DELETE SET NULL,
          subcontractor_id UUID REFERENCES "${schemaName}".subcontractor_directory(id) ON DELETE SET NULL,
          bidder_company_name TEXT NOT NULL,
          bidder_contact_email TEXT,
          current_version_id UUID,
          status TEXT NOT NULL DEFAULT 'submitted',
          submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          awarded_at TIMESTAMPTZ,
          awarded_by TEXT,
          commitment_id TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Index for fast bids lookup by RFQ
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_bids_rfq
        ON "${schemaName}".bids(rfq_id)
      `);

      // Create bid_versions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".bid_versions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          bid_id UUID NOT NULL REFERENCES "${schemaName}".bids(id) ON DELETE CASCADE,
          version_number INTEGER NOT NULL,
          total_amount NUMERIC(15,2) NOT NULL,
          line_items JSONB NOT NULL,
          scope_notes TEXT,
          exclusions TEXT,
          inclusions TEXT,
          valid_until TIMESTAMPTZ,
          submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          trigger_amendment_id UUID REFERENCES "${schemaName}".rfq_amendments(id) ON DELETE SET NULL
        )
      `);

      // Index for fast bid versions lookup
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_bid_versions_bid
        ON "${schemaName}".bid_versions(bid_id)
      `);

      // Create bid_leveling_notes table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".bid_leveling_notes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          rfq_id UUID NOT NULL REFERENCES "${schemaName}".rfqs(id) ON DELETE CASCADE,
          bid_id UUID NOT NULL REFERENCES "${schemaName}".bids(id) ON DELETE CASCADE,
          category TEXT NOT NULL,
          note TEXT NOT NULL,
          adjustment_amount NUMERIC(15,2),
          created_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Index for fast bid leveling notes lookup by RFQ
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_bid_leveling_notes_rfq
        ON "${schemaName}".bid_leveling_notes(rfq_id)
      `);

      // Create qbo_connections table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".qbo_connections (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          realm_id TEXT NOT NULL,
          environment TEXT NOT NULL,
          access_token TEXT,
          encrypted_refresh_token TEXT NOT NULL,
          token_expires_at TIMESTAMPTZ NOT NULL,
          refresh_token_expires_at TIMESTAMPTZ NOT NULL,
          company_name TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          last_sync_at TIMESTAMPTZ,
          error_message TEXT,
          connected_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Index for webhook lookup by realmId
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_qbo_connections_realm
        ON "${schemaName}".qbo_connections(realm_id)
      `);

      // Create qbo_sync_state table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".qbo_sync_state (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          entity_type TEXT NOT NULL,
          last_successful_sync TIMESTAMPTZ,
          last_cdc_sync TIMESTAMPTZ,
          sync_status TEXT NOT NULL DEFAULT 'pending',
          error_message TEXT,
          synced_count INTEGER NOT NULL DEFAULT 0,
          error_count INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // Create qbo_entity_mappings table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".qbo_entity_mappings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          entity_type TEXT NOT NULL,
          platform_id UUID NOT NULL,
          qbo_id TEXT NOT NULL,
          qbo_sync_token TEXT,
          direction TEXT NOT NULL DEFAULT 'bidirectional',
          last_synced_at TIMESTAMPTZ,
          sync_status TEXT NOT NULL DEFAULT 'synced',
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(entity_type, platform_id),
          UNIQUE(entity_type, qbo_id)
        )
      `);

      // Index for forward mapping (platform -> QBO)
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_qbo_entity_mappings_platform
        ON "${schemaName}".qbo_entity_mappings(entity_type, platform_id)
      `);

      // Index for reverse mapping (QBO -> platform)
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_qbo_entity_mappings_qbo
        ON "${schemaName}".qbo_entity_mappings(entity_type, qbo_id)
      `);

      // Create qbo_sync_notifications table
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".qbo_sync_notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          entity_type TEXT NOT NULL,
          entity_id TEXT,
          message TEXT NOT NULL,
          severity TEXT NOT NULL DEFAULT 'error',
          dismissed BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
