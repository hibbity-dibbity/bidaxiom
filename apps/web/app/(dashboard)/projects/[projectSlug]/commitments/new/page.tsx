"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { CommitmentForm } from "@/components/budget/commitment-form";
import { ChevronLeft } from "lucide-react";

export default function NewCommitmentPage({
  params,
}: {
  params: { projectSlug: string };
}) {
  const { projectSlug } = params;
  const router = useRouter();

  // Resolve project by slug (cached from layout)
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id;

  const handleSuccess = () => {
    router.push(`/projects/${projectSlug}/commitments`);
  };

  if (!project) {
    return null; // Layout handles loading/error states
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/projects/${projectSlug}/commitments`)}
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

      <CommitmentForm projectId={project.id} onSuccess={handleSuccess} />
    </div>
  );
}
