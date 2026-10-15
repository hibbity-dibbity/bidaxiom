import { and, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { getDb } from "../../db/client.js";
import { users, organizationMemberships, ssoConnections, ssoIdentities } from "../../db/schema/public.js";
import { hashPassword } from "../password.js";
import { getProvider } from "./providers.js";
import { newPkce, signPending, verifyPending, type PendingSso } from "./pending.js";
import { issueSsoSession } from "../session.js";

/** A problem to show the person signing in (wrong company, not invited, and so on). */
export class SsoError extends Error {}

const CALLBACK_PATH = "/api/auth/sso/callback";

function checkRedirect(uri: string) {
  let u: URL;
  try { u = new URL(uri); } catch { throw new SsoError("Bad return address"); }
  if (u.pathname !== CALLBACK_PATH || u.search || u.hash || !/^https?:$/.test(u.protocol)) throw new SsoError("Bad return address");
}

export async function beginSso(input: { provider: string; purpose: "login" | "setup"; redirectUri: string; loginHint?: string; userId?: string; organizationId?: string }) {
  const adapter = getProvider(input.provider);
  if (!adapter) throw new SsoError("Unknown sign-in provider");
  if (!adapter.configured()) throw new SsoError(`${adapter.label} sign-in is not set up on this server yet.`);
  checkRedirect(input.redirectUri);
  const pk = newPkce();
  const pending: PendingSso = {
    provider: input.provider, purpose: input.purpose, state: pk.state, nonce: pk.nonce, codeVerifier: pk.codeVerifier,
    redirectUri: input.redirectUri, userId: input.userId, organizationId: input.organizationId,
  };
  return {
    authUrl: adapter.authorizeUrl({ redirectUri: input.redirectUri, state: pk.state, nonce: pk.nonce, codeChallenge: pk.codeChallenge, loginHint: input.loginHint }),
    pendingToken: await signPending(pending),
  };
}

export type SsoResult =
  | { kind: "login"; session: Awaited<ReturnType<typeof issueSsoSession>> }
  | { kind: "setup"; organizationId: string };

export async function finishSso(input: { code: string; state: string; pendingToken: string }): Promise<SsoResult> {
  let pending: PendingSso;
  try { pending = await verifyPending(input.pendingToken); } catch { throw new SsoError("This sign-in expired. Please start again."); }
  if (pending.state !== input.state) throw new SsoError("Sign-in response did not match the request. Please start again.");
  const adapter = getProvider(pending.provider);
  if (!adapter) throw new SsoError("Unknown sign-in provider");
  let id;
  try {
    id = await adapter.exchange({ code: input.code, redirectUri: pending.redirectUri, codeVerifier: pending.codeVerifier, nonce: pending.nonce });
  } catch (e) {
    throw new SsoError(e instanceof Error ? e.message : "Sign-in failed");
  }
  const db = getDb();

  if (pending.purpose === "setup") {
    if (!pending.userId || !pending.organizationId) throw new SsoError("Bad request");
    const m = await db.query.organizationMemberships.findFirst({
      where: and(eq(organizationMemberships.userId, pending.userId), eq(organizationMemberships.organizationId, pending.organizationId)),
    });
    if (!m || m.role !== "org:admin") throw new SsoError("Only a company admin can connect sign-in.");
    const taken = await db.query.ssoConnections.findFirst({ where: and(eq(ssoConnections.provider, pending.provider), eq(ssoConnections.tenantRef, id.tenantRef)) });
    if (taken && taken.organizationId !== pending.organizationId) throw new SsoError("That Microsoft organization is already connected to another BidAxiom company.");
    const mine = await db.query.ssoConnections.findFirst({ where: and(eq(ssoConnections.organizationId, pending.organizationId), eq(ssoConnections.provider, pending.provider)) });
    if (mine) {
      await db.update(ssoConnections).set({ tenantRef: id.tenantRef, enabled: true, updatedAt: new Date() }).where(eq(ssoConnections.id, mine.id));
    } else {
      await db.insert(ssoConnections).values({ organizationId: pending.organizationId, provider: pending.provider, tenantRef: id.tenantRef });
    }
    const linked = await db.query.ssoIdentities.findFirst({ where: and(eq(ssoIdentities.provider, pending.provider), eq(ssoIdentities.tenantRef, id.tenantRef), eq(ssoIdentities.subject, id.subject)) });
    if (linked && linked.userId !== pending.userId) throw new SsoError("That Microsoft account is already linked to a different BidAxiom user.");
    if (!linked) await db.insert(ssoIdentities).values({ userId: pending.userId, provider: pending.provider, tenantRef: id.tenantRef, subject: id.subject, email: id.email });
    return { kind: "setup", organizationId: pending.organizationId };
  }

  // Sign-in: the person's Microsoft directory decides which company this is.
  const conn = await db.query.ssoConnections.findFirst({ where: and(eq(ssoConnections.provider, pending.provider), eq(ssoConnections.tenantRef, id.tenantRef)) });
  if (!conn || !conn.enabled) throw new SsoError("Your Microsoft organization is not connected to a BidAxiom company. Ask your BidAxiom admin to set up Microsoft sign-in.");
  const domains = conn.allowedDomains ?? [];
  if (domains.length > 0 && !(id.email && domains.includes(id.email.split("@")[1]))) throw new SsoError("Your email address is not allowed to sign in to this company.");

  const identity = await db.query.ssoIdentities.findFirst({ where: and(eq(ssoIdentities.provider, pending.provider), eq(ssoIdentities.tenantRef, id.tenantRef), eq(ssoIdentities.subject, id.subject)) });
  let userId: string;
  if (identity) {
    userId = identity.userId;
  } else {
    if (!id.email) throw new SsoError("Microsoft did not share an email address for this account.");
    const existing = await db.query.users.findFirst({ where: eq(users.email, id.email) });
    if (existing) {
      // Never take over an account just because an email matches: only people already in this company link.
      const m = await db.query.organizationMemberships.findFirst({
        where: and(eq(organizationMemberships.userId, existing.id), eq(organizationMemberships.organizationId, conn.organizationId)),
      });
      if (!m) throw new SsoError("An account with this email exists but is not part of this company. Ask your BidAxiom admin to invite you.");
      userId = existing.id;
    } else {
      if (!conn.autoProvision) throw new SsoError("You do not have a BidAxiom account yet. Ask your BidAxiom admin to invite you.");
      const [first, ...rest] = (id.name ?? "").split(" ");
      const [created] = await db.insert(users).values({
        email: id.email,
        emailVerified: true,
        passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
        firstName: first || null,
        lastName: rest.join(" ") || null,
      }).returning({ id: users.id });
      userId = created.id;
    }
    await db.insert(ssoIdentities).values({ userId, provider: pending.provider, tenantRef: id.tenantRef, subject: id.subject, email: id.email });
  }
  // Make sure they belong to this company (auto-provisioned and invited-then-linked people may not yet).
  const member = await db.query.organizationMemberships.findFirst({
    where: and(eq(organizationMemberships.userId, userId), eq(organizationMemberships.organizationId, conn.organizationId)),
  });
  if (!member) {
    if (!conn.autoProvision) throw new SsoError("You are not a member of this company. Ask your BidAxiom admin to invite you.");
    await db.insert(organizationMemberships).values({ userId, organizationId: conn.organizationId, role: conn.defaultRole });
  }
  return { kind: "login", session: await issueSsoSession(userId, conn.organizationId) };
}

/** True when this person must sign in through SSO (their company requires it and they are not an admin). */
export async function passwordLoginBlocked(userId: string): Promise<boolean> {
  const db = getDb();
  const m = await db.query.organizationMemberships.findFirst({ where: eq(organizationMemberships.userId, userId) });
  if (!m || m.role === "org:admin") return false;
  const conn = await db.query.ssoConnections.findFirst({ where: and(eq(ssoConnections.organizationId, m.organizationId), eq(ssoConnections.enabled, true), eq(ssoConnections.enforceSso, true)) });
  return Boolean(conn);
}
