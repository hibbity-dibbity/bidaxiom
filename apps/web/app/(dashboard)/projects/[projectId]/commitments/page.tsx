"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CommitmentList } from "@/components/budget/commitment-list";
import { Plus, ChevronLeft } from "lucide-react";

export default function CommitmentsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${projectId}/budget`}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Budget
          </Link>
        </Button>
        <Button asChild>
          <Link href={`/projects/${projectId}/commitments/new`}>
            <Plus className="h-4 w-4 mr-2" />
            New Commitment
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold mb-2">Commitments</h1>
        <p className="text-muted-foreground">
          Manage subcontracts and purchase orders
        </p>
      </div>

      <CommitmentList projectId={projectId} />
    </div>
  );
}
