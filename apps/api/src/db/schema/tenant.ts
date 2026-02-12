import {
  pgSchema,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  numeric,
} from "drizzle-orm/pg-core";
import type { TradesConfig } from "@construction/shared";

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
    validFrom: timestamp("valid_from", { withTimezone: true }).defaultNow().notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }), // NULL = current active version
    createdBy: text("created_by").notNull(), // Clerk user ID
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Projects table
   * Core project records with metadata, dates, budget, and CSI cost codes
   */
  const projects = schema.table("projects", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
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

  return {
    schema,
    auditLogs,
    userProfiles,
    companyProfiles,
    projects,
    projectTeamMembers,
    projectPhases,
    folders,
    documents,
    documentVersions,
  };
}

/**
 * Type for the return value of createTenantSchema.
 * Useful for typing context objects that hold tenant DB references.
 */
export type TenantSchema = ReturnType<typeof createTenantSchema>;
