"use client";

import Link from "next/link";
import { Users, Building2 } from "lucide-react";

/**
 * Settings landing page.
 * Routes to sub-pages for company configuration.
 */
export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your company and team settings
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/settings/members"
          className="rounded-lg border bg-card p-6 hover:shadow-sm transition-shadow"
        >
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Team Members</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Invite and manage team members, assign roles
          </p>
        </Link>

        <Link
          href="/settings/company"
          className="rounded-lg border bg-card p-6 hover:shadow-sm transition-shadow"
        >
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Company Profile</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure company type and trade specialties
          </p>
        </Link>
      </div>
    </div>
  );
}
