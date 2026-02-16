"use client";

import { redirect } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";

export default function EstimateWorkflowRedirectPage({
  params,
}: {
  params: { projectSlug: string; estimateId: string };
}) {
  const { projectSlug, estimateId } = params;
  const { data: estimate, isLoading } = trpc.estimates.getById.useQuery({ id: estimateId });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (estimate?.slug) {
    redirect(`/projects/${projectSlug}/estimates/${estimate.slug}/workflow`);
  }

  // If estimate not found, redirect to list
  redirect(`/projects/${projectSlug}/estimates`);
}
