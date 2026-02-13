"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BudgetLineItemTable } from "@/components/budget/budget-line-item-table";
import { ChevronLeft } from "lucide-react";

export default function BudgetLineItemsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${projectId}/budget`}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Budget
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold mb-2">Budget Line Items</h1>
        <p className="text-muted-foreground">
          Manage budget allocations by cost code
        </p>
      </div>

      <BudgetLineItemTable projectId={projectId} />
    </div>
  );
}
