import { NextResponse } from "next/server";
import { createServerTRPCClient } from "@/lib/trpc-server";
import { getPlatformToken, clearPlatformCookie } from "@/lib/platform-session";

const QUERIES = new Set(["me", "companies", "activity"]);
const MUTATIONS = new Set(["createCompany", "resetSignIn", "resendSetupEmail", "setCompanyDisabled", "setCompanyPasscodeExempt", "setUserPasscodeExempt", "moveCompanyToBin", "restoreCompany", "deleteCompanyForever"]);

/** Forwards a whitelisted operator call to the API with the operator's token. */
export async function POST(request: Request) {
  const token = await getPlatformToken(request);
  if (!token) return NextResponse.json({ error: "Sign in required", signedOut: true }, { status: 401 });
  const body = await request.json().catch(() => null);
  const proc = String(body?.proc ?? "");
  if (!QUERIES.has(proc) && !MUTATIONS.has(proc)) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  try {
    const api = createServerTRPCClient(token).platform as any;
    const data = QUERIES.has(proc) ? await api[proc].query(body?.input) : await api[proc].mutate(body?.input);
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    const signedOut = /session expired|sign-in required|unavailable/i.test(message);
    const res = NextResponse.json({ error: message, signedOut }, { status: signedOut ? 401 : 400 });
    if (signedOut) clearPlatformCookie(res);
    return res;
  }
}
