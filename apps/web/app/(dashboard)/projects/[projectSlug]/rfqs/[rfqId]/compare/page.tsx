"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BidComparisonTable } from "@/components/bidding/bid-comparison-table";
import { ChevronLeft } from "lucide-react";

export default function BidComparisonPage({
  params,
}: {
  params: { projectSlug: string; rfqId: string };
}) {
  const { projectSlug, rfqId } = params;

  // Resolve project by slug (cached from layout)
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id;

  const { data: rfq, isLoading } = trpc.rfq.getById.useQuery({ id: rfqId });

  if (isLoading || !rfq) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!project) {
    return null; // Layout handles loading/error states
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${projectSlug}/rfqs/${rfqId}`}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to RFQ
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">
          Bid Comparison - {rfq.rfqNumber}
        </h1>
        <p className="text-muted-foreground mt-1">{rfq.title}</p>
      </div>

      <BidComparisonTable rfqId={rfqId} projectId={projectId!} />
    </div>
  );
}
