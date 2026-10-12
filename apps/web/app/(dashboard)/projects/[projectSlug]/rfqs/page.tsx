"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { RfqStatusBadge } from "@/components/bidding/rfq-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { FilterChips, type FilterChip } from "@/components/shared/filter-chips";
import { useDebounce } from "@/hooks/use-debounce";
import { ChevronRight, Download, Plus, Search, SearchX, FileQuestion } from "lucide-react";
import type { RfqStatus } from "@construction/shared";

const CSI_DIVISION_MAP: Record<number, string> = {
  0: "00 - Procurement",
  1: "01 - General Requirements",
  2: "02 - Existing Conditions",
  3: "03 - Concrete",
  4: "04 - Masonry",
  5: "05 - Metals",
  6: "06 - Wood, Plastics",
  7: "07 - Thermal & Moisture",
  8: "08 - Openings",
  9: "09 - Finishes",
  10: "10 - Specialties",
  21: "21 - Fire Suppression",
  22: "22 - Plumbing",
  23: "23 - HVAC",
  26: "26 - Electrical",
  27: "27 - Communications",
  28: "28 - Security",
  31: "31 - Earthwork",
  32: "32 - Exterior Improvements",
  33: "33 - Utilities",
};

export default function RfqsPage({
  params,
}: {
  params: { projectSlug: string };
}) {
  const { projectSlug } = params;
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<RfqStatus | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);

  // Resolve project by slug (cached from layout)
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id;

  const { data: rfqs, isLoading } = trpc.rfq.list.useQuery({ projectId: projectId! }, { enabled: !!projectId });

  const filteredRfqs = useMemo(() => {
    if (!rfqs) return [];
    let result = rfqs;
    if (statusFilter !== "all") {
      result = result.filter((rfq) => rfq.status === statusFilter);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (rfq) =>
          rfq.title?.toLowerCase().includes(q) ||
          rfq.rfqNumber?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [rfqs, statusFilter, debouncedSearch]);

  const activeChips: FilterChip[] = statusFilter !== "all"
    ? [{
        label: `Status: ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}`,
        onRemove: () => setStatusFilter("all" as RfqStatus | "all"),
      }]
    : [];

  const clearAllFilters = () => {
    setStatusFilter("all" as RfqStatus | "all");
    setSearchInput("");
  };

  const hasActiveFilters = statusFilter !== "all" || !!debouncedSearch;

  const exportCsv = () => {
    const today = new Date().toISOString().split("T")[0];
    const filename = `rfqs-${projectSlug}-${today}.csv`;

    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;

    const header = ["RFQ #", "Title", "Status", "Due Date"].map(escape).join(",");
    const csvRows = filteredRfqs.map((rfq) => [
      rfq.rfqNumber ?? "",
      rfq.title ?? "",
      rfq.status.charAt(0).toUpperCase() + rfq.status.slice(1),
      new Date(rfq.dueDate).toLocaleDateString(),
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!project) {
    return null; // Layout handles loading/error states
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requests for Quotation"
        description={project.name}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={filteredRfqs.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button asChild>
              <Link href={`/projects/${projectSlug}/rfqs/new`}>
                <Plus className="mr-2 h-4 w-4" />
                New RFQ
              </Link>
            </Button>
          </>
        }
      />

      <div className="space-y-2">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title or RFQ number..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        {/* Status filter */}
        <div className="flex gap-3">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as RfqStatus | "all")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="issued">Issued</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="awarded">Awarded</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Filter chips */}
        <FilterChips chips={activeChips} onClearAll={clearAllFilters} />
      </div>

      {filteredRfqs.length > 0 ? (
        <Card>
          <div className="relative w-full overflow-auto max-h-[70vh]">
            <Table>
              <TableHeader className="sticky top-0 z-20 bg-background">
                <TableRow>
                  <TableHead className="sticky left-0 z-30 bg-background border-r">RFQ #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trades</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Bids</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[48px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRfqs.map((rfq) => (
                  <TableRow
                    key={rfq.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/projects/${projectSlug}/rfqs/${rfq.id}`)}
                  >
                    <TableCell className="sticky left-0 z-10 bg-background border-r font-mono font-medium">
                      {rfq.rfqNumber}
                    </TableCell>
                    <TableCell className="font-medium">{rfq.title}</TableCell>
                    <TableCell>
                      <RfqStatusBadge status={rfq.status as RfqStatus} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(rfq.trades as number[]).slice(0, 3).map((trade) => (
                          <span
                            key={trade}
                            className="text-xs bg-muted px-2 py-1 rounded"
                          >
                            {CSI_DIVISION_MAP[trade] || `CSI ${trade}`}
                          </span>
                        ))}
                        {(rfq.trades as number[]).length > 3 && (
                          <span className="text-xs text-muted-foreground px-2 py-1">
                            +{(rfq.trades as number[]).length - 3} more
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(rfq.dueDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{rfq.bidCount || 0}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(rfq.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="w-[48px]">
                      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={hasActiveFilters ? SearchX : FileQuestion}
          heading={
            hasActiveFilters
              ? "No RFQs match your filters"
              : "No RFQs yet"
          }
          description={
            hasActiveFilters
              ? "Try adjusting your search or filter criteria."
              : "Get started by creating your first Request for Quotation."
          }
          action={
            !hasActiveFilters
              ? { label: "New RFQ", href: `/projects/${projectSlug}/rfqs/new` }
              : undefined
          }
        />
      )}
    </div>
  );
}
