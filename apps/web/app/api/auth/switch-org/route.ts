import { NextResponse } from "next/server";
import { getSessionFromRequest, setSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  const { organizationId } = await request.json();
  console.log("[switch-org] Received organizationId:", organizationId);

  // Get current session to preserve existing data
  const currentSession = await getSessionFromRequest(request);
  const token = currentSession.accessToken;

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Call API to switch org
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  // Try non-batch single procedure call format
  const payload = { organizationId };
  console.log("[switch-org] Calling backend with payload:", JSON.stringify(payload));

  const response = await fetch(`${API_URL}/trpc/auth.switchOrganization`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[switch-org] Backend error:", response.status, errorText);
    return NextResponse.json({ error: "Failed to switch org" }, { status: 400 });
  }

  const data = await response.json();
  console.log("[switch-org] Backend response:", JSON.stringify(data));

  // Non-batch format: response has result.data
  const result = data?.result?.data;
  console.log("[switch-org] Parsed result:", JSON.stringify(result));

  if (result) {
    // Build complete updated session data
    const updatedSession = {
      ...currentSession,
      orgId: result.org.id,
      orgRole: result.org.role,
      orgName: result.org.name,
      accessToken: result.accessToken,
    };

    // Create response and set cookie explicitly
    const res = NextResponse.json({ org: result.org });
    await setSessionCookie(res, updatedSession);

    return res;
  }

  return NextResponse.json({ error: "Invalid response" }, { status: 400 });
}
