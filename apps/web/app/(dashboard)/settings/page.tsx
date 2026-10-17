"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { User, Users, Building2, Plug, KeyRound, Activity, Trash2, FileText, LayoutTemplate, ScrollText } from "lucide-react";

/**
 * Settings landing page.
 * Routes to sub-pages for company configuration and account settings.
 */
export default function SettingsPage() {
  const { orgRole } = useAuth();
  const isAdmin = !orgRole || orgRole === "org:admin";
  const canTemplates = isAdmin || orgRole === "org:project_manager" || orgRole === "org:estimator";
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

        {isAdmin && (
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
        )}

        {isAdmin && (
        <Link
          href="/settings/sign-in"
          className="bg-card p-6 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Single Sign-On</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Let your team sign in with Microsoft
          </p>
        </Link>
        )}

        {isAdmin && (
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
        )}

        {isAdmin && (
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
        )}

        {isAdmin && (
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
        )}

        {isAdmin && (
        <Link
          href="/settings/deleted-projects"
          className="bg-card p-6 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <Trash2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Deleted Projects</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Recover projects removed within the last 30 days
          </p>
        </Link>
        )}

        {isAdmin && (
        <Link
          href="/settings/document-naming"
          className="bg-card p-6 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Document Naming</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure how generated PDFs are named with custom templates
          </p>
        </Link>
        )}

        {isAdmin && (
        <Link
          href="/settings/proposal-terms"
          className="bg-card p-6 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <ScrollText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Proposal Terms</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Master terms and conditions added to every proposal you send
          </p>
        </Link>
        )}

        {isAdmin && (
        <Link
          href="/settings/change-order-terms"
          className="bg-card p-6 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <ScrollText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Change Order Authorization</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            The extra work authorization wording printed on every change order you send
          </p>
        </Link>
        )}

        {canTemplates && (
        <Link
          href="/settings/proposal-templates"
          className="bg-card p-6 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <LayoutTemplate className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Proposal Templates</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Reusable groups of lines (slab, metal building and its add-ons, insulation) for proposals and change orders, personal or shared
          </p>
        </Link>
        )}
      </div>
    </div>
  );
}
