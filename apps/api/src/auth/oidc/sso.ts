import { and, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { getDb } from "../../db/client.js";
import { users, organizations, organizationMemberships, ssoConnections, ssoIdentities } from "../../db/schema/public.js";
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

/** Sign in: the company code (its slug) says which company's identity provider to use. */
export async function beginSso(input: { companyCode: string; redirectUri: string; loginHint?: string }) {
  const db = getDb();
  const org = await db.query.organizations.findFirst({ where: eq(organizations.slug, input.companyCode.trim().toLowerCase()) });
  const conn = org ? await db.query.ssoConnections.findFirst({ where: eq(ssoConnections.organizationId, org.id) }) : null;
  if (!conn || !conn.enabled || !conn.verified) throw new SsoError("Single sign-on is not set up for that company code.");
  return start(conn, { purpose: "login", redirectUri: input.redirectUri, loginHint: input.loginHint });
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
  const domains = conn.allowedDomains ?? [];
  if (domains.length > 0 && !(id.email && domains.includes(id.email.split("@")[1]))) throw new SsoError("Your email address is not allowed to sign in to this company.");

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
