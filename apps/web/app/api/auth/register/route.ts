import { NextResponse } from "next/server";

// Server-side code may need a different address than the browser (e.g. the Docker
// network name). Falls back to the public URL when API_INTERNAL_URL isn't set.
const API_URL =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function POST(request: Request) {
  const body = await request.json();

  console.log("Registration request body:", body);

  const response = await fetch(`${API_URL}/trpc/auth.register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      json: {
        email: body.email,
        password: body.password,
        firstName: body.firstName,
        lastName: body.lastName,
        invitationToken: body.invitationToken,
      }
    }),
  });

  console.log("tRPC response status:", response.status);

  const data = await response.json();
  console.log("tRPC response data:", data);

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
