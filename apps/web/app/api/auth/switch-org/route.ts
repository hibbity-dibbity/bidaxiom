import { NextResponse } from "next/server";
import { getSessionFromRequest, setSessionCookie } from "@/lib/session";
import { createServerTRPCClient } from "@/lib/trpc-server";

export async function POST(request: Request) {
  const { organizationId } = await request.json();
  console.log("[switch-org] Received organizationId:", organizationId);

  // Get current session to preserve existing data
  const currentSession = await getSessionFromRequest(request);
  const token = currentSession.accessToken;

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Use server-side tRPC client instead of raw fetch
    const trpc = createServerTRPCClient(token);
    console.log("[switch-org] Calling backend via tRPC client");

    const result = await trpc.auth.switchOrganization.mutate({ organizationId });
    console.log("[switch-org] Backend response:", JSON.stringify(result));

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
  } catch (error: any) {
    console.error("[switch-org] Backend error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to switch org" },
      { status: 400 }
    );
  }
}
