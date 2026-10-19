import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { ForbiddenError } from "@casl/ability";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { defineAbilitiesFor } from "../../auth/abilities.js";
import { buildCostPerSf, DEFAULT_SF_CATEGORIES, lifecyclePhaseEnum } from "@construction/shared";

/**
 * Cost per square foot report. Costs come from order lines (purchase and work orders, drafts included), sorted into
 * categories you define by keywords in the line description, then divided by each project's square footage.
 */

type Ctx = {
  tenant: NonNullable<Awaited<ReturnType<typeof import("../../tenant/context.js").buildTenantContext>>>;
  userId: string;
  orgRole: string | null;
};

function need(ctx: { tenant?: Ctx["tenant"] | null; userId?: string | null; orgRole?: string | null }): Ctx {
  if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
  return { tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole ?? null };
}

async function can(c: Ctx, action: "read" | "update") {
  const memberships = await c.tenant.db
    .select({ projectId: c.tenant.schema.projectTeamMembers.projectId, role: c.tenant.schema.projectTeamMembers.role })
    .from(c.tenant.schema.projectTeamMembers)
    .where(eq(c.tenant.schema.projectTeamMembers.userId, c.userId));
  const abilities = defineAbilitiesFor(c.orgRole ?? "org:member", c.userId, memberships);
  ForbiddenError.from(abilities).throwUnlessCan(action, "Estimate");
}

async function loadCategories(c: Ctx) {
  const { db, schema } = c.tenant;
  let rows = await db.select().from(schema.costSfCategories).orderBy(asc(schema.costSfCategories.sortOrder));
  if (rows.length === 0) {
    // First visit: start with a few common ones, which can all be renamed, changed or removed.
    await db.insert(schema.costSfCategories).values(DEFAULT_SF_CATEGORIES.map((d, i) => ({ name: d.name, keywords: d.keywords, sortOrder: i })));
    rows = await db.select().from(schema.costSfCategories).orderBy(asc(schema.costSfCategories.sortOrder));
  }
  return rows.map((r) => ({ id: r.id, name: r.name, keywords: r.keywords }));
}

export const costPerSfRouter = router({
  categories: protectedProcedure.query(async ({ ctx }) => {
    const c = need(ctx);
    await can(c, "read");
    return loadCategories(c);
  }),

  saveCategories: protectedProcedure
    .input(
      z.object({
        categories: z
          .array(z.object({ name: z.string().trim().min(1).max(60), keywords: z.array(z.string().trim().min(1).max(60)).max(40) }))
          .max(40),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const c = need(ctx);
      await can(c, "update");
      const names = input.categories.map((x) => x.name.toLowerCase());
      if (new Set(names).size !== names.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Two categories have the same name." });
      const { db, schema } = c.tenant;
      await db.transaction(async (tx) => {
        await tx.delete(schema.costSfCategories);
        if (input.categories.length) {
          await tx.insert(schema.costSfCategories).values(input.categories.map((x, i) => ({ name: x.name, keywords: x.keywords, sortOrder: i })));
        }
      });
      return loadCategories(c);
    }),

  report: protectedProcedure
    .input(
      z.object({
        /** budget = proposal cost when accepted; projected = current expected cost. */
        basis: z.enum(["budget", "projected"]).default("projected"),
        lifecyclePhases: z.array(lifecyclePhaseEnum).max(20).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const c = need(ctx);
      await can(c, "read");
      const { db, schema } = c.tenant;
      const categories = await loadCategories(c);

      const where = [isNull(schema.projects.deletedAt)];
      if (input.lifecyclePhases?.length) where.push(inArray(schema.projects.lifecyclePhase, input.lifecyclePhases));
      const projects = await db
        .select({
          id: schema.projects.id,
          name: schema.projects.name,
          jobNumber: schema.projects.jobNumber,
          slug: schema.projects.slug,
          sqft: schema.projects.buildingSqft,
          phase: schema.projects.lifecyclePhase,
        })
        .from(schema.projects)
        .where(and(...where));

      const sized = projects.filter((p) => Number(p.sqft) > 0);
      const ids = sized.map((p) => p.id);
      const orderRows = ids.length
        ? await db.select({ id: schema.orders.id, projectId: schema.orders.projectId }).from(schema.orders).where(inArray(schema.orders.projectId, ids))
        : [];
      const projectOf = new Map(orderRows.map((o) => [o.id, o.projectId]));
      const lineRows = orderRows.length
        ? await db
            .select({
              orderId: schema.orderLines.orderId,
              description: schema.orderLines.description,
              budget: schema.orderLines.budgetCost,
              projected: schema.orderLines.projectedCost,
            })
            .from(schema.orderLines)
            .where(inArray(schema.orderLines.orderId, orderRows.map((o) => o.id)))
        : [];
      const lines = lineRows.map((l) => ({
        projectId: projectOf.get(l.orderId)!,
        description: l.description,
        amount: Number(input.basis === "budget" ? l.budget : l.projected),
      }));

      const result = buildCostPerSf(
        sized.map((p) => ({ id: p.id, name: p.name, jobNumber: p.jobNumber, slug: p.slug, sqft: Number(p.sqft), phase: p.phase })),
        lines,
        categories,
      );
      return {
        ...result,
        projectsConsidered: projects.length,
        withoutSqft: projects.length - sized.length,
        withoutCost: sized.length - result.rows.length,
      };
    }),
});
