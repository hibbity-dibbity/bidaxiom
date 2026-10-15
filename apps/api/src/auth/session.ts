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
  return issueSession(userId, organizationId);
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
export async function issueSession(userId: string, organizationId?: string) {
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const membership = await db.query.organizationMemberships.findFirst({
    where: organizationId
      ? and(eq(organizationMemberships.userId, userId), eq(organizationMemberships.organizationId, organizationId))
      : eq(organizationMemberships.userId, userId),
  });
  if (!user) throw new Error("User not found");
  if (organizationId && !membership) throw new Error("No access to that company");
  const org = membership ? await db.query.organizations.findFirst({ where: eq(organizations.id, membership.organizationId) }) : null;
  if (membership && !org) throw new Error("Company not found");

  const tokenFamily = nanoid();
  const accessToken = await signAccessToken({ userId: user.id, orgId: org?.id ?? "", orgRole: membership?.role ?? "org:member", hasMfa: true });
  const refreshToken = await signRefreshToken({ userId: user.id, tokenFamily, hasMfa: true });
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
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, mfaEnabled: true },
    org: org && membership ? { id: org.id, name: org.name, role: membership.role } : null,
  };
}
