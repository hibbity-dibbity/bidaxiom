import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { router } from "../trpc.js";
import { authProcedure } from "../procedures.js";
import { db, getPool, createTenantDb } from "../../db/client.js";
import {
  users,
  organizations,
  organizationMemberships,
  organizationInvitations,
  userCompanyMappings,
  refreshTokens,
  passkeys,
  passwordResetTokens,
} from "../../db/schema/public.js";
import { randomBytes } from "node:crypto";
import { hashPassword } from "../../auth/password.js";
import { sendPasswordResetEmail } from "../../services/email.js";
import { createAuditLog } from "../../audit/logger.js";
import { AuditAction } from "@construction/shared";
import { provisionTenantSchema } from "../../tenant/provision.js";
import { generateToken } from "../../auth/tokens.js";

/**
 * Organization router uses authProcedure which provides ctx.userId from Clerk JWT.
 * This router handles organization CRUD that will replace Clerk Organizations in Plan 05.
 *
 * During transition period (Plans 03-04), this router coexists with Clerk:
 * - Uses authProcedure (still validates Clerk JWT via existing context.ts)
 * - Creates organizations in our custom tables
 * - Maintains backward compatibility with legacy userCompanyMappings table
 *
 * Plan 05 will replace context.ts to use custom JWT instead of Clerk.
 */

/**
 * Generate a URL-safe slug from organization name.
 * Lowercase, replace spaces with hyphens, strip non-alphanumeric, append random suffix.
 */
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const suffix = nanoid(6).toLowerCase();
  return `${base}-${suffix}`;
}

/**
 * Verify user is an admin of the organization.
 */
async function requireOrgAdmin(userId: string, organizationId: string): Promise<void> {
  const membership = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.organizationId, organizationId)
      )
    )
    .limit(1);

  if (membership.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this organization",
    });
  }

  if (membership[0].role !== "org:admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only organization admins can perform this action",
    });
  }
}

/**
 * Verify user has membership in the organization.
 */
async function requireOrgMembership(userId: string, organizationId: string): Promise<void> {
  const membership = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.organizationId, organizationId)
      )
    )
    .limit(1);

  if (membership.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this organization",
    });
  }
}

/**
 * Send invitation email to user.
 * Uses nodemailer SMTP configuration.
 */
async function sendInvitationEmail(
  email: string,
  organizationName: string,
  token: string
): Promise<void> {
  const inviteUrl = `${process.env.WEB_URL || "http://localhost:3000"}/accept-invitation?token=${token}`;

  // Import email sender dynamically to avoid initialization issues
  const { sendReportEmail } = await import("../../services/email-sender.js");

  const subject = `Invitation to join ${organizationName}`;
  const bodyHtml = `
    <html>
      <body>
        <h2>You've been invited to join ${organizationName}</h2>
        <p>Click the link below to accept your invitation:</p>
        <p><a href="${inviteUrl}">${inviteUrl}</a></p>
        <p>This invitation will expire in 7 days.</p>
      </body>
    </html>
  `;

  // Note: sendReportEmail expects attachment, but we'll use a workaround
  // For now, log the invitation (email sending will be implemented properly in Plan 04)
  console.log(`Invitation email to ${email}:`, inviteUrl);
}

export const organizationRouter = router({
  /**
   * Create a new organization with automatic tenant provisioning.
   */
  create: authProcedure
    .input(
      z.object({
        name: z.string().min(1),
        slug: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // authProcedure guarantees ctx.userId is not null
      const userId = ctx.userId!;

      // Generate slug if not provided
      const slug = input.slug || generateSlug(input.name);

      // Check if slug is already taken
      const existing = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Organization slug already exists",
        });
      }

      // Generate a clerkOrgId-compatible identifier for backward compatibility
      const clerkOrgId = `org_${nanoid(24)}`;

      // Provision tenant schema
      const pool = getPool();
      const tenant = await provisionTenantSchema(clerkOrgId, input.name, pool);

      // Create organization record
      const [org] = await db
        .insert(organizations)
        .values({
          name: input.name,
          slug,
          tenantId: tenant.id,
          createdBy: userId,
          clerkOrgId,
        })
        .returning();

      // Create admin membership for creating user
      await db.insert(organizationMemberships).values({
        userId,
        organizationId: org.id,
        role: "org:admin",
      });

      // Backward compatibility: insert into legacy userCompanyMappings
      await db.insert(userCompanyMappings).values({
        clerkUserId: userId,
        tenantId: tenant.id,
        role: "org:admin",
      });

      // Create user_profile in tenant schema
      const tenantDb = createTenantDb(tenant.schemaName);

      // Get user details from public users table
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user) {
        await tenantDb.db.execute(sql`
          INSERT INTO "${sql.raw(tenant.schemaName)}".user_profiles (
            clerk_user_id, email, first_name, last_name, role
          ) VALUES (
            ${userId}, ${user.email}, ${user.firstName || ""}, ${user.lastName || ""}, ${"org:admin"}
          )
        `);
      }

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        tenantId: tenant.id,
      };
    }),

  /**
   * List all organizations the current user belongs to.
   */
  list: authProcedure.query(async ({ ctx }) => {
    const userId = ctx.userId!;

    const memberships = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        role: organizationMemberships.role,
        tenantId: organizations.tenantId,
      })
      .from(organizationMemberships)
      .innerJoin(
        organizations,
        eq(organizationMemberships.organizationId, organizations.id)
      )
      .where(eq(organizationMemberships.userId, userId));

    return memberships;
  }),

  /**
   * Get organization details by ID.
   */
  getById: authProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.userId!;

      await requireOrgMembership(userId, input.organizationId);

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1);

      if (!org) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Count members
      const memberCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(organizationMemberships)
        .where(eq(organizationMemberships.organizationId, input.organizationId));

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        tenantId: org.tenantId,
        memberCount: memberCount[0]?.count || 0,
        createdAt: org.createdAt,
      };
    }),

  /**
   * Update member role in organization.
   */
  updateMemberRole: authProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        userId: z.string().uuid(),
        role: z.enum([
          "org:admin",
          "org:member",
          "org:project_manager",
          "org:accountant",
          "org:estimator",
          "org:superintendent",
          "org:foreman",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentUserId = ctx.userId!;

      await requireOrgAdmin(currentUserId, input.organizationId);

      // Update membership role
      const [updated] = await db
        .update(organizationMemberships)
        .set({
          role: input.role,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(organizationMemberships.organizationId, input.organizationId),
            eq(organizationMemberships.userId, input.userId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Membership not found",
        });
      }

      // Update user_profile role in tenant schema for consistency
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1);

      if (org && org.tenantId) {
        const [tenant] = await db.query.tenants.findMany({
          where: (tenants, { eq }) => eq(tenants.id, org.tenantId!),
        });

        if (tenant) {
          const tenantDb = createTenantDb(tenant.schemaName);
          await tenantDb.db.execute(sql`
            UPDATE "${sql.raw(tenant.schemaName)}".user_profiles
            SET role = ${input.role}, updated_at = NOW()
            WHERE clerk_user_id = ${input.userId}
          `);
        }
      }

      return updated;
    }),

  /**
   * Admin: reset someone's sign-in. Their password stops working (they get a reset link), they are signed
   * out everywhere, and their authenticator app and passkeys are cleared so they must set up security again.
   */
  resetMemberSignIn: authProcedure
    .input(z.object({ organizationId: z.string().uuid(), userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const adminId = ctx.userId!;
      if (ctx.mfaGate) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Finish setting up your own sign-in security first." });
      }
      await requireOrgAdmin(adminId, input.organizationId);
      if (adminId === input.userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Use Account settings to change your own sign-in." });
      }
      const memberships = await db.select().from(organizationMemberships).where(eq(organizationMemberships.userId, input.userId));
      if (!memberships.some((m) => m.organizationId === input.organizationId)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "That person is not a member of this company." });
      }
      if (memberships.some((m) => m.organizationId !== input.organizationId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That person also belongs to other companies, so their sign-in can only be reset by themselves (Forgot password)." });
      }
      const [target] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      // The old password is dead immediately; only the emailed link sets a new one.
      await db.update(users).set({
        passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
        hashType: "argon2id",
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: null,
        requireMfaSetup: true,
      }).where(eq(users.id, target.id));
      await db.delete(passkeys).where(eq(passkeys.userId, target.id));
      await db.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.userId, target.id), sql`${refreshTokens.revokedAt} IS NULL`));

      const { token, hash } = generateToken();
      await db.insert(passwordResetTokens).values({ userId: target.id, tokenHash: hash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
      await sendPasswordResetEmail(target.email, token);

      if (ctx.tenant) {
        await createAuditLog(ctx.tenant.db, ctx.tenant.schema, {
          entityType: "User", entityId: target.id, action: AuditAction.UPDATE, actorId: adminId,
          changes: { after: { signInReset: true, email: target.email } },
        });
      }
      return { ok: true as const, email: target.email };
    }),

  /**
   * Remove member from organization.
   */
  removeMember: authProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        userId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentUserId = ctx.userId!;

      await requireOrgAdmin(currentUserId, input.organizationId);

      // Check if user is removing themselves as the last admin
      if (currentUserId === input.userId) {
        const adminCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(organizationMemberships)
          .where(
            and(
              eq(organizationMemberships.organizationId, input.organizationId),
              eq(organizationMemberships.role, "org:admin")
            )
          );

        if (adminCount[0]?.count <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot remove the last admin from the organization",
          });
        }
      }

      // Delete from organizationMemberships
      await db
        .delete(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.organizationId, input.organizationId),
            eq(organizationMemberships.userId, input.userId)
          )
        );

      // Delete from legacy userCompanyMappings
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1);

      if (org && org.tenantId) {
        await db
          .delete(userCompanyMappings)
          .where(
            and(
              eq(userCompanyMappings.clerkUserId, input.userId),
              eq(userCompanyMappings.tenantId, org.tenantId)
            )
          );

        // Delete user_profile from tenant schema
        const [tenant] = await db.query.tenants.findMany({
          where: (tenants, { eq }) => eq(tenants.id, org.tenantId!),
        });

        if (tenant) {
          const tenantDb = createTenantDb(tenant.schemaName);
          await tenantDb.db.execute(sql`
            DELETE FROM "${sql.raw(tenant.schemaName)}".user_profiles
            WHERE clerk_user_id = ${input.userId}
          `);
        }
      }

      return { success: true };
    }),

  /**
   * List members of an organization.
   */
  listMembers: authProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.userId!;

      await requireOrgMembership(userId, input.organizationId);

      const members = await db
        .select({
          userId: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: organizationMemberships.role,
          joinedAt: organizationMemberships.createdAt,
        })
        .from(organizationMemberships)
        .innerJoin(users, eq(organizationMemberships.userId, users.id))
        .where(eq(organizationMemberships.organizationId, input.organizationId));

      return members;
    }),

  /**
   * Invite a user to the organization via email.
   */
  invite: authProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        email: z.string().email(),
        role: z.enum([
          "org:admin",
          "org:member",
          "org:project_manager",
          "org:accountant",
          "org:estimator",
          "org:superintendent",
          "org:foreman",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId!;

      await requireOrgAdmin(userId, input.organizationId);

      // Check if email is already a member
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existingUser.length > 0) {
        const existingMembership = await db
          .select()
          .from(organizationMemberships)
          .where(
            and(
              eq(organizationMemberships.userId, existingUser[0].id),
              eq(organizationMemberships.organizationId, input.organizationId)
            )
          )
          .limit(1);

        if (existingMembership.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "User is already a member of this organization",
          });
        }
      }

      // Check if there's already a pending invitation
      const pendingInvitation = await db
        .select()
        .from(organizationInvitations)
        .where(
          and(
            eq(organizationInvitations.organizationId, input.organizationId),
            eq(organizationInvitations.email, input.email),
            eq(organizationInvitations.status, "pending")
          )
        )
        .limit(1);

      if (pendingInvitation.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An invitation has already been sent to this email",
        });
      }

      // Generate invitation token
      const { token, hash } = generateToken();

      // Create invitation with 7-day expiry
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const [invitation] = await db
        .insert(organizationInvitations)
        .values({
          organizationId: input.organizationId,
          email: input.email,
          role: input.role,
          tokenHash: hash,
          status: "pending",
          invitedBy: userId,
          expiresAt,
        })
        .returning();

      // Get organization name for email
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1);

      // Send invitation email
      if (org) {
        await sendInvitationEmail(input.email, org.name, token);
      }

      return {
        invitationId: invitation.id,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
      };
    }),

  /**
   * List pending invitations for an organization.
   */
  listInvitations: authProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.userId!;

      await requireOrgAdmin(userId, input.organizationId);

      const invitations = await db
        .select({
          id: organizationInvitations.id,
          email: organizationInvitations.email,
          role: organizationInvitations.role,
          status: organizationInvitations.status,
          expiresAt: organizationInvitations.expiresAt,
          createdAt: organizationInvitations.createdAt,
        })
        .from(organizationInvitations)
        .where(eq(organizationInvitations.organizationId, input.organizationId));

      return invitations;
    }),

  /**
   * Revoke a pending invitation.
   */
  revokeInvitation: authProcedure
    .input(z.object({ invitationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId!;

      // Get invitation to verify org membership
      const [invitation] = await db
        .select()
        .from(organizationInvitations)
        .where(eq(organizationInvitations.id, input.invitationId))
        .limit(1);

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }

      await requireOrgAdmin(userId, invitation.organizationId);

      // Update invitation status to revoked
      await db
        .update(organizationInvitations)
        .set({ status: "revoked" })
        .where(eq(organizationInvitations.id, input.invitationId));

      return { success: true };
    }),
});
