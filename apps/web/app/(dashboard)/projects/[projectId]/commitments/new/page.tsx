"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CommitmentForm } from "@/components/budget/commitment-form";
import { ChevronLeft } from "lucide-react";

export default function NewCommitmentPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const handleSuccess = () => {
    router.push(`/projects/${projectId}/commitments`);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/projects/${projectId}/commitments`)}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Commitments
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold mb-2">New Commitment</h1>
        <p className="text-muted-foreground">
          Create a new subcontract or purchase order
        </p>
      </div>

      <CommitmentForm projectId={projectId} onSuccess={handleSuccess} />
    </div>
  );
}
