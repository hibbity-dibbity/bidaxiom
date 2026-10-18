import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { asc, desc, eq, max } from "drizzle-orm";
import { router } from "../trpc.js";
import { protectedProcedure, authorizedProcedure } from "../procedures.js";
import { requirePermission } from "../middleware/authorize.js";

/** A new company starts with no proposal terms; it writes its own sections in Settings. */
export const DEFAULT_TERMS_SECTIONS: Array<{ title: string; body: string }> = [];

/** Starter text for the change order authorization. {company} is replaced with the company name. */
export const DEFAULT_CO_SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: "Change Order / Extra Work Authorization",
    body:
      "I hereby authorize {company} to perform the additional work on the above mentioned project, as directed above. I fully understand that this work and the associated cost are in addition to any contract amount that I previously have to this date. By signing below I agree to pay {company} for the cost of the work in accordance with the payment terms of the contract for this project.",
  },
  {
    title: "Reservation of rights",
    body:
      "{company} reserves the rights to recovery of additional time or direct and impact costs allocated to this change but not presently known or determinable at the time of this contract change order.",
  },
];

export type TermsKind = "proposal" | "change_order";
const kindSchema = z.enum(["proposal", "change_order"]).default("proposal");

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
    kind: v.kind,
    createdAt: v.createdAt,
    sections: sections.map((s) => ({ id: s.id, title: s.title, body: s.body })),
  };
}

async function insertVersion(
  tenant: Tenant,
  userId: string,
  sections: Array<{ title: string; body: string }>,
  kind: TermsKind = "proposal"
) {
  const { db, schema } = tenant;
  const id = await db.transaction(async (tx) => {
    const [{ value }] = await tx.select({ value: max(schema.termsVersions.version) }).from(schema.termsVersions).where(eq(schema.termsVersions.kind, kind));
    const [row] = await tx
      .insert(schema.termsVersions)
      .values({ version: (value ?? 0) + 1, kind, createdBy: userId })
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
export async function ensureCurrentTerms(tenant: Tenant, userId: string, kind: TermsKind = "proposal") {
  const { db, schema } = tenant;
  const [latest] = await db
    .select({ id: schema.termsVersions.id })
    .from(schema.termsVersions)
    .where(eq(schema.termsVersions.kind, kind))
    .orderBy(desc(schema.termsVersions.version))
    .limit(1);
  const starter =
    kind === "change_order"
      ? DEFAULT_CO_SECTIONS.map((x) => ({ title: x.title, body: x.body.split("{company}").join(tenant.companyName || "the Contractor") }))
      : DEFAULT_TERMS_SECTIONS;
  const id = latest?.id ?? (await insertVersion(tenant, userId, starter, kind));
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
  current: protectedProcedure.input(z.object({ kind: kindSchema }).optional()).query(async ({ ctx, input }) => {
    const { tenant, userId } = need(ctx);
    return ensureCurrentTerms(tenant, userId, input?.kind ?? "proposal");
  }),

  /** Saving creates a new version. Proposals already sent keep the version they were sent with. */
  save: authorizedProcedure
    .use(requirePermission("manage", "CompanySettings"))
    .input(
      z.object({
        kind: kindSchema,
        sections: z
          .array(z.object({ title: z.string().trim().min(1, "Every section needs a title").max(200), body: z.string().max(20000) }))
          .max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tenant, userId } = need(ctx);
      await ensureCurrentTerms(tenant, userId, input.kind);
      const id = await insertVersion(tenant, userId, input.sections, input.kind);
      const saved = await readVersion(tenant, id);
      return saved!;
    }),
});
