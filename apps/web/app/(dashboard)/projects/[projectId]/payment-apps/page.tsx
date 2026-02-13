"use client";

import { useParams } from "next/navigation";
import { PaymentAppList } from "@/components/payment-app/payment-app-list";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function PaymentAppsPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${projectId}`}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Project
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Payment Applications</h1>
        <p className="text-muted-foreground mt-1">
          Create and track payment applications for this project
        </p>
      </div>

      <PaymentAppList projectId={projectId} />
    </div>
  );
}
