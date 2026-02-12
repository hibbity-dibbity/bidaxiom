"use client";

import { OrganizationSwitcher } from "@clerk/nextjs";

/**
 * Slack-style company switcher.
 * Per locked decision: dropdown in header bar.
 * Uses Clerk's OrganizationSwitcher which handles:
 * - Listing user's organizations
 * - Switching active organization
 * - Creating new organizations
 * - Session preservation on switch
 */
export function CompanySwitcher() {
  return (
    <OrganizationSwitcher
      hidePersonal={true}
      afterSelectOrganizationUrl="/"
      appearance={{
        elements: {
          rootBox: "flex items-center",
          organizationSwitcherTrigger:
            "px-2 py-1 rounded-md border border-input bg-background hover:bg-accent text-sm",
        },
      }}
    />
  );
}
