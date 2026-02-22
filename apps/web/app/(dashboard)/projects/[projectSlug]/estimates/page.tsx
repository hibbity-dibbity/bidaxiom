"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { EmptyState } from "@/components/shared/empty-state";
import { useDebounce } from "@/hooks/use-debounce";
import { FileText, Plus, Search, SearchX } from "lucide-react";
import { formatCurrency } from "@construction/shared";
import { format } from "date-fns";

export default function EstimatesPage({
  params,
}: {
  params: { projectSlug: string };
}) {
  const { projectSlug } = params;
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);

  // Resolve project by slug (cached from layout)
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id;

  const { data: estimates, isLoading } = trpc.estimates.list.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );

  const displayedEstimates = useMemo(() => {
    if (!estimates) return [];
    if (!debouncedSearch.trim()) return estimates;
    const q = debouncedSearch.toLowerCase();
    return estimates.filter((e) => e.name.toLowerCase().includes(q));
  }, [estimates, debouncedSearch]);

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

      {/* Search bar — only show when there are estimates to search */}
      {estimates && estimates.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search estimates by name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {displayedEstimates.length > 0 ? (
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
              {displayedEstimates.map((estimate) => (
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
      ) : (
        <EmptyState
          icon={debouncedSearch ? SearchX : FileText}
          heading={debouncedSearch ? "No estimates match your search" : "No estimates yet"}
          description={
            debouncedSearch
              ? "Try a different search term."
              : "Create your first estimate to begin the pre-bid cost estimation process."
          }
          action={
            !debouncedSearch
              ? { label: "New Estimate", href: `/projects/${projectSlug}/estimates/new` }
              : undefined
          }
        />
      )}
    </div>
  );
}
