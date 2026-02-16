import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Migration: Add estimates and related tables for Phase 17
 * Phase: 17-estimating-workflow-setup-core
 * Purpose: Create estimates, estimate_line_items, cost_code_templates, template_line_items, labor_rate_templates, estimate_versions, and sov_versions tables
 */

console.log("Starting Phase 17 migration (Estimates)...");
console.log("Adding estimates and related tables to all tenant schemas");
console.log("---");

// Get all active tenant schemas
const tenants = await pool.query(
  "SELECT schema_name FROM tenants WHERE status = 'active'"
);

let successCount = 0;
let failureCount = 0;
const failures: Array<{ schema: string; error: string }> = [];

for (const row of tenants.rows) {
  const schemaName = row.schema_name;
  console.log(`\nMigrating schema: ${schemaName}`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Create estimates table
    console.log(`  - Creating estimates table...`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".estimates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES "${schemaName}".projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        project_type TEXT NOT NULL,
        applied_cost_code_template_id UUID,
        applied_labor_rate_template_id UUID,
        overhead_type TEXT NOT NULL DEFAULT 'percentage',
        overhead_value NUMERIC(15,2) NOT NULL DEFAULT 0,
        markup_base TEXT NOT NULL DEFAULT 'direct',
        direct_costs NUMERIC(15,2) NOT NULL DEFAULT 0,
        overhead_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
        markup_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
        total_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
        current_version INTEGER NOT NULL DEFAULT 1,
        submitted_at TIMESTAMPTZ,
        accepted_at TIMESTAMPTZ,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_estimates_project
      ON "${schemaName}".estimates(project_id)
    `);

    // Create estimate_line_items table
    console.log(`  - Creating estimate_line_items table...`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".estimate_line_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        estimate_id UUID NOT NULL REFERENCES "${schemaName}".estimates(id) ON DELETE CASCADE,
        cost_code_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        quantity NUMERIC(15,4) NOT NULL,
        unit TEXT NOT NULL,
        unit_cost NUMERIC(15,4) NOT NULL,
        cost_type TEXT NOT NULL,
        custom_markup_percent NUMERIC(5,2),
        source_template_id UUID,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_estimate_line_items_estimate
      ON "${schemaName}".estimate_line_items(estimate_id)
    `);

    // Create cost_code_templates table
    console.log(`  - Creating cost_code_templates table...`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".cost_code_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        scope TEXT NOT NULL,
        project_type TEXT,
        created_by TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cost_code_templates_active
      ON "${schemaName}".cost_code_templates(is_active)
      WHERE is_active = true
    `);

    // Create template_line_items table
    console.log(`  - Creating template_line_items table...`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".template_line_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID NOT NULL REFERENCES "${schemaName}".cost_code_templates(id) ON DELETE CASCADE,
        cost_code_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        quantity NUMERIC(15,4),
        unit TEXT,
        estimated_unit_cost NUMERIC(15,4),
        cost_type TEXT NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_template_line_items_template
      ON "${schemaName}".template_line_items(template_id)
    `);

    // Create labor_rate_templates table
    console.log(`  - Creating labor_rate_templates table...`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".labor_rate_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        scope TEXT NOT NULL,
        rates JSONB NOT NULL,
        created_by TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_labor_rate_templates_active
      ON "${schemaName}".labor_rate_templates(is_active)
      WHERE is_active = true
    `);

    // Create estimate_versions table
    console.log(`  - Creating estimate_versions table...`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".estimate_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        estimate_id UUID NOT NULL REFERENCES "${schemaName}".estimates(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        status TEXT NOT NULL,
        snapshot JSONB NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_estimate_versions_estimate
      ON "${schemaName}".estimate_versions(estimate_id)
    `);

    // Create sov_versions table
    console.log(`  - Creating sov_versions table...`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".sov_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sov_id UUID NOT NULL,
        estimate_version_id UUID REFERENCES "${schemaName}".estimate_versions(id) ON DELETE SET NULL,
        version INTEGER NOT NULL,
        status TEXT NOT NULL,
        line_items JSONB NOT NULL,
        created_from_change_order UUID REFERENCES "${schemaName}".change_orders(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sov_versions_sov
      ON "${schemaName}".sov_versions(sov_id)
    `);

    await client.query("COMMIT");
    console.log(`  ✓ Migration successful for ${schemaName}`);
    successCount++;
  } catch (error) {
    await client.query("ROLLBACK");
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  ✗ Migration failed for ${schemaName}: ${errorMessage}`);
    failures.push({ schema: schemaName, error: errorMessage });
    failureCount++;
  } finally {
    client.release();
  }
}

console.log("\n---");
console.log("Migration Summary:");
console.log(`  Total tenants: ${tenants.rows.length}`);
console.log(`  Successful: ${successCount}`);
console.log(`  Failed: ${failureCount}`);

if (failures.length > 0) {
  console.log("\nFailed migrations:");
  failures.forEach(({ schema, error }) => {
    console.log(`  - ${schema}: ${error}`);
  });
}

await pool.end();

process.exit(failureCount > 0 ? 1 : 0);
