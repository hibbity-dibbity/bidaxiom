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
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Change Orders</h1>
      <ChangeOrderList projectId={projectId} />
    </div>
  );
}
