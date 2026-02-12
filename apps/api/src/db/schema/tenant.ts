import {
  pgSchema,
  uuid,
  text,
  timestamp,
  jsonb,
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

  return {
    schema,
    auditLogs,
    userProfiles,
    companyProfiles,
  };
}

/**
 * Type for the return value of createTenantSchema.
 * Useful for typing context objects that hold tenant DB references.
 */
export type TenantSchema = ReturnType<typeof createTenantSchema>;
