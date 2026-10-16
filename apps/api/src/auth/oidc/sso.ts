import { and, eq, isNotNull } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { getDb } from "../../db/client.js";
import { users, organizations, organizationMemberships, ssoConnections, ssoDomains, ssoIdentities } from "../../db/schema/public.js";
import { hashPassword } from "../password.js";
import { authorizeUrl, exchange } from "./providers.js";
import { decryptSecret } from "./secret.js";
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

async function start(conn: typeof ssoConnections.$inferSelect, input: { purpose: "login" | "setup"; redirectUri: string; loginHint?: string; userId?: string }) {
  checkRedirect(input.redirectUri);
  const pk = newPkce();
  const pending: PendingSso = {
    connectionId: conn.id, purpose: input.purpose, state: pk.state, nonce: pk.nonce, codeVerifier: pk.codeVerifier,
    redirectUri: input.redirectUri, userId: input.userId,
  };
  let url: string;
  try {
    url = await authorizeUrl(conn, { redirectUri: input.redirectUri, state: pk.state, nonce: pk.nonce, codeChallenge: pk.codeChallenge, loginHint: input.loginHint });
  } catch (e) {
    throw new SsoError(e instanceof Error ? e.message : "Could not reach the identity provider");
  }
  return { authUrl: url, pendingToken: await signPending(pending) };
}

/** Which company's sign-in (if any) handles this email address, from its verified domain. */
export async function connectionForEmail(email: string) {
  return (await resolveConnection(email))?.conn ?? null;
}

/**
 * Which company connection signs this email address in? First by a verified email domain; failing
 * that, by an account that has already linked itself to a connection (for example an admin who
 * tested the connection, whose BidAxiom email is on a public domain such as hotmail.com).
 */
async function resolveConnection(email: string) {
  const clean = email.trim().toLowerCase();
  const domain = clean.split("@")[1];
  if (!domain) return null;
  const db = getDb();
  const row = await db.query.ssoDomains.findFirst({ where: and(eq(ssoDomains.domain, domain), isNotNull(ssoDomains.verifiedAt)) });
  if (row) {
    const conn = await db.query.ssoConnections.findFirst({ where: eq(ssoConnections.id, row.connectionId) });
    if (conn && conn.enabled && conn.verified) return { conn, viaDomain: true };
  }
  const user = await db.query.users.findFirst({ where: eq(users.email, clean), columns: { id: true } });
  if (!user) return null;
  const identity = await db.query.ssoIdentities.findFirst({ where: eq(ssoIdentities.userId, user.id) });
  if (!identity) return null;
  const conn = await db.query.ssoConnections.findFirst({ where: eq(ssoConnections.id, identity.connectionId) });
  return conn && conn.enabled && conn.verified ? { conn, viaDomain: false } : null;
}

/** Sign in: the email address's verified domain says which company's identity provider to use. */
export async function beginSso(input: { email: string; redirectUri: string }) {
  const found = await resolveConnection(input.email);
  if (!found) throw new SsoError("Single sign-on is not set up for that email address.");
  // The email is only a hint to the provider when it is on the company's own domain.
  return start(found.conn, { purpose: "login", redirectUri: input.redirectUri, ...(found.viaDomain ? { loginHint: input.email.trim().toLowerCase() } : {}) });
}

/** Admin: test a saved connection by signing in through it once. That also links the admin's own account. */
export async function beginSetup(input: { organizationId: string; userId: string; redirectUri: string }) {
  const conn = await getDb().query.ssoConnections.findFirst({ where: eq(ssoConnections.organizationId, input.organizationId) });
  if (!conn) throw new SsoError("Save the connection details first.");
  return start(conn, { purpose: "setup", redirectUri: input.redirectUri, userId: input.userId });
}

export type SsoResult =
  | { kind: "login"; session: Awaited<ReturnType<typeof issueSsoSession>> }
  | { kind: "setup" };

export async function finishSso(input: { code: string; state: string; pendingToken: string }): Promise<SsoResult> {
  let pending: PendingSso;
  try { pending = await verifyPending(input.pendingToken); } catch { throw new SsoError("This sign-in expired. Please start again."); }
  if (pending.state !== input.state) throw new SsoError("Sign-in response did not match the request. Please start again.");
  const db = getDb();
  const conn = await db.query.ssoConnections.findFirst({ where: eq(ssoConnections.id, pending.connectionId) });
  if (!conn) throw new SsoError("That connection no longer exists.");
  let id;
  try {
    id = await exchange({ issuer: conn.issuer, clientId: conn.clientId, clientSecret: decryptSecret(conn.clientSecretEnc) }, {
      code: input.code, redirectUri: pending.redirectUri, codeVerifier: pending.codeVerifier, nonce: pending.nonce,
    });
  } catch (e) {
    throw new SsoError(e instanceof Error ? e.message : "Sign-in failed");
  }
  const linked = await db.query.ssoIdentities.findFirst({ where: and(eq(ssoIdentities.connectionId, conn.id), eq(ssoIdentities.subject, id.subject)) });

  if (pending.purpose === "setup") {
    if (!pending.userId) throw new SsoError("Bad request");
    const m = await db.query.organizationMemberships.findFirst({
      where: and(eq(organizationMemberships.userId, pending.userId), eq(organizationMemberships.organizationId, conn.organizationId)),
    });
    if (!m || m.role !== "org:admin") throw new SsoError("Only a company admin can connect sign-in.");
    if (linked && linked.userId !== pending.userId) throw new SsoError("That account is already linked to a different BidAxiom user.");
    if (!linked) await db.insert(ssoIdentities).values({ userId: pending.userId, connectionId: conn.id, subject: id.subject, email: id.email });
    await db.update(ssoConnections).set({ verified: true, updatedAt: new Date() }).where(eq(ssoConnections.id, conn.id));
    return { kind: "setup" };
  }

  if (!conn.enabled || !conn.verified) throw new SsoError("Single sign-on is turned off for this company.");
  // Only addresses at the company's verified domains may come in through this connection.
  const verified = await db.query.ssoDomains.findMany({ where: and(eq(ssoDomains.connectionId, conn.id), isNotNull(ssoDomains.verifiedAt)) });
  if (!id.email || !verified.some((d) => d.domain === id.email!.split("@")[1])) throw new SsoError("Your email address is not at one of this company's sign-in domains.");

  let userId: string;
  if (linked) {
    userId = linked.userId;
  } else {
    if (!id.email) throw new SsoError("Your identity provider did not share a verified email address for this account.");
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
    await db.insert(ssoIdentities).values({ userId, connectionId: conn.id, subject: id.subject, email: id.email });
  }
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
  const conn = await db.query.ssoConnections.findFirst({ where: and(eq(ssoConnections.organizationId, m.organizationId), eq(ssoConnections.enabled, true), eq(ssoConnections.verified, true), eq(ssoConnections.enforceSso, true)) });
  return Boolean(conn);
}
