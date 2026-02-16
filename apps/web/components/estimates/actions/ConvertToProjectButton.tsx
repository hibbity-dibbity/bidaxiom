"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { ButtonProps } from "@/components/ui/button";

interface ConvertToProjectButtonProps {
  estimateId: string;
  onSuccess?: () => void;
  variant?: ButtonProps["variant"];
}

export function ConvertToProjectButton({
  estimateId,
  onSuccess,
  variant = "default"
}: ConvertToProjectButtonProps) {
  const router = useRouter();

  const convertToProject = trpc.estimates.convertToProject.useMutation({
    onSuccess: (data) => {
      toast.success(`Project activated with ${data.budgetLineItemsCreated} budget line items`);
      onSuccess?.();
      // Navigate to project budget page using slug
      router.push(`/projects/${data.projectSlug}/budget`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to convert estimate to project");
    },
  });

  return (
    <Button
      variant={variant}
      onClick={() => convertToProject.mutate({ estimateId })}
      disabled={convertToProject.isPending}
    >
      {convertToProject.isPending ? "Converting..." : "Convert to Project"}
    </Button>
  );
}
