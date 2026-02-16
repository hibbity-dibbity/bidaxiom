import { router } from "../trpc.js";
import { authorizedProcedure } from "../procedures.js";
import { globalSearchInputSchema } from "@construction/shared";
import { ilike, or } from "drizzle-orm";

export const searchRouter = router({
  global: authorizedProcedure
    .input(globalSearchInputSchema)
    .query(async ({ ctx, input }) => {
      const { query, limit } = input;
      const searchPattern = `%${query}%`;

      // Runtime check (TypeScript doesn't know authorizedProcedure guarantees non-null tenant)
      if (!ctx.tenant) {
        throw new Error("Tenant context missing");
      }

      const { projects, customers } = ctx.tenant.schema;

      // Search projects (job number, name)
      const projectResults = await ctx.tenant.db
        .select({
          id: projects.id,
          name: projects.name,
          jobNumber: projects.jobNumber,
          customerId: projects.customerId,
          slug: projects.slug,
        })
        .from(projects)
        .where(
          or(
            ilike(projects.name, searchPattern),
            ilike(projects.jobNumber, searchPattern)
          )
        )
        .limit(limit);

      // Search customers (company name, contact name)
      const customerResults = await ctx.tenant.db
        .select({
          id: customers.id,
          companyName: customers.companyName,
          contactName: customers.contactName,
        })
        .from(customers)
        .where(
          or(
            ilike(customers.companyName, searchPattern),
            ilike(customers.contactName, searchPattern)
          )
        )
        .limit(limit);

      // Transform to SearchResult[]
      const results = [
        ...projectResults.map((p) => ({
          type: "project" as const,
          id: p.id,
          title: p.name,
          subtitle: p.jobNumber,
          url: `/projects/${p.slug}`,
        })),
        ...customerResults.map((c) => ({
          type: "customer" as const,
          id: c.id,
          title: c.companyName || c.contactName,
          subtitle: c.companyName ? c.contactName : null,
          url: `/customers/${c.id}`,
        })),
      ];

      return results.slice(0, limit);
    }),
});
