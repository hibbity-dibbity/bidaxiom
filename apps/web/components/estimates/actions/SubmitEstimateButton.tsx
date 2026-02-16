"use client";

import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { ButtonProps } from "@/components/ui/button";

interface SubmitEstimateButtonProps {
  estimateId: string;
  onSuccess?: () => void;
  variant?: ButtonProps["variant"];
}

export function SubmitEstimateButton({ estimateId, onSuccess, variant = "default" }: SubmitEstimateButtonProps) {
  const submitEstimate = trpc.estimates.submitEstimate.useMutation({
    onSuccess: () => {
      toast.success("Estimate submitted for approval");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit estimate");
    },
  });

  return (
    <Button
      variant={variant}
      onClick={() => submitEstimate.mutate({ estimateId })}
      disabled={submitEstimate.isPending}
    >
      {submitEstimate.isPending ? "Submitting..." : "Submit for Approval"}
    </Button>
  );
}
