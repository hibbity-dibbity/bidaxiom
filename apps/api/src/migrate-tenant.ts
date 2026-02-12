import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
config({ path: resolve(process.cwd(), "../../.env") });

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Get all active tenant schemas and run migration on each
const tenants = await pool.query(
  "SELECT schema_name FROM tenants WHERE status = 'active'"
);

for (const row of tenants.rows) {
  const { migrateTenantSchema } = await import("./db/migrate.js");
  await migrateTenantSchema(pool, row.schema_name);
}

await pool.end();
