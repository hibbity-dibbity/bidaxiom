import { NextResponse } from "next/server";
import { callSso, publicOrigin, setPending } from "@/lib/sso-api";

/** Sign in with a company's own identity provider: send the browser to its sign-in page. */
export async function GET(request: Request) {
  const origin = publicOrigin(request);
  const email = new URL(request.url).searchParams.get("email") ?? "";
  try {
    const r = await callSso<{ authUrl: string; pendingToken: string }>("start", { email, redirectUri: `${origin}/api/auth/sso/callback` });
    await setPending(r.pendingToken);
    return NextResponse.redirect(r.authUrl);
  } catch (e) {
    return NextResponse.redirect(`${origin}/sign-in?sso_error=${encodeURIComponent(e instanceof Error ? e.message : "Sign-in failed")}`);
  }
}
