import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { asc, desc, eq, max } from "drizzle-orm";
import { router } from "../trpc.js";
import { protectedProcedure, authorizedProcedure } from "../procedures.js";
import { requirePermission } from "../middleware/authorize.js";

/** Starter sections, written once when a company opens the terms screen for the first time. */
export const DEFAULT_TERMS_SECTIONS: Array<{ title: string; body: string }> = [
  { title: "Payment", body: "[Your payment terms: due dates, late fees, accepted payment methods.]" },
  { title: "Changes in scope", body: "[Your change order terms: how scope changes are priced and approved.]" },
  { title: "Warranty", body: "[Your warranty terms.]" },
  { title: "Insurance and permits", body: "[Who obtains permits and what insurance coverage applies.]" },
];

type Tenant = NonNullable<
  Awaited<ReturnType<typeof import("../../tenant/context.js").buildTenantContext>>
>;

async function readVersion(tenant: Tenant, versionId: string) {
  const { db, schema } = tenant;
  const [v] = await db.select().from(schema.termsVersions).where(eq(schema.termsVersions.id, versionId)).limit(1);
  if (!v) return null;
  const sections = await db
    .select()
    .from(schema.termsSections)
    .where(eq(schema.termsSections.versionId, versionId))
    .orderBy(asc(schema.termsSections.sortOrder));
  return {
    id: v.id,
    version: v.version,
    createdAt: v.createdAt,
    sections: sections.map((s) => ({ id: s.id, title: s.title, body: s.body })),
  };
}

async function insertVersion(
  tenant: Tenant,
  userId: string,
  sections: Array<{ title: string; body: string }>
) {
  const { db, schema } = tenant;
  const id = await db.transaction(async (tx) => {
    const [{ value }] = await tx.select({ value: max(schema.termsVersions.version) }).from(schema.termsVersions);
    const [row] = await tx
      .insert(schema.termsVersions)
      .values({ version: (value ?? 0) + 1, createdBy: userId })
      .returning({ id: schema.termsVersions.id });
    if (sections.length > 0) {
      await tx.insert(schema.termsSections).values(
        sections.map((s, i) => ({ versionId: row.id, title: s.title, body: s.body, sortOrder: i }))
      );
    }
    return row.id;
  });
  return id;
}

/** Latest terms version; creates version 1 from the starter sections if none exists yet. */
export async function ensureCurrentTerms(tenant: Tenant, userId: string) {
  const { db, schema } = tenant;
  const [latest] = await db
    .select({ id: schema.termsVersions.id })
    .from(schema.termsVersions)
    .orderBy(desc(schema.termsVersions.version))
    .limit(1);
  const id = latest?.id ?? (await insertVersion(tenant, userId, DEFAULT_TERMS_SECTIONS));
  const full = await readVersion(tenant, id);
  if (!full) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Terms version missing" });
  return full;
}

export { readVersion as readTermsVersion };

function need(ctx: { tenant: Tenant | null; userId: string | null }): { tenant: Tenant; userId: string } {
  if (!ctx.tenant || !ctx.userId) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
  }
  return { tenant: ctx.tenant, userId: ctx.userId };
}

export const termsRouter = router({
  /** The terms that will be pinned to the next proposal that is sent. */
  current: protectedProcedure.query(async ({ ctx }) => {
    const { tenant, userId } = need(ctx);
    return ensureCurrentTerms(tenant, userId);
  }),

  /** Saving creates a new version. Proposals already sent keep the version they were sent with. */
  save: authorizedProcedure
    .use(requirePermission("manage", "CompanySettings"))
    .input(
      z.object({
        sections: z
          .array(z.object({ title: z.string().trim().min(1, "Every section needs a title").max(200), body: z.string().max(20000) }))
          .max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tenant, userId } = need(ctx);
      await ensureCurrentTerms(tenant, userId);
      const id = await insertVersion(tenant, userId, input.sections);
      const saved = await readVersion(tenant, id);
      return saved!;
    }),
});
