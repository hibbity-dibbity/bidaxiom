import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  const { organizationId } = await request.json();
  console.log("[DEBUG ORG-FLOW] 3a. switch-org route called with organizationId:", organizationId);

  // Call API to switch org
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const { getAccessToken } = await import("@/lib/auth");
  const token = await getAccessToken();
  console.log("[DEBUG ORG-FLOW] 3b. Got access token for backend call:", token ? "yes (length: " + token.length + ")" : "NO TOKEN");

  // tRPC batch format for Fastify adapter
  const payload = { "0": { json: { organizationId } } };
  console.log("[DEBUG ORG-FLOW] 3b-payload. Sending to backend:", JSON.stringify(payload));

  const response = await fetch(`${API_URL}/trpc/auth.switchOrganization?batch=1`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  console.log("[DEBUG ORG-FLOW] 3c. Backend response status:", response.status, "ok:", response.ok);

  if (!response.ok) {
    const errorText = await response.text();
    console.log("[DEBUG ORG-FLOW] 3c-error. Backend error response:", errorText);
    return NextResponse.json({ error: "Failed to switch org" }, { status: 400 });
  }

  const data = await response.json();
  console.log("[DEBUG ORG-FLOW] 3d. Raw backend response:", JSON.stringify(data));

  // Batch format: response is array with single element
  const batchResult = data[0];
  const result = batchResult?.result?.data?.json;
  console.log("[DEBUG ORG-FLOW] 3e. Parsed tRPC batch result:", JSON.stringify(result));

  if (result) {
    console.log("[DEBUG ORG-FLOW] 3f. Updating session with org:", JSON.stringify(result.org), "accessToken length:", result.accessToken?.length);

    // Update session directly in this API route context (not via server action)
    const session = await getSession();
    session.orgId = result.org.id;
    session.orgRole = result.org.role;
    session.orgName = result.org.name;
    session.accessToken = result.accessToken;
    await session.save();

    console.log("[DEBUG ORG-FLOW] 3g. Session updated and saved - orgId:", session.orgId, "orgName:", session.orgName);
    return NextResponse.json({ org: result.org });
  }

  console.log("[DEBUG ORG-FLOW] 3h. ERROR: result was falsy, raw data:", JSON.stringify(data));
  return NextResponse.json({ error: "Invalid response" }, { status: 400 });
}
