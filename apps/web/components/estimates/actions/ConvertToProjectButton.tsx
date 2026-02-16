"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/hooks/use-toast";
import type { ButtonProps } from "@/components/ui/button";

interface ConvertToProjectButtonProps {
  estimateId: string;
  projectId: string;
  onSuccess?: () => void;
  variant?: ButtonProps["variant"];
}

export function ConvertToProjectButton({
  estimateId,
  projectId,
  onSuccess,
  variant = "default"
}: ConvertToProjectButtonProps) {
  const { toast } = useToast();
  const router = useRouter();

  const convertToProject = trpc.estimates.convertToProject.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Project activated",
        description: `Budget created with ${data.budgetLineItemsCreated} line items.`,
      });
      onSuccess?.();
      // Navigate to project budget page
      router.push(`/projects/${projectId}/budget`);
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
      onClick={() => convertToProject.mutate({ estimateId })}
      disabled={convertToProject.isPending}
    >
      {convertToProject.isPending ? "Converting..." : "Convert to Project"}
    </Button>
  );
}
