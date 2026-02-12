import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * Public schema: tenants table
 * Central registry of all company tenants.
 * Each tenant maps to a Clerk organization and a PostgreSQL schema.
 */
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  schemaName: text("schema_name").unique().notNull(),
  clerkOrgId: text("clerk_org_id").unique().notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Public schema: user_company_mappings table
 * Maps Clerk users to tenants with their role.
 * A user can belong to multiple companies (multi-org support).
 */
export const userCompanyMappings = pgTable(
  "user_company_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("idx_ucm_clerk_user_id").on(table.clerkUserId),
    tenantIdx: index("idx_ucm_tenant_id").on(table.tenantId),
  })
);
