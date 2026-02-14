import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { tenants, organizations } from "../db/schema/public.js";
import type { TenantRecord } from "./provision.js";

/**
 * Resolve a tenant from a Clerk organization ID (legacy path).
 *
 * Queries the public tenants table to find the matching active tenant.
 * Returns null if not found (caller decides how to handle).
 *
 * @param clerkOrgId - The Clerk organization ID (e.g., "org_abc123")
 * @returns TenantRecord if found and active, null otherwise
 */
export async function resolveTenant(
  clerkOrgId: string
): Promise<TenantRecord | null> {
  const result = await db
    .select({
      id: tenants.id,
      schemaName: tenants.schemaName,
      clerkOrgId: tenants.clerkOrgId,
      name: tenants.name,
      status: tenants.status,
    })
    .from(tenants)
    .where(
      and(
        eq(tenants.clerkOrgId, clerkOrgId),
        eq(tenants.status, "active")
      )
    )
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return result[0];
}

/**
 * Resolve a tenant from a custom organization ID (new custom auth path).
 *
 * First tries the organizations table (new custom auth), then falls back
 * to the legacy Clerk org ID path for backward compatibility during migration.
 *
 * @param orgId - The organization ID (custom UUID or legacy Clerk org ID)
 * @returns TenantRecord if found and active, null otherwise
 */
export async function resolveTenantByOrgId(
  orgId: string
): Promise<TenantRecord | null> {
  // First check the organizations table (new custom auth path)
  const orgResult = await db
    .select({
      tenantId: organizations.tenantId,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (orgResult.length > 0 && orgResult[0].tenantId) {
    return resolveTenantById(orgResult[0].tenantId);
  }

  // Fallback: try the old clerk_org_id path for backward compatibility during migration
  return resolveTenant(orgId);
}

/**
 * Resolve a tenant by direct tenant ID lookup.
 *
 * @param tenantId - The tenant ID (UUID)
 * @returns TenantRecord if found and active, null otherwise
 */
export async function resolveTenantById(
  tenantId: string
): Promise<TenantRecord | null> {
  const result = await db
    .select({
      id: tenants.id,
      schemaName: tenants.schemaName,
      clerkOrgId: tenants.clerkOrgId,
      name: tenants.name,
      status: tenants.status,
    })
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), eq(tenants.status, "active")))
    .limit(1);

  return result.length === 0 ? null : result[0];
}
