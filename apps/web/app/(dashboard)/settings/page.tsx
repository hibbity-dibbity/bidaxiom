"use client";

import Link from "next/link";
import { User, Users, Building2, Plug, Activity } from "lucide-react";

/**
 * Settings landing page.
 * Routes to sub-pages for company configuration and account settings.
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
          href="/settings/account"
          className="bg-card p-6 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <User className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Account Settings</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage your profile, password, and two-factor authentication
          </p>
        </Link>

        <Link
          href="/settings/members"
          className="bg-card p-6 hover:bg-muted/50 transition-colors"
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
          className="bg-card p-6 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Company Profile</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure company type and trade specialties
          </p>
        </Link>

        <Link
          href="/settings/integrations"
          className="bg-card p-6 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <Plug className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Integrations</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Connect external services like QuickBooks Online
          </p>
        </Link>

        <Link
          href="/settings/activity"
          className="bg-card p-6 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Activity Log</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            View recent activity across your organization
          </p>
        </Link>
      </div>
    </div>
  );
}
