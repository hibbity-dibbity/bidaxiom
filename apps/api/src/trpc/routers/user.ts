import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { desc, like, or } from "drizzle-orm";

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

      const users = await db
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

      return {
        items: users,
        total: users.length,
      };
    }),

  /**
   * Invite a new user to the organization via email
   * Note: This uses Clerk's invitation API
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

      try {
        // Use Clerk SDK to create organization invitation
        const { createClerkClient } = await import("@clerk/backend");
        const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

        const invitation = await clerkClient.organizations.createOrganizationInvitation({
          organizationId: ctx.orgId,
          emailAddress: input.email,
          role: input.role,
          publicMetadata: {
            firstName: input.firstName,
            lastName: input.lastName,
          },
        });

        return {
          id: invitation.id,
          email: input.email,
          status: invitation.status,
        };
      } catch (error: any) {
        // Log the full error for debugging
        console.error("Invitation error:", error);
        console.error("Error details:", {
          message: error.message,
          clerkError: error.clerkError,
          errors: error.errors,
          status: error.status,
        });

        // Check if it's a Clerk error
        if (error.clerkError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.errors?.[0]?.message || "Failed to send invitation",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to send invitation",
        });
      }
    }),
});
