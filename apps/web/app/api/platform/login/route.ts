import { NextResponse } from "next/server";
import { createServerTRPCClient } from "@/lib/trpc-server";
import { setPlatformCookie } from "@/lib/platform-session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.username || !body?.password || !body?.code) {
    return NextResponse.json({ error: "Enter your username, password and authenticator code." }, { status: 400 });
  }
  try {
    const trpc = createServerTRPCClient();
    const result = await trpc.platform.login.mutate({ username: String(body.username), password: String(body.password), code: String(body.code) });
    const res = NextResponse.json({ ok: true });
    await setPlatformCookie(res, result.token);
    return res;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sign-in failed" }, { status: 401 });
  }
}
