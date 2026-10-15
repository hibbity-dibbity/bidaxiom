import {
  integer,
  bigint,
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  boolean,
  unique,
  jsonb,
} from "drizzle-orm/pg-core";

/** A person's passkey (WebAuthn credential). The private key never leaves their device. */
export const passkeys = pgTable("passkeys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(), // JWK as JSON
  alg: integer("alg").notNull(),
  counter: bigint("counter", { mode: "number" }).notNull().default(0),
  transports: jsonb("transports").$type<string[]>().notNull().default([]),
  backedUp: boolean("backed_up").notNull().default(false),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
}, (table) => ({
  userIdx: index("idx_passkeys_user").on(table.userId),
}));

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

// --- Custom Auth Tables (Phase 12) ---

/**
 * Users table - replaces Clerk user management.
 * Central user identity. Each user can belong to multiple organizations.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  passwordHash: text("password_hash").notNull(),
  hashType: text("hash_type").notNull().default("argon2id"), // argon2id or bcrypt (for migration)
  firstName: text("first_name"),
  lastName: text("last_name"),
  avatarUrl: text("avatar_url"),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  /** An admin reset this person's sign-in: they must set up a second factor before using the app. */
  requireMfaSetup: boolean("require_mfa_setup").notNull().default(false),
  mfaSecret: text("mfa_secret"), // Encrypted TOTP secret
  mfaBackupCodes: jsonb("mfa_backup_codes").$type<string[]>(), // Hashed backup codes
  clerkUserId: text("clerk_user_id"), // For migration tracking, nullable
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("idx_users_email").on(table.email),
  clerkUserIdx: index("idx_users_clerk_user_id").on(table.clerkUserId),
}));

/**
 * Organizations - replaces Clerk Organizations.
 * Each organization maps to a tenant schema.
 */
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // URL-safe identifier
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").references(() => users.id),
  clerkOrgId: text("clerk_org_id"), // For migration tracking, nullable
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  slugIdx: index("idx_organizations_slug").on(table.slug),
  clerkOrgIdx: index("idx_organizations_clerk_org_id").on(table.clerkOrgId),
}));

/**
 * Organization memberships - replaces Clerk organization memberships.
 * Maps users to organizations with roles.
 */
export const organizationMemberships = pgTable("organization_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("org:member"), // org:admin, org:member, org:project_manager, etc.
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userOrgUnique: unique().on(table.userId, table.organizationId),
  userIdx: index("idx_org_memberships_user").on(table.userId),
  orgIdx: index("idx_org_memberships_org").on(table.organizationId),
}));

/**
 * Organization invitations - replaces Clerk invitation flow.
 * Admin-initiated invitations with 7-day TTL.
 */
export const organizationInvitations = pgTable("organization_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("org:member"),
  tokenHash: text("token_hash").notNull(), // Hashed invitation token
  status: text("status").notNull().default("pending"), // pending, accepted, expired, revoked
  invitedBy: uuid("invited_by").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("idx_org_invitations_email").on(table.email),
  orgIdx: index("idx_org_invitations_org").on(table.organizationId),
}));

/**
 * Refresh tokens - for JWT refresh token rotation with reuse detection.
 * Stored in Redis for fast lookup; DB is fallback/audit.
 */
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  familyId: text("family_id").notNull(), // Token family for rotation tracking
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  replacedByHash: text("replaced_by_hash"), // Points to the token that replaced this one
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index("idx_refresh_tokens_user").on(table.userId),
  familyIdx: index("idx_refresh_tokens_family").on(table.familyId),
}));

/**
 * Email verification tokens.
 * Token is hashed before storage; plaintext sent in email.
 */
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index("idx_email_verification_user").on(table.userId),
}));

/**
 * Password reset tokens.
 * Token is hashed before storage; plaintext sent in email.
 */
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index("idx_password_reset_user").on(table.userId),
}));

/**
 * Single sign-on connection: one company's own OpenID Connect app registration (Microsoft, Google,
 * Okta, ...). The company creates the registration and gives us the issuer, client id and secret.
 */
export const ssoConnections = pgTable("sso_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().unique().references(() => organizations.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // preset used to fill it in: microsoft, google, oidc
  issuer: text("issuer").notNull(),
  clientId: text("client_id").notNull(),
  clientSecretEnc: text("client_secret_enc").notNull(), // AES-GCM, see auth/oidc/secret.ts
  verified: boolean("verified").notNull().default(false), // an admin has signed in through it successfully
  enabled: boolean("enabled").notNull().default(true),
  enforceSso: boolean("enforce_sso").notNull().default(false), // members (not admins) must use SSO, not a password
  autoProvision: boolean("auto_provision").notNull().default(false), // create accounts on first sign-in
  defaultRole: text("default_role").notNull().default("org:member"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** A user's identity at their company's identity provider (the provider's stable id for them). */
export const ssoIdentities = pgTable("sso_identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  connectionId: uuid("connection_id").notNull().references(() => ssoConnections.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  identityUnique: unique().on(table.connectionId, table.subject),
  userIdx: index("idx_sso_identities_user").on(table.userId),
}));

/**
 * Email domains a company has claimed for single sign-on. A domain only routes sign-ins once the
 * company has proven it owns it by publishing a DNS TXT record; each domain can belong to one company.
 */
export const ssoDomains = pgTable("sso_domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectionId: uuid("connection_id").notNull().references(() => ssoConnections.id, { onDelete: "cascade" }),
  domain: text("domain").notNull(),
  token: text("token"),
  codeHash: text("code_hash"),
  codeExpiresAt: timestamp("code_expires_at", { withTimezone: true }),
  codeAttempts: integer("code_attempts").notNull().default(0),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  connDomainUnique: unique().on(table.connectionId, table.domain),
}));
