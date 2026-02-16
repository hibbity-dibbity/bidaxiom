import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local from project root (two levels up from apps/api)
config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

import { pool } from "../client.js";

/**
 * Migration: Extend schema for estimate-to-bid lifecycle tracking
 * Phase: 18-estimating-workflow-lifecycle-and-conversion (Plan 18-01)
 *
 * Schema changes:
 * - Add linkedBidId column to estimates table
 * - Add estimateId, closedAt, closedBy, closedNotes columns to bids table
 *
 * This migration is idempotent - checks for column existence before adding.
 */

async function migratePhase18Schema() {
  console.log("Starting Phase 18 schema migration...\n");

  // Get all active tenants from public.tenants table
  const result = await pool.query(
    "SELECT schema_name FROM public.tenants WHERE status = 'active'"
  );

  console.log(`Found ${result.rows.length} active tenant(s)\n`);

  for (const row of result.rows) {
    const schemaName = row.schema_name;
    console.log(`Migrating tenant: ${schemaName}`);

    try {
      // 1. Check if estimates.linkedBidId already exists
      const estimatesColumnCheck = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = 'estimates'
          AND column_name = 'linked_bid_id'
      `, [schemaName]);

      if (estimatesColumnCheck.rows.length === 0) {
        // Add linkedBidId to estimates table
        await pool.query(`
          ALTER TABLE "${schemaName}".estimates
          ADD COLUMN linked_bid_id UUID;
        `);
        console.log("  ✓ Added linked_bid_id column to estimates table");
      } else {
        console.log("  ⊙ linked_bid_id column already exists in estimates table");
      }

      // 2. Check if bids.estimateId already exists
      const bidsEstimateCheck = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = 'bids'
          AND column_name = 'estimate_id'
      `, [schemaName]);

      if (bidsEstimateCheck.rows.length === 0) {
        // Add estimateId to bids table with FK to estimates
        await pool.query(`
          ALTER TABLE "${schemaName}".bids
          ADD COLUMN estimate_id UUID REFERENCES "${schemaName}".estimates(id) ON DELETE SET NULL;
        `);
        console.log("  ✓ Added estimate_id column to bids table");
      } else {
        console.log("  ⊙ estimate_id column already exists in bids table");
      }

      // 3. Check if bids.closedAt already exists
      const bidsClosedAtCheck = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = 'bids'
          AND column_name = 'closed_at'
      `, [schemaName]);

      if (bidsClosedAtCheck.rows.length === 0) {
        // Add closure tracking columns to bids table
        await pool.query(`
          ALTER TABLE "${schemaName}".bids
          ADD COLUMN closed_at TIMESTAMPTZ,
          ADD COLUMN closed_by TEXT,
          ADD COLUMN closed_notes TEXT;
        `);
        console.log("  ✓ Added closed_at, closed_by, closed_notes columns to bids table");
      } else {
        console.log("  ⊙ closed_at column already exists in bids table");
      }

      console.log(`✓ Successfully migrated ${schemaName}\n`);
    } catch (err) {
      console.error(`✗ Failed to migrate ${schemaName}:`, err);
      throw err; // Stop on first error
    }
  }

  console.log("✓ Phase 18 schema migration complete!");
}

migratePhase18Schema()
  .then(() => {
    console.log("\nMigration successful. Estimate-bid lifecycle columns added to all tenants.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n✗ Migration failed:", err);
    process.exit(1);
  });
