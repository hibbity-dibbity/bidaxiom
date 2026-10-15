import { getIronSession, sealData, unsealData, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { parse } from "cookie";
import type { NextResponse } from "next/server";

export interface SessionData {
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
  orgId?: string;
  orgRole?: string;
  orgName?: string;
  hasMfa?: boolean;
  /** Must finish setting up sign-in security (authenticator app + passkey for admins) before using the app. */
  mfaGate?: boolean;
  user?: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "construction_session",
  cookieOptions: {
    // Browsers drop "secure" cookies on plain http (a phone on the local network). COOKIE_SECURE=false allows that.
    secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const, // "lax" allows OAuth redirects, "strict" blocks them
    maxAge: 7 * 24 * 60 * 60, // 7 days (matches refresh token TTL)
  },
};

export async function getSession() {
  return await getIronSession<SessionData>(await cookies(), sessionOptions);
}

/**
 * Read session data from request cookie (for Route Handlers).
 * Bypasses Next.js cookies() API which may not work reliably in Route Handlers.
 */
export async function getSessionFromRequest(request: Request): Promise<SessionData> {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return {};
  }

  const cookies = parse(cookieHeader);
  const sessionCookie = cookies[sessionOptions.cookieName];
  if (!sessionCookie) {
    return {};
  }

  try {
    const data = await unsealData<SessionData>(sessionCookie, {
      password: sessionOptions.password,
    });
    return data;
  } catch {
    // Invalid or expired cookie
    return {};
  }
}

/**
 * Set session cookie on NextResponse (for Route Handlers).
 * Bypasses Next.js cookies() API to ensure cookie is set on the response.
 */
export async function setSessionCookie(
  response: NextResponse,
  data: SessionData
): Promise<void> {
  // Seal the session data with iron-session
  // Use 14-day TTL for seal (iron-session default), cookie maxAge for HTTP cookie expiry
  const sealedValue = await sealData(data, {
    password: sessionOptions.password,
    ttl: 14 * 24 * 60 * 60, // 14 days (iron-session default)
  });

  // Set the cookie on the response
  response.cookies.set(sessionOptions.cookieName, sealedValue, sessionOptions.cookieOptions);
}
