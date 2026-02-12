"use client";

import { UserProfile } from "@clerk/nextjs";

/**
 * MFA Setup Page
 *
 * Shown when an authenticated user has not yet enabled MFA.
 * Per locked decision: MFA is required for ALL users, no exceptions.
 * Middleware redirects users without MFA here before they can access the dashboard.
 */
export default function MfaSetupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/50 p-4">
      <div className="mb-8 max-w-md text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Multi-Factor Authentication Required
        </h1>
        <p className="mt-2 text-muted-foreground">
          To protect your account and your company&apos;s data, multi-factor
          authentication is required to use ConstructionSaaS. Please enable an
          authenticator app below to continue.
        </p>
      </div>
      <UserProfile
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-md",
          },
        }}
      />
    </div>
  );
}
