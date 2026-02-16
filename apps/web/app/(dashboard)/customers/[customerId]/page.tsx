"use client";

import { redirect } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerRedirectPage({
  params,
}: {
  params: { customerId: string };
}) {
  const { customerId } = params;
  const { data: customer, isLoading } = trpc.customer.getById.useQuery({ id: customerId });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (customer?.slug) {
    redirect(`/customers/${customer.slug}`);
  }

  // If customer not found, redirect to list
  redirect("/customers");
}
