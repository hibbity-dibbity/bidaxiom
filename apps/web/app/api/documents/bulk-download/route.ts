import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function POST(request: NextRequest) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const apiResponse = await fetch(`${API_URL}/api/documents/bulk-download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!apiResponse.ok) {
    const errText = await apiResponse.text().catch(() => "");
    return NextResponse.json(
      { error: errText || "Bulk download failed" },
      { status: apiResponse.status }
    );
  }

  // Stream the zip directly back to the client without buffering
  return new NextResponse(apiResponse.body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="documents.zip"',
    },
  });
}
