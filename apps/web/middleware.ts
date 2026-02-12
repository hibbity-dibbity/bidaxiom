import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Public routes that don't require authentication.
 */
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

/**
 * MFA setup route — accessible to authenticated users without MFA.
 */
const isMfaSetupRoute = createRouteMatcher(["/mfa-setup(.*)"]);

/**
 * Whether to enforce MFA for all users.
 *
 * Requires Clerk Pro plan + custom session token with:
 *   claim "isMfa" → value "{{user.two_factor_enabled}}"
 *
 * Set NEXT_PUBLIC_ENFORCE_MFA=true in .env.local when ready.
 */
const ENFORCE_MFA = process.env.NEXT_PUBLIC_ENFORCE_MFA === "true";

/**
 * Clerk middleware with optional MFA enforcement.
 *
 * Flow:
 * 1. Public routes pass through
 * 2. No userId → redirect to sign-in
 * 3. If MFA enforcement enabled: no MFA + not on mfa-setup → redirect to /mfa-setup
 * 4. Otherwise, allow through
 *
 * IMPORTANT (CVE-2025-29927): This middleware is first-line defense only.
 * Auth MUST also be verified at the data access layer (tRPC context).
 * Do NOT rely solely on middleware for security.
 */
export default clerkMiddleware(async (auth, req) => {
  // Allow public routes through
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  const { userId, sessionClaims } = await auth();

  // No authenticated user → redirect to sign-in
  if (!userId) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.url);
    return NextResponse.redirect(signInUrl);
  }

  // MFA enforcement (requires Clerk Pro plan)
  if (ENFORCE_MFA) {
    const hasMfa = (sessionClaims as Record<string, unknown>)?.isMfa === true;

    if (!hasMfa && !isMfaSetupRoute(req)) {
      return NextResponse.redirect(new URL("/mfa-setup", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
