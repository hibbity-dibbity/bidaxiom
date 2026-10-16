import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth";
import { callSso, publicOrigin, setPending } from "@/lib/sso-api";

/** Admin: test the saved connection by signing in through it once. */
export async function GET(request: Request) {
  const origin = publicOrigin(request);
  const token = await getAccessToken();
  if (!token) return NextResponse.redirect(`${origin}/sign-in?sso_error=${encodeURIComponent("Your session expired. Sign in, then test the connection again.")}`);
  try {
    const r = await callSso<{ authUrl: string; pendingToken: string }>("setupStart", { redirectUri: `${origin}/api/auth/sso/callback` }, token);
    await setPending(r.pendingToken);
    return NextResponse.redirect(r.authUrl);
  } catch (e) {
    return NextResponse.redirect(`${origin}/settings/sign-in?error=${encodeURIComponent(e instanceof Error ? e.message : "Could not start")}`);
  }
}
