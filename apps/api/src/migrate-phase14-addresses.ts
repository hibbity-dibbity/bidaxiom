import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local from project root (two levels up from apps/api)
config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

import { pool } from "./db/client.js";

/**
 * Migration: Add structured address columns and clear freeform data
 * Phase: 14-form-standardization-and-validation (Plan 14-02)
 *
 * Adds street1, street2, city, state, zip columns to:
 * - customers (clears phone, address)
 * - subcontractor_directory (clears contact_phone, address)
 * - projects (clears location)
 *
 * User decided to DELETE existing freeform phone/address data
 */

async function migrateAddresses() {
  console.log("Starting Phase 14 (Structured Addresses) migration...\n");

  // Get all active tenants
  const result = await pool.query(
    "SELECT schema_name FROM tenants WHERE status = 'active'"
  );

  console.log(`Found ${result.rows.length} active tenant(s)\n`);

  for (const row of result.rows) {
    const schemaName = row.schema_name;
    console.log(`Migrating schema: ${schemaName}`);

    try {
      // ============================================================
      // CUSTOMERS TABLE
      // ============================================================

      // Check if columns already exist
      const customersCheckResult = await pool.query(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
        AND table_name = 'customers'
        AND column_name IN ('street1', 'street2', 'city', 'state', 'zip')
        `,
        [schemaName]
      );

      if (customersCheckResult.rows.length === 0) {
        // Add structured address columns to customers
        await pool.query(`
          ALTER TABLE "${schemaName}".customers
          ADD COLUMN IF NOT EXISTS street1 TEXT,
          ADD COLUMN IF NOT EXISTS street2 TEXT,
          ADD COLUMN IF NOT EXISTS city TEXT,
          ADD COLUMN IF NOT EXISTS state TEXT,
          ADD COLUMN IF NOT EXISTS zip TEXT
        `);
        console.log(`  ✓ Added structured address columns to customers`);
      } else {
        console.log(`  - Structured address columns already exist in customers`);
      }

      // Delete existing freeform data per user decision
      await pool.query(`
        UPDATE "${schemaName}".customers
        SET phone = NULL, address = NULL
        WHERE phone IS NOT NULL OR address IS NOT NULL
      `);
      console.log(`  ✓ Cleared freeform phone/address data from customers`);

      // ============================================================
      // SUBCONTRACTOR_DIRECTORY TABLE
      // ============================================================

      // Check if columns already exist
      const subsCheckResult = await pool.query(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
        AND table_name = 'subcontractor_directory'
        AND column_name IN ('street1', 'street2', 'city', 'state', 'zip')
        `,
        [schemaName]
      );

      if (subsCheckResult.rows.length === 0) {
        // Add structured address columns to subcontractor_directory
        await pool.query(`
          ALTER TABLE "${schemaName}".subcontractor_directory
          ADD COLUMN IF NOT EXISTS street1 TEXT,
          ADD COLUMN IF NOT EXISTS street2 TEXT,
          ADD COLUMN IF NOT EXISTS city TEXT,
          ADD COLUMN IF NOT EXISTS state TEXT,
          ADD COLUMN IF NOT EXISTS zip TEXT
        `);
        console.log(`  ✓ Added structured address columns to subcontractor_directory`);
      } else {
        console.log(`  - Structured address columns already exist in subcontractor_directory`);
      }

      // Delete existing freeform data per user decision
      await pool.query(`
        UPDATE "${schemaName}".subcontractor_directory
        SET contact_phone = NULL, address = NULL
        WHERE contact_phone IS NOT NULL OR address IS NOT NULL
      `);
      console.log(`  ✓ Cleared freeform contact_phone/address data from subcontractor_directory`);

      // ============================================================
      // PROJECTS TABLE
      // ============================================================

      // Check if columns already exist
      const projectsCheckResult = await pool.query(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
        AND table_name = 'projects'
        AND column_name IN ('street1', 'street2', 'city', 'state', 'zip')
        `,
        [schemaName]
      );

      if (projectsCheckResult.rows.length === 0) {
        // Add structured address columns to projects
        await pool.query(`
          ALTER TABLE "${schemaName}".projects
          ADD COLUMN IF NOT EXISTS street1 TEXT,
          ADD COLUMN IF NOT EXISTS street2 TEXT,
          ADD COLUMN IF NOT EXISTS city TEXT,
          ADD COLUMN IF NOT EXISTS state TEXT,
          ADD COLUMN IF NOT EXISTS zip TEXT
        `);
        console.log(`  ✓ Added structured address columns to projects`);
      } else {
        console.log(`  - Structured address columns already exist in projects`);
      }

      // Delete existing freeform data per user decision
      await pool.query(`
        UPDATE "${schemaName}".projects
        SET location = NULL
        WHERE location IS NOT NULL
      `);
      console.log(`  ✓ Cleared freeform location data from projects`);

      console.log(`  ✓ Completed ${schemaName}\n`);
    } catch (error) {
      console.error(`  ✗ Error migrating ${schemaName}:`, error);
      // Continue to next tenant instead of failing entirely
      continue;
    }
  }

  console.log("✓ Migration complete!");
  process.exit(0);
}

migrateAddresses().catch((error) => {
  console.error("\n✗ Migration failed:", error);
  process.exit(1);
});
