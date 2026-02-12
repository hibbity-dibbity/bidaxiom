import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc.js";
import { authProcedure, protectedProcedure } from "../procedures.js";
import { db } from "../../db/client.js";
import { tenants, userCompanyMappings } from "../../db/schema/public.js";
import { resolveTenant } from "../../tenant/resolve.js";

export const tenantRouter = router({
  /**
   * Get the current tenant context.
   * Requires full protection (auth + MFA + active org).
   */
  current: protectedProcedure.query(({ ctx }) => {
    return {
      tenantId: ctx.tenant.tenantId,
      companyName: ctx.tenant.companyName,
      schemaName: ctx.tenant.schemaName,
    };
  }),

  /**
   * List all organizations the current user belongs to.
   * Uses authProcedure (not protectedProcedure) because user may not have
   * an active org selected yet (e.g., during org switching).
   */
  list: authProcedure.query(async ({ ctx }) => {
    const mappings = await db
      .select({
        tenantId: userCompanyMappings.tenantId,
        role: userCompanyMappings.role,
        companyName: tenants.name,
        schemaName: tenants.schemaName,
      })
      .from(userCompanyMappings)
      .innerJoin(tenants, eq(userCompanyMappings.tenantId, tenants.id))
      .where(eq(userCompanyMappings.clerkUserId, ctx.userId));

    return mappings;
  }),

  /**
   * Validate that the user can switch to a given organization.
   * Uses authProcedure because the user is switching FROM their current org.
   *
   * NOTE: The actual org switch happens on Clerk side via OrganizationSwitcher.
   * This endpoint provides server-side validation.
   */
  switch: authProcedure
    .input(z.object({ orgId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Resolve the target org
      const tenant = await resolveTenant(input.orgId);
      if (!tenant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Verify user has membership
      const membership = await db
        .select()
        .from(userCompanyMappings)
        .where(eq(userCompanyMappings.clerkUserId, ctx.userId))
        .limit(1);

      if (membership.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this organization",
        });
      }

      return {
        tenantId: tenant.id,
        companyName: tenant.name,
        schemaName: tenant.schemaName,
      };
    }),
});
