"use client";

import { trpc } from "@/lib/trpc";
import { ChangeOrderList } from "@/components/change-order/change-order-list";

export default function ChangeOrdersPage({
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
    <div className="space-y-6">
      <ChangeOrderList projectId={projectId} projectSlug={project.slug} />
    </div>
  );
}
