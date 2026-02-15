"use client";

import { trpc } from "@/lib/trpc";
import { ChangeOrderForm } from "@/components/change-order/change-order-form";

export default function NewChangeOrderPage({
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
      <h1 className="text-2xl font-bold">New Change Order</h1>
      <ChangeOrderForm projectId={projectId} />
    </div>
  );
}
