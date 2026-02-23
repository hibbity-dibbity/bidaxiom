"use client";

import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { EstimateStepperBar } from "@/components/estimates/workflow/EstimateStepperBar";
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
      <div className="p-6">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-12 w-full mb-6" />
        <Skeleton className="h-96 w-full" />
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
    <div className="p-6">
      {/* Page header: estimate name + saving indicator */}
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

      {/* Step progress stepper (FORM-01) — replaces WorkflowSidebar for navigation.
          Note: wizard steps are rendered via switch/case in WorkflowStepContainer,
          NOT conditionally mounted in a single form. No Controller unmount risk here. */}
      <EstimateStepperBar />

      {/* Step content */}
      <WorkflowStepContainer estimateId={estimate.id} currentStep={currentStep} />
    </div>
  );
}
