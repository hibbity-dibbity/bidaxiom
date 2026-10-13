import {
  pgSchema,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  numeric,
  boolean,
  unique,
  index,
} from "drizzle-orm/pg-core";
import type {
  TradesConfig,
  JobNumberSettings,
  RetainageConfig,
  ReportFilter,
  ReportColumn,
  ReportChartConfig,
  DocumentNamingSettings,
  DetectedField,
  FieldMapping,
} from "@construction/shared";

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
    defaultProjectMode: text("default_project_mode").default("gc_advanced"),
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
        startingSequenceNumber: 1,
        nextSequenceNumber: 1,
        lastGeneratedFormat: null,
      }),
    retainageConfig: jsonb("retainage_config")
      .$type<RetainageConfig>()
      .default({
        defaultRate: 10,
        progressiveRates: [],
        releaseConditions: {
          substantialCompletion: true,
          punchListComplete: false,
          finalAcceptance: false,
          lienWaiversRequired: true,
        },
      }),
    // logoStorageKey: text("logo_storage_key"), // Logo columns removed in quick-17 (static BidAxiom branding)
    // Company contact info for document generation
    phone: text("phone"),
    website: text("website"),
    license: text("license"), // Contractor license number
    street1: text("street1"),
    street2: text("street2"),
    city: text("city"),
    state: text("state"), // 2-char US state abbreviation
    zip: text("zip"),
    allowPersonalTemplates: boolean("allow_personal_templates"), // Allow users to create personal estimate templates (default: true if null)
    sovGroupingMethod: text("sov_grouping_method"), // Default SOV grouping method: csi, phase, payment_schedule (default: csi if null)
    documentNamingSettings: jsonb("document_naming_settings")
      .$type<DocumentNamingSettings>(), // Per-doc-type naming templates (null = use default pattern)
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
    address: text("address"), // Legacy field - will be cleared by migration
    street1: text("street1"),
    street2: text("street2"),
    city: text("city"),
    state: text("state"), // 2-char US state abbreviation
    zip: text("zip"),
    slug: text("slug").unique(), // URL-safe slug for routing
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
    slug: text("slug"),  // URL-safe slug: {jobnumber}-{projectname}
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
    description: text("description"),
    location: text("location"), // Legacy field - will be cleared by migration
    street1: text("street1"),
    street2: text("street2"),
    city: text("city"),
    state: text("state"), // 2-char US state abbreviation
    zip: text("zip"),
    projectType: text("project_type").notNull(), // commercial, residential, infrastructure, industrial
    status: text("status").notNull().default("active"), // active, on_hold, completed, archived, bidding
    lifecyclePhase: text("lifecycle_phase").notNull().default("opportunity"),
    projectMode: text("project_mode").notNull().default("gc_advanced"),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    budget: numeric("budget", { precision: 15, scale: 2 }),
    customerBudget: numeric("customer_budget", { precision: 15, scale: 2 }),
    buildingWidth: numeric("building_width", { precision: 10, scale: 2 }),
    buildingLength: numeric("building_length", { precision: 10, scale: 2 }),
    buildingHeight: numeric("building_height", { precision: 10, scale: 2 }),
    buildingSqft: numeric("building_sqft", { precision: 12, scale: 2 }),
    costCodes: jsonb("cost_codes").notNull().default([]).$type<number[]>(),
    metadata: jsonb("metadata").notNull().default({}).$type<Record<string, unknown>>(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: text("deleted_by"),         // Clerk user ID of deleting admin
    deletionReason: text("deletion_reason"),
    restoredAt: timestamp("restored_at", { withTimezone: true }),
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
   * Document templates table
   * Company-scoped custom templates (.docx/.xlsx) for PDF generation.
   * Stores detected merge fields and user-defined field mappings.
   * One active template per doc type (enforced by partial unique index in DB).
   */
  const documentTemplates = schema.table("document_templates", {
    id: uuid("id").primaryKey().defaultRandom(),
    docType: text("doc_type").notNull(), // "proposal" | "change_order" | "payment_app" | "rfq"
    name: text("name").notNull(),
    fileType: text("file_type").notNull(), // "docx" | "xlsx"
    storageKey: text("storage_key").notNull(),
    fileSize: integer("file_size"),
    detectedFields: jsonb("detected_fields").notNull().$type<DetectedField[]>().default([]),
    fieldMappings: jsonb("field_mappings").notNull().$type<FieldMapping[]>().default([]),
    isActive: boolean("is_active").notNull().default(false),
    uploadedBy: text("uploaded_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
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
    category: text("category"), // contract, drawing, specification, submittal, rfi, change_order, payment_app, invoice, report, photo, closeout, other
    description: text("description"),
    currentVersionId: uuid("current_version_id"),
    fileSize: integer("file_size"),
    contentType: text("content_type"),
    templateId: uuid("template_id").references(() => documentTemplates.id, { onDelete: "set null" }),
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
   * Document tags
   * Many-to-many relationship between documents and tags for organization
   */
  const documentTags = schema.table("document_tags", {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(), // lowercase, normalized
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Document access logs
   * Audit trail for document view and download events
   */
  const documentAccessLogs = schema.table("document_access_logs", {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(), // Clerk user ID
    action: text("action").notNull(), // view, download
    ipAddress: text("ip_address"),
    accessedAt: timestamp("accessed_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Document workflows (RFI, Submittal, Transmittal)
   * Links documents to formal workflow processes with approval chains
   * One workflow per document (unique constraint on documentId)
   */
  const documentWorkflows = schema.table("document_workflows", {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull().unique().references(() => documents.id, { onDelete: "cascade" }),
    workflowType: text("workflow_type").notNull(), // rfi, submittal, transmittal
    workflowNumber: text("workflow_number").notNull(), // e.g., "RFI-001", "SUB-024", "TX-012"
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), // Denormalized for queries
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("draft"), // draft, submitted, under_review, approved, rejected, closed, cancelled
    priority: text("priority"), // low, medium, high, urgent
    dueDate: timestamp("due_date", { withTimezone: true }),
    submittedBy: text("submitted_by"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    responseDocumentId: uuid("response_document_id").references(() => documents.id, { onDelete: "set null" }),
    respondedBy: text("responded_by"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Workflow approvals
   * Multi-step approval process for document workflows
   * Supports specific user, any with role, or all with role requirements
   */
  const workflowApprovals = schema.table("workflow_approvals", {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id").notNull().references(() => documentWorkflows.id, { onDelete: "cascade" }),
    stepNumber: integer("step_number").notNull(),
    approverUserId: text("approver_user_id"), // Nullable - null means any user with role
    approverRole: text("approver_role"), // Nullable - project_manager, superintendent, etc.
    requirementType: text("requirement_type").notNull(), // specific_user, any_with_role, all_with_role
    status: text("status").notNull().default("pending"), // pending, approved, rejected, skipped
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    comments: text("comments"),
  });

  /**
   * Workflow counters
   * Sequential numbering for workflow types per project
   * Uses SELECT FOR UPDATE for race-free sequential numbering
   */
  const workflowCounters = schema.table("workflow_counters", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    workflowType: text("workflow_type").notNull(), // rfi, submittal, transmittal
    currentNumber: integer("current_number").notNull().default(0),
  });

  /**
   * Workflow history
   * Tracks all state changes and field updates for workflows
   * Complete audit trail for workflow lifecycle
   */
  const workflowHistory = schema.table("workflow_history", {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id").notNull().references(() => documentWorkflows.id, { onDelete: "cascade" }),
    changedBy: text("changed_by").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    fieldName: text("field_name"), // Nullable - for non-status field changes
    oldValue: text("old_value"), // Nullable
    newValue: text("new_value"), // Nullable
    comment: text("comment"),
  });

  /**
   * Document permissions
   * Granular sharing permissions for specific documents
   * Allows users to grant view/edit access to individuals beyond project team
   * Folder permissions are inherited when document has no explicit permissions
   */
  const documentPermissions = schema.table("document_permissions", {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(), // Clerk user ID of person granted access
    permissionLevel: text("permission_level").notNull(), // view, edit
    grantedBy: text("granted_by").notNull(), // Clerk user ID who shared
    grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }), // null = no expiration
  }, (table) => ({
    // One permission level per user per document
    uniqueDocumentUser: unique().on(table.documentId, table.userId),
    // Fast permission checks
    documentUserIdx: index().on(table.documentId, table.userId),
    // "Shared with me" queries
    userIdx: index().on(table.userId),
  }));

  /**
   * Folder permissions
   * Granular sharing permissions for folders
   * Permissions cascade to documents within when includeSubfolders is true
   */
  const folderPermissions = schema.table("folder_permissions", {
    id: uuid("id").primaryKey().defaultRandom(),
    folderId: uuid("folder_id").notNull().references(() => folders.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(), // Clerk user ID of person granted access
    permissionLevel: text("permission_level").notNull(), // view, edit
    includeSubfolders: boolean("include_subfolders").notNull().default(true), // cascade to child folders
    grantedBy: text("granted_by").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }), // null = no expiration
  }, (table) => ({
    // One permission level per user per folder
    uniqueFolderUser: unique().on(table.folderId, table.userId),
    // Fast permission checks
    folderUserIdx: index().on(table.folderId, table.userId),
  }));

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
    actualCost: numeric("actual_cost", { precision: 15, scale: 2 }).notNull().default("0"),
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
   * Document naming counters
   * Company-scoped sequential counters for PDF document numbering (Phase 38).
   * One counter per doc type per tenant schema (no project scoping).
   * Use SELECT FOR UPDATE for race-free atomic increments.
   */
  const documentNamingCounters = schema.table("document_naming_counters", {
    id: uuid("id").primaryKey().defaultRandom(),
    docType: text("doc_type").notNull(), // "proposal" | "change_order" | "payment_app" | "rfq"
    currentNumber: integer("current_number").notNull().default(0),
  }, (table) => ({
    docTypeUnique: unique("document_naming_counters_doc_type_unique").on(table.docType),
  }));

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
    address: text("address"), // Legacy field - will be cleared by migration
    street1: text("street1"),
    street2: text("street2"),
    city: text("city"),
    state: text("state"), // 2-char US state abbreviation
    zip: text("zip"),
    trades: jsonb("trades").notNull().default([]).$type<number[]>(),
    trade: jsonb("trade").notNull().default([]).$type<string[]>(),
    tradeOther: text("trade_other"),
    notes: text("notes"),
    status: text("status").notNull().default("active"), // active, inactive, blacklisted
    // Subs & Vendors directory fields (phase 1 of the proposal builder)
    kind: text("kind").notNull().default("subcontractor"), // subcontractor, supplier
    category: text("category"), // supplier category, e.g. "Building materials"
    paymentTerms: text("payment_terms"), // e.g. "Net 30"
    creditLimit: numeric("credit_limit", { precision: 15, scale: 2 }),
    taxIdLast4: text("tax_id_last4"), // only the last 4 digits are stored; the full ID lives on the W-9
    w9OnFile: boolean("w9_on_file").notNull().default(false),
    w9ReceivedAt: timestamp("w9_received_at", { withTimezone: true }),
    insuranceExpiresAt: timestamp("insurance_expires_at", { withTimezone: true }),
    is1099: boolean("is_1099").notNull().default(false),
    slug: text("slug").unique(), // URL-safe slug for routing
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
    rfqId: uuid("rfq_id").references(() => rfqs.id, { onDelete: "cascade" }), // Nullable - supports estimate-based bids
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }), // Required for all bids
    invitationId: uuid("invitation_id").references(() => rfqInvitations.id, { onDelete: "set null" }),
    subcontractorId: uuid("subcontractor_id").references(() => subcontractorDirectory.id, { onDelete: "set null" }),
    bidderCompanyName: text("bidder_company_name").notNull(),
    bidderContactEmail: text("bidder_contact_email"),
    currentVersionId: uuid("current_version_id"),
    estimateId: uuid("estimate_id").references(() => estimates.id, { onDelete: "set null" }),
    status: text("status").notNull().default("draft"), // draft, submitted, won, lost, withdrawn
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    awardedAt: timestamp("awarded_at", { withTimezone: true }),
    awardedBy: text("awarded_by"),
    commitmentId: text("commitment_id"), // TEXT reference to avoid circular FK
    notes: text("notes"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: text("closed_by"),
    closedNotes: text("closed_notes"),
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

  /**
   * QuickBooks Online connections
   * Stores OAuth tokens and connection metadata for QBO integration
   */
  const qboConnections = schema.table("qbo_connections", {
    id: uuid("id").primaryKey().defaultRandom(),
    realmId: text("realm_id").notNull(),
    environment: text("environment").notNull(), // sandbox | production
    accessToken: text("access_token"), // Short-lived (1 hour), OK unencrypted
    encryptedRefreshToken: text("encrypted_refresh_token").notNull(), // AES-256-GCM encrypted
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }).notNull(),
    companyName: text("company_name"),
    status: text("status").notNull().default("active"), // active | disconnected | expired | error
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    connectedBy: text("connected_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * QuickBooks sync state
   * Tracks last successful sync per entity type
   */
  const qboSyncState = schema.table("qbo_sync_state", {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(), // project, invoice, bill, payment, vendor, customer
    lastSuccessfulSync: timestamp("last_successful_sync", { withTimezone: true }),
    lastCdcSync: timestamp("last_cdc_sync", { withTimezone: true }),
    syncStatus: text("sync_status").notNull().default("pending"), // pending | syncing | synced | error | conflict
    errorMessage: text("error_message"),
    syncedCount: integer("synced_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * QuickBooks entity mappings
   * Bidirectional mapping between platform IDs and QBO IDs
   */
  const qboEntityMappings = schema.table("qbo_entity_mappings", {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(), // project, invoice, bill, payment, vendor, customer
    platformId: uuid("platform_id").notNull(),
    qboId: text("qbo_id").notNull(), // QBO entity ID (string, not integer)
    qboSyncToken: text("qbo_sync_token"), // QBO's optimistic lock token
    direction: text("direction").notNull().default("bidirectional"), // platform_to_qbo | qbo_to_platform | bidirectional
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    syncStatus: text("sync_status").notNull().default("synced"), // pending | syncing | synced | error | conflict
    metadata: jsonb("metadata").default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * QuickBooks sync notifications
   * User-facing alerts for sync failures after retries exhausted
   */
  const qboSyncNotifications = schema.table("qbo_sync_notifications", {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(), // project, invoice, bill, payment, vendor, customer
    entityId: text("entity_id"), // Platform or QBO ID of the failed entity
    message: text("message").notNull(),
    severity: text("severity").notNull().default("error"), // error | warning | info
    dismissed: boolean("dismissed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Report definitions
   * User-created custom reports with filter, column, and chart configurations
   * Supports saving and reusing report configurations across different data sources
   */
  const reportDefinitions = schema.table("report_definitions", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    type: text("type").notNull(), // ReportType enum
    dataSource: text("data_source").notNull(), // projects, budgets, change_orders, payment_apps, bids, commitments
    filters: jsonb("filters").notNull().default([]).$type<ReportFilter[]>(),
    columns: jsonb("columns").notNull().$type<ReportColumn[]>(),
    sortBy: jsonb("sort_by").$type<{ field: string; direction: "asc" | "desc" }>(),
    groupBy: text("group_by"),
    chartConfig: jsonb("chart_config").$type<ReportChartConfig>(),
    status: text("status").notNull().default("active"), // ReportStatus enum: draft, active, archived
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Report templates
   * Pre-built report configurations that can be instantiated by users
   * System templates (isSystem=true) are read-only, tenant templates can be customized
   */
  const reportTemplates = schema.table("report_templates", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    type: text("type").notNull(), // ReportType enum
    isSystem: boolean("is_system").notNull().default(false),
    definition: jsonb("definition").notNull().$type<Partial<{
      type: string;
      dataSource: string;
      filters: ReportFilter[];
      columns: ReportColumn[];
      sortBy?: { field: string; direction: "asc" | "desc" };
      groupBy?: string;
      chartConfig?: ReportChartConfig;
      status: string;
    }>>(),
    previewImageUrl: text("preview_image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Report schedules
   * Automated report generation and email delivery on a recurring schedule
   * Supports daily, weekly, monthly, and quarterly frequencies
   */
  const reportSchedules = schema.table("report_schedules", {
    id: uuid("id").primaryKey().defaultRandom(),
    reportDefinitionId: uuid("report_definition_id").notNull().references(() => reportDefinitions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    frequency: text("frequency").notNull(), // ScheduleFrequency enum: daily, weekly, monthly, quarterly
    dayOfWeek: integer("day_of_week"), // 0-6, Sunday=0
    dayOfMonth: integer("day_of_month"), // 1-31
    time: text("time").notNull(), // HH:MM format
    recipients: jsonb("recipients").notNull().$type<string[]>(),
    format: text("format").notNull(), // ExportFormat enum: pdf, excel, csv
    isActive: boolean("is_active").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Materialized report data
   * Cached report results with expiry timestamps for performance optimization
   * Avoids re-running expensive queries for frequently accessed reports
   */
  const materializedReportData = schema.table("materialized_report_data", {
    id: uuid("id").primaryKey().defaultRandom(),
    reportDefinitionId: uuid("report_definition_id").notNull().references(() => reportDefinitions.id, { onDelete: "cascade" }),
    data: jsonb("data").notNull().$type<unknown>(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  });

  /**
   * Calendar connections
   * Per-user OAuth connections to Google Calendar or Microsoft Outlook
   * One connection per provider per user
   */
  const calendarConnections = schema.table("calendar_connections", {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(), // google, microsoft
    userId: text("user_id").notNull(), // Clerk user ID (per-user, not per-company)
    status: text("status").notNull().default("active"), // active, disconnected, expired, error
    accessToken: text("access_token"), // Short-lived (1 hour), OK unencrypted
    encryptedRefreshToken: text("encrypted_refresh_token").notNull(), // AES-256-GCM encrypted
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }), // NULL for Google
    calendarId: text("calendar_id").notNull().default("primary"), // "primary" for Google
    providerEmail: text("provider_email"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    syncToken: text("sync_token"), // Google syncToken or Microsoft deltaLink
    webhookChannelId: text("webhook_channel_id"), // Google channel ID
    webhookResourceId: text("webhook_resource_id"), // Google resource ID
    webhookSubscriptionId: text("webhook_subscription_id"), // Microsoft subscription ID
    webhookExpiresAt: timestamp("webhook_expires_at", { withTimezone: true }), // Webhook expiry
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  }, (table) => ({
    // One connection per provider per user
    uniqueProviderUser: unique().on(table.provider, table.userId),
  }));

  /**
   * Calendar events
   * Bidirectional sync between platform milestones and external calendar events
   */
  const calendarEvents = schema.table("calendar_events", {
    id: uuid("id").primaryKey().defaultRandom(),
    calendarConnectionId: uuid("calendar_connection_id").notNull().references(() => calendarConnections.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }), // NULL for external-origin events
    externalEventId: text("external_event_id").notNull(), // Google/Microsoft event ID
    title: text("title").notNull(),
    description: text("description"),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }),
    allDay: boolean("all_day").notNull().default(false),
    timezone: text("timezone"), // IANA timezone
    source: text("source").notNull(), // platform, external
    sourceEntityType: text("source_entity_type"), // project, project_phase
    sourceEntityId: text("source_entity_id"), // Project ID or phase ID
    etag: text("etag"), // Provider ETag for conflict detection
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  }, (table) => ({
    // Prevent duplicate events
    uniqueConnectionEvent: unique().on(table.calendarConnectionId, table.externalEventId),
    // Fast project milestone queries
    projectIdIdx: index().on(table.projectId),
    // Reverse lookups for source entity
    sourceEntityIdx: index().on(table.sourceEntityType, table.sourceEntityId),
  }));

  /**
   * Calendar sync state
   * Tracks sync status and metrics per connection
   */
  const calendarSyncState = schema.table("calendar_sync_state", {
    id: uuid("id").primaryKey().defaultRandom(),
    calendarConnectionId: uuid("calendar_connection_id").notNull().unique().references(() => calendarConnections.id, { onDelete: "cascade" }),
    lastFullSyncAt: timestamp("last_full_sync_at", { withTimezone: true }),
    lastIncrementalSyncAt: timestamp("last_incremental_sync_at", { withTimezone: true }),
    syncStatus: text("sync_status").notNull().default("idle"), // idle, syncing, synced, error
    syncedEventCount: integer("synced_event_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Estimates
   * Core estimate records with versioning and template tracking
   */
  const estimates = schema.table("estimates", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("draft"), // draft, submitted, accepted, under_contract
    projectType: text("project_type").notNull(), // commercial, residential, infrastructure, industrial
    appliedCostCodeTemplateId: uuid("applied_cost_code_template_id"),
    appliedLaborRateTemplateId: uuid("applied_labor_rate_template_id"),
    overheadType: text("overhead_type").notNull().default("percentage"), // percentage, fixed
    overheadValue: numeric("overhead_value", { precision: 15, scale: 2 }).notNull().default("0"),
    markupBase: text("markup_base").notNull().default("direct"), // direct, direct_plus_overhead
    directCosts: numeric("direct_costs", { precision: 15, scale: 2 }).notNull().default("0"),
    overheadAmount: numeric("overhead_amount", { precision: 15, scale: 2 }).notNull().default("0"),
    markupAmount: numeric("markup_amount", { precision: 15, scale: 2 }).notNull().default("0"),
    totalCost: numeric("total_cost", { precision: 15, scale: 2 }).notNull().default("0"),
    currentVersion: integer("current_version").notNull().default(1),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    linkedBidId: uuid("linked_bid_id"),
    // Proposal builder fields (phase 2). A proposal is an estimate.
    salesTaxPercent: numeric("sales_tax_percent", { precision: 5, scale: 2 }).notNull().default("0"),
    paymentTerms: text("payment_terms").notNull().default("Net 30"),
    validDays: integer("valid_days").notNull().default(30),
    termsVersionId: uuid("terms_version_id"), // master terms version pinned when the proposal is sent
    revision: integer("revision").notNull().default(1), // 1 for the original, 2+ for revisions of a sent proposal
    revisionOfId: uuid("revision_of_id"), // the proposal this one revises
    isActive: boolean("is_active").notNull().default(false), // the one proposal per project that feeds the project numbers
    slug: text("slug").unique(), // URL-safe slug for routing
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Proposal cost lines (replaces estimate_line_items for the proposal builder).
   * Two levels only: parentId is null for parents and standalone optional items,
   * and points at a parent for children. A parent with children is priced from them.
   */
  const proposalCostLines = schema.table("proposal_cost_lines", {
    id: uuid("id").primaryKey().defaultRandom(),
    estimateId: uuid("estimate_id").notNull().references(() => estimates.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"), // self-reference enforced by the router (kept FK-free so replace-all saves are simple)
    type: text("type").notNull(), // labor, material, subcontractor, equipment, other
    name: text("name").notNull(),
    costCodeId: integer("cost_code_id"), // required at acceptance, except for type "other"
    quantity: numeric("quantity", { precision: 15, scale: 4 }).notNull().default("1"),
    unit: text("unit").notNull().default("ea"),
    unitCost: numeric("unit_cost", { precision: 15, scale: 4 }).notNull().default("0"),
    marginPercent: numeric("margin_percent", { precision: 5, scale: 2 }).notNull().default("0"),
    contingencyPercent: numeric("contingency_percent", { precision: 6, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    visibility: text("visibility").notNull().default("price"), // price, name_only, hidden (children only)
    isOptional: boolean("is_optional").notNull().default(false),
    optionAccepted: boolean("option_accepted"), // null = undecided; set when the proposal is accepted
    vendorId: uuid("vendor_id"), // subcontractor_directory.id (suppliers and subs)
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Global costs (overhead, fuel, etc.): face value, spread across base parent lines.
   */
  const proposalGlobalCosts = schema.table("proposal_global_costs", {
    id: uuid("id").primaryKey().defaultRandom(),
    estimateId: uuid("estimate_id").notNull().references(() => estimates.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull().default("0"),
    sortOrder: integer("sort_order").notNull().default(0),
  });

  /**
   * Master terms and conditions. Every save of the settings screen creates a new immutable
   * version; a proposal pins the version that was current when it was sent.
   */
  const termsVersions = schema.table("terms_versions", {
    id: uuid("id").primaryKey().defaultRandom(),
    version: integer("version").notNull().unique(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  const termsSections = schema.table("terms_sections", {
    id: uuid("id").primaryKey().defaultRandom(),
    versionId: uuid("version_id").notNull().references(() => termsVersions.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
  });

  /**
   * Purchase orders and work orders generated when a proposal is accepted. One table with a
   * kind ("purchase" or "work"); detail fields for each kind are added with the order screens.
   * vendorId is null while the order is an unassigned draft.
   */
  const orders = schema.table("orders", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    estimateId: uuid("estimate_id").notNull().references(() => estimates.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // purchase, work
    number: text("number").notNull(), // PO<job number>-01, WO<job number>-01
    vendorId: uuid("vendor_id"), // subcontractor_directory.id
    status: text("status").notNull().default("draft"), // draft, issued, partially_paid, paid, closed
    revision: integer("revision").notNull().default(1),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Lines on an order. budgetCost is the proposal cost at acceptance and never changes;
   * projectedCost starts equal to it and is editable on draft orders.
   */
  const orderLines = schema.table("order_lines", {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    sourceLineId: uuid("source_line_id"), // proposal_cost_lines.id it came from
    description: text("description").notNull(),
    costCodeId: integer("cost_code_id"), // unused; kept for old rows
    category: text("category"), // COGS: Materials & Supplies / Equipment Rental / Subcontract Labor
    budgetCost: numeric("budget_cost", { precision: 15, scale: 2 }).notNull().default("0"),
    projectedCost: numeric("projected_cost", { precision: 15, scale: 2 }).notNull().default("0"),
    exclusions: text("exclusions"), // work orders only
    sortOrder: integer("sort_order").notNull().default(0),
  });

  /**
   * Invoicing schedule: percentage milestones that must total 100.
   */
  const invoiceMilestones = schema.table("invoice_milestones", {
    id: uuid("id").primaryKey().defaultRandom(),
    estimateId: uuid("estimate_id").notNull().references(() => estimates.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    percent: numeric("percent", { precision: 5, scale: 2 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  });

  /**
   * Estimate line items
   * Individual cost line items within an estimate
   */
  const estimateLineItems = schema.table("estimate_line_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    estimateId: uuid("estimate_id").notNull().references(() => estimates.id, { onDelete: "cascade" }),
    costCodeId: integer("cost_code_id").notNull(),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 15, scale: 4 }).notNull(),
    unit: text("unit").notNull(), // ea, sf, lf, ton, hr
    unitCost: numeric("unit_cost", { precision: 15, scale: 4 }).notNull(),
    costType: text("cost_type").notNull(), // labor, material, equipment, subcontractor
    customMarkupPercent: numeric("custom_markup_percent", { precision: 5, scale: 2 }),
    sourceTemplateId: uuid("source_template_id"), // NO FK - tracks origin without constraint
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Cost code templates
   * Company and personal templates for recurring estimate structures
   */
  const costCodeTemplates = schema.table("cost_code_templates", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    scope: text("scope").notNull(), // company, personal
    projectType: text("project_type"), // applies to all if null
    createdBy: text("created_by").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Template line items
   * Predefined line items within cost code templates
   */
  const templateLineItems = schema.table("template_line_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id").notNull().references(() => costCodeTemplates.id, { onDelete: "cascade" }),
    costCodeId: integer("cost_code_id").notNull(),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 15, scale: 4 }),
    unit: text("unit"),
    estimatedUnitCost: numeric("estimated_unit_cost", { precision: 15, scale: 4 }),
    costType: text("cost_type").notNull(), // labor, material, equipment, subcontractor
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Labor rate templates
   * Company and personal templates for labor classifications and rates
   */
  const laborRateTemplates = schema.table("labor_rate_templates", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    scope: text("scope").notNull(), // company, personal
    rates: jsonb("rates").notNull().$type<Record<string, number>>(), // { "Foreman": 65, "Carpenter": 45 }
    createdBy: text("created_by").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Estimate versions
   * Snapshot history of estimates for change tracking
   */
  const estimateVersions = schema.table("estimate_versions", {
    id: uuid("id").primaryKey().defaultRandom(),
    estimateId: uuid("estimate_id").notNull().references(() => estimates.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status").notNull(),
    snapshot: jsonb("snapshot").notNull().$type<Record<string, unknown>>(), // complete estimate + line items + totals
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * SOV versions
   * Schedule of Values version history linked to estimate versions
   */
  const sovVersions = schema.table("sov_versions", {
    id: uuid("id").primaryKey().defaultRandom(),
    sovId: uuid("sov_id").notNull(),
    estimateVersionId: uuid("estimate_version_id").references(() => estimateVersions.id, { onDelete: "set null" }),
    version: integer("version").notNull(),
    status: text("status").notNull(), // draft, submitted, accepted, contractual
    lineItems: jsonb("line_items").notNull().$type<unknown[]>(), // array of SOV line items with metadata
    createdFromChangeOrder: uuid("created_from_change_order").references(() => changeOrders.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Project lifecycle transitions
   * Immutable audit trail of all lifecycle phase transitions for projects.
   * Records every state machine transition with actor, reason, and event source.
   */
  const projectLifecycleTransitions = schema.table("project_lifecycle_transitions", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    fromPhase: text("from_phase").notNull(),
    toPhase: text("to_phase").notNull(),
    triggeredBy: text("triggered_by").notNull(), // 'user' | 'system'
    actorId: text("actor_id").notNull(),          // user UUID or 'system'
    reason: text("reason"),                        // Required for backward transitions
    eventSource: text("event_source"),             // e.g., 'estimate_created', 'pay_app_approved'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Project notes
   * Free-form team notes per project. Hard delete (no soft delete).
   */
  const projectNotes = schema.table("project_notes", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(), // Clerk/internal user ID (ctx.userId)
    content: text("content").notNull(),
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
    documentTags,
    documentAccessLogs,
    documentWorkflows,
    workflowApprovals,
    workflowCounters,
    workflowHistory,
    documentPermissions,
    folderPermissions,
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
    qboConnections,
    qboSyncState,
    qboEntityMappings,
    qboSyncNotifications,
    reportDefinitions,
    reportTemplates,
    reportSchedules,
    materializedReportData,
    calendarConnections,
    calendarEvents,
    calendarSyncState,
    estimates,
    estimateLineItems,
    proposalCostLines,
    proposalGlobalCosts,
    invoiceMilestones,
    termsVersions,
    termsSections,
    orders,
    orderLines,
    costCodeTemplates,
    templateLineItems,
    laborRateTemplates,
    estimateVersions,
    sovVersions,
    projectLifecycleTransitions,
    documentNamingCounters,
    documentTemplates,
    projectNotes,
  };
}

/**
 * Type for the return value of createTenantSchema.
 * Useful for typing context objects that hold tenant DB references.
 */
export type TenantSchema = ReturnType<typeof createTenantSchema>;
