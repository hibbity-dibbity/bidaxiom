"use client";

import { useParams } from "next/navigation";
import { ChangeOrderDetail } from "@/components/change-order/change-order-detail";

export default function ChangeOrderDetailPage() {
  const { projectId, changeOrderId } = useParams<{
    projectId: string;
    changeOrderId: string;
  }>();

  return <ChangeOrderDetail changeOrderId={changeOrderId} projectId={projectId} />;
}
