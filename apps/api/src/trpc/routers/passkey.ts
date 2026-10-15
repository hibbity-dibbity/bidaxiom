import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { router, publicProcedure } from "../trpc.js";
import { authProcedure } from "../procedures.js";
import { getDb } from "../../db/client.js";
import { users, passkeys, organizationMemberships } from "../../db/schema/public.js";
import {
  newChallenge, consumeChallenge, registrationOptions, authenticationOptions,
  verifyRegistration, verifyAssertion, PasskeyError, b64u,
} from "../../auth/webauthn.js";
import { issueSession } from "../../auth/session.js";
import { passwordLoginBlocked } from "../../auth/oidc/sso.js";
import { checkLoginRateLimit } from "../../auth/rate-limit.js";

const MAX_PASSKEYS = 10;

const registerResponse = z.object({
  id: z.string().max(1400),
  response: z.object({
    clientDataJSON: z.string().max(4000),
    attestationObject: z.string().max(16000),
    transports: z.array(z.string().max(20)).max(8).optional(),
  }),
});
const loginResponse = z.object({
  id: z.string().max(1400),
  response: z.object({
    clientDataJSON: z.string().max(4000),
    authenticatorData: z.string().max(2000),
    signature: z.string().max(2000),
    userHandle: z.string().max(200).nullish(),
  }),
});

function fail(e: unknown): never {
  if (e instanceof PasskeyError) throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
  throw new TRPCError({ code: "BAD_REQUEST", message: "That passkey request expired or was already used. Try again." });
}

function clientIp(ctx: { req?: { headers: Record<string, string | string[] | undefined> } }): string {
  const f = ctx.req?.headers["x-forwarded-for"];
  const ip = Array.isArray(f) ? f[0] : f;
  return ip ? ip.split(",")[0].trim() : "unknown";
}

/** Passkeys: sign in with a fingerprint, face or device PIN instead of a password. Works for any account. */
export const passkeyRouter = router({
  registerStart: authProcedure.mutation(async ({ ctx }) => {
    const db = getDb();
    const user = await db.query.users.findFirst({ where: eq(users.id, ctx.userId) });
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    const existing = await db.query.passkeys.findMany({ where: eq(passkeys.userId, user.id), columns: { credentialId: true } });
    if (existing.length >= MAX_PASSKEYS) throw new TRPCError({ code: "BAD_REQUEST", message: `You can have up to ${MAX_PASSKEYS} passkeys.` });
    const { challenge, token } = await newChallenge("register", user.id);
    return {
      token,
      options: registrationOptions({
        challenge, userId: user.id, email: user.email,
        name: [user.firstName, user.lastName].filter(Boolean).join(" "),
        existingCredentialIds: existing.map((e) => e.credentialId),
      }),
    };
  }),

  registerFinish: authProcedure
    .input(z.object({ token: z.string().max(4000), name: z.string().trim().min(1).max(60), response: registerResponse }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      let cred;
      try {
        const claims = await consumeChallenge(input.token, "register");
        if (claims.userId !== ctx.userId) throw new Error("Not yours");
        cred = verifyRegistration({ response: input.response, challenge: claims.challenge });
      } catch (e) { fail(e); }
      try {
        await db.insert(passkeys).values({
          userId: ctx.userId, credentialId: cred.credentialId, publicKey: cred.publicKey, alg: cred.alg,
          counter: cred.counter, transports: cred.transports, backedUp: cred.backedUp, name: input.name,
        });
      } catch {
        throw new TRPCError({ code: "CONFLICT", message: "That passkey is already registered." });
      }
      return { ok: true as const };
    }),

  status: authProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const user = await db.query.users.findFirst({ where: eq(users.id, ctx.userId) });
    const mine = await db.query.passkeys.findMany({ where: eq(passkeys.userId, ctx.userId), columns: { id: true } });
    return { totp: Boolean(user?.mfaEnabled), passkeys: mine.length, adminNeedsFactor: ctx.orgRole === "org:admin" };
  }),

  list: authProcedure.query(async ({ ctx }) => {
    const rows = await getDb().query.passkeys.findMany({ where: eq(passkeys.userId, ctx.userId) });
    return rows
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((p) => ({ id: p.id, name: p.name, createdAt: p.createdAt.toISOString(), lastUsedAt: p.lastUsedAt?.toISOString() ?? null, synced: p.backedUp }));
  }),

  remove: authProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const db = getDb();
    const mine = await db.query.passkeys.findMany({ where: eq(passkeys.userId, ctx.userId), columns: { id: true } });
    if (!mine.some((p) => p.id === input.id)) throw new TRPCError({ code: "NOT_FOUND", message: "Passkey not found" });
    // A company admin must keep at least one second factor.
    const user = await db.query.users.findFirst({ where: eq(users.id, ctx.userId) });
    const adminRow = await db.query.organizationMemberships.findFirst({
      where: and(eq(organizationMemberships.userId, ctx.userId), eq(organizationMemberships.role, "org:admin")),
    });
    if (adminRow && mine.length === 1 && !user?.mfaEnabled) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Company admins need a second factor. Set up an authenticator app before removing your last passkey." });
    }
    await db.delete(passkeys).where(and(eq(passkeys.id, input.id), eq(passkeys.userId, ctx.userId)));
    return { ok: true as const };
  }),

  /** Public: start signing in. No email is asked or revealed; the device offers the passkeys it holds. */
  loginStart: publicProcedure.mutation(async () => {
    const { challenge, token } = await newChallenge("login");
    return { token, options: authenticationOptions(challenge) };
  }),

  loginFinish: publicProcedure
    .input(z.object({ token: z.string().max(4000), response: loginResponse }))
    .mutation(async ({ ctx, input }) => {
      await checkLoginRateLimit("passkey", clientIp(ctx as never));
      const db = getDb();
      let claims;
      try { claims = await consumeChallenge(input.token, "login"); } catch (e) { fail(e); }
      const stored = await db.query.passkeys.findFirst({ where: eq(passkeys.credentialId, input.response.id) });
      const bad = new TRPCError({ code: "UNAUTHORIZED", message: "That passkey was not recognised." });
      if (!stored) throw bad;
      if (input.response.response.userHandle && input.response.response.userHandle !== b64u(Buffer.from(stored.userId))) throw bad;
      let result;
      try {
        result = verifyAssertion({ response: input.response, challenge: claims.challenge, stored: { publicKey: stored.publicKey, alg: stored.alg, counter: stored.counter } });
      } catch (e) { fail(e); }
      const user = await db.query.users.findFirst({ where: eq(users.id, stored.userId) });
      if (!user) throw bad;
      if (!user.emailVerified) throw new TRPCError({ code: "FORBIDDEN", message: "Please verify your email before logging in" });
      if (await passwordLoginBlocked(user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Your company requires its own single sign-on. Enter your work email and continue." });
      }
      await db.update(passkeys).set({ counter: result.counter, lastUsedAt: new Date() }).where(eq(passkeys.id, stored.id));
      return issueSession(user.id);
    }),
});
