"use server";
// Server Actions for auth operations

import { getSession, type SessionData } from "./session";
import { redirect } from "next/navigation";

// Server-side code may need a different address than the browser (e.g. the Docker
// network name). Falls back to the public URL when API_INTERNAL_URL isn't set.
const API_URL =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Get the current access token from session.
 * If expired, attempt to refresh using the refresh token.
 */
/** Refreshes in flight, by refresh token: simultaneous requests share one call instead of each rotating the token. */
const inFlight = new Map<string, Promise<{ ok: boolean; status: number; data: any }>>();

function callRefresh(refreshToken: string) {
  let p = inFlight.get(refreshToken);
  if (!p) {
    p = (async () => {
      try {
        const response = await fetch(`${API_URL}/trpc/auth.refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        const data = response.ok ? await response.json() : null;
        return { ok: response.ok, status: response.status, data };
      } catch {
        return { ok: false, status: 0, data: null }; // the API is restarting or unreachable
      }
    })();
    inFlight.set(refreshToken, p);
    setTimeout(() => inFlight.delete(refreshToken), 5000);
  }
  return p;
}

const tokenExpiresAt = (token: string | undefined): number => {
  try {
    return token ? JSON.parse(Buffer.from(token.split(".")[1], "base64").toString()).exp * 1000 : 0;
  } catch {
    return 0;
  }
};

export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  if (!session.accessToken) return null;

  // Try to decode the JWT to check expiry (without verification -- that's the API's job)
  try {
    const payload = JSON.parse(
      Buffer.from(session.accessToken.split(".")[1], "base64").toString()
    );
    const expiresAt = payload.exp * 1000;
    const now = Date.now();

    // If token expires in less than 2 minutes, refresh proactively
    if (expiresAt - now < 2 * 60 * 1000) {
      const fresh = await refreshAccessToken();
      // A refresh that failed for a passing reason (the API restarting) keeps the token we have while it still works.
      return fresh ?? (expiresAt > Date.now() && (await getSession()).accessToken ? session.accessToken ?? null : null);
    }

    return session.accessToken;
  } catch {
    return session.accessToken; // If decode fails, let the API handle it
  }
}

/**
 * Refresh the access token using the refresh token.
 */
export async function refreshAccessToken(): Promise<string | null> {
  const session = await getSession();
  if (!session.refreshToken) return null;

  const result0 = await callRefresh(session.refreshToken);
  if (!result0.ok) {
    // Only a refusal of the token itself ends the session. A busy server, a restart or a network blip does not.
    if (result0.status === 401) {
      // Another request may have just renewed the cookie; look again before giving up.
      const latest = await getSession();
      if (latest.refreshToken && latest.refreshToken !== session.refreshToken) return latest.accessToken ?? null;
      session.destroy();
    }
    return null;
  }
  const result = result0.data?.result?.data;

  if (result?.accessToken && result?.refreshToken) {
    session.accessToken = result.accessToken;
    session.refreshToken = result.refreshToken;
    try {
      // Keep the "second factor done" flag in step with the new token (it turns on after setting one up).
      const claims = JSON.parse(Buffer.from(result.accessToken.split(".")[1], "base64").toString());
      if (typeof claims.hasMfa === "boolean") session.hasMfa = claims.hasMfa;
      session.mfaGate = claims.mfaGate === true;
    } catch {}
    await session.save();
    return result.accessToken;
  }

  return null;
}

/**
 * Log in with credentials. Stores tokens in session.
 */
export async function login(data: {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; firstName?: string | null; lastName?: string | null; mfaEnabled: boolean; mfaGate?: boolean };
  org?: { id: string; name: string; role: string } | null;
}) {
  const session = await getSession();
  session.userId = data.user.id;
  session.accessToken = data.accessToken;
  session.refreshToken = data.refreshToken;
  session.hasMfa = data.user.mfaEnabled;
  session.mfaGate = data.user.mfaGate === true;
  session.user = {
    email: data.user.email,
    firstName: data.user.firstName,
    lastName: data.user.lastName,
  };
  if (data.org) {
    session.orgId = data.org.id;
    session.orgRole = data.org.role;
    session.orgName = data.org.name;
  }
  await session.save();
}

/**
 * Log out. Destroys session.
 */
export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/sign-in");
}

/**
 * Update the active organization in session.
 */
export async function setActiveOrg(org: { id: string; name: string; role: string }, accessToken: string) {
  const session = await getSession();
  session.orgId = org.id;
  session.orgRole = org.role;
  session.orgName = org.name;
  session.accessToken = accessToken;
  await session.save();
}

/**
 * Get session data for client components (read-only snapshot).
 */
export async function getSessionData(): Promise<SessionData> {
  const session = await getSession();
  return {
    userId: session.userId,
    orgId: session.orgId,
    orgRole: session.orgRole,
    orgName: session.orgName,
    hasMfa: session.hasMfa,
    mfaGate: session.mfaGate,
    user: session.user,
    // Do NOT return tokens to client
  };
}
