import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { tenants } from "../db/schema/public.js";
import type { TenantRecord } from "./provision.js";

/**
 * Resolve a tenant from a Clerk organization ID.
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
