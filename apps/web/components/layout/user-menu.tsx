"use client";

import { UserButton } from "@clerk/nextjs";

/**
 * User menu with avatar, profile, and sign-out.
 * Per locked decision IDMT-03: "User can log out from any page"
 * Uses Clerk's UserButton which provides:
 * - User avatar
 * - Profile management
 * - Sign-out option
 */
export function UserMenu() {
  return (
    <UserButton
      afterSignOutUrl="/sign-in"
      appearance={{
        elements: {
          avatarBox: "h-8 w-8",
        },
      }}
    />
  );
}
