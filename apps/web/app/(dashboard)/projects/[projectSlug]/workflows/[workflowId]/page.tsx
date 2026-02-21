"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { WorkflowDetail } from "@/components/workflow/workflow-detail";
import { Skeleton } from "@/components/ui/skeleton";

export default function WorkflowDetailPage() {
  const params = useParams<{ projectSlug: string; workflowId: string }>();
  const { projectSlug, workflowId } = params;

  // Resolve projectId from slug (cached by layout's getBySlug query)
  const { data: project } = trpc.project.getBySlug.useQuery(
    { slug: projectSlug },
    { enabled: !!projectSlug }
  );

  if (!project) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <WorkflowDetail
      workflowId={workflowId}
      projectId={project.id}
      projectSlug={projectSlug}
    />
  );
}
