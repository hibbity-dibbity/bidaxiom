import { resolveTenant } from "./resolve.js";
import { createTenantDb } from "../db/client.js";
import type { TenantSchema } from "../db/schema/tenant.js";

/**
 * Full tenant context for a request.
 * Contains everything needed to scope queries to the correct tenant.
 *
 * IMPORTANT: Never store this in global/module scope.
 * Always create fresh per request via buildTenantContext().
 */
export interface RequestTenantContext {
  tenantId: string;
  schemaName: string;
  companyName: string;
  userId: string;
  db: ReturnType<typeof createTenantDb>["db"];
  schema: TenantSchema;
}

/**
 * Build a request-scoped tenant context from Clerk session data.
 *
 * SECURITY: Tenant ID is NEVER derived from frontend request.
 * It is always resolved from the authenticated Clerk session's org ID.
 *
 * @param clerkOrgId - From authenticated Clerk session (not from request params)
 * @param clerkUserId - From authenticated Clerk session
 * @returns Full tenant context with scoped DB client
 * @throws Error with code TENANT_NOT_FOUND if org has no provisioned schema
 */
export async function buildTenantContext(
  clerkOrgId: string,
  clerkUserId: string
): Promise<RequestTenantContext> {
  const tenant = await resolveTenant(clerkOrgId);

  if (!tenant) {
    const error = new Error(
      `Tenant not found for org ${clerkOrgId}. Schema may not be provisioned yet.`
    );
    (error as Error & { code: string }).code = "TENANT_NOT_FOUND";
    throw error;
  }

  const tenantDb = createTenantDb(tenant.schemaName);

  return {
    tenantId: tenant.id,
    schemaName: tenant.schemaName,
    companyName: tenant.name,
    userId: clerkUserId,
    db: tenantDb.db,
    schema: {
      schema: tenantDb.schema,
      auditLogs: tenantDb.auditLogs,
      userProfiles: tenantDb.userProfiles,
      companyProfiles: tenantDb.companyProfiles,
      customers: tenantDb.customers,
      projects: tenantDb.projects,
      projectTeamMembers: tenantDb.projectTeamMembers,
      projectPhases: tenantDb.projectPhases,
      folders: tenantDb.folders,
      documents: tenantDb.documents,
      documentVersions: tenantDb.documentVersions,
      documentTags: tenantDb.documentTags,
      documentAccessLogs: tenantDb.documentAccessLogs,
      documentWorkflows: tenantDb.documentWorkflows,
      workflowApprovals: tenantDb.workflowApprovals,
      workflowCounters: tenantDb.workflowCounters,
      workflowHistory: tenantDb.workflowHistory,
      documentPermissions: tenantDb.documentPermissions,
      folderPermissions: tenantDb.folderPermissions,
      budgetLineItems: tenantDb.budgetLineItems,
      commitments: tenantDb.commitments,
      commitmentLineItems: tenantDb.commitmentLineItems,
      changeOrders: tenantDb.changeOrders,
      changeOrderLineItems: tenantDb.changeOrderLineItems,
      changeOrderCounters: tenantDb.changeOrderCounters,
      approvalWorkflowSteps: tenantDb.approvalWorkflowSteps,
      changeOrderHistory: tenantDb.changeOrderHistory,
      sovItems: tenantDb.sovItems,
      paymentApps: tenantDb.paymentApps,
      paymentAppLineItems: tenantDb.paymentAppLineItems,
      paymentAppCounters: tenantDb.paymentAppCounters,
      retainageHeld: tenantDb.retainageHeld,
      lienWaivers: tenantDb.lienWaivers,
      paymentAppApprovalSteps: tenantDb.paymentAppApprovalSteps,
      subcontractorDirectory: tenantDb.subcontractorDirectory,
      rfqs: tenantDb.rfqs,
      rfqAmendments: tenantDb.rfqAmendments,
      rfqInvitations: tenantDb.rfqInvitations,
      bids: tenantDb.bids,
      bidVersions: tenantDb.bidVersions,
      bidLevelingNotes: tenantDb.bidLevelingNotes,
      qboConnections: tenantDb.qboConnections,
      qboSyncState: tenantDb.qboSyncState,
      qboEntityMappings: tenantDb.qboEntityMappings,
      qboSyncNotifications: tenantDb.qboSyncNotifications,
      reportDefinitions: tenantDb.reportDefinitions,
      reportTemplates: tenantDb.reportTemplates,
      reportSchedules: tenantDb.reportSchedules,
      materializedReportData: tenantDb.materializedReportData,
      calendarConnections: tenantDb.calendarConnections,
      calendarEvents: tenantDb.calendarEvents,
      calendarSyncState: tenantDb.calendarSyncState,
    },
  };
}
