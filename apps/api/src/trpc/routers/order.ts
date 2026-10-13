import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { asc, eq, inArray } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";

/**
 * Purchase and work orders. For now this only reads the draft orders created when a proposal is
 * accepted; reviewing, issuing and revising them comes with the order screens.
 */
export const orderRouter = router({
  /** Orders generated from one proposal, with vendor names, lines and totals (dollars). */
  listForEstimate: protectedProcedure
    .input(z.object({ estimateId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
      }
      const { db, schema } = ctx.tenant;
      const memberships = await db
        .select({ projectId: schema.projectTeamMembers.projectId, role: schema.projectTeamMembers.role })
        .from(schema.projectTeamMembers)
        .where(eq(schema.projectTeamMembers.userId, ctx.userId));
      const abilities = defineAbilitiesFor(ctx.orgRole ?? "org:member", ctx.userId, memberships);
      ForbiddenError.from(abilities).throwUnlessCan("read", "Estimate");

      const orders = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.estimateId, input.estimateId))
        .orderBy(asc(schema.orders.kind), asc(schema.orders.number));
      if (orders.length === 0) return [];

      const lines = await db
        .select()
        .from(schema.orderLines)
        .where(inArray(schema.orderLines.orderId, orders.map((o) => o.id)))
        .orderBy(asc(schema.orderLines.sortOrder));
      const vendorIds = [...new Set(orders.map((o) => o.vendorId).filter((v): v is string => !!v))];
      const vendors =
        vendorIds.length > 0
          ? await db
              .select({ id: schema.subcontractorDirectory.id, name: schema.subcontractorDirectory.companyName })
              .from(schema.subcontractorDirectory)
              .where(inArray(schema.subcontractorDirectory.id, vendorIds))
          : [];
      const vendorName = new Map(vendors.map((v) => [v.id, v.name]));

      return orders.map((o) => {
        const ol = lines.filter((l) => l.orderId === o.id);
        return {
          id: o.id,
          kind: o.kind as "purchase" | "work",
          number: o.number,
          status: o.status,
          vendorId: o.vendorId,
          vendorName: o.vendorId ? (vendorName.get(o.vendorId) ?? "Unknown vendor") : null,
          budgetTotal: ol.reduce((a, l) => a + Number(l.budgetCost), 0),
          lines: ol.map((l) => ({
            id: l.id,
            description: l.description,
            budgetCost: Number(l.budgetCost),
            projectedCost: Number(l.projectedCost),
          })),
        };
      });
    }),
});
