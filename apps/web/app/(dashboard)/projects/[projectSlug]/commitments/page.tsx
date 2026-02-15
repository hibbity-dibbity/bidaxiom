"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { CommitmentList } from "@/components/budget/commitment-list";
import { Plus, ChevronLeft } from "lucide-react";

export default function CommitmentsPage({
  params,
}: {
  params: { projectSlug: string };
}) {
  const { projectSlug } = params;

  // Resolve project by slug (cached from layout)
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id;

  if (!project) {
    return null; // Layout handles loading/error states
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${projectSlug}/budget`}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Budget
          </Link>
        </Button>
        <Button asChild>
          <Link href={`/projects/${projectSlug}/commitments/new`}>
            <Plus className="h-4 w-4 mr-2" />
            New Commitment
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold mb-2">Commitments</h1>
        <p className="text-muted-foreground">
          Manage subcontracts and purchase orders
        </p>
      </div>

      <CommitmentList projectId={projectId} />
    </div>
  );
}
