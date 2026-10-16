import { NextResponse } from "next/server";
import { clearPlatformCookie } from "@/lib/platform-session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearPlatformCookie(res);
  return res;
}
