import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { router, publicProcedure } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { getDb } from "../../db/client.js";
import { organizations, ssoConnections, ssoIdentities } from "../../db/schema/public.js";
import { PRESETS, issuerFor, discover } from "../../auth/oidc/providers.js";
import { beginSso, beginSetup, finishSso, SsoError } from "../../auth/oidc/sso.js";
import { encryptSecret } from "../../auth/oidc/secret.js";
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
  /** Start signing in. The company code is the company's short name (its slug). */
  start: publicProcedure
    .input(z.object({ companyCode: z.string().min(1).max(80), redirectUri: z.string().max(500), loginHint: z.string().max(200).optional() }))
    .mutation(async ({ input }) => {
      try { return await beginSso(input); } catch (e) { bad(e); }
    }),

  /** Finish signing in (or finish testing a connection) with what the provider sent back. */
  complete: publicProcedure
    .input(z.object({ code: z.string().min(1).max(4000), state: z.string().max(200), pendingToken: z.string().max(4000) }))
    .mutation(async ({ input }) => {
      try { return await finishSso(input); } catch (e) { bad(e); }
    }),

  /** Admin: test the saved connection. Signs the admin in through it, which links their account. */
  setupStart: protectedProcedure
    .input(z.object({ redirectUri: z.string().max(500) }))
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = requireAdmin(ctx);
      try { return await beginSetup({ organizationId: orgId, userId, redirectUri: input.redirectUri }); } catch (e) { bad(e); }
    }),

  /** Admin: this company's sign-in settings. Never returns the secret. */
  get: protectedProcedure.query(async ({ ctx }) => {
    const { orgId, userId } = requireAdmin(ctx);
    const db = getDb();
    const conn = await db.query.ssoConnections.findFirst({ where: eq(ssoConnections.organizationId, orgId) });
    const linked = conn ? await db.query.ssoIdentities.findFirst({ where: and(eq(ssoIdentities.connectionId, conn.id), eq(ssoIdentities.userId, userId)) }) : null;
    const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) });
    return {
      companyCode: org?.slug ?? "",
      presets: PRESETS.map((p) => ({ key: p.key, label: p.label, field: p.field })),
      roles: Object.entries(ROLES).filter(([k]) => k !== "org:admin").map(([key, v]) => ({ key, label: v.label })),
      connection: conn
        ? {
            id: conn.id, provider: conn.provider, issuer: conn.issuer, clientId: conn.clientId, verified: conn.verified,
            enabled: conn.enabled, enforceSso: conn.enforceSso, autoProvision: conn.autoProvision, defaultRole: conn.defaultRole,
            allowedDomains: conn.allowedDomains ?? [], youAreLinked: Boolean(linked),
          }
        : null,
    };
  }),

  /** Admin: save the identity provider details. Changing them requires testing again. */
  save: protectedProcedure
    .input(z.object({
      preset: z.enum(["microsoft", "google", "oidc"]),
      value: z.string().max(300).optional(),
      clientId: z.string().min(3).max(300),
      clientSecret: z.string().max(2000).optional(), // blank keeps the saved secret
    }))
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = requireAdmin(ctx);
      const db = getDb();
      const existing = await db.query.ssoConnections.findFirst({ where: eq(ssoConnections.organizationId, orgId) });
      if (!existing && !input.clientSecret) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter the client secret." });
      let issuer: string;
      try {
        issuer = issuerFor(input.preset, input.value);
        await discover(issuer);
      } catch (e) {
        throw new TRPCError({ code: "BAD_REQUEST", message: e instanceof Error ? e.message : "Could not reach the identity provider" });
      }
      const values = {
        provider: input.preset, issuer, clientId: input.clientId.trim(), verified: false,
        ...(input.clientSecret ? { clientSecretEnc: encryptSecret(input.clientSecret.trim()) } : {}),
        updatedAt: new Date(),
      };
      let id: string;
      if (existing) {
        await db.update(ssoConnections).set({ ...values, enforceSso: false }).where(eq(ssoConnections.id, existing.id));
        await db.delete(ssoIdentities).where(eq(ssoIdentities.connectionId, existing.id));
        id = existing.id;
      } else {
        const [c] = await db.insert(ssoConnections).values({ organizationId: orgId, clientSecretEnc: encryptSecret(input.clientSecret!.trim()), ...values }).returning({ id: ssoConnections.id });
        id = c.id;
      }
      if (ctx.tenant) await createAuditLog(ctx.tenant.db, ctx.tenant.schema, { entityType: "SsoConnection", entityId: id, action: existing ? AuditAction.UPDATE : AuditAction.CREATE, actorId: userId, changes: { after: { provider: input.preset, issuer, clientId: input.clientId } } });
      return { ok: true as const };
    }),

  update: protectedProcedure
    .input(z.object({
      enabled: z.boolean(),
      enforceSso: z.boolean(),
      autoProvision: z.boolean(),
      defaultRole: z.string().max(40),
      allowedDomains: z.array(z.string().max(100)).max(20),
    }))
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = requireAdmin(ctx);
      const db = getDb();
      const conn = await db.query.ssoConnections.findFirst({ where: eq(ssoConnections.organizationId, orgId) });
      if (!conn) throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found" });
      if (input.defaultRole === "org:admin" || !(input.defaultRole in ROLES)) throw new TRPCError({ code: "BAD_REQUEST", message: "Pick a role other than admin for new accounts." });
      const domains = Array.from(new Set(input.allowedDomains.map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean)));
      if (domains.some((d) => !DOMAIN.test(d))) throw new TRPCError({ code: "BAD_REQUEST", message: "One of the email domains is not valid." });
      if (!conn.verified && (input.enabled || input.enforceSso)) throw new TRPCError({ code: "BAD_REQUEST", message: "Test the connection first." });
      if (input.enforceSso) {
        const linked = await db.query.ssoIdentities.findFirst({ where: and(eq(ssoIdentities.connectionId, conn.id), eq(ssoIdentities.userId, userId)) });
        if (!linked) throw new TRPCError({ code: "BAD_REQUEST", message: "Test the connection with your own account first, so you can't lock yourself out." });
        if (!input.enabled) throw new TRPCError({ code: "BAD_REQUEST", message: "Turn sign-in on before requiring it." });
      }
      await db.update(ssoConnections).set({ enabled: input.enabled, enforceSso: input.enforceSso, autoProvision: input.autoProvision, defaultRole: input.defaultRole, allowedDomains: domains, updatedAt: new Date() }).where(eq(ssoConnections.id, conn.id));
      if (ctx.tenant) await createAuditLog(ctx.tenant.db, ctx.tenant.schema, { entityType: "SsoConnection", entityId: conn.id, action: AuditAction.UPDATE, actorId: userId, changes: { after: { enabled: input.enabled, enforceSso: input.enforceSso, autoProvision: input.autoProvision, defaultRole: input.defaultRole, allowedDomains: domains } } });
      return { ok: true as const };
    }),

  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    const { orgId, userId } = requireAdmin(ctx);
    const db = getDb();
    const conn = await db.query.ssoConnections.findFirst({ where: eq(ssoConnections.organizationId, orgId) });
    if (!conn) return { ok: true as const };
    await db.delete(ssoConnections).where(eq(ssoConnections.id, conn.id)); // identities go with it
    if (ctx.tenant) await createAuditLog(ctx.tenant.db, ctx.tenant.schema, { entityType: "SsoConnection", entityId: conn.id, action: AuditAction.DELETE, actorId: userId, changes: { before: { provider: conn.provider } } });
    return { ok: true as const };
  }),
});
