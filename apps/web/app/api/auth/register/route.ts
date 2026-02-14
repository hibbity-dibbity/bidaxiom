import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function POST(request: Request) {
  const body = await request.json();

  const response = await fetch(`${API_URL}/trpc/auth.register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: body }),
  });

  const data = await response.json();
  const result = data.result?.data?.json;

  if (!response.ok || !result) {
    const error = data.error?.json?.message || "Registration failed";
    return NextResponse.json({ error }, { status: response.status || 400 });
  }

  return NextResponse.json({
    success: true,
    message: result.message,
  });
}
