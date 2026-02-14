import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { type SessionData, sessionOptions } from "./lib/session";

const publicRoutes = ["/sign-in", "/sign-up", "/verify-email", "/reset-password", "/api/webhooks"];
const mfaSetupRoute = "/mfa-setup";

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((route) => pathname.startsWith(route));
}

const ENFORCE_MFA = process.env.NEXT_PUBLIC_ENFORCE_MFA === "true";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // Get session from cookie
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  // No authenticated user -> redirect to sign-in
  if (!session.userId) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect_url", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // MFA enforcement
  if (ENFORCE_MFA && !session.hasMfa && !pathname.startsWith(mfaSetupRoute)) {
    return NextResponse.redirect(new URL(mfaSetupRoute, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
