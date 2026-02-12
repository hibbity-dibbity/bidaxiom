"use client";

import { useOrganization } from "@clerk/nextjs";
import { OrganizationProfile } from "@clerk/nextjs";

/**
 * Team member management page.
 *
 * Per locked decisions:
 * - "Admin-initiated invitations only; no self-service 'join company' flow"
 * - "Users do NOT self-join companies — they are invited by the company admin"
 *
 * Uses Clerk's OrganizationProfile component which provides:
 * - Member list with roles
 * - Invitation form (email + role) — admin only
 * - Pending invitations list
 * - Remove member functionality
 *
 * Clerk handles role-based visibility natively:
 * - Admins see invite form and member management
 * - Members see read-only member list
 */
export default function MembersPage() {
  const { organization } = useOrganization();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Team Members</h1>
        <p className="text-muted-foreground">
          Manage your team and invite new members
          {organization?.name ? ` to ${organization.name}` : ""}
        </p>
      </div>

      <div className="[&_.cl-organizationProfile-root]:w-full [&_.cl-card]:shadow-none [&_.cl-card]:border [&_.cl-card]:rounded-lg [&_.cl-navbar]:hidden [&_.cl-pageScrollBox]:p-0 [&_.cl-profilePage]:p-4 [&_.cl-organizationProfile-root]:max-w-none">
        <OrganizationProfile
          routing="hash"
          appearance={{
            elements: {
              rootBox: "w-full max-w-none",
              card: "shadow-none border rounded-lg w-full max-w-none",
              navbar: "hidden",
              pageScrollBox: "p-0",
              page: "p-4",
              profileSection: "border-b pb-4",
              profileSectionContent: "pt-2",
            },
          }}
        />
      </div>
    </div>
  );
}
