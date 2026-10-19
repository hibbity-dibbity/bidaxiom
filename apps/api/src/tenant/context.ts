import { eq } from "drizzle-orm";
import { resolveTenantByOrgId } from "./resolve.js";
import { db } from "../db/client.js";
import { organizations } from "../db/schema/public.js";
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
 * Build a request-scoped tenant context from authenticated session data.
 *
 * SECURITY: Tenant ID is NEVER derived from frontend request.
 * It is always resolved from the authenticated session's org ID.
 *
 * @param orgId - From authenticated session (custom org ID or legacy Clerk org ID)
 * @param userId - From authenticated session (custom user ID or legacy Clerk user ID)
 * @returns Full tenant context with scoped DB client
 * @throws Error with code TENANT_NOT_FOUND if org has no provisioned schema
 */
export async function buildTenantContext(
  orgId: string,
  userId: string
): Promise<RequestTenantContext> {
  const tenant = await resolveTenantByOrgId(orgId);

  // The platform operator can switch a company off without touching its data.
  const [org] = await db.select({ disabledAt: organizations.disabledAt, deletedAt: organizations.deletedAt }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (org?.disabledAt || org?.deletedAt) {
    const error = new Error(`Company ${orgId} is disabled.`);
    (error as Error & { code: string }).code = "TENANT_DISABLED";
    throw error;
  }

  if (!tenant) {
    const error = new Error(
      `Tenant not found for org ${orgId}. Schema may not be provisioned yet.`
    );
    (error as Error & { code: string }).code = "TENANT_NOT_FOUND";
    throw error;
  }

  const tenantDb = createTenantDb(tenant.schemaName);

  return {
    tenantId: tenant.id,
    schemaName: tenant.schemaName,
    companyName: tenant.name,
    userId,
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
      subcontractorDirectory: tenantDb.subcontractorDirectory,
      bids: tenantDb.bids,
      bidVersions: tenantDb.bidVersions,
      qboConnections: tenantDb.qboConnections,
      qboSyncState: tenantDb.qboSyncState,
      qboEntityMappings: tenantDb.qboEntityMappings,
      qboSyncNotifications: tenantDb.qboSyncNotifications,
      qboReceipts: tenantDb.qboReceipts,
      qboReceiptAllocations: tenantDb.qboReceiptAllocations,
      qboBills: tenantDb.qboBills,
      qboBillPayments: tenantDb.qboBillPayments,
      qboExpenses: tenantDb.qboExpenses,
      proposalTemplates: tenantDb.proposalTemplates,
      proposalTemplateLines: tenantDb.proposalTemplateLines,
      reportDefinitions: tenantDb.reportDefinitions,
      reportTemplates: tenantDb.reportTemplates,
      reportSchedules: tenantDb.reportSchedules,
      materializedReportData: tenantDb.materializedReportData,
      calendarConnections: tenantDb.calendarConnections,
      calendarEvents: tenantDb.calendarEvents,
      calendarSyncState: tenantDb.calendarSyncState,
      estimates: tenantDb.estimates,
      estimateLineItems: tenantDb.estimateLineItems,
      proposalCostLines: tenantDb.proposalCostLines,
      proposalGlobalCosts: tenantDb.proposalGlobalCosts,
      invoiceMilestones: tenantDb.invoiceMilestones,
      termsVersions: tenantDb.termsVersions,
      termsSections: tenantDb.termsSections,
      orders: tenantDb.orders,
      orderLines: tenantDb.orderLines,
      orderRevisions: tenantDb.orderRevisions,
      orderPayments: tenantDb.orderPayments,
      orderDocuments: tenantDb.orderDocuments,
      materialTakeoffs: tenantDb.materialTakeoffs,
      proposalTakeoffLinks: tenantDb.proposalTakeoffLinks,
      proposalSignatures: tenantDb.proposalSignatures,
      companySignature: tenantDb.companySignature,
      emailLog: tenantDb.emailLog,
      invoices: tenantDb.invoices,
      invoicePayments: tenantDb.invoicePayments,
      invoiceItems: tenantDb.invoiceItems,
      costCodeTemplates: tenantDb.costCodeTemplates,
      templateLineItems: tenantDb.templateLineItems,
      laborRateTemplates: tenantDb.laborRateTemplates,
      estimateVersions: tenantDb.estimateVersions,
      sovVersions: tenantDb.sovVersions,
      projectLifecycleTransitions: tenantDb.projectLifecycleTransitions,
      documentNamingCounters: tenantDb.documentNamingCounters,
      documentTemplates: tenantDb.documentTemplates,
      projectNotes: tenantDb.projectNotes,
      costSfCategories: tenantDb.costSfCategories,
      actionPrompts: tenantDb.actionPrompts,
    },
  };
}
