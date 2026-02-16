import dotenv from "dotenv";
import { resolve } from "path";
import { Pool } from "pg";
import slug from "slug";

// Load environment variables from monorepo root
dotenv.config({ path: resolve(process.cwd(), "../../.env.local") });

/**
 * Generate URL-safe slug from identifier and name
 */
function generateSlug(identifier: string, name: string): string {
  const slugIdentifier = slug(identifier, { lower: true });
  const slugName = slug(name, { lower: true });
  return `${slugIdentifier}-${slugName}`;
}

async function addEntitySlugs() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Get all tenant schemas
    const tenants = await pool.query(`
      SELECT schema_name FROM information_schema.schemata
      WHERE schema_name LIKE 'tenant_%'
    `);

    for (const tenant of tenants.rows) {
      const schema = tenant.schema_name;
      console.log(`Processing ${schema}...`);

      // Add slug column to customers (if not exists)
      await pool.query(`
        ALTER TABLE ${schema}.customers
        ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE
      `);

      // Add slug column to subcontractor_directory (if not exists)
      await pool.query(`
        ALTER TABLE ${schema}.subcontractor_directory
        ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE
      `);

      // Add slug column to estimates (if not exists)
      await pool.query(`
        ALTER TABLE ${schema}.estimates
        ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE
      `);

      // Generate slugs for existing customers
      const customers = await pool.query(`
        SELECT id, company_name, contact_name FROM ${schema}.customers WHERE slug IS NULL
      `);
      for (const customer of customers.rows) {
        const name = customer.company_name || customer.contact_name || 'unknown';
        const slugValue = generateSlug(`cust-${customer.id.slice(0, 8)}`, name);
        await pool.query(
          `UPDATE ${schema}.customers SET slug = $1 WHERE id = $2`,
          [slugValue, customer.id]
        );
      }

      // Generate slugs for existing subcontractors
      const subcontractors = await pool.query(`
        SELECT id, company_name FROM ${schema}.subcontractor_directory WHERE slug IS NULL
      `);
      for (const subcontractor of subcontractors.rows) {
        const slugValue = generateSlug(`sub-${subcontractor.id.slice(0, 8)}`, subcontractor.company_name);
        await pool.query(
          `UPDATE ${schema}.subcontractor_directory SET slug = $1 WHERE id = $2`,
          [slugValue, subcontractor.id]
        );
      }

      // Generate slugs for existing estimates
      const estimates = await pool.query(`
        SELECT e.id, e.name, p.job_number
        FROM ${schema}.estimates e
        JOIN ${schema}.projects p ON e.project_id = p.id
        WHERE e.slug IS NULL
      `);
      for (const estimate of estimates.rows) {
        const identifier = estimate.job_number
          ? `est-${estimate.job_number}`
          : `est-${estimate.id.slice(0, 8)}`;
        const slugValue = generateSlug(identifier, estimate.name);
        await pool.query(
          `UPDATE ${schema}.estimates SET slug = $1 WHERE id = $2`,
          [slugValue, estimate.id]
        );
      }

      console.log(`✓ ${schema} complete`);
    }

    console.log("All tenants updated");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

addEntitySlugs().catch((error) => {
  console.error(error);
  process.exit(1);
});
