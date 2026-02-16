"use client";

import { redirect } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";

export default function SubcontractorRedirectPage({
  params,
}: {
  params: { subId: string };
}) {
  const { subId } = params;
  const { data: subcontractor, isLoading } = trpc.subcontractor.getById.useQuery({ id: subId });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (subcontractor?.slug) {
    redirect(`/subcontractors/${subcontractor.slug}`);
  }

  // If subcontractor not found, redirect to list
  redirect("/subcontractors");
}
