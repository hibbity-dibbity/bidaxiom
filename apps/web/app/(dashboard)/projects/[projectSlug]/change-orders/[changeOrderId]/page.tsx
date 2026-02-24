"use client";

import { trpc } from "@/lib/trpc";
import { ChangeOrderDetail } from "@/components/change-order/change-order-detail";

export default function ChangeOrderDetailPage({
  params,
}: {
  params: { projectSlug: string; changeOrderId: string };
}) {
  const { projectSlug, changeOrderId } = params;

  // Resolve project by slug (cached from layout)
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });

  if (!project) {
    return null; // Layout handles loading/error states
  }

  return (
    <ChangeOrderDetail
      changeOrderId={changeOrderId}
      projectId={project.id}
      projectSlug={project.slug}
      customerEmail={project?.customer?.email}
    />
  );
}
