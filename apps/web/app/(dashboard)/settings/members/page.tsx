"use client";

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
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Team Members</h1>
        <p className="text-muted-foreground">
          Manage your team and invite new members
        </p>
      </div>

      <OrganizationProfile
        appearance={{
          elements: {
            rootBox: "w-full",
            card: "shadow-none border rounded-lg",
            navbar: "hidden",
            pageScrollBox: "p-0",
          },
        }}
        routing="hash"
      />
    </div>
  );
}
