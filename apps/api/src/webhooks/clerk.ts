import { Webhook } from "svix";
import pg from "pg";
import { eq, and } from "drizzle-orm";
import { provisionTenantSchema } from "../tenant/provision.js";
import { resolveTenant } from "../tenant/resolve.js";
import { db } from "../db/client.js";
import { userCompanyMappings } from "../db/schema/public.js";
import { createTenantDb } from "../db/client.js";

interface WebhookRequest {
  body: string;
  headers: Record<string, string>;
}

interface WebhookResult {
  success: boolean;
  message?: string;
  schemaName?: string;
}

/**
 * Handle Clerk webhook events for organization lifecycle.
 *
 * Verifies webhook signature via svix, then processes:
 * - organization.created: Provisions a new tenant schema
 * - organizationMembership.created: Adds user to tenant
 * - organizationMembership.deleted: Removes user from tenant
 *
 * @param req - Raw request with body string and headers
 * @param pool - PostgreSQL connection pool (for provisioning)
 * @returns Result indicating success/failure
 */
export async function handleClerkWebhook(
  req: WebhookRequest,
  pool: pg.Pool
): Promise<WebhookResult> {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("CLERK_WEBHOOK_SECRET not configured");
    throw new Error("Webhook secret not configured");
  }

  // Verify webhook signature
  const wh = new Webhook(webhookSecret);
  let event: { type: string; data: Record<string, unknown> };

  try {
    event = wh.verify(req.body, req.headers) as typeof event;
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    throw new Error("Invalid webhook signature");
  }

  console.log(`Processing Clerk webhook: ${event.type}`);

  switch (event.type) {
    case "organization.created":
      return handleOrgCreated(event.data, pool);

    case "organizationMembership.created":
      return handleMembershipCreated(event.data);

    case "organizationMembership.deleted":
      return handleMembershipDeleted(event.data);

    default:
      console.log(`Unhandled webhook event type: ${event.type}`);
      return { success: true, message: `Event type ${event.type} not handled` };
  }
}

/**
 * Handle organization.created: provision a new tenant schema.
 */
async function handleOrgCreated(
  data: Record<string, unknown>,
  pool: pg.Pool
): Promise<WebhookResult> {
  const orgId = data.id as string;
  const orgName = data.name as string;

  if (!orgId || !orgName) {
    throw new Error("Missing org id or name in webhook data");
  }

  const tenant = await provisionTenantSchema(orgId, orgName, pool);
  console.log(`Provisioned schema for org ${orgId}: ${tenant.schemaName}`);

  return {
    success: true,
    schemaName: tenant.schemaName,
    message: `Schema provisioned: ${tenant.schemaName}`,
  };
}

/**
 * Handle organizationMembership.created: add user to tenant.
 */
async function handleMembershipCreated(
  data: Record<string, unknown>
): Promise<WebhookResult> {
  const orgData = data.organization as Record<string, unknown> | undefined;
  const userData = data.public_user_data as Record<string, unknown> | undefined;
  const role = (data.role as string) || "member";

  const orgId = orgData?.id as string;
  const userId = userData?.user_id as string;
  const email = (userData?.identifier as string) || "";
  const firstName = (userData?.first_name as string) || null;
  const lastName = (userData?.last_name as string) || null;

  if (!orgId || !userId) {
    throw new Error("Missing org or user data in membership webhook");
  }

  // Resolve tenant
  const tenant = await resolveTenant(orgId);
  if (!tenant) {
    console.error(`Tenant not found for org ${orgId} during membership event`);
    return { success: false, message: `Tenant not found for org ${orgId}` };
  }

  // Add to public schema user_company_mappings
  await db.insert(userCompanyMappings).values({
    clerkUserId: userId,
    tenantId: tenant.id,
    role,
  });

  // Add to tenant schema user_profiles
  const tenantDb = createTenantDb(tenant.schemaName);
  await tenantDb.db
    .insert(tenantDb.userProfiles)
    .values({
      clerkUserId: userId,
      email,
      firstName,
      lastName,
      role,
    })
    .onConflictDoNothing({ target: tenantDb.userProfiles.clerkUserId });

  console.log(`User ${userId} joined org ${orgId} as ${role}`);
  return { success: true, message: `User ${userId} added to org ${orgId}` };
}

/**
 * Handle organizationMembership.deleted: remove user from tenant.
 */
async function handleMembershipDeleted(
  data: Record<string, unknown>
): Promise<WebhookResult> {
  const orgData = data.organization as Record<string, unknown> | undefined;
  const userData = data.public_user_data as Record<string, unknown> | undefined;

  const orgId = orgData?.id as string;
  const userId = userData?.user_id as string;

  if (!orgId || !userId) {
    throw new Error("Missing org or user data in membership deletion webhook");
  }

  // Resolve tenant
  const tenant = await resolveTenant(orgId);
  if (!tenant) {
    console.warn(`Tenant not found for org ${orgId} during membership deletion`);
    return { success: true, message: "Tenant not found, nothing to clean up" };
  }

  // Remove from public schema user_company_mappings
  await db
    .delete(userCompanyMappings)
    .where(
      and(
        eq(userCompanyMappings.clerkUserId, userId),
        eq(userCompanyMappings.tenantId, tenant.id)
      )
    );

  // Remove from tenant schema user_profiles
  const tenantDb = createTenantDb(tenant.schemaName);
  await tenantDb.db
    .delete(tenantDb.userProfiles)
    .where(eq(tenantDb.userProfiles.clerkUserId, userId));

  console.log(`User ${userId} removed from org ${orgId}`);
  return { success: true, message: `User ${userId} removed from org ${orgId}` };
}
