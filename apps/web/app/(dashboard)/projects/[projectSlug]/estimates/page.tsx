"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { FileText, Plus } from "lucide-react";
import { formatCurrency } from "@construction/shared";
import { format } from "date-fns";

export default function EstimatesPage({
  params,
}: {
  params: { projectSlug: string };
}) {
  const { projectSlug } = params;

  // Resolve project by slug (cached from layout)
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id;

  const { data: estimates, isLoading } = trpc.estimates.list.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Empty state
  if (!estimates || estimates.length === 0) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Estimates</h1>
          <Button asChild>
            <Link href={`/projects/${projectSlug}/estimates/new`}>
              <Plus className="h-4 w-4 mr-2" />
              New Estimate
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Estimates Yet</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Create your first estimate to begin the pre-bid cost estimation process.
            </p>
            <Button asChild>
              <Link href={`/projects/${projectSlug}/estimates/new`}>
                <Plus className="h-4 w-4 mr-2" />
                New Estimate
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Estimates</h1>
        <Button asChild>
          <Link href={`/projects/${projectSlug}/estimates/new`}>
            <Plus className="h-4 w-4 mr-2" />
            New Estimate
          </Link>
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total Cost</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {estimates.map((estimate) => (
              <TableRow key={estimate.id}>
                <TableCell className="font-medium">{estimate.name}</TableCell>
                <TableCell>
                  <StatusBadge
                    variant={
                      estimate.status === "draft"
                        ? "draft"
                        : estimate.status === "submitted"
                        ? "pending"
                        : estimate.status === "approved"
                        ? "approved"
                        : "rejected"
                    }
                  >
                    {estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(parseFloat(estimate.totalCost || "0"))}
                </TableCell>
                <TableCell>{format(new Date(estimate.createdAt), "MMM d, yyyy")}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/projects/${projectSlug}/estimates/${estimate.slug}`}>
                      View
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
