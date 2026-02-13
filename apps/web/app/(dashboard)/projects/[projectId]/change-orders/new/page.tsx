"use client";

import { useParams } from "next/navigation";
import { ChangeOrderForm } from "@/components/change-order/change-order-form";

export default function NewChangeOrderPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">New Change Order</h1>
      <ChangeOrderForm projectId={projectId} />
    </div>
  );
}
