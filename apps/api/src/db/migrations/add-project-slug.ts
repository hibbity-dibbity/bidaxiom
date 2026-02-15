import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getPool } from "../client.js";
import slug from "slug";

// Load environment variables from root .env.local
// Using absolute path relative to the script file location
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, "../../../../../.env.local");
console.log("Loading .env from:", envPath);
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error("Failed to load .env.local:", result.error);
  process.exit(1);
}

/**
 * Generate a URL-safe slug from job number and project name.
 * Inline implementation to keep migration self-contained.
 */
function generateProjectSlug(jobNumber: string | null, projectName: string): string {
  const parts = jobNumber ? [jobNumber, projectName] : [projectName];
  const combined = parts.join("-");
  return slug(combined, { lower: true });
}

async function migrateProjectSlugs() {
  console.log("DATABASE_URL:", process.env.DATABASE_URL ? "✓ Loaded" : "✗ Missing");

  const pool = getPool();
  console.log("Starting project slug migration...");

  // Get all active tenants
  const tenantsResult = await pool.query(
    "SELECT schema_name FROM tenants WHERE status = 'active'"
  );

  console.log(`Found ${tenantsResult.rows.length} active tenants`);

  for (const row of tenantsResult.rows) {
    const schemaName = row.schema_name;
    console.log(`\nMigrating tenant: ${schemaName}`);

    try {
      // Step 1: Add slug column if it doesn't exist
      await pool.query(`
        ALTER TABLE "${schemaName}".projects
        ADD COLUMN IF NOT EXISTS slug TEXT;
      `);
      console.log(`  ✓ Added slug column`);

      // Step 2: Get all projects that need slugs (where slug IS NULL)
      const projectsResult = await pool.query(`
        SELECT id, job_number, name
        FROM "${schemaName}".projects
        WHERE slug IS NULL;
      `);

      console.log(`  Found ${projectsResult.rows.length} projects without slugs`);

      // Step 3: Generate and update slug for each project
      for (const project of projectsResult.rows) {
        const projectSlug = generateProjectSlug(project.job_number, project.name);

        // Check for collisions and append -1, -2, etc. if needed
        let finalSlug = projectSlug;
        let counter = 1;

        while (true) {
          const collisionCheck = await pool.query(
            `SELECT id FROM "${schemaName}".projects WHERE slug = $1 AND id != $2 LIMIT 1`,
            [finalSlug, project.id]
          );

          if (collisionCheck.rows.length === 0) {
            break; // No collision, use this slug
          }

          finalSlug = `${projectSlug}-${counter}`;
          counter++;

          if (counter > 100) {
            // Safety limit - fallback to timestamp
            finalSlug = `${projectSlug}-${Date.now()}`;
            break;
          }
        }

        // Update the project with the unique slug
        await pool.query(
          `UPDATE "${schemaName}".projects SET slug = $1 WHERE id = $2`,
          [finalSlug, project.id]
        );
      }

      console.log(`  ✓ Backfilled ${projectsResult.rows.length} project slugs`);

      // Step 4: Create unique partial index on slug (only for non-null values)
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "${schemaName}_projects_slug_unique"
        ON "${schemaName}".projects (slug)
        WHERE slug IS NOT NULL;
      `);
      console.log(`  ✓ Created unique index on slug`);

      console.log(`✓ Completed migration for ${schemaName}`);
    } catch (err) {
      console.error(`✗ Failed to migrate ${schemaName}:`, err);
      throw err; // Stop on first error to avoid partial migrations
    }
  }

  console.log("\n✓ Migration complete!");
}

migrateProjectSlugs()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n✗ Migration failed:", err);
    process.exit(1);
  });
