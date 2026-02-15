import slug from "slug";
import { eq, and, ne } from "drizzle-orm";
import type { TenantSchema } from "../db/schema/tenant.js";

/**
 * Generate a URL-safe slug from job number and project name.
 *
 * @param jobNumber - The project's job number (nullable)
 * @param projectName - The project name
 * @returns URL-safe slug in format: {jobnumber}-{projectname} or just {projectname}
 *
 * @example
 * generateProjectSlug("2024-001", "Office Renovation") => "2024-001-office-renovation"
 * generateProjectSlug(null, "New Warehouse") => "new-warehouse"
 */
export function generateProjectSlug(jobNumber: string | null, projectName: string): string {
  const parts = jobNumber ? [jobNumber, projectName] : [projectName];
  const combined = parts.join("-");
  return slug(combined, { lower: true });
}

/**
 * Generate a unique slug for a project, handling collisions by appending -1, -2, etc.
 *
 * @param jobNumber - The project's job number (nullable)
 * @param projectName - The project name
 * @param tenantDb - Drizzle database instance for the tenant
 * @param tenantSchema - Drizzle schema for the tenant
 * @param excludeProjectId - Optional project ID to exclude from collision check (for updates)
 * @returns Promise resolving to a unique slug
 *
 * @example
 * await generateUniqueProjectSlug("2024-001", "Office Renovation", db, schema) => "2024-001-office-renovation"
 * // If collision exists:
 * await generateUniqueProjectSlug("2024-001", "Office Renovation", db, schema) => "2024-001-office-renovation-1"
 */
export async function generateUniqueProjectSlug(
  jobNumber: string | null,
  projectName: string,
  tenantDb: any,
  tenantSchema: TenantSchema,
  excludeProjectId?: string
): Promise<string> {
  const baseSlug = generateProjectSlug(jobNumber, projectName);

  // Check for existing slug
  const whereConditions = excludeProjectId
    ? and(
        eq(tenantSchema.projects.slug, baseSlug),
        ne(tenantSchema.projects.id, excludeProjectId)
      )
    : eq(tenantSchema.projects.slug, baseSlug);

  const existing = await tenantDb
    .select({ id: tenantSchema.projects.id })
    .from(tenantSchema.projects)
    .where(whereConditions)
    .limit(1);

  // No collision - return base slug
  if (existing.length === 0) {
    return baseSlug;
  }

  // Collision detected - try appending -1, -2, etc.
  let counter = 1;
  let candidateSlug = `${baseSlug}-${counter}`;

  while (counter < 100) { // Safety limit to prevent infinite loops
    const whereConditionsWithCounter = excludeProjectId
      ? and(
          eq(tenantSchema.projects.slug, candidateSlug),
          ne(tenantSchema.projects.id, excludeProjectId)
        )
      : eq(tenantSchema.projects.slug, candidateSlug);

    const collision = await tenantDb
      .select({ id: tenantSchema.projects.id })
      .from(tenantSchema.projects)
      .where(whereConditionsWithCounter)
      .limit(1);

    if (collision.length === 0) {
      return candidateSlug;
    }

    counter++;
    candidateSlug = `${baseSlug}-${counter}`;
  }

  // Fallback: append timestamp if we hit the limit
  return `${baseSlug}-${Date.now()}`;
}
