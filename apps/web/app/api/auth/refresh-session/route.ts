import { NextResponse } from "next/server";
import { refreshAccessToken, getSessionData } from "@/lib/auth";

/** Get a fresh access token now (for example right after setting up a second factor) and return the session snapshot. */
export async function POST() {
  const token = await refreshAccessToken();
  if (!token) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json(await getSessionData());
}
