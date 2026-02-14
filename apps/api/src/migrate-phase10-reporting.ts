import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local from project root (two levels up from apps/api)
config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

import { pool } from './db/client.js';

/**
 * Migration script for Phase 10: Reporting & Analytics
 *
 * Adds reporting tables to existing tenant schemas:
 * - report_definitions
 * - report_templates
 * - report_schedules
 * - materialized_report_data
 */

async function migratePhase10Reporting() {
  console.log('Starting Phase 10 (Reporting) migration...');

  // Get all active tenants
  const result = await pool.query(
    "SELECT schema_name FROM tenants WHERE status = 'active'"
  );

  console.log(`Found ${result.rows.length} active tenant(s)`);

  for (const row of result.rows) {
    const schemaName = row.schema_name;
    console.log(`\nMigrating tenant: ${schemaName}`);

    try {
      // 1. report_definitions table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".report_definitions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          description TEXT,
          type TEXT NOT NULL,
          data_source TEXT NOT NULL,
          definition JSONB NOT NULL,
          owner_id TEXT NOT NULL,
          is_favorite BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      console.log('  ✓ Created report_definitions table');

      // 2. report_templates table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".report_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          description TEXT,
          type TEXT NOT NULL,
          is_system BOOLEAN NOT NULL DEFAULT false,
          definition JSONB NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      console.log('  ✓ Created report_templates table');

      // 3. report_schedules table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".report_schedules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          report_id UUID NOT NULL REFERENCES "${schemaName}".report_definitions(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          frequency TEXT NOT NULL,
          day_of_week INTEGER,
          day_of_month INTEGER,
          time TEXT NOT NULL,
          recipients TEXT[] NOT NULL,
          format TEXT NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT true,
          next_run_at TIMESTAMP,
          last_run_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      console.log('  ✓ Created report_schedules table');

      // Create index for active schedule queries
      await pool.query(`
        CREATE INDEX IF NOT EXISTS "${schemaName}_report_schedules_next_run_at_idx"
        ON "${schemaName}".report_schedules (next_run_at)
        WHERE is_active = true;
      `);
      console.log('  ✓ Created index on report_schedules.next_run_at');

      // 4. materialized_report_data table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".materialized_report_data (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          report_id UUID NOT NULL REFERENCES "${schemaName}".report_definitions(id) ON DELETE CASCADE,
          data JSONB NOT NULL,
          filter_hash TEXT NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      console.log('  ✓ Created materialized_report_data table');

      // Create indexes for cache lookups
      await pool.query(`
        CREATE INDEX IF NOT EXISTS "${schemaName}_materialized_report_data_report_id_idx"
        ON "${schemaName}".materialized_report_data (report_id);
      `);
      console.log('  ✓ Created index on materialized_report_data.report_id');

      await pool.query(`
        CREATE INDEX IF NOT EXISTS "${schemaName}_materialized_report_data_expires_at_idx"
        ON "${schemaName}".materialized_report_data (expires_at);
      `);
      console.log('  ✓ Created index on materialized_report_data.expires_at');

      console.log(`✓ Completed migration for ${schemaName}`);
    } catch (err) {
      console.error(`✗ Failed to migrate ${schemaName}:`, err);
      throw err; // Stop on first error
    }
  }

  console.log('\n✓ Phase 10 migration complete!');
  console.log('All reporting tables have been added to tenant schemas.');
}

migratePhase10Reporting()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n✗ Migration failed:', err);
    process.exit(1);
  });
