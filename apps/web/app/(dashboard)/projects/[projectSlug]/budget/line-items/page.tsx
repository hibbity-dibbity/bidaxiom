"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { BudgetLineItemTable } from "@/components/budget/budget-line-item-table";
import { ChevronLeft } from "lucide-react";

export default function BudgetLineItemsPage({
  params,
}: {
  params: { projectSlug: string };
}) {
  const { projectSlug } = params;

  // Resolve project by slug (cached from layout)
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id;

  if (!project) {
    return null; // Layout handles loading/error states
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${projectSlug}/budget`}>
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

      <BudgetLineItemTable projectId={project.id} />
    </div>
  );
}
