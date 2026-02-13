"use client";

import { useParams } from "next/navigation";
import { ChangeOrderList } from "@/components/change-order/change-order-list";

export default function ChangeOrdersPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Change Orders</h1>
      <ChangeOrderList projectId={projectId} />
    </div>
  );
}
