import slug from "slug";
import { eq, and, ne } from "drizzle-orm";
import type { TenantSchema } from "../db/schema/tenant.js";

/**
 * Generate URL-safe slug from identifier and name
 * Examples:
 *   - Project: "24001" + "Main Street Renovation" → "24001-main-street-renovation"
 *   - Customer: "CUST-123" + "ABC Construction" → "cust-123-abc-construction"
 *   - Estimate: "EST-24001" + "Main Street Estimate" → "est-24001-main-street-estimate"
 */
export function generateSlug(identifier: string, name: string): string {
  const slugIdentifier = slug(identifier, { lower: true });
  const slugName = slug(name, { lower: true });
  return `${slugIdentifier}-${slugName}`;
}

/**
 * Parse slug back to identifier
 * Examples:
 *   - "24001-main-street-renovation" → "24001"
 *   - "cust-123-abc-construction" → "cust-123"
 *   - "est-24001-main-street-estimate" → "est-24001"
 *
 * Note: parseSlug returns slug-safe identifier, not original.
 * Use for database lookup, not display.
 */
export function parseSlug(fullSlug: string): string {
  // Split on first dash after identifier
  // Identifier is typically numeric (projects) or prefix-numeric (customers/estimates)
  const parts = fullSlug.split("-");

  // Project pattern: "24001-..." (numeric identifier)
  if (/^\d+$/.test(parts[0])) {
    return parts[0];
  }

  // Customer/Estimate pattern: "cust-123-..." or "est-24001-..."
  if (parts.length >= 2 && /^[a-z]+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
    return `${parts[0]}-${parts[1]}`;
  }

  // Fallback: return first part
  return parts[0];
}

/**
 * Validate slug format
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

/**
 * Generate a URL-safe slug from job number and project name.
 * Backward compatibility wrapper for generateSlug.
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
  if (jobNumber) {
    return generateSlug(jobNumber, projectName);
  }
  const slugName = slug(projectName, { lower: true });
  return slugName;
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
