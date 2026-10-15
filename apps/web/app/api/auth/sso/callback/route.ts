import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { login } from "@/lib/auth";
import { callSso, publicOrigin, PENDING_COOKIE } from "@/lib/sso-api";

type Result =
  | { kind: "login"; session: Parameters<typeof login>[0] }
  | { kind: "setup"; organizationId: string };

/** The provider sends the browser back here with a code; trade it for a BidAxiom session. */
export async function GET(request: Request) {
  const origin = publicOrigin(request);
  const url = new URL(request.url);
  const jar = await cookies();
  const pending = jar.get(PENDING_COOKIE)?.value;
  jar.delete({ name: PENDING_COOKIE, path: "/api/auth/sso" });
  const fail = (msg: string, to = "/sign-in") => NextResponse.redirect(`${origin}${to}${to.includes("?") ? "&" : "?"}${to.startsWith("/settings") ? "error" : "sso_error"}=${encodeURIComponent(msg)}`);

  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (providerError) return fail(providerError.split("\n")[0].slice(0, 200));
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!pending || !code || !state) return fail("This sign-in expired. Please start again.");
  try {
    const r = await callSso<Result>("complete", { code, state, pendingToken: pending });
    if (r.kind === "setup") return NextResponse.redirect(`${origin}/settings/sign-in?connected=1`);
    await login(r.session);
    return NextResponse.redirect(`${origin}/`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Sign-in failed");
  }
}
