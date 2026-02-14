import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth";

export async function GET() {
  const accessToken = await getAccessToken();
  return NextResponse.json({ accessToken });
}
