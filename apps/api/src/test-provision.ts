/**
 * Quick E2E smoke test for tenant provisioning.
 * Run: cd apps/api && npx tsx src/test-provision.ts
 *
 * Uses dynamic imports to ensure dotenv loads before db/client.ts pool creation.
 */
import { config } from "dotenv";
import { resolve } from "path";

// Load env BEFORE any module that reads process.env
config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

// Dynamic imports — run AFTER dotenv has loaded
const pg = await import("pg");
const { provisionTenantSchema } = await import("./tenant/provision.js");
const { resolveTenant } = await import("./tenant/resolve.js");

const { Pool } = pg.default;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

async function main() {
  const testOrgId = "org_test_smoke_" + Date.now();
  const testOrgName = "Smoke Test Corp";

  console.log("=== Tenant Provisioning E2E Test ===\n");
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? "set" : "MISSING!"}\n`);

  // 1. Provision a new tenant
  console.log(`1. Provisioning tenant for org: ${testOrgId}`);
  const tenant = await provisionTenantSchema(testOrgId, testOrgName, pool);
  console.log(`   OK: schema="${tenant.schemaName}", id="${tenant.id}", status="${tenant.status}"`);

  // 2. Resolve the tenant
  console.log(`\n2. Resolving tenant by orgId: ${testOrgId}`);
  const resolved = await resolveTenant(testOrgId);
  if (!resolved) {
    throw new Error("Failed to resolve tenant!");
  }
  console.log(`   OK: resolved id="${resolved.id}", schema="${resolved.schemaName}"`);

  // 3. Verify idempotency
  console.log(`\n3. Testing idempotency (provision same org again)`);
  const duplicate = await provisionTenantSchema(testOrgId, testOrgName, pool);
  if (duplicate.id !== tenant.id) {
    throw new Error("Idempotency failed — got different tenant ID!");
  }
  console.log(`   OK: same id="${duplicate.id}" returned`);

  // 4. Verify schema was created in PostgreSQL
  console.log(`\n4. Verifying PostgreSQL schema exists`);
  const schemaCheck = await pool.query(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
    [tenant.schemaName]
  );
  if (schemaCheck.rows.length === 0) {
    throw new Error(`Schema "${tenant.schemaName}" not found!`);
  }
  console.log(`   OK: schema "${tenant.schemaName}" exists`);

  // 5. Verify tenant tables exist
  console.log(`\n5. Verifying tenant tables exist`);
  const tablesCheck = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
    [tenant.schemaName]
  );
  const tables = tablesCheck.rows.map((r: { table_name: string }) => r.table_name);
  console.log(`   Tables: ${tables.join(", ")}`);
  if (!tables.includes("audit_logs") || !tables.includes("user_profiles")) {
    throw new Error("Missing expected tables!");
  }
  console.log("   OK: audit_logs and user_profiles present");

  // Cleanup: remove test data
  console.log(`\n6. Cleaning up test data`);
  await pool.query(`DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE`);
  await pool.query(`DELETE FROM tenants WHERE clerk_org_id = $1`, [testOrgId]);
  console.log("   OK: cleaned up");

  console.log("\n=== ALL TESTS PASSED ===");
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("\n!!! TEST FAILED !!!", err);
  pool.end().then(() => process.exit(1));
});
