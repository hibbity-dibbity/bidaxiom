"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CreateOrganization,
  useOrganizationList,
} from "@clerk/nextjs";

/**
 * Onboarding Page
 *
 * Handles two signup paths per locked decisions:
 * 1. Direct signup -> user has no org -> show CreateOrganization
 * 2. Invited signup -> Clerk auto-joined user to org -> redirect to dashboard
 *
 * Clerk automatically handles invitation tokens (__clerk_ticket param).
 * When a user clicks an email invitation link, Clerk's SignUp component
 * detects the invitation context and auto-joins the user to the inviting
 * org after signup -- no custom code needed.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { userMemberships, isLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  useEffect(() => {
    if (!isLoaded) return;

    // If user already has an organization (invited path), redirect to dashboard
    if (userMemberships.data && userMemberships.data.length > 0) {
      router.push("/");
    }
  }, [isLoaded, userMemberships.data, router]);

  // Loading state while checking organizations
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // User has an org already (invited) -- will redirect via useEffect
  if (userMemberships.data && userMemberships.data.length > 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Redirecting to dashboard...</div>
      </div>
    );
  }

  // Direct signup path: user needs to create their first organization
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/50 p-4">
      <div className="mb-8 max-w-md text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Create Your Company
        </h1>
        <p className="mt-2 text-muted-foreground">
          Set up your company to start managing projects, bids, and financials.
        </p>
      </div>
      <CreateOrganization
        afterCreateOrganizationUrl="/"
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
