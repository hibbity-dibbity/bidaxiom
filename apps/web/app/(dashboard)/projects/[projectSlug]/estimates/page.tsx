"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { PageHeader } from "@/components/shared/page-header";
import { DocumentActions } from "@/components/shared/document-actions";
import { IconAction } from "@/components/shared/icon-action";
import { Star } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { Download, FileText, Plus, Search, SearchX } from "lucide-react";
import { formatCurrency } from "@construction/shared";
import { format } from "date-fns";

export default function EstimatesPage({
  params,
}: {
  params: { projectSlug: string };
}) {
  const { projectSlug } = params;
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);

  // Resolve project by slug (cached from layout)
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id;

  const { data: estimates, isLoading } = trpc.estimates.list.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );

  const utils = trpc.useUtils();
  const createNext = trpc.proposal.createNext.useMutation({
    onSuccess: (r) => {
      utils.estimates.list.invalidate();
      router.push(`/projects/${projectSlug}/estimates/${r.slug}`);
    },
    onError: (e) => toast.error("Could not create the proposal", { description: e.message }),
  });
  const setActive = trpc.proposal.setActive.useMutation({
    onSuccess: () => {
      toast.success("Active proposal changed");
      utils.estimates.list.invalidate();
    },
    onError: (e) => toast.error("Could not change the active proposal", { description: e.message }),
  });
  const hasAccepted = !!estimates?.some((e) => e.status === "accepted" || e.status === "under_contract");
  const startNew = () => {
    if (projectId) createNext.mutate({ projectId });
  };

  const displayedEstimates = useMemo(() => {
    if (!estimates) return [];
    if (!debouncedSearch.trim()) return estimates;
    const q = debouncedSearch.toLowerCase();
    return estimates.filter((e) => e.name.toLowerCase().includes(q));
  }, [estimates, debouncedSearch]);

  const exportCsv = () => {
    const today = new Date().toISOString().split("T")[0];
    const filename = `estimates-${projectSlug}-${today}.csv`;

    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;

    const header = ["Name", "Status", "Proposal Total", "Created Date"].map(escape).join(",");
    const csvRows = displayedEstimates.map((e) => [
      e.name,
      e.status.charAt(0).toUpperCase() + e.status.slice(1),
      Number(e.totalCost || "0").toFixed(2),
      format(new Date(e.createdAt), "MMM d, yyyy"),
    ].map(escape).join(","));

    const csv = [header, ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proposals"
        description="Pricing proposals for this project"
        actions={
          <>
            <Button
              variant="link"
              size="sm"
              onClick={exportCsv}
              disabled={displayedEstimates.length === 0}
             aria-label="Export CSV">
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="max-sm:sr-only">Export CSV</span>
            </Button>
            {hasAccepted ? (
              <span className="text-sm text-muted-foreground">Accepted. Changes now go through <Link href={`/projects/${projectSlug}/change-orders`} className="underline underline-offset-2">change orders</Link>.</span>
            ) : (
            <Button onClick={startNew} disabled={!projectId || createNext.isPending}>
              <Plus className="mr-2 h-4 w-4" />
              {createNext.isPending
                ? "Creating..."
                : estimates && estimates.length > 0
                ? "New Revision"
                : "New Proposal"}
            </Button>
            )}
          </>
        }
      />

      {/* Search bar — only show when there are estimates to search */}
      {estimates && estimates.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search proposals by name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {displayedEstimates.length > 0 ? (
        <Card>
          <div className="relative w-full overflow-auto max-h-[70vh]">
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-background">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Proposal Total</TableHead>
                <TableHead>Created Date</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedEstimates.map((estimate) => (
                <TableRow
                  key={estimate.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/projects/${projectSlug}/estimates/${estimate.slug}`)
                  }
                >
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
                      {estimate.status === "submitted" ? "Sent" : estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatCurrency(parseFloat(estimate.totalCost || "0"))}
                  </TableCell>
                  <TableCell>{format(new Date(estimate.createdAt), "MMM d, yyyy")}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {estimate.isActive ? (
                      <StatusBadge variant="approved">Active</StatusBadge>
                    ) : (
                      <IconAction icon={Star} label="Make this the active proposal" busy={setActive.isPending} onClick={() => setActive.mutate({ estimateId: estimate.id })} />
                    )}
                  </TableCell>
                  <TableCell>
                    <DocumentActions
                      kind="proposal"
                      id={estimate.id}
                      emailHighlight={estimate.status === "draft"}
                      previewHref={`/projects/${projectSlug}/estimates/${estimate.slug}/preview`}
                      onSent={() => utils.estimates.list.invalidate()}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={debouncedSearch ? SearchX : FileText}
          heading={debouncedSearch ? "No proposals match your search" : "No proposals yet"}
          description={
            debouncedSearch
              ? "Try a different search term."
              : "Create your first proposal to begin the pre-bid cost estimation process."
          }
          action={
            !debouncedSearch
              ? { label: "New Proposal", onClick: startNew }
              : undefined
          }
        />
      )}
    </div>
  );
}
