import { NextResponse } from "next/server";

const API = process.env.API_INTERNAL_URL || "http://api:3001";

/** Passes the free-trial form to the BidAxiom API from the server, so the browser never talks to the API directly. */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Please fill in the form." }, { status: 400 });
  }
  const forwarded = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "";
  try {
    const res = await fetch(`${API}/trpc/trial.start`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(forwarded ? { "x-forwarded-for": forwarded } : {}) },
      body: JSON.stringify({
        companyName: String(body.companyName ?? ""),
        firstName: String(body.firstName ?? ""),
        lastName: String(body.lastName ?? ""),
        email: String(body.email ?? ""),
        website: String(body.website ?? ""),
      }),
      cache: "no-store",
    });
    const json: any = await res.json().catch(() => null);
    if (res.ok) return NextResponse.json({ ok: true });
    const code = json?.error?.data?.code;
    let message: string = json?.error?.message ?? "";
    if (code === "BAD_REQUEST") message = "Please check your company name, name and email, then try again.";
    return NextResponse.json({ error: message || "We could not start your trial. Please try again." }, { status: res.status === 429 ? 429 : res.status === 409 ? 409 : 400 });
  } catch {
    return NextResponse.json({ error: "We could not reach BidAxiom just now. Please try again in a minute." }, { status: 503 });
  }
}
