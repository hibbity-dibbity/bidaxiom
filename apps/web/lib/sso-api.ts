import { cookies } from "next/headers";

/** Calls the API's sign-in procedures from the web server (route handlers). */
const API_URL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const PENDING_COOKIE = "sso_pending";

export async function callSso<T>(procedure: string, input: unknown, accessToken?: string): Promise<T> {
  const res = await fetch(`${API_URL}/trpc/sso.${procedure}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? "Sign-in service is unavailable");
  return data.result.data as T;
}

/** The address this request came in on, as the browser sees it (behind Docker the Host header is the browser's). */
export function publicOrigin(request: Request): string {
  const h = request.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(request.url).host;
  const proto = h.get("x-forwarded-proto") ?? (new URL(request.url).protocol.replace(":", "") || "http");
  return `${proto}://${host}`;
}

export async function setPending(token: string) {
  (await cookies()).set(PENDING_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/api/auth/sso",
  });
}
