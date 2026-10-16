import { sealData, unsealData } from "iron-session";
import { parse } from "cookie";
import type { NextResponse } from "next/server";

/** Platform operators get their own cookie, completely separate from company sessions. */
export const PLATFORM_COOKIE = "bidaxiom_operator";
const MAX_AGE = 8 * 60 * 60;

const cookieOptions = () => ({
  secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production",
  httpOnly: true,
  sameSite: "strict" as const,
  maxAge: MAX_AGE,
  path: "/",
});

export async function setPlatformCookie(res: NextResponse, token: string) {
  const sealed = await sealData({ token }, { password: process.env.SESSION_SECRET!, ttl: MAX_AGE });
  res.cookies.set(PLATFORM_COOKIE, sealed, cookieOptions());
}

export function clearPlatformCookie(res: NextResponse) {
  res.cookies.set(PLATFORM_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

export async function getPlatformToken(request: Request): Promise<string | null> {
  const header = request.headers.get("cookie");
  if (!header) return null;
  const raw = parse(header)[PLATFORM_COOKIE];
  if (!raw) return null;
  try {
    const data = await unsealData<{ token?: string }>(raw, { password: process.env.SESSION_SECRET!, ttl: MAX_AGE });
    return data.token ?? null;
  } catch {
    return null;
  }
}
