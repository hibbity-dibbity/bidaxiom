import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { router, publicProcedure } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { getDb } from "../../db/client.js";
import { ssoConnections, ssoIdentities } from "../../db/schema/public.js";
import { listProviders } from "../../auth/oidc/providers.js";
import { beginSso, finishSso, SsoError } from "../../auth/oidc/sso.js";
import { ROLES } from "../../auth/roles.js";
import { createAuditLog } from "../../audit/logger.js";
import { AuditAction } from "@construction/shared";

function bad(e: unknown): never {
  if (e instanceof SsoError) throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
  throw e;
}

function requireAdmin(ctx: { orgRole: string | null; orgId: string | null; userId: string | null }) {
  if (ctx.orgRole !== "org:admin" || !ctx.orgId || !ctx.userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only a company admin can manage sign-in settings." });
  }
  return { orgId: ctx.orgId, userId: ctx.userId };
}

const DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export const ssoRouter = router({
  /** Which "Sign in with ..." buttons this server can offer. */
  providers: publicProcedure.query(() => listProviders().filter((p) => p.configured).map(({ key, label }) => ({ key, label }))),

  /** Start signing in. The browser goes to `authUrl` and keeps `pendingToken` for the way back. */
  start: publicProcedure
    .input(z.object({ provider: z.string().max(30), redirectUri: z.string().max(500), loginHint: z.string().max(200).optional() }))
    .mutation(async ({ input }) => {
      try { return await beginSso({ ...input, purpose: "login" }); } catch (e) { bad(e); }
    }),

  /** Finish signing in (or finish connecting a company) with what the provider sent back. */
  complete: publicProcedure
    .input(z.object({ code: z.string().min(1).max(4000), state: z.string().max(200), pendingToken: z.string().max(4000) }))
    .mutation(async ({ input }) => {
      try { return await finishSso(input); } catch (e) { bad(e); }
    }),

  /** Admin: start connecting this company's Microsoft directory. Signs the admin in as proof. */
  setupStart: protectedProcedure
    .input(z.object({ provider: z.string().max(30), redirectUri: z.string().max(500) }))
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = requireAdmin(ctx);
      try { return await beginSso({ ...input, purpose: "setup", userId, organizationId: orgId }); } catch (e) { bad(e); }
    }),

  /** Admin: current sign-in settings for this company. */
  get: protectedProcedure.query(async ({ ctx }) => {
    const { orgId, userId } = requireAdmin(ctx);
    const db = getDb();
    const connections = await db.query.ssoConnections.findMany({ where: eq(ssoConnections.organizationId, orgId) });
    const mine = await db.query.ssoIdentities.findMany({ where: eq(ssoIdentities.userId, userId) });
    return {
      providers: listProviders(),
      roles: Object.entries(ROLES).filter(([k]) => k !== "org:admin").map(([key, v]) => ({ key, label: v.label })),
      connections: connections.map((c) => ({
        id: c.id, provider: c.provider, enabled: c.enabled, enforceSso: c.enforceSso, autoProvision: c.autoProvision,
        defaultRole: c.defaultRole, allowedDomains: c.allowedDomains ?? [],
        youAreLinked: mine.some((i) => i.provider === c.provider && i.tenantRef === c.tenantRef),
      })),
    };
  }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      enabled: z.boolean(),
      enforceSso: z.boolean(),
      autoProvision: z.boolean(),
      defaultRole: z.string().max(40),
      allowedDomains: z.array(z.string().max(100)).max(20),
    }))
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = requireAdmin(ctx);
      const db = getDb();
      const conn = await db.query.ssoConnections.findFirst({ where: and(eq(ssoConnections.id, input.id), eq(ssoConnections.organizationId, orgId)) });
      if (!conn) throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found" });
      if (input.defaultRole === "org:admin" || !(input.defaultRole in ROLES)) throw new TRPCError({ code: "BAD_REQUEST", message: "Pick a role other than admin for new accounts." });
      const domains = Array.from(new Set(input.allowedDomains.map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean)));
      if (domains.some((d) => !DOMAIN.test(d))) throw new TRPCError({ code: "BAD_REQUEST", message: "One of the email domains is not valid." });
      if (input.enforceSso) {
        const linked = await db.query.ssoIdentities.findFirst({ where: and(eq(ssoIdentities.userId, userId), eq(ssoIdentities.provider, conn.provider), eq(ssoIdentities.tenantRef, conn.tenantRef)) });
        if (!linked) throw new TRPCError({ code: "BAD_REQUEST", message: "Sign in with Microsoft yourself first, so you can't lock yourself out." });
        if (!input.enabled) throw new TRPCError({ code: "BAD_REQUEST", message: "Turn sign-in on before requiring it." });
      }
      await db.update(ssoConnections).set({ enabled: input.enabled, enforceSso: input.enforceSso, autoProvision: input.autoProvision, defaultRole: input.defaultRole, allowedDomains: domains, updatedAt: new Date() }).where(eq(ssoConnections.id, conn.id));
      if (ctx.tenant) await createAuditLog(ctx.tenant.db, ctx.tenant.schema, { entityType: "SsoConnection", entityId: conn.id, action: AuditAction.UPDATE, actorId: userId, changes: { after: { enabled: input.enabled, enforceSso: input.enforceSso, autoProvision: input.autoProvision, defaultRole: input.defaultRole, allowedDomains: domains } } });
      return { ok: true as const };
    }),

  disconnect: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const { orgId, userId } = requireAdmin(ctx);
    const db = getDb();
    const conn = await db.query.ssoConnections.findFirst({ where: and(eq(ssoConnections.id, input.id), eq(ssoConnections.organizationId, orgId)) });
    if (!conn) throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found" });
    await db.delete(ssoIdentities).where(and(eq(ssoIdentities.provider, conn.provider), eq(ssoIdentities.tenantRef, conn.tenantRef)));
    await db.delete(ssoConnections).where(eq(ssoConnections.id, conn.id));
    if (ctx.tenant) await createAuditLog(ctx.tenant.db, ctx.tenant.schema, { entityType: "SsoConnection", entityId: conn.id, action: AuditAction.DELETE, actorId: userId, changes: { before: { provider: conn.provider } } });
    return { ok: true as const };
  }),
});
