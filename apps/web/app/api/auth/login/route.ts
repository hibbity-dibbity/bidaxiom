import { NextResponse } from "next/server";
import { login } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function POST(request: Request) {
  const body = await request.json();

  const response = await fetch(`${API_URL}/trpc/auth.login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: body }),
  });

  const data = await response.json();
  const result = data.result?.data?.json;

  if (!response.ok || !result) {
    const error = data.error?.json?.message || "Login failed";
    return NextResponse.json({ error }, { status: response.status || 400 });
  }

  // MFA required
  if (result.requiresMfa) {
    return NextResponse.json({ requiresMfa: true, userId: result.userId });
  }

  // Successful login -- store in session
  await login(result);

  return NextResponse.json({
    success: true,
    user: result.user,
    org: result.org,
    needsOrg: !result.org, // Redirect to onboarding if no org
    needsMfa: !result.user.mfaEnabled && process.env.NEXT_PUBLIC_ENFORCE_MFA === "true",
  });
}
