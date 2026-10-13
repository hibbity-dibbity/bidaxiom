"use client";

import { OrderDetail } from "@/components/orders/order-detail";

export default function OrderDetailPage({ params }: { params: { projectSlug: string; orderId: string } }) {
  return <OrderDetail projectSlug={params.projectSlug} orderId={params.orderId} />;
}
