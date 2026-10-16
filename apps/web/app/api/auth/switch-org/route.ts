import { NextResponse } from "next/server";
import { getSessionFromRequest, setSessionCookie } from "@/lib/session";
import { createServerTRPCClient } from "@/lib/trpc-server";

export async function POST(request: Request) {
  const { organizationId } = await request.json();

  // Get current session to preserve existing data
  const currentSession = await getSessionFromRequest(request);
  const token = currentSession.accessToken;

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Use server-side tRPC client instead of raw fetch
    const trpc = createServerTRPCClient(token);

    const result = await trpc.auth.switchOrganization.mutate({ organizationId });

    // The new token says whether this person still has to set up a second factor in the new company
    // (admins always do). Keep the web session in step so the app sends them to MFA setup.
    let mfaGate = false;
    let hasMfa = currentSession.hasMfa;
    try {
      const claims = JSON.parse(Buffer.from(result.accessToken.split(".")[1], "base64").toString());
      mfaGate = claims.mfaGate === true;
      if (typeof claims.hasMfa === "boolean") hasMfa = claims.hasMfa;
    } catch {}

    // Build complete updated session data
    const updatedSession = {
      ...currentSession,
      orgId: result.org.id,
      orgRole: result.org.role,
      orgName: result.org.name,
      accessToken: result.accessToken,
      mfaGate,
      hasMfa,
    };

    // Create response and set cookie explicitly
    const res = NextResponse.json({ org: result.org, mfaGate });
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
