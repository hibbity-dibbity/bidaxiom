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
import { sendPasswordResetEmail, sendInvitationEmail } from "../../services/email.js";
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

/** Email an invitation. Never throws: returns whether the email went out and why not if it did not. */
async function mailInvitation(
  inviterId: string,
  email: string,
  organizationName: string,
  token: string
): Promise<{ emailSent: boolean; emailError: string | null }> {
  try {
    const [inviter] = await db.select().from(users).where(eq(users.id, inviterId)).limit(1);
    const name = [inviter?.firstName, inviter?.lastName].filter(Boolean).join(" ") || inviter?.email || "Your administrator";
    const sent = await sendInvitationEmail(email, organizationName, name, token);
    return { emailSent: sent, emailError: sent ? null : "Email is not set up on the server (no RESEND_API_KEY)." };
  } catch (err) {
    return { emailSent: false, emailError: err instanceof Error ? err.message : "The email service refused the message." };
  }
}

export const organizationRouter = router({
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
        // One company per account: an email that already has an account cannot be invited anywhere else.
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

        throw new TRPCError({
          code: "CONFLICT",
          message: existingMembership.length > 0
            ? "User is already a member of this organization"
            : "That email already has a BidAxiom account. Each account belongs to one company, so use a different email address.",
        });
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

      const mail = org
        ? await mailInvitation(userId, input.email, org.name, token)
        : { emailSent: false, emailError: "Company not found." };

      return {
        invitationId: invitation.id,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
        ...mail,
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
   * Send a pending invitation again. The old link stops working: a new one is issued and the
   * 7-day clock restarts.
   */
  resendInvitation: authProcedure
    .input(z.object({ invitationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId!;
      const [invitation] = await db
        .select()
        .from(organizationInvitations)
        .where(eq(organizationInvitations.id, input.invitationId))
        .limit(1);
      if (!invitation) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
      await requireOrgAdmin(userId, invitation.organizationId);
      if (invitation.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only a pending invitation can be sent again" });
      }
      const { token, hash } = generateToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await db
        .update(organizationInvitations)
        .set({ tokenHash: hash, expiresAt })
        .where(eq(organizationInvitations.id, invitation.id));
      const [org] = await db.select().from(organizations).where(eq(organizations.id, invitation.organizationId)).limit(1);
      const mail = org
        ? await mailInvitation(userId, invitation.email, org.name, token)
        : { emailSent: false, emailError: "Company not found." };
      return { email: invitation.email, expiresAt, ...mail };
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
