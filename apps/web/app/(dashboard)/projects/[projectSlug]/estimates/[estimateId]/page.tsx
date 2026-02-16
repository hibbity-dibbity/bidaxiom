"use client";

import { redirect } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";

export default function EstimateRedirectPage({
  params,
}: {
  params: { projectSlug: string; estimateId: string };
}) {
  const { projectSlug, estimateId } = params;
  const { data: estimate, isLoading } = trpc.estimates.getById.useQuery({ id: estimateId });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (estimate?.slug) {
    redirect(`/projects/${projectSlug}/estimates/${estimate.slug}`);
  }

  // If estimate not found, redirect to list
  redirect(`/projects/${projectSlug}/estimates`);
}
