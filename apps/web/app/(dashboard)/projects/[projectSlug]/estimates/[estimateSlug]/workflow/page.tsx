"use client";

import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkflowSidebar } from "@/components/estimates/workflow/WorkflowSidebar";
import { WorkflowStepContainer } from "@/components/estimates/workflow/WorkflowStepContainer";
import { useWorkflowState } from "@/components/estimates/workflow/useWorkflowState";
import { useIsMutating } from "@tanstack/react-query";

export default function EstimateWorkflowPage({
  params,
}: {
  params: { projectSlug: string; estimateSlug: string };
}) {
  const { estimateSlug } = params;
  const { setEstimateId, currentStep } = useWorkflowState();
  const isMutating = useIsMutating();

  // Load estimate data
  const { data: estimate, isLoading } = trpc.estimates.getBySlug.useQuery({
    slug: estimateSlug,
  });

  // Initialize workflow state with current estimate
  useEffect(() => {
    if (estimate?.id) {
      setEstimateId(estimate.id);
    }
  }, [estimate?.id, setEstimateId]);

  if (isLoading) {
    return (
      <div className="flex h-screen">
        <div className="w-64 border-r p-6">
          <Skeleton className="h-8 w-32 mb-4" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Estimate Not Found</h2>
          <p className="text-muted-foreground">
            The estimate you're looking for doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar Navigation */}
      <WorkflowSidebar />

      {/* Main Content Area */}
      <div className="flex-1 p-6">
        {/* Saving Indicator */}
        <div className="mb-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{estimate.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Status: {estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}
            </p>
          </div>
          {isMutating > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span>Saving...</span>
            </div>
          )}
        </div>

        {/* Step Content */}
        <WorkflowStepContainer estimateId={estimate.id} currentStep={currentStep} />
      </div>
    </div>
  );
}
