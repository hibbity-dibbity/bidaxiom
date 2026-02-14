import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
  orgId?: string;
  orgRole?: string;
  orgName?: string;
  hasMfa?: boolean;
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
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const, // "lax" allows OAuth redirects, "strict" blocks them
    maxAge: 7 * 24 * 60 * 60, // 7 days (matches refresh token TTL)
  },
};

export async function getSession() {
  return await getIronSession<SessionData>(await cookies(), sessionOptions);
}
