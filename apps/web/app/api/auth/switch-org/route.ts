import { NextResponse } from "next/server";
import { setActiveOrg } from "@/lib/auth";

export async function POST(request: Request) {
  const { organizationId } = await request.json();
  console.log("[DEBUG ORG-FLOW] 3a. switch-org route called with organizationId:", organizationId);

  // Call API to switch org
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const { getAccessToken } = await import("@/lib/auth");
  const token = await getAccessToken();
  console.log("[DEBUG ORG-FLOW] 3b. Got access token for backend call:", token ? "yes (length: " + token.length + ")" : "NO TOKEN");

  const response = await fetch(`${API_URL}/trpc/auth.switchOrganization`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ json: { organizationId } }),
  });
  console.log("[DEBUG ORG-FLOW] 3c. Backend response status:", response.status, "ok:", response.ok);

  if (!response.ok) {
    return NextResponse.json({ error: "Failed to switch org" }, { status: 400 });
  }

  const data = await response.json();
  const result = data.result?.data?.json;
  console.log("[DEBUG ORG-FLOW] 3d. Parsed tRPC response - result:", JSON.stringify(result));

  if (result) {
    console.log("[DEBUG ORG-FLOW] 3e. Calling setActiveOrg with org:", JSON.stringify(result.org), "accessToken length:", result.accessToken?.length);
    await setActiveOrg(result.org, result.accessToken);
    console.log("[DEBUG ORG-FLOW] 3f. setActiveOrg completed successfully");
    return NextResponse.json({ org: result.org });
  }

  console.log("[DEBUG ORG-FLOW] 3g. ERROR: result was falsy, raw data:", JSON.stringify(data));
  return NextResponse.json({ error: "Invalid response" }, { status: 400 });
}
