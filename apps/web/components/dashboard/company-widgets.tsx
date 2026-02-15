"use client";

import { KpiCard, KpiCardSkeleton } from "./kpi-card";
import { trpc } from "@/lib/trpc";
import { Building2, Gavel, Receipt, Target } from "lucide-react";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function TotalActiveProjects() {
  const { data, isLoading, error } = trpc.dashboard.totalActiveProjects.useQuery(undefined, {
    retry: false,
  });

  if (isLoading) {
    return <KpiCardSkeleton />;
  }

  if (error || !data) {
    return (
      <KpiCard
        title="Total Active Projects"
        value="--"
        description="Unable to load"
        icon={Building2}
      />
    );
  }

  return (
    <KpiCard
      title="Total Active Projects"
      value={data.count}
      description="Across all teams"
      icon={Building2}
      status="neutral"
    />
  );
}

export function CompanyOpenBids() {
  const { data, isLoading, error } = trpc.dashboard.openBids.useQuery(undefined, {
    retry: false,
  });

  if (isLoading) {
    return <KpiCardSkeleton />;
  }

  if (error || !data) {
    return (
      <KpiCard
        title="Open Bids"
        value="--"
        description="Unable to load"
        icon={Gavel}
      />
    );
  }

  const description = data.count > 0 ? "Under evaluation" : "No open bids";

  return (
    <KpiCard
      title="Open Bids"
      value={data.count}
      description={description}
      icon={Gavel}
      status="neutral"
    />
  );
}

export function PendingPayApps() {
  const { data, isLoading, error } = trpc.dashboard.pendingPayApps.useQuery(undefined, {
    retry: false,
  });

  if (isLoading) {
    return <KpiCardSkeleton />;
  }

  if (error || !data) {
    return (
      <KpiCard
        title="Pending Pay Apps"
        value="--"
        description="Unable to load"
        icon={Receipt}
      />
    );
  }

  const description = data.count > 0
    ? `${currencyFormatter.format(data.totalAmount)} pending`
    : "None pending";
  const status = data.count > 0 ? "warning" : "success";

  return (
    <KpiCard
      title="Pending Pay Apps"
      value={data.count}
      description={description}
      icon={Receipt}
      status={status}
    />
  );
}

export function BidOpportunities() {
  const { data, isLoading, error } = trpc.dashboard.bidOpportunities.useQuery(undefined, {
    retry: false,
  });

  if (isLoading) {
    return <KpiCardSkeleton />;
  }

  if (error || !data) {
    return (
      <KpiCard
        title="Bid Opportunities"
        value="--"
        description="Unable to load"
        icon={Target}
      />
    );
  }

  const description = data.count > 0 ? "Open RFQs" : "No open RFQs";

  return (
    <KpiCard
      title="Bid Opportunities"
      value={data.count}
      description={description}
      icon={Target}
      status="neutral"
    />
  );
}
