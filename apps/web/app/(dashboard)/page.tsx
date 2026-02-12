"use client";

import Link from "next/link";
import { useOrganization } from "@clerk/nextjs";
import {
  FolderKanban,
  Gavel,
  DollarSign,
  Activity,
  UserPlus,
  Plus,
  Shield,
  UserCheck,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

/**
 * Company dashboard landing page.
 * Per locked decision: "Landing page after login: Company dashboard"
 */
export default function DashboardPage() {
  const { organization } = useOrganization();
  const companyName = organization?.name ?? "Your Company";

  // Fetch real audit summary data
  const auditSummary = trpc.audit.summary.useQuery(undefined, {
    retry: false,
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to {companyName}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title="Active Projects"
          value="--"
          description="Coming in Phase 3"
          icon={FolderKanban}
        />
        <StatsCard
          title="Open Bids"
          value="--"
          description="Coming in Phase 7"
          icon={Gavel}
        />
        <StatsCard
          title="Pending Pay Apps"
          value="--"
          description="Coming in Phase 6"
          icon={DollarSign}
        />
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/settings/members">
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Team Members
          </Link>
        </Button>
        <Button variant="outline" disabled>
          <Plus className="mr-2 h-4 w-4" />
          Create Project
          <span className="ml-2 text-xs text-muted-foreground">(Soon)</span>
        </Button>
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Recent Activity</h2>
          </div>
          {auditSummary.data && auditSummary.data.totalToday > 0 && (
            <span className="text-sm text-muted-foreground">
              {auditSummary.data.totalToday} actions today
            </span>
          )}
        </div>

        {auditSummary.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : auditSummary.data?.recentActions &&
          auditSummary.data.recentActions.length > 0 ? (
          <div className="space-y-3">
            {auditSummary.data.recentActions.map((entry) => (
              <ActivityItem
                key={entry.id}
                action={entry.action}
                entityType={entry.entityType}
                entityId={entry.entityId}
                timestamp={new Date(entry.timestamp)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground">No recent activity yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Start by inviting team members!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatsCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border bg-card p-6 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
}

const actionIcons: Record<string, React.ComponentType<{ className?: string }>> =
  {
    create: Plus,
    invite: UserPlus,
    role_change: Shield,
    login: UserCheck,
  };

function ActivityItem({
  action,
  entityType,
  entityId,
  timestamp,
}: {
  action: string;
  entityType: string;
  entityId: string;
  timestamp: Date;
}) {
  const Icon = actionIcons[action] ?? Building2;
  const timeAgo = getRelativeTime(timestamp);

  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {action.replace("_", " ")} {entityType.toLowerCase()}
        </p>
        <p className="text-xs text-muted-foreground truncate">{entityId}</p>
      </div>
      <p className="text-xs text-muted-foreground whitespace-nowrap">
        {timeAgo}
      </p>
    </div>
  );
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
