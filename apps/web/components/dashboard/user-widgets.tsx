"use client";

import { KpiCard, KpiCardSkeleton } from "./kpi-card";
import { trpc } from "@/lib/trpc";
import { FolderKanban, Gavel, ClipboardCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export function MyActiveProjects() {
  const router = useRouter();
  const { userId } = useAuth();
  const { data, isLoading, error } = trpc.dashboard.myActiveProjects.useQuery(undefined, {
    retry: false,
  });

  if (isLoading) {
    return <KpiCardSkeleton />;
  }

  if (error || !data) {
    return (
      <KpiCard
        title="My Active Projects"
        value="--"
        description="Unable to load"
        icon={FolderKanban}
      />
    );
  }

  const status = data.overdueCount > 0 ? "warning" : "success";
  const description =
    data.overdueCount > 0
      ? `${data.overdueCount} overdue`
      : "All on schedule";

  return (
    <KpiCard
      title="My Active Projects"
      value={data.count}
      description={description}
      icon={FolderKanban}
      status={status}
      onClick={() => {
        const params = new URLSearchParams({ status: "active" });
        if (userId) params.set("assignedUser", userId);
        router.push(`/projects?${params.toString()}`);
      }}
    />
  );
}

export function MyOpenBids() {
  const router = useRouter();
  const { data, isLoading, error } = trpc.dashboard.myOpenBids.useQuery(undefined, {
    retry: false,
  });

  if (isLoading) {
    return <KpiCardSkeleton />;
  }

  if (error || !data) {
    return (
      <KpiCard
        title="My Open Bids"
        value="--"
        description="Unable to load"
        icon={Gavel}
      />
    );
  }

  const description =
    data.count > 0 ? "Awaiting response" : "No open bids";
  const status = data.count > 0 ? "neutral" : "success";

  return (
    <KpiCard
      title="My Open Bids"
      value={data.count}
      description={description}
      icon={Gavel}
      status={status}
      onClick={() => router.push("/projects")}
    />
  );
}

export function MyTodo() {
  const { data, isLoading, error } = trpc.dashboard.myTodo.useQuery(undefined, {
    retry: false,
  });

  if (isLoading) {
    return <KpiCardSkeleton />;
  }

  if (error || !data) {
    return (
      <KpiCard
        title="My To-Do"
        value="--"
        description="Unable to load"
        icon={ClipboardCheck}
      />
    );
  }

  // Build description from breakdown
  const parts: string[] = [];
  if (data.breakdown.changeOrders > 0) {
    parts.push(`${data.breakdown.changeOrders} approval${data.breakdown.changeOrders > 1 ? "s" : ""}`);
  }
  if (data.breakdown.workflows > 0) {
    parts.push(`${data.breakdown.workflows} workflow${data.breakdown.workflows > 1 ? "s" : ""}`);
  }

  const description = parts.length > 0 ? parts.join(", ") : "All caught up";
  const status = data.count > 0 ? "warning" : "success";

  return (
    <KpiCard
      title="My To-Do"
      value={data.count}
      description={description}
      icon={ClipboardCheck}
      status={status}
    />
  );
}
