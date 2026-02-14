import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { desc, like, or, eq, inArray } from "drizzle-orm";
import { generateToken } from "../../auth/tokens.js";
import { db as publicDb } from "../../db/client.js";
import { organizationInvitations, organizations, users } from "../../db/schema/public.js";

/**
 * User management router.
 * Handles listing users in tenant and inviting new users.
 */
export const userRouter = router({
  /**
   * List all users in the current tenant
   */
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().int().positive().max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;

      // Build WHERE conditions
      const conditions = [];
      if (input.search) {
        conditions.push(
          or(
            like(schema.userProfiles.email, `%${input.search}%`),
            like(schema.userProfiles.firstName, `%${input.search}%`),
            like(schema.userProfiles.lastName, `%${input.search}%`)
          )
        );
      }

      const whereClause = conditions.length > 0 ? conditions[0] : undefined;

      const userProfiles = await db
        .select({
          id: schema.userProfiles.id,
          clerkUserId: schema.userProfiles.clerkUserId,
          email: schema.userProfiles.email,
          firstName: schema.userProfiles.firstName,
          lastName: schema.userProfiles.lastName,
          role: schema.userProfiles.role,
        })
        .from(schema.userProfiles)
        .where(whereClause)
        .orderBy(desc(schema.userProfiles.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      // Batch-lookup public users to get the actual users.id UUID
      // The clerkUserId column contains either old Clerk IDs or new UUIDs (users.id)
      const clerkUserIds = userProfiles.map(p => p.clerkUserId);

      let publicUsers: Array<{ id: string; clerkUserId: string | null }> = [];
      if (clerkUserIds.length > 0) {
        publicUsers = await publicDb
          .select({
            id: users.id,
            clerkUserId: users.clerkUserId,
          })
          .from(users)
          .where(
            or(
              inArray(users.id, clerkUserIds),
              inArray(users.clerkUserId, clerkUserIds.filter(id => id !== null))
            )
          );
      }

      // Build map: clerkUserId -> users.id
      const userIdMap = new Map<string, string>();
      for (const publicUser of publicUsers) {
        // Match by users.id (for new users where clerkUserId stores users.id)
        userIdMap.set(publicUser.id, publicUser.id);
        // Match by users.clerkUserId (for old users with actual Clerk IDs)
        if (publicUser.clerkUserId) {
          userIdMap.set(publicUser.clerkUserId, publicUser.id);
        }
      }

      // Map to include userId field
      const mappedUsers = userProfiles.map(profile => ({
        ...profile,
        userId: userIdMap.get(profile.clerkUserId) || profile.clerkUserId,
      }));

      return {
        items: mappedUsers,
        total: mappedUsers.length,
      };
    }),

  /**
   * Invite a new user to the organization via email.
   * Note: This procedure is kept for backward compatibility.
   * For new code, use the organization router's invite procedure instead.
   *
   * Redirects to the organization invitation system (custom auth).
   */
  invite: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        role: z.enum(["org:admin", "org:member"]).default("org:member"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId || !ctx.orgId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      // Only org admins can invite users
      if (!ctx.orgRole || !ctx.orgRole.includes("admin")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only organization admins can invite users",
        });
      }

      // Find the organization by orgId
      const [org] = await publicDb
        .select()
        .from(organizations)
        .where(eq(organizations.id, ctx.orgId))
        .limit(1);

      if (!org) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Generate invitation token (plaintext for email, hash for DB)
      const { token, hash } = await generateToken();

      // Calculate expiry (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Create invitation record
      const [invitation] = await publicDb
        .insert(organizationInvitations)
        .values({
          organizationId: ctx.orgId,
          email: input.email,
          role: input.role,
          tokenHash: hash,
          status: "pending",
          invitedBy: ctx.userId,
          expiresAt,
        })
        .returning();

      // Send invitation email (logs to console in dev mode)
      try {
        const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/accept-invitation?token=${token}`;
        console.log(`Invitation email to ${input.email}:`, inviteUrl);
      } catch (err) {
        console.warn("Failed to send invitation email:", err);
      }

      return {
        id: invitation.id,
        email: input.email,
        status: invitation.status,
      };
    }),
});
