"use client";

import { OrdersReview } from "@/components/orders/orders-review";

export default function OrdersReviewPage({ params }: { params: { projectSlug: string; estimateSlug: string } }) {
  return <OrdersReview projectSlug={params.projectSlug} estimateSlug={params.estimateSlug} />;
}
