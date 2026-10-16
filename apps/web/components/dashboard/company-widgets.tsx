"use client";

import { KpiCard, KpiCardSkeleton } from "./kpi-card";
import { trpc } from "@/lib/trpc";
import { Building2, Gavel, Receipt, Target, DollarSign, Layers, Calculator } from "lucide-react";
import { useRouter } from "next/navigation";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function TotalActiveProjects() {
  const router = useRouter();
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
      onClick={() => router.push("/projects?status=active")}
    />
  );
}

export function CompanyOpenBids() {
  const router = useRouter();
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
      onClick={() => router.push("/projects")}
    />
  );
}

export function BidOpportunities() {
  const router = useRouter();
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

  const description = data.count > 0 ? "Open bids" : "No open bids";

  return (
    <KpiCard
      title="Bid Opportunities"
      value={data.count}
      description={description}
      icon={Target}
      status="neutral"
      onClick={() => router.push("/projects")}
    />
  );
}

export function RevenueInProgress() {
  const router = useRouter();
  const { data, isLoading, error } = trpc.dashboard.revenueInProgress.useQuery(undefined, {
    retry: false,
  });

  if (isLoading) {
    return <KpiCardSkeleton />;
  }

  if (error || !data) {
    return (
      <KpiCard
        title="Revenue in Progress"
        value="--"
        description="Unable to load"
        icon={DollarSign}
      />
    );
  }

  return (
    <KpiCard
      title="Revenue in Progress"
      value={currencyFormatter.format(data.total)}
      description="Total budgeted on active projects"
      icon={DollarSign}
      status="neutral"
      onClick={() => router.push("/projects?status=active")}
    />
  );
}

export function Backlog() {
  const router = useRouter();
  const { data, isLoading, error } = trpc.dashboard.backlog.useQuery(undefined, {
    retry: false,
  });

  if (isLoading) {
    return <KpiCardSkeleton />;
  }

  if (error || !data) {
    return (
      <KpiCard
        title="Backlog"
        value="--"
        description="Unable to load"
        icon={Layers}
      />
    );
  }

  const status = data.total > 0 ? "success" : "neutral";

  return (
    <KpiCard
      title="Backlog"
      value={currencyFormatter.format(data.total)}
      description="Committed less earned"
      icon={Layers}
      status={status}
      onClick={() => router.push("/projects?status=active")}
    />
  );
}

export function EstimatingPipeline() {
  const { data, isLoading, error } = trpc.dashboard.estimatingPipeline.useQuery(undefined, {
    retry: false,
  });

  if (isLoading) {
    return <KpiCardSkeleton />;
  }

  if (error || !data) {
    return (
      <KpiCard
        title="Estimating Pipeline"
        value="--"
        description="Unable to load"
        icon={Calculator}
      />
    );
  }

  const description = data.hasEstimatingModule ? "Active estimates" : "No estimates yet";

  return (
    <KpiCard
      title="Estimating Pipeline"
      value={currencyFormatter.format(data.total)}
      description={description}
      icon={Calculator}
      status="neutral"
    />
  );
}
