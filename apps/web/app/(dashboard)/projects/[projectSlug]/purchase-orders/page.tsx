"use client";

import { ProjectOrdersList } from "@/components/orders/project-orders-list";

export default function PurchaseOrdersPage({ params }: { params: { projectSlug: string } }) {
  return <ProjectOrdersList projectSlug={params.projectSlug} kind="purchase" />;
}
