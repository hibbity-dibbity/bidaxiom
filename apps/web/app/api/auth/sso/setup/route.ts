import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth";
import { callSso, publicOrigin, setPending } from "@/lib/sso-api";

/** Admin: connect this company's Microsoft directory. The admin signs in once as proof. */
export async function GET(request: Request) {
  const origin = publicOrigin(request);
  const provider = new URL(request.url).searchParams.get("provider") ?? "microsoft";
  const token = await getAccessToken();
  if (!token) return NextResponse.redirect(`${origin}/sign-in`);
  try {
    const r = await callSso<{ authUrl: string; pendingToken: string }>("setupStart", { provider, redirectUri: `${origin}/api/auth/sso/callback` }, token);
    await setPending(r.pendingToken);
    return NextResponse.redirect(r.authUrl);
  } catch (e) {
    return NextResponse.redirect(`${origin}/settings/sign-in?error=${encodeURIComponent(e instanceof Error ? e.message : "Could not start")}`);
  }
}
