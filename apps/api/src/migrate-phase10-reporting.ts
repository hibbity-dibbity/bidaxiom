import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local from project root (two levels up from apps/api)
config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

import { pool } from './db/client.js';

/**
 * Migration script for Phase 10: Reporting & Analytics
 *
 * Drops and recreates reporting tables in existing tenant schemas to match Drizzle schema:
 * - report_definitions
 * - report_templates
 * - report_schedules
 * - materialized_report_data
 *
 * IMPORTANT: This drops old tables with mismatched columns and recreates them.
 * Any existing report data will be lost (acceptable for Phase 10 which was just added).
 */

async function migratePhase10Reporting() {
  console.log('Starting Phase 10 (Reporting) migration...');
  console.log('WARNING: This will DROP existing report tables and recreate them.');

  // Get all active tenants
  const result = await pool.query(
    "SELECT schema_name FROM tenants WHERE status = 'active'"
  );

  console.log(`Found ${result.rows.length} active tenant(s)`);

  for (const row of result.rows) {
    const schemaName = row.schema_name;
    console.log(`\nMigrating tenant: ${schemaName}`);

    try {
      // Drop old tables (CASCADE handles FK dependencies)
      console.log('  Dropping old tables...');
      await pool.query(`DROP TABLE IF EXISTS "${schemaName}".materialized_report_data CASCADE`);
      await pool.query(`DROP TABLE IF EXISTS "${schemaName}".report_schedules CASCADE`);
      await pool.query(`DROP TABLE IF EXISTS "${schemaName}".report_templates CASCADE`);
      await pool.query(`DROP TABLE IF EXISTS "${schemaName}".report_definitions CASCADE`);
      console.log('  ✓ Dropped old tables');

      // Recreate report_definitions (matching Drizzle schema and provision.ts lines 1260-1277)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".report_definitions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          description TEXT,
          type TEXT NOT NULL,
          data_source TEXT NOT NULL,
          filters JSONB NOT NULL DEFAULT '[]'::jsonb,
          columns JSONB NOT NULL,
          sort_by JSONB,
          group_by TEXT,
          chart_config JSONB,
          status TEXT NOT NULL DEFAULT 'active',
          created_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      console.log('  ✓ Created report_definitions table');

      // Index for fast report type lookups
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_report_definitions_type
        ON "${schemaName}".report_definitions(type)
      `);

      // Index for fast active report lookups
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_report_definitions_status
        ON "${schemaName}".report_definitions(status)
      `);
      console.log('  ✓ Created indexes on report_definitions');

      // Recreate report_templates (matching Drizzle schema and provision.ts lines 1292-1303)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".report_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          description TEXT,
          type TEXT NOT NULL,
          is_system BOOLEAN NOT NULL DEFAULT false,
          definition JSONB NOT NULL,
          preview_image_url TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      console.log('  ✓ Created report_templates table');

      // Recreate report_schedules (matching Drizzle schema and provision.ts lines 1306-1324)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".report_schedules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          report_definition_id UUID NOT NULL REFERENCES "${schemaName}".report_definitions(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          frequency TEXT NOT NULL,
          day_of_week INTEGER,
          day_of_month INTEGER,
          time TEXT NOT NULL,
          recipients JSONB NOT NULL,
          format TEXT NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT true,
          last_run_at TIMESTAMPTZ,
          next_run_at TIMESTAMPTZ,
          created_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      console.log('  ✓ Created report_schedules table');

      // Index for fast scheduled report lookups (only active schedules)
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run
        ON "${schemaName}".report_schedules(next_run_at)
        WHERE is_active = true
      `);
      console.log('  ✓ Created index on report_schedules');

      // Recreate materialized_report_data (matching Drizzle schema and provision.ts lines 1334-1342)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".materialized_report_data (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          report_definition_id UUID NOT NULL REFERENCES "${schemaName}".report_definitions(id) ON DELETE CASCADE,
          data JSONB NOT NULL,
          generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL
        )
      `);
      console.log('  ✓ Created materialized_report_data table');

      // Index for fast cache expiry cleanup
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_materialized_report_data_expires
        ON "${schemaName}".materialized_report_data(expires_at)
      `);
      console.log('  ✓ Created index on materialized_report_data');

      console.log(`✓ Completed migration for ${schemaName}`);
    } catch (err) {
      console.error(`✗ Failed to migrate ${schemaName}:`, err);
      throw err; // Stop on first error
    }
  }

  console.log('\n✓ Phase 10 migration complete!');
  console.log('All reporting tables have been recreated to match Drizzle schema.');
}

migratePhase10Reporting()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n✗ Migration failed:', err);
    pool.end();
    process.exit(1);
  });
