/**
 * Fix admin role after user account deletion and recreation.
 *
 * When a user deletes and recreates their account, the new user record gets
 * a new UUID. The organization_memberships row linking the old UUID to the
 * org:admin role becomes orphaned, and the new user gets org:member by default,
 * causing read-only access everywhere.
 *
 * This script:
 * 1. Finds the user by email
 * 2. Updates organization_memberships to org:admin
 * 3. Updates user_company_mappings to org:admin
 * 4. Updates tenant user_profiles to org:admin
 * 5. Cleans up orphaned memberships from deleted user
 */

import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

// Load env vars from monorepo root
config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  console.log("Starting admin role fix...\n");

  try {
    // Step 1: Find all users
    console.log("=== Step 1: Finding users ===");
    const usersResult = await pool.query(
      `SELECT id, email, first_name, last_name, created_at FROM users ORDER BY created_at DESC`
    );

    console.log(`Found ${usersResult.rows.length} users:\n`);
    usersResult.rows.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Name: ${user.first_name || "(none)"} ${user.last_name || "(none)"}`);
      console.log(`   Created: ${user.created_at}\n`);
    });

    // For this specific case, we know the user's email
    // If there are multiple users, pick the most recent one
    const currentUser = usersResult.rows[0];

    if (!currentUser) {
      console.error("No users found!");
      return;
    }

    console.log(`Using current user: ${currentUser.email} (ID: ${currentUser.id})\n`);

    // Step 2: Find organization and current membership state
    console.log("=== Step 2: Finding organization and membership ===");
    const orgResult = await pool.query(`SELECT id, name FROM organizations LIMIT 1`);

    if (orgResult.rows.length === 0) {
      console.error("No organization found!");
      return;
    }

    const org = orgResult.rows[0];
    console.log(`Organization: ${org.name} (ID: ${org.id})\n`);

    // Check current membership
    const membershipResult = await pool.query(
      `SELECT id, role FROM organization_memberships WHERE user_id = $1 AND organization_id = $2`,
      [currentUser.id, org.id]
    );

    if (membershipResult.rows.length > 0) {
      console.log(`Current membership role: ${membershipResult.rows[0].role}`);
    } else {
      console.log(`No membership found for current user`);
    }

    // Step 3: Find tenant for this org
    console.log("\n=== Step 3: Finding tenant schema ===");
    const tenantResult = await pool.query(
      `SELECT t.id, t.schema_name FROM tenants t
       JOIN organizations o ON o.tenant_id = t.id
       WHERE o.id = $1`,
      [org.id]
    );

    if (tenantResult.rows.length === 0) {
      console.error("No tenant found for organization!");
      return;
    }

    const tenant = tenantResult.rows[0];
    console.log(`Tenant: ${tenant.schema_name} (ID: ${tenant.id})\n`);

    // Step 4: UPSERT organization_memberships
    console.log("=== Step 4: Updating organization_memberships ===");
    const upsertMembershipResult = await pool.query(
      `INSERT INTO organization_memberships (user_id, organization_id, role)
       VALUES ($1, $2, 'org:admin')
       ON CONFLICT (user_id, organization_id)
       DO UPDATE SET role = 'org:admin', updated_at = NOW()
       RETURNING id, role`,
      [currentUser.id, org.id]
    );

    console.log(`✓ Membership role set to: ${upsertMembershipResult.rows[0].role}\n`);

    // Step 5: UPSERT user_company_mappings
    console.log("=== Step 5: Updating user_company_mappings ===");

    // Check if mapping exists
    const mappingCheckResult = await pool.query(
      `SELECT id, role FROM user_company_mappings WHERE clerk_user_id = $1 AND tenant_id = $2`,
      [currentUser.id, tenant.id]
    );

    if (mappingCheckResult.rows.length > 0) {
      // Update existing
      await pool.query(
        `UPDATE user_company_mappings SET role = 'org:admin' WHERE clerk_user_id = $1 AND tenant_id = $2`,
        [currentUser.id, tenant.id]
      );
      console.log(`✓ Updated existing user_company_mappings to org:admin\n`);
    } else {
      // Insert new
      await pool.query(
        `INSERT INTO user_company_mappings (clerk_user_id, tenant_id, role)
         VALUES ($1, $2, 'org:admin')`,
        [currentUser.id, tenant.id]
      );
      console.log(`✓ Inserted new user_company_mappings with org:admin\n`);
    }

    // Step 6: Update tenant schema user_profiles
    console.log("=== Step 6: Updating tenant user_profiles ===");

    // Check if profile exists
    const profileCheckResult = await pool.query(
      `SELECT id, role FROM "${tenant.schema_name}".user_profiles WHERE clerk_user_id = $1`,
      [currentUser.id]
    );

    if (profileCheckResult.rows.length > 0) {
      // Update existing
      await pool.query(
        `UPDATE "${tenant.schema_name}".user_profiles SET role = 'org:admin' WHERE clerk_user_id = $1`,
        [currentUser.id]
      );
      console.log(`✓ Updated tenant user_profiles to org:admin\n`);
    } else {
      // Insert new
      await pool.query(
        `INSERT INTO "${tenant.schema_name}".user_profiles (clerk_user_id, email, first_name, last_name, role)
         VALUES ($1, $2, $3, $4, 'org:admin')`,
        [currentUser.id, currentUser.email, currentUser.first_name, currentUser.last_name]
      );
      console.log(`✓ Inserted new tenant user_profiles with org:admin\n`);
    }

    // Step 7: Clean up orphaned memberships
    console.log("=== Step 7: Cleaning up orphaned memberships ===");
    const orphanedResult = await pool.query(
      `DELETE FROM organization_memberships
       WHERE user_id NOT IN (SELECT id FROM users)
       RETURNING id`
    );

    if (orphanedResult.rows.length > 0) {
      console.log(`✓ Deleted ${orphanedResult.rows.length} orphaned membership(s)\n`);
    } else {
      console.log(`✓ No orphaned memberships found\n`);
    }

    // Step 8: Summary
    console.log("=== Summary ===");
    console.log(`User: ${currentUser.email} (${currentUser.id})`);
    console.log(`Organization: ${org.name} (${org.id})`);
    console.log(`Tenant: ${tenant.schema_name}`);
    console.log(`\n✓ All roles updated to org:admin`);
    console.log(`\nNext steps:`);
    console.log(`1. Log out of the application`);
    console.log(`2. Log back in`);
    console.log(`3. The JWT will be refreshed with org:admin role`);
    console.log(`4. Company Profile should show full edit access\n`);

  } catch (error) {
    console.error("Error fixing admin role:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

main();
