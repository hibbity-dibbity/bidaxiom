"use client";

import { useOrganization } from "@clerk/nextjs";
import {
  FolderKanban,
  Gavel,
  DollarSign,
  Activity,
} from "lucide-react";

/**
 * Company dashboard landing page.
 * Per locked decision: "Landing page after login: Company dashboard"
 *
 * Shows placeholder cards for Phase 1:
 * - Active Projects count
 * - Open Bids count
 * - Pending Pay Apps count
 * - Recent Activity feed
 *
 * Real data comes from future phases.
 */
export default function DashboardPage() {
  const { organization } = useOrganization();
  const companyName = organization?.name ?? "Your Company";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to {companyName}
        </p>
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

      {/* Recent Activity */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Recent Activity</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-muted-foreground">No recent activity</p>
          <p className="text-sm text-muted-foreground mt-1">
            Activity will appear here as you use the platform
          </p>
        </div>
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
