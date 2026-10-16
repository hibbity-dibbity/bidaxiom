import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "../db/client.js";
import { users, organizations, organizationMemberships, refreshTokens, passkeys } from "../db/schema/public.js";
import { signAccessToken, signRefreshToken } from "./jwt.js";
import { hashToken } from "./tokens.js";

/**
 * Start a session for a user who has already proven who they are (single sign-on).
 * Same tokens as the password login: access token, rotating refresh token, last-login stamp.
 * The IdP did the multi-factor step, so the session counts as MFA-verified.
 */
export async function issueSsoSession(userId: string, organizationId: string) {
  return issueSession(userId, organizationId, { idp: true });
}

/** How many different kinds of second factor the person has (authenticator app, passkey). */
export async function mfaMethodCount(userId: string, mfaEnabled: boolean): Promise<number> {
  const hasPasskey = await hasSecondFactor(userId, false);
  return (mfaEnabled ? 1 : 0) + (hasPasskey ? 1 : 0);
}

/**
 * Must this person finish setting up sign-in security before using the app?
 * Admins need two different methods (so one can back up the other); a person an admin reset needs one.
 * A session that came from the company's identity provider is exempt: the provider did the second step.
 */
export async function computeMfaGate(userId: string, orgRole: string | null | undefined, idp: boolean): Promise<boolean> {
  const user = await getDb().query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return false;
  const methods = await mfaMethodCount(userId, user.mfaEnabled);
  if (user.requireMfaSetup && methods >= 1) {
    await getDb().update(users).set({ requireMfaSetup: false }).where(eq(users.id, userId));
  }
  if (idp) return false;
  if (orgRole === "org:admin" && methods < 2) return true;
  return user.requireMfaSetup && methods < 1;
}

export const COMPANY_DISABLED_MESSAGE =
  "Your company's BidAxiom account is disabled, so nobody there can sign in right now. Contact your company administrator or BidAxiom support.";

/** Throws when the person's company has been disabled or moved to the recycle bin. */
export async function assertCompanyActive(userId: string, organizationId?: string): Promise<void> {
  const db = getDb();
  const membership = await db.query.organizationMemberships.findFirst({
    where: organizationId
      ? and(eq(organizationMemberships.userId, userId), eq(organizationMemberships.organizationId, organizationId))
      : eq(organizationMemberships.userId, userId),
  });
  if (!membership) return;
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, membership.organizationId) });
  if (org && (org.disabledAt || org.deletedAt)) throw new Error(COMPANY_DISABLED_MESSAGE);
}

/** True when the person has any second factor set up (authenticator app or a passkey). */
export async function hasSecondFactor(userId: string, mfaEnabled: boolean): Promise<boolean> {
  if (mfaEnabled) return true;
  const row = await getDb().query.passkeys.findFirst({ where: eq(passkeys.userId, userId), columns: { id: true } });
  return Boolean(row);
}

/**
 * Start a session after the person proved who they are with a second factor built in
 * (single sign-on, or a passkey). With no organization given, their first company is used.
 */
export async function issueSession(userId: string, organizationId?: string, opts: { idp?: boolean } = {}) {
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const membership = await db.query.organizationMemberships.findFirst({
    where: organizationId
      ? and(eq(organizationMemberships.userId, userId), eq(organizationMemberships.organizationId, organizationId))
      : eq(organizationMemberships.userId, userId),
  });
  if (!user) throw new Error("User not found");
  await assertCompanyActive(userId, organizationId);
  if (organizationId && !membership) throw new Error("No access to that company");
  const org = membership ? await db.query.organizations.findFirst({ where: eq(organizations.id, membership.organizationId) }) : null;
  if (membership && !org) throw new Error("Company not found");

  const tokenFamily = nanoid();
  const idp = opts.idp === true;
  const orgRole = membership?.role ?? "org:member";
  const mfaGate = await computeMfaGate(user.id, orgRole, idp);
  const accessToken = await signAccessToken({ userId: user.id, orgId: org?.id ?? "", orgRole, hasMfa: true, mfaGate, idp });
  const refreshToken = await signRefreshToken({ userId: user.id, tokenFamily, hasMfa: true, idp });
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    familyId: tokenFamily,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  return {
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, mfaEnabled: true, mfaGate },
    org: org && membership ? { id: org.id, name: org.name, role: membership.role } : null,
  };
}
