import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

/**
 * POST /api/auth/logout
 *
 * Destroys the user's session and clears the session cookie.
 * Used by UserMenu component for sign-out functionality.
 */
export async function POST() {
  try {
    const session = await getSession();
    session.destroy();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Failed to sign out" },
      { status: 500 }
    );
  }
}
