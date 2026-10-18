import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { db as publicDb } from "../../db/client.js";
import { organizationInvitations, organizationMemberships, passkeys, ssoConnections, users } from "../../db/schema/public.js";

/**
 * Numbers for the status chips on the Settings home page. Everyone gets the "you" part; the company part
 * (people, terms, QuickBooks, sign-in, records) is only worked out for administrators.
 */
export const settingsSummaryRouter = router({
  summary: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    const { db, schema } = ctx.tenant;
    const isAdmin = ctx.orgRole === "org:admin";

    const [me] = await publicDb.select({ mfa: users.mfaEnabled }).from(users).where(eq(users.id, ctx.userId)).limit(1);
    const [keys] = await publicDb.select({ n: count() }).from(passkeys).where(eq(passkeys.userId, ctx.userId));
    const templates = await db.select({ scope: schema.proposalTemplates.scope, createdBy: schema.proposalTemplates.createdBy }).from(schema.proposalTemplates);
    const you = {
      authenticator: Boolean(me?.mfa),
      passkeys: Number(keys?.n ?? 0),
      templatesMine: templates.filter((t) => t.scope === "personal" && t.createdBy === ctx.userId).length,
      templatesShared: templates.filter((t) => t.scope === "global").length,
    };
    if (!isAdmin || !ctx.orgId) return { isAdmin: false as const, you };

    const [prof] = await db.select().from(schema.companyProfiles).where(isNull(schema.companyProfiles.validTo)).limit(1);
    const trades = (prof?.tradesConfig as { csiDivisions?: unknown[]; customTrades?: unknown[] } | undefined) ?? {};
    const [members] = await publicDb.select({ n: count() }).from(organizationMemberships).where(eq(organizationMemberships.organizationId, ctx.orgId));
    const [invited] = await publicDb.select({ n: count() }).from(organizationInvitations).where(and(eq(organizationInvitations.organizationId, ctx.orgId), eq(organizationInvitations.status, "pending"), gte(organizationInvitations.expiresAt, new Date())));
    const termsInfo = async (kind: "proposal" | "change_order") => {
      const [v] = await db.select({ id: schema.termsVersions.id, version: schema.termsVersions.version }).from(schema.termsVersions).where(eq(schema.termsVersions.kind, kind)).orderBy(desc(schema.termsVersions.version)).limit(1);
      if (!v) return null;
      const [n] = await db.select({ n: count() }).from(schema.termsSections).where(eq(schema.termsSections.versionId, v.id));
      return { version: v.version, sections: Number(n?.n ?? 0) };
    };
    const [sso] = await publicDb.select({ enabled: ssoConnections.enabled, verified: ssoConnections.verified }).from(ssoConnections).where(eq(ssoConnections.organizationId, ctx.orgId)).limit(1);
    const [qbo] = await db.select({ status: schema.qboConnections.status, lastSyncAt: schema.qboConnections.lastSyncAt }).from(schema.qboConnections).limit(1);
    const [latest] = await db.select({ at: schema.auditLogs.timestamp }).from(schema.auditLogs).orderBy(desc(schema.auditLogs.timestamp)).limit(1);
    const thirty = new Date(Date.now() - 30 * 86400000);
    const [deleted] = await db.select({ n: count() }).from(schema.projects).where(and(isNotNull(schema.projects.deletedAt), gte(schema.projects.deletedAt, thirty)));
    const naming = (prof?.documentNamingSettings ?? {}) as Record<string, unknown>;

    return {
      isAdmin: true as const,
      you,
      company: {
        type: (prof?.companyType as string | undefined) ?? null,
        trades: (trades.csiDivisions?.length ?? 0) + (trades.customTrades?.length ?? 0),
        members: Number(members?.n ?? 0),
        invited: Number(invited?.n ?? 0),
        proposalTerms: await termsInfo("proposal"),
        changeOrderTerms: await termsInfo("change_order"),
        namingFormats: Object.values(naming).filter(Boolean).length,
      },
      connections: {
        qbo: qbo ? { status: qbo.status, lastSyncAt: qbo.lastSyncAt?.toISOString() ?? null } : null,
        sso: sso ? { enabled: sso.enabled, verified: sso.verified } : null,
      },
      records: { lastActivityAt: latest?.at.toISOString() ?? null, deletedProjects: Number(deleted?.n ?? 0) },
    };
  }),
});
