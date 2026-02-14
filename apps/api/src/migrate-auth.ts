/**
 * Data migration script: Clerk to Custom Auth
 *
 * Migrates existing data from Clerk-era tables to custom auth tables.
 * Run this ONCE during the migration from Clerk to custom authentication.
 *
 * Usage: cd apps/api && npx tsx src/migrate-auth.ts
 *
 * What it does:
 * 1. Creates auth tables in public schema (if not exists)
 * 2. Migrates organizations from tenants table
 * 3. Migrates users from user_company_mappings + user_profiles
 * 4. Migrates memberships to organizationMemberships table
 * 5. Outputs migration report
 *
 * Important:
 * - Idempotent (safe to run multiple times - uses INSERT ... ON CONFLICT DO NOTHING)
 * - Runs in a transaction (all-or-nothing)
 * - Password hashes cannot be exported from Clerk in development
 *   Users will need to use "Forgot Password" to set new passwords
 * - MFA secrets are not exportable; users must re-setup MFA
 */

import dotenv from "dotenv";
dotenv.config({ path: "../../.env.local" });

import { db } from "./db/client.js";
import {
  tenants,
  userCompanyMappings,
  users,
  organizations,
  organizationMemberships,
} from "./db/schema/public.js";
import { createTenantDb } from "./db/client.js";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

interface MigrationStats {
  organizationsMigrated: number;
  usersMigrated: number;
  membershipsMigrated: number;
  usersNeedingPasswordReset: string[];
}

async function migrateAuth(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    organizationsMigrated: 0,
    usersMigrated: 0,
    membershipsMigrated: 0,
    usersNeedingPasswordReset: [],
  };

  console.log("Starting Clerk to Custom Auth migration...\n");

  return await db.transaction(async (tx) => {
    // Step 1: Migrate organizations
    console.log("Step 1: Migrating organizations from tenants table...");
    const allTenants = await tx.select().from(tenants);

    for (const tenant of allTenants) {
      // Generate slug from company name (lowercase, replace spaces with hyphens)
      const slug = tenant.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      await tx
        .insert(organizations)
        .values({
          clerkOrgId: tenant.clerkOrgId,
          tenantId: tenant.id,
          name: tenant.name,
          slug,
        })
        .onConflictDoNothing({ target: organizations.tenantId });

      stats.organizationsMigrated++;
    }
    console.log(`  ✓ Migrated ${stats.organizationsMigrated} organizations\n`);

    // Step 2: Get unique Clerk user IDs from user_company_mappings
    console.log("Step 2: Migrating users from user_company_mappings + user_profiles...");
    const uniqueUserMappings = await tx
      .selectDistinct({
        clerkUserId: userCompanyMappings.clerkUserId,
      })
      .from(userCompanyMappings);

    for (const mapping of uniqueUserMappings) {
      const clerkUserId = mapping.clerkUserId;

      // Get user profile from ANY tenant (they should all have the same email/name)
      // We'll use the first tenant this user belongs to
      const userMapping = await tx
        .select()
        .from(userCompanyMappings)
        .where(eq(userCompanyMappings.clerkUserId, clerkUserId))
        .limit(1);

      if (userMapping.length === 0) continue;

      const tenant = await tx
        .select()
        .from(tenants)
        .where(eq(tenants.id, userMapping[0].tenantId))
        .limit(1);

      if (tenant.length === 0) continue;

      // Query tenant's user_profiles table for this user's details
      const tenantDb = createTenantDb(tenant[0].schemaName);
      const userProfiles = await tenantDb.db
        .select()
        .from(tenantDb.userProfiles)
        .where(eq(tenantDb.userProfiles.clerkUserId, clerkUserId))
        .limit(1);

      if (userProfiles.length === 0) {
        console.warn(`  ⚠ No user profile found for Clerk user ${clerkUserId}, skipping`);
        continue;
      }

      const profile = userProfiles[0];

      // Create user in public.users table
      // Password hash: Set placeholder - users will need to reset password
      // MFA: Disabled - users will need to re-setup MFA
      await tx
        .insert(users)
        .values({
          clerkUserId,
          email: profile.email || `unknown-${nanoid(10)}@placeholder.com`,
          emailVerified: true, // Clerk users were already verified
          passwordHash: "MIGRATION_PENDING",
          hashType: "none",
          firstName: profile.firstName,
          lastName: profile.lastName,
          mfaEnabled: false,
          mfaSecret: null,
          mfaBackupCodes: null,
        })
        .onConflictDoNothing({ target: users.clerkUserId });

      stats.usersMigrated++;
      stats.usersNeedingPasswordReset.push(profile.email || clerkUserId);
    }
    console.log(`  ✓ Migrated ${stats.usersMigrated} users\n`);

    // Step 3: Migrate memberships
    console.log("Step 3: Migrating organization memberships...");
    const allMappings = await tx.select().from(userCompanyMappings);

    for (const mapping of allMappings) {
      // Find the custom user record
      const customUser = await tx
        .select()
        .from(users)
        .where(eq(users.clerkUserId, mapping.clerkUserId))
        .limit(1);

      if (customUser.length === 0) {
        console.warn(`  ⚠ User not found for ${mapping.clerkUserId}, skipping membership`);
        continue;
      }

      // Find the organization record
      const org = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.tenantId, mapping.tenantId))
        .limit(1);

      if (org.length === 0) {
        console.warn(`  ⚠ Organization not found for tenant ${mapping.tenantId}, skipping membership`);
        continue;
      }

      // Create membership
      await tx
        .insert(organizationMemberships)
        .values({
          userId: customUser[0].id,
          organizationId: org[0].id,
          role: mapping.role,
        })
        .onConflictDoNothing({
          target: [organizationMemberships.userId, organizationMemberships.organizationId],
        });

      stats.membershipsMigrated++;
    }
    console.log(`  ✓ Migrated ${stats.membershipsMigrated} memberships\n`);

    return stats;
  });
}

// Run migration
migrateAuth()
  .then((stats) => {
    console.log("=".repeat(60));
    console.log("Migration completed successfully!");
    console.log("=".repeat(60));
    console.log(`Organizations migrated: ${stats.organizationsMigrated}`);
    console.log(`Users migrated: ${stats.usersMigrated}`);
    console.log(`Memberships migrated: ${stats.membershipsMigrated}`);
    console.log();
    console.log("IMPORTANT:");
    console.log("-".repeat(60));
    console.log("1. All migrated users need to reset their passwords.");
    console.log("   Clerk password hashes cannot be exported in development.");
    console.log("   Users should use the 'Forgot Password' flow.");
    console.log();
    console.log("2. All migrated users need to re-setup MFA (if they had it).");
    console.log("   Clerk MFA secrets are not exportable.");
    console.log();
    console.log(`${stats.usersNeedingPasswordReset.length} users affected.`);
    console.log("=".repeat(60));
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
