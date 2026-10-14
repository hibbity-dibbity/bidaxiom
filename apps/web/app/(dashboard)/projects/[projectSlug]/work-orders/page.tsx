"use client";

import { ProjectOrdersList } from "@/components/orders/project-orders-list";

export default function WorkOrdersPage({ params }: { params: { projectSlug: string } }) {
  return <ProjectOrdersList projectSlug={params.projectSlug} kind="work" />;
}
