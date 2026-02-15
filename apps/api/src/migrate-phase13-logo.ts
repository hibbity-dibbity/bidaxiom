import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local from project root (two levels up from apps/api)
config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

import { pool } from "./db/client.js";

/**
 * Migration: Add logo_storage_key column to company_profiles
 * Phase: 13-navigation-and-theme-foundation (Plan 13-09)
 *
 * Adds logoStorageKey column to support company branding with logo upload
 */

async function migrateLogo() {
  console.log("Starting Phase 13 (Logo Storage) migration...\n");

  // Get all active tenants
  const result = await pool.query(
    "SELECT schema_name FROM tenants WHERE status = 'active'"
  );

  console.log(`Found ${result.rows.length} active tenant(s)\n`);

  for (const row of result.rows) {
    const schemaName = row.schema_name;
    console.log(`Migrating schema: ${schemaName}`);

    try {
      // Check if column already exists
      const checkResult = await pool.query(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
        AND table_name = 'company_profiles'
        AND column_name = 'logo_storage_key'
        `,
        [schemaName]
      );

      if (checkResult.rows.length === 0) {
        // Add the column
        await pool.query(
          `ALTER TABLE "${schemaName}".company_profiles
           ADD COLUMN logo_storage_key TEXT`
        );
        console.log(`  ✓ Added logo_storage_key column to ${schemaName}`);
      } else {
        console.log(`  - Column already exists in ${schemaName}`);
      }
    } catch (error) {
      console.error(`  ✗ Error migrating ${schemaName}:`, error);
      throw error;
    }
  }

  console.log("\n✓ Migration complete!");
  process.exit(0);
}

migrateLogo().catch((error) => {
  console.error("\n✗ Migration failed:", error);
  process.exit(1);
});
