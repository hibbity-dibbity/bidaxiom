import {
  pgSchema,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  numeric,
  boolean,
} from "drizzle-orm/pg-core";
import type { TradesConfig, JobNumberSettings } from "@construction/shared";

/**
 * Creates a tenant-scoped schema with all tenant-specific tables.
 * Each company gets its own PostgreSQL schema for data isolation.
 *
 * @param schemaName - The PostgreSQL schema name (e.g., "tenant_abc123")
 * @returns Object containing all table definitions scoped to the schema
 *
 * NOTE: More tables (projects, budgets, change_orders, etc.) will be added
 * in future phases. Keep this function extensible.
 */
export function createTenantSchema(schemaName: string) {
  const schema = pgSchema(schemaName);

  /**
   * Immutable audit log. UPDATE and DELETE are revoked on this table.
   * Every sensitive action is recorded with before/after state.
   */
  const auditLogs = schema.table("audit_logs", {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    actorId: text("actor_id").notNull(),
    actorEmail: text("actor_email"),
    changes: jsonb("changes").notNull().$type<Record<string, unknown>>(),
    ipAddress: text("ip_address"),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * User profiles within this tenant.
   * Synced from Clerk on membership events.
   */
  const userProfiles = schema.table("user_profiles", {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    email: text("email").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Company configuration profiles with effective dating.
   * Tracks company type (GC/sub/both) and trade capabilities over time.
   *
   * Effective dating pattern:
   * - validFrom/validTo define the time range this version is active
   * - Current version has validTo = NULL
   * - Historical versions have validTo set when a new version is created
   * - Supports point-in-time queries for historical context (e.g., company config at bid date)
   */
  const companyProfiles = schema.table("company_profiles", {
    id: uuid("id").primaryKey().defaultRandom(),
    companyType: text("company_type").notNull(), // gc_only, sub_only, both
    tradesConfig: jsonb("trades_config")
      .notNull()
      .$type<TradesConfig>()
      .default({ csiDivisions: [], customTrades: [] }),
    jobNumberSettings: jsonb("job_number_settings")
      .$type<JobNumberSettings>()
      .default({
        enabled: false,
        template: "{YYYY}-{NNN}",
        nextSequenceNumber: 1,
        lastGeneratedFormat: null,
      }),
    validFrom: timestamp("valid_from", { withTimezone: true }).defaultNow().notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }), // NULL = current active version
    createdBy: text("created_by").notNull(), // Clerk user ID
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Customers table
   * Stores customer/client information for projects
   */
  const customers = schema.table("customers", {
    id: uuid("id").primaryKey().defaultRandom(),
    companyName: text("company_name"), // Nullable - not all customers are companies
    contactName: text("contact_name").notNull(), // Primary contact person
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Projects table
   * Core project records with metadata, dates, budget, and CSI cost codes
   */
  const projects = schema.table("projects", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    jobNumber: text("job_number"), // Nullable, unique constraint via partial index
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
    description: text("description"),
    location: text("location"),
    projectType: text("project_type").notNull(), // commercial, residential, infrastructure, industrial
    status: text("status").notNull().default("active"), // active, on_hold, completed, archived
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    budget: numeric("budget", { precision: 15, scale: 2 }),
    costCodes: jsonb("cost_codes").notNull().default([]).$type<number[]>(),
    metadata: jsonb("metadata").notNull().default({}).$type<Record<string, unknown>>(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Project team members
   * Assigns users to projects with project-specific roles
   * Unique constraint ensures one role per user per project
   */
  const projectTeamMembers = schema.table("project_team_members", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: text("role").notNull(), // project_manager, superintendent, foreman, estimator, accountant, viewer
    assignedBy: text("assigned_by").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Project phases
   * Tracks construction phases with dates and status
   */
  const projectPhases = schema.table("project_phases", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    orderIndex: integer("order_index").notNull(),
    status: text("status").notNull().default("pending"), // pending, in_progress, completed
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Folders for document organization
   * Supports hierarchical structure via parentId (self-referential)
   * No FK on parentId to avoid circular reference complexity
   */
  const folders = schema.table("folders", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    name: text("name").notNull(),
    description: text("description"),
    orderIndex: integer("order_index").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Documents table
   * Holds document metadata. Actual file content is in document_versions.
   * currentVersionId points to the latest version.
   */
  const documents = schema.table("documents", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id").references(() => folders.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    currentVersionId: uuid("current_version_id"),
    fileSize: integer("file_size"),
    contentType: text("content_type"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Document versions table
   * Stores version history for documents. Each upload creates a new version.
   */
  const documentVersions = schema.table("document_versions", {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    storageKey: text("storage_key").notNull(),
    fileSize: integer("file_size").notNull(),
    contentType: text("content_type").notNull(),
    uploadedBy: text("uploaded_by").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
    changeNotes: text("change_notes"),
  });

  /**
   * Budget line items
   * Each line item represents a budget allocation for a specific cost code
   * Cost codes 0-49 are CSI divisions, 50+ are custom company codes
   */
  const budgetLineItems = schema.table("budget_line_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    costCodeId: integer("cost_code_id").notNull(),
    description: text("description").notNull(),
    budgetedAmount: numeric("budgeted_amount", { precision: 15, scale: 2 }).notNull(),
    isLocked: boolean("is_locked").notNull().default(false),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Commitments (subcontracts and purchase orders)
   * Tracks financial commitments before actual costs are incurred
   */
  const commitments = schema.table("commitments", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'subcontract' or 'purchase_order'
    vendorName: text("vendor_name").notNull(),
    contractNumber: text("contract_number"),
    description: text("description"),
    totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
    status: text("status").notNull().default("draft"), // draft, pending, approved, executed, closed
    executedAt: timestamp("executed_at", { withTimezone: true }),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Commitment line items
   * Maps commitments to budget line items for cost tracking
   */
  const commitmentLineItems = schema.table("commitment_line_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    commitmentId: uuid("commitment_id").notNull().references(() => commitments.id, { onDelete: "cascade" }),
    budgetLineItemId: uuid("budget_line_item_id").references(() => budgetLineItems.id, { onDelete: "set null" }),
    costCodeId: integer("cost_code_id").notNull(),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Change orders table
   * Tracks owner, internal, and subcontractor change orders with status workflow
   */
  const changeOrders = schema.table("change_orders", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'owner', 'internal', 'subcontractor'
    status: text("status").notNull().default("draft"), // draft, pco_submitted, pending_approval, approved, rejected, void
    pcoNumber: text("pco_number"), // e.g., "PCO-2024-001" (assigned on submit)
    coNumber: text("co_number"), // e.g., "CO-2024-001" (assigned on approval)
    title: text("title").notNull(),
    description: text("description").notNull(),
    reason: text("reason"), // for internal COs: error, efficiency, value_engineering, other
    commitmentId: uuid("commitment_id").references(() => commitments.id, { onDelete: "set null" }), // for subcontractor COs
    requestedBy: text("requested_by"), // for owner COs: who requested the change
    totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull().default("0"),
    relatedDocuments: jsonb("related_documents").notNull().default([]).$type<string[]>(), // array of document IDs from Phase 3
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    submittedBy: text("submitted_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: text("approved_by"),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectedBy: text("rejected_by"),
    rejectionReason: text("rejection_reason"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Change order line items
   * Individual line items within a change order mapped to budget line items
   */
  const changeOrderLineItems = schema.table("change_order_line_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    changeOrderId: uuid("change_order_id").notNull().references(() => changeOrders.id, { onDelete: "cascade" }),
    budgetLineItemId: uuid("budget_line_item_id").references(() => budgetLineItems.id, { onDelete: "set null" }),
    costCodeId: integer("cost_code_id").notNull(),
    description: text("description").notNull(),
    amountChange: numeric("amount_change", { precision: 15, scale: 2 }).notNull(), // positive = increase, negative = decrease
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Change order counters
   * Sequential numbering for PCO and CO numbers scoped by project and year
   */
  const changeOrderCounters = schema.table("change_order_counters", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'pco' or 'co'
    year: integer("year").notNull(),
    lastNumber: integer("last_number").notNull().default(0),
  });

  /**
   * Approval workflow steps
   * Defines multi-step approval requirements for change orders
   */
  const approvalWorkflowSteps = schema.table("approval_workflow_steps", {
    id: uuid("id").primaryKey().defaultRandom(),
    changeOrderId: uuid("change_order_id").notNull().references(() => changeOrders.id, { onDelete: "cascade" }),
    stepOrder: integer("step_order").notNull(), // 1, 2, 3...
    approverRole: text("approver_role"), // normalized Clerk role e.g., "org:project_manager"
    approverUserId: text("approver_user_id"), // specific user or null = any with role
    requirementType: text("requirement_type").notNull().default("all"), // 'all', 'any', 'specific'
    status: text("status").notNull().default("pending"), // pending, approved, rejected, skipped
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    comments: text("comments"),
  });

  /**
   * Change order history
   * Field-level audit trail for change order modifications
   */
  const changeOrderHistory = schema.table("change_order_history", {
    id: uuid("id").primaryKey().defaultRandom(),
    changeOrderId: uuid("change_order_id").notNull().references(() => changeOrders.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    changedBy: text("changed_by").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
    changeType: text("change_type").notNull(), // 'field_update', 'status_change', 'approval', 'line_item_change'
    fieldName: text("field_name"), // e.g., 'description', 'totalAmount'
    oldValue: jsonb("old_value").$type<unknown>(),
    newValue: jsonb("new_value").$type<unknown>(),
    comments: text("comments"),
  });

  /**
   * Schedule of Values (SOV) items
   * Defines the cost breakdown structure for payment applications
   */
  const sovItems = schema.table("sov_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    budgetLineItemId: uuid("budget_line_item_id").references(() => budgetLineItems.id, { onDelete: "set null" }),
    itemNumber: text("item_number").notNull(),
    description: text("description").notNull(),
    scheduledValue: numeric("scheduled_value", { precision: 15, scale: 2 }).notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Payment applications (AIA G702 summary)
   * Tracks contractor applications for payment
   */
  const paymentApps = schema.table("payment_apps", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    applicationNumber: text("application_number").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    originalContractSum: numeric("original_contract_sum", { precision: 15, scale: 2 }).notNull(),
    netChangeByChangeOrders: numeric("net_change_by_change_orders", { precision: 15, scale: 2 }).default("0"),
    contractSumToDate: numeric("contract_sum_to_date", { precision: 15, scale: 2 }).notNull(),
    totalCompletedAndStored: numeric("total_completed_and_stored", { precision: 15, scale: 2 }).notNull().default("0"),
    retainageAmount: numeric("retainage_amount", { precision: 15, scale: 2 }).notNull().default("0"),
    totalEarnedLessRetainage: numeric("total_earned_less_retainage", { precision: 15, scale: 2 }).notNull().default("0"),
    previousPayments: numeric("previous_payments", { precision: 15, scale: 2 }).default("0"),
    currentPaymentDue: numeric("current_payment_due", { precision: 15, scale: 2 }).notNull().default("0"),
    balanceToFinish: numeric("balance_to_finish", { precision: 15, scale: 2 }).notNull().default("0"),
    status: text("status").notNull().default("draft"), // draft, submitted, under_review, approved, rejected, paid
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: text("approved_by"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Payment application line items (AIA G703 continuation sheet)
   * Individual line items within a payment application
   */
  const paymentAppLineItems = schema.table("payment_app_line_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentAppId: uuid("payment_app_id").notNull().references(() => paymentApps.id, { onDelete: "cascade" }),
    sovItemId: uuid("sov_item_id").notNull().references(() => sovItems.id, { onDelete: "restrict" }),
    previousPercentComplete: numeric("previous_percent_complete", { precision: 5, scale: 2 }).notNull().default("0"),
    currentPercentComplete: numeric("current_percent_complete", { precision: 5, scale: 2 }).notNull(),
    workCompletedThisPeriod: numeric("work_completed_this_period", { precision: 15, scale: 2 }).notNull(),
    materialsStoredThisPeriod: numeric("materials_stored_this_period", { precision: 15, scale: 2 }).notNull().default("0"),
    totalCompletedAndStored: numeric("total_completed_and_stored", { precision: 15, scale: 2 }).notNull(),
    retainagePercent: numeric("retainage_percent", { precision: 5, scale: 2 }).notNull(),
    retainageAmount: numeric("retainage_amount", { precision: 15, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Payment application counters
   * Sequential numbering for payment applications
   */
  const paymentAppCounters = schema.table("payment_app_counters", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    lastNumber: integer("last_number").notNull().default(0),
  });

  /**
   * Retainage held
   * Tracks retainage amounts held from payment applications
   */
  const retainageHeld = schema.table("retainage_held", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    paymentAppId: uuid("payment_app_id").notNull().references(() => paymentApps.id, { onDelete: "cascade" }),
    amountHeld: numeric("amount_held", { precision: 15, scale: 2 }).notNull(),
    retainageRate: numeric("retainage_rate", { precision: 5, scale: 2 }).notNull(),
    status: text("status").notNull().default("held"), // held, eligible_for_release, released
    releasedAmount: numeric("released_amount", { precision: 15, scale: 2 }).default("0"),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releasedBy: text("released_by"),
    releaseNotes: text("release_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Lien waivers
   * Tracks conditional and unconditional lien waivers for payment applications
   */
  const lienWaivers = schema.table("lien_waivers", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    paymentAppId: uuid("payment_app_id").notNull().references(() => paymentApps.id, { onDelete: "cascade" }),
    waiverType: text("waiver_type").notNull(), // partial_conditional, partial_unconditional, final_conditional, final_unconditional
    partyName: text("party_name").notNull(),
    partyType: text("party_type").notNull(), // subcontractor, supplier, vendor
    throughDate: timestamp("through_date", { withTimezone: true }).notNull(),
    amountWaived: numeric("amount_waived", { precision: 15, scale: 2 }).notNull(),
    status: text("status").notNull().default("pending"), // pending, received, verified, stored
    receivedAt: timestamp("received_at", { withTimezone: true }),
    receivedBy: text("received_by"),
    requiresNotarization: boolean("requires_notarization").notNull().default(false),
    isNotarized: boolean("is_notarized").notNull().default(false),
    usesStatutoryForm: boolean("uses_statutory_form").notNull().default(false),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Payment application approval steps
   * Multi-step approval workflow for payment applications
   */
  const paymentAppApprovalSteps = schema.table("payment_app_approval_steps", {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentAppId: uuid("payment_app_id").notNull().references(() => paymentApps.id, { onDelete: "cascade" }),
    stepOrder: integer("step_order").notNull(),
    approverRole: text("approver_role"),
    approverUserId: text("approver_user_id"),
    requirementType: text("requirement_type").notNull().default("all"), // all, any, specific
    status: text("status").notNull().default("pending"), // pending, approved, rejected, skipped
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    comments: text("comments"),
  });

  /**
   * Subcontractor directory
   * Company's subcontractor contacts and trade capabilities
   */
  const subcontractorDirectory = schema.table("subcontractor_directory", {
    id: uuid("id").primaryKey().defaultRandom(),
    companyName: text("company_name").notNull(),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    address: text("address"),
    trades: jsonb("trades").notNull().default([]).$type<number[]>(),
    notes: text("notes"),
    status: text("status").notNull().default("active"), // active, inactive, blacklisted
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Request for Quotation (RFQ)
   * Tracks RFQ issuance to subcontractors
   */
  const rfqs = schema.table("rfqs", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    rfqNumber: text("rfq_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    scopeOfWork: text("scope_of_work").notNull(),
    trades: jsonb("trades").notNull().default([]).$type<number[]>(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("draft"), // draft, issued, closed, awarded, cancelled
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    issuedBy: text("issued_by"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    attachmentIds: jsonb("attachment_ids").default([]).$type<string[]>(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * RFQ amendments
   * Immutable amendment trail for RFQs
   */
  const rfqAmendments = schema.table("rfq_amendments", {
    id: uuid("id").primaryKey().defaultRandom(),
    rfqId: uuid("rfq_id").notNull().references(() => rfqs.id, { onDelete: "cascade" }),
    amendmentNumber: integer("amendment_number").notNull(),
    description: text("description").notNull(),
    scopeChanges: text("scope_changes"),
    dueDateChange: timestamp("due_date_change", { withTimezone: true }),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * RFQ invitations
   * Tracks which subs were invited to an RFQ
   */
  const rfqInvitations = schema.table("rfq_invitations", {
    id: uuid("id").primaryKey().defaultRandom(),
    rfqId: uuid("rfq_id").notNull().references(() => rfqs.id, { onDelete: "cascade" }),
    subcontractorId: uuid("subcontractor_id").references(() => subcontractorDirectory.id, { onDelete: "set null" }),
    externalEmail: text("external_email"),
    externalCompanyName: text("external_company_name"),
    status: text("status").notNull().default("pending"), // pending, viewed, responded, declined
    sentAt: timestamp("sent_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Bids
   * Bid submissions from subcontractors
   */
  const bids = schema.table("bids", {
    id: uuid("id").primaryKey().defaultRandom(),
    rfqId: uuid("rfq_id").notNull().references(() => rfqs.id, { onDelete: "cascade" }),
    invitationId: uuid("invitation_id").references(() => rfqInvitations.id, { onDelete: "set null" }),
    subcontractorId: uuid("subcontractor_id").references(() => subcontractorDirectory.id, { onDelete: "set null" }),
    bidderCompanyName: text("bidder_company_name").notNull(),
    bidderContactEmail: text("bidder_contact_email"),
    currentVersionId: uuid("current_version_id"),
    status: text("status").notNull().default("submitted"), // submitted, under_review, shortlisted, awarded, rejected, withdrawn
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    awardedAt: timestamp("awarded_at", { withTimezone: true }),
    awardedBy: text("awarded_by"),
    commitmentId: text("commitment_id"), // TEXT reference to avoid circular FK
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Bid versions
   * Snapshot versioning for bids
   */
  const bidVersions = schema.table("bid_versions", {
    id: uuid("id").primaryKey().defaultRandom(),
    bidId: uuid("bid_id").notNull().references(() => bids.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
    lineItems: jsonb("line_items").notNull().$type<Array<{
      description: string;
      quantity?: number;
      unitPrice?: number;
      amount: number;
      costCodeId?: number;
    }>>(),
    scopeNotes: text("scope_notes"),
    exclusions: text("exclusions"),
    inclusions: text("inclusions"),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    triggerAmendmentId: uuid("trigger_amendment_id").references(() => rfqAmendments.id, { onDelete: "set null" }),
  });

  /**
   * Bid leveling notes
   * Scope leveling annotations for bid comparison
   */
  const bidLevelingNotes = schema.table("bid_leveling_notes", {
    id: uuid("id").primaryKey().defaultRandom(),
    rfqId: uuid("rfq_id").notNull().references(() => rfqs.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id").notNull().references(() => bids.id, { onDelete: "cascade" }),
    category: text("category").notNull(), // scope_gap, scope_extra, clarification, risk
    note: text("note").notNull(),
    adjustmentAmount: numeric("adjustment_amount", { precision: 15, scale: 2 }),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  return {
    schema,
    auditLogs,
    userProfiles,
    companyProfiles,
    customers,
    projects,
    projectTeamMembers,
    projectPhases,
    folders,
    documents,
    documentVersions,
    budgetLineItems,
    commitments,
    commitmentLineItems,
    changeOrders,
    changeOrderLineItems,
    changeOrderCounters,
    approvalWorkflowSteps,
    changeOrderHistory,
    sovItems,
    paymentApps,
    paymentAppLineItems,
    paymentAppCounters,
    retainageHeld,
    lienWaivers,
    paymentAppApprovalSteps,
    subcontractorDirectory,
    rfqs,
    rfqAmendments,
    rfqInvitations,
    bids,
    bidVersions,
    bidLevelingNotes,
  };
}

/**
 * Type for the return value of createTenantSchema.
 * Useful for typing context objects that hold tenant DB references.
 */
export type TenantSchema = ReturnType<typeof createTenantSchema>;
