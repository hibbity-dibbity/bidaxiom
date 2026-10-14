"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";
import { ProjectHeader } from "./components/project-header";
import { ProjectTabs } from "./components/project-tabs";

interface ProjectLayoutProps {
  children: ReactNode;
  params: { projectSlug: string };
}

export default function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { projectSlug } = params;
  const { orgRole, userId } = useAuth();

  // Fetch project by slug
  const { data: project, isLoading, error } = trpc.project.getBySlug.useQuery({
    slug: projectSlug,
  });

  // Fetch header stats for the financial stat bar (enabled only when project is loaded)
  const { data: headerStats } = trpc.project.getHeaderStats.useQuery(
    { projectId: project?.id ?? "" },
    { enabled: !!project?.id }
  );

  // Header stat bar: contract value from the active proposal, cost and cash out from the orders.
  const { data: activeProposal } = trpc.proposal.activeForProject.useQuery(
    { projectId: project?.id ?? "" },
    { enabled: !!project?.id }
  );
  const { data: orderSummary } = trpc.order.projectSummary.useQuery(
    { projectId: project?.id ?? "" },
    { enabled: !!project?.id }
  );
  const { data: invoiceSummary } = trpc.invoice.list.useQuery(
    { projectId: project?.id ?? "" },
    { enabled: !!project?.id }
  );
  const billed = invoiceSummary?.billed ?? 0;
  const collected = invoiceSummary?.collected ?? 0;
  const stats = {
    contractValue: activeProposal ? activeProposal.contractValue / 100 : 0,
    billed,
    collected,
    costBudget: orderSummary?.costBudget ?? 0,
    paid: orderSummary?.paid ?? 0,
    outstanding: orderSummary?.outstanding ?? 0,
    cashPosition: collected - (orderSummary?.paid ?? 0),
  };

  const isAdmin = orgRole === "org:admin";

  // Determine if the current user can manually transition lifecycle phases.
  // The API enforces RBAC regardless — this flag only controls badge interactivity.
  // Org admins can always transition. Project-level estimator/project_manager/project_administrator
  // roles are also allowed — we check team membership when the project data is available.
  const canTransition = (() => {
    if (orgRole === "org:admin") return true;
    if (!userId || !project?.teamMembers) return false;
    const myMembership = project.teamMembers.find(
      (m: { userId: string; role: string }) => m.userId === userId
    );
    return (
      myMembership?.role === "estimator" ||
      myMembership?.role === "project_manager" ||
      myMembership?.role === "project_administrator"
    );
  })();

  // Loading state: Show skeleton placeholders
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-12 w-full" />
        <div className="mt-4">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // Not found state: Show error message with back link
  if (error || !project) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <h3 className="text-lg font-semibold">Project not found</h3>
          <p className="text-sm text-muted-foreground">
            The project you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button asChild>
            <Link href="/projects">Back to Projects</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Success state: Sticky chrome wrapper + scrollable content
  return (
    <div>
      {/* Sticky chrome wrapper — sticks within main's overflow-auto scroll context */}
      <div className="sticky top-0 z-10 bg-background -mx-6 -mt-6 px-6 pt-4 border-b">
        <ProjectHeader
          project={{
            id: project.id,
            jobNumber: project.jobNumber,
            name: project.name,
            slug: project.slug ?? "",
            lifecyclePhase: project.lifecyclePhase ?? "opportunity",
            projectMode: project.projectMode ?? "gc_advanced",
            customerId: project.customerId,
            customerSlug: project.customer?.slug ?? null,
            customerName: project.customer?.companyName ?? project.customer?.contactName ?? null,
            street1: project.street1 ?? null,
            city: project.city ?? null,
            state: project.state ?? null,
            zip: project.zip ?? null,
            startDate: project.startDate ?? null,
            endDate: project.endDate ?? null,
            restoredAt: project.restoredAt ?? null,
            customerBudget: project.customerBudget ?? null,
          }}
          stats={stats}
          canTransition={canTransition}
          canDelete={isAdmin}
        />
        <ProjectTabs
          projectSlug={projectSlug}
          projectMode={project.projectMode ?? "gc_advanced"}
          lifecyclePhase={project.lifecyclePhase ?? "opportunity"}
          headerStats={headerStats ?? null}
          orderCounts={orderSummary ? { purchase: orderSummary.purchaseCount, work: orderSummary.workCount } : null}
          openInvoices={invoiceSummary?.openCount ?? 0}
        />
      </div>
      {/* Scrollable content area with restored top padding */}
      <div className="pt-8">{children}</div>
    </div>
  );
}
