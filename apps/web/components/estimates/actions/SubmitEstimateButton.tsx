"use client";

import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/hooks/use-toast";
import type { ButtonProps } from "@/components/ui/button";

interface SubmitEstimateButtonProps {
  estimateId: string;
  onSuccess?: () => void;
  variant?: ButtonProps["variant"];
}

export function SubmitEstimateButton({ estimateId, onSuccess, variant = "default" }: SubmitEstimateButtonProps) {
  const { toast } = useToast();

  const submitEstimate = trpc.estimates.submitEstimate.useMutation({
    onSuccess: () => {
      toast({
        title: "Estimate submitted",
        description: "Your estimate has been submitted for approval.",
      });
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
