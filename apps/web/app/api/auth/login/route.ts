import { NextResponse } from "next/server";
import { login } from "@/lib/auth";

/**
 * Store login result in session.
 * The sign-in page already calls the tRPC login mutation,
 * so this endpoint just stores the session data.
 */
export async function POST(request: Request) {
  try {
    const result = await request.json();

    // Validate required fields
    if (!result.accessToken || !result.refreshToken || !result.user) {
      return NextResponse.json(
        { error: "Invalid login data" },
        { status: 400 }
      );
    }

    // Store session
    await login(result);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Session storage error:", error);
    return NextResponse.json(
      { error: "Failed to store session" },
      { status: 500 }
    );
  }
}
