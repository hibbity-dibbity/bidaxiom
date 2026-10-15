import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { router, publicProcedure } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { getDb } from "../../db/client.js";
import { ssoConnections, ssoDomains, ssoIdentities, users } from "../../db/schema/public.js";
import { PRESETS, issuerFor, discover } from "../../auth/oidc/providers.js";
import { beginSso, beginSetup, finishSso, connectionForEmail, SsoError } from "../../auth/oidc/sso.js";
import { encryptSecret } from "../../auth/oidc/secret.js";
import { createHash, randomInt } from "node:crypto";
import { sendDomainCodeEmail } from "../../services/email.js";
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

const PUBLIC_MAIL = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "aol.com", "icloud.com", "me.com", "proton.me", "protonmail.com", "gmx.com", "mail.com"]);
const hashCode = (id: string, code: string) => createHash("sha256").update(`${id}:${code}`).digest("hex");
const DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export const ssoRouter = router({
  /** First sign-in step: does this email address sign in through its company's identity provider? */
  route: publicProcedure
    .input(z.object({ email: z.string().email().max(200) }))
    .mutation(async ({ input }) => {
      const conn = await connectionForEmail(input.email);
      return { sso: Boolean(conn), enforced: Boolean(conn?.enforceSso) };
    }),

  /** Go to the identity provider for this email address. */
  start: publicProcedure
    .input(z.object({ email: z.string().email().max(200), redirectUri: z.string().max(500) }))
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
    const domains = conn ? await db.query.ssoDomains.findMany({ where: eq(ssoDomains.connectionId, conn.id) }) : [];
    return {
      presets: PRESETS.map((p) => ({ key: p.key, label: p.label, field: p.field })),
      roles: Object.entries(ROLES).filter(([k]) => k !== "org:admin").map(([key, v]) => ({ key, label: v.label })),
      connection: conn
        ? {
            id: conn.id, provider: conn.provider, issuer: conn.issuer, clientId: conn.clientId, verified: conn.verified,
            enabled: conn.enabled, enforceSso: conn.enforceSso, autoProvision: conn.autoProvision, defaultRole: conn.defaultRole,
            youAreLinked: Boolean(linked),
            domains: domains.map((d) => ({ id: d.id, domain: d.domain, verified: Boolean(d.verifiedAt) })),
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
    }))
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = requireAdmin(ctx);
      const db = getDb();
      const conn = await db.query.ssoConnections.findFirst({ where: eq(ssoConnections.organizationId, orgId) });
      if (!conn) throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found" });
      if (input.defaultRole === "org:admin" || !(input.defaultRole in ROLES)) throw new TRPCError({ code: "BAD_REQUEST", message: "Pick a role other than admin for new accounts." });
      if (input.enabled) {
        const ok = await db.query.ssoDomains.findFirst({ where: and(eq(ssoDomains.connectionId, conn.id), isNotNull(ssoDomains.verifiedAt)) });
        if (!ok) throw new TRPCError({ code: "BAD_REQUEST", message: "Add and verify at least one email domain first, so sign-ins can find your company." });
      }
      if (!conn.verified && (input.enabled || input.enforceSso)) throw new TRPCError({ code: "BAD_REQUEST", message: "Test the connection first." });
      if (input.enforceSso) {
        const linked = await db.query.ssoIdentities.findFirst({ where: and(eq(ssoIdentities.connectionId, conn.id), eq(ssoIdentities.userId, userId)) });
        if (!linked) throw new TRPCError({ code: "BAD_REQUEST", message: "Test the connection with your own account first, so you can't lock yourself out." });
        if (!input.enabled) throw new TRPCError({ code: "BAD_REQUEST", message: "Turn sign-in on before requiring it." });
      }
      await db.update(ssoConnections).set({ enabled: input.enabled, enforceSso: input.enforceSso, autoProvision: input.autoProvision, defaultRole: input.defaultRole, updatedAt: new Date() }).where(eq(ssoConnections.id, conn.id));
      if (ctx.tenant) await createAuditLog(ctx.tenant.db, ctx.tenant.schema, { entityType: "SsoConnection", entityId: conn.id, action: AuditAction.UPDATE, actorId: userId, changes: { after: { enabled: input.enabled, enforceSso: input.enforceSso, autoProvision: input.autoProvision, defaultRole: input.defaultRole } } });
      return { ok: true as const };
    }),

  /** Admin: claim an email domain. Proven by an emailed code, or instantly when the admin's own verified email is on it. */
  domainAdd: protectedProcedure.input(z.object({ domain: z.string().max(100) })).mutation(async ({ ctx, input }) => {
    const { orgId, userId } = requireAdmin(ctx);
    const db = getDb();
    const conn = await db.query.ssoConnections.findFirst({ where: eq(ssoConnections.organizationId, orgId) });
    if (!conn) throw new TRPCError({ code: "BAD_REQUEST", message: "Save the connection details first." });
    const domain = input.domain.trim().toLowerCase().replace(/^@/, "");
    if (!DOMAIN.test(domain)) throw new TRPCError({ code: "BAD_REQUEST", message: "That is not a valid domain, for example thomsonenterprises.com" });
    if (PUBLIC_MAIL.has(domain)) throw new TRPCError({ code: "BAD_REQUEST", message: "Public email services like this can't be claimed. Use your company's own domain." });
    const taken = await db.query.ssoDomains.findFirst({ where: and(eq(ssoDomains.domain, domain), isNotNull(ssoDomains.verifiedAt)) });
    if (taken) throw new TRPCError({ code: "CONFLICT", message: "That domain is already in use by another company." });
    const me = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const mine = me?.emailVerified && me.email.toLowerCase().endsWith(`@${domain}`);
    try {
      await db.insert(ssoDomains).values({ connectionId: conn.id, domain, verifiedAt: mine ? new Date() : null }).onConflictDoNothing();
    } catch {
      throw new TRPCError({ code: "CONFLICT", message: "That domain is already in use by another company." });
    }
    return { ok: true as const, verified: Boolean(mine) };
  }),

  /** Admin: email a 6-digit code to an address at the domain. */
  domainSendCode: protectedProcedure.input(z.object({ id: z.string().uuid(), email: z.string().email().max(200) })).mutation(async ({ ctx, input }) => {
    const { orgId } = requireAdmin(ctx);
    const db = getDb();
    const conn = await db.query.ssoConnections.findFirst({ where: eq(ssoConnections.organizationId, orgId) });
    const d = conn ? await db.query.ssoDomains.findFirst({ where: and(eq(ssoDomains.id, input.id), eq(ssoDomains.connectionId, conn.id)) }) : null;
    if (!d) throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found" });
    const email = input.email.trim().toLowerCase();
    if (!email.endsWith(`@${d.domain}`)) throw new TRPCError({ code: "BAD_REQUEST", message: `Enter an email address at ${d.domain}.` });
    if (d.codeExpiresAt && d.codeExpiresAt.getTime() - 29 * 60_000 > Date.now()) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "A code was just sent. Wait a minute before asking for another." });
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await db.update(ssoDomains).set({ codeHash: hashCode(d.id, code), codeExpiresAt: new Date(Date.now() + 30 * 60_000), codeAttempts: 0 }).where(eq(ssoDomains.id, d.id));
    try {
      await sendDomainCodeEmail(email, d.domain, code);
    } catch {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "We couldn't send the email. Try again shortly." });
    }
    return { ok: true as const };
  }),

  domainVerify: protectedProcedure.input(z.object({ id: z.string().uuid(), code: z.string().trim().length(6) })).mutation(async ({ ctx, input }) => {
    const { orgId } = requireAdmin(ctx);
    const db = getDb();
    const conn = await db.query.ssoConnections.findFirst({ where: eq(ssoConnections.organizationId, orgId) });
    const d = conn ? await db.query.ssoDomains.findFirst({ where: and(eq(ssoDomains.id, input.id), eq(ssoDomains.connectionId, conn.id)) }) : null;
    if (!d) throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found" });
    if (!d.codeHash || !d.codeExpiresAt || d.codeExpiresAt.getTime() < Date.now()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "That code has expired. Send a new one." });
    }
    if (d.codeAttempts >= 5) throw new TRPCError({ code: "BAD_REQUEST", message: "Too many wrong tries. Send a new code." });
    if (hashCode(d.id, input.code) !== d.codeHash) {
      await db.update(ssoDomains).set({ codeAttempts: d.codeAttempts + 1 }).where(eq(ssoDomains.id, d.id));
      throw new TRPCError({ code: "BAD_REQUEST", message: "That code is not right." });
    }
    try {
      await db.update(ssoDomains).set({ verifiedAt: new Date(), codeHash: null, codeExpiresAt: null }).where(eq(ssoDomains.id, d.id));
    } catch {
      throw new TRPCError({ code: "CONFLICT", message: "That domain is already in use by another company." });
    }
    return { ok: true as const };
  }),

  domainRemove: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const { orgId } = requireAdmin(ctx);
    const db = getDb();
    const conn = await db.query.ssoConnections.findFirst({ where: eq(ssoConnections.organizationId, orgId) });
    if (conn) await db.delete(ssoDomains).where(and(eq(ssoDomains.id, input.id), eq(ssoDomains.connectionId, conn.id)));
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
