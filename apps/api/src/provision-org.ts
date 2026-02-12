import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const pg = await import("pg");
const { provisionTenantSchema } = await import("./tenant/provision.js");

const pool = new pg.default.Pool({
  connectionString: process.env.DATABASE_URL,
});

const orgId = process.argv[2] || "org_39ZgU1gRh0PxbJFj6XqcDEr3V05";
const orgName = process.argv[3] || "Thomson Enterprises";

console.log(`Provisioning tenant for org: ${orgId} (${orgName})`);

// Check existing
const existing = await pool.query(
  "SELECT * FROM tenants WHERE clerk_org_id = $1",
  [orgId]
);

if (existing.rows.length > 0) {
  console.log("Tenant already exists:", existing.rows[0]);
} else {
  const result = await provisionTenantSchema(orgId, orgName, pool);
  console.log("Provisioned:", result);
}

await pool.end();
