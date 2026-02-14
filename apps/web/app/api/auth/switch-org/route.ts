import { NextResponse } from "next/server";
import { setActiveOrg } from "@/lib/auth";

export async function POST(request: Request) {
  const { organizationId } = await request.json();
  // Call API to switch org
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const { getAccessToken } = await import("@/lib/auth");
  const token = await getAccessToken();

  const response = await fetch(`${API_URL}/trpc/auth.switchOrganization`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ json: { organizationId } }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Failed to switch org" }, { status: 400 });
  }

  const data = await response.json();
  const result = data.result?.data?.json;

  if (result) {
    await setActiveOrg(result.org, result.accessToken);
    return NextResponse.json({ org: result.org });
  }

  return NextResponse.json({ error: "Invalid response" }, { status: 400 });
}
