"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterChips, type FilterChip } from "@/components/shared/filter-chips";
import { useDebounce } from "@/hooks/use-debounce";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronsUpDown, ChevronUp, ChevronDown, Plus, FilePlus, Search, SearchX, Download } from "lucide-react";
import type { ChangeOrderStatus, ChangeOrderType } from "@construction/shared";

interface ChangeOrderListProps {
  projectId: string;        // For tRPC queries
  projectSlug: string;      // For navigation
}

const statusVariantMap: Record<ChangeOrderStatus, "draft" | "pending" | "approved" | "rejected" | "cancelled" | "warning"> = {
  draft: "draft",
  pco_submitted: "pending",
  pending_approval: "warning",
  approved: "approved",
  rejected: "rejected",
  void: "cancelled",
};

const typeColors: Record<ChangeOrderType, string> = {
  owner: "bg-blue-500",
  internal: "bg-purple-500",
  subcontractor: "bg-orange-500",
};

const typeLabels: Record<ChangeOrderType, string> = {
  owner: "Owner",
  internal: "Internal",
  subcontractor: "Subcontractor",
};

export function ChangeOrderList({ projectId, projectSlug }: ChangeOrderListProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);

  const { data: changeOrders, isLoading } = trpc.changeOrder.list.useQuery({
    projectId,
    status: statusFilter === "all" ? undefined : (statusFilter as ChangeOrderStatus),
    type: typeFilter === "all" ? undefined : (typeFilter as ChangeOrderType),
  });

  const handleNavigateToDetail = (changeOrderId: string) => {
    router.push(`/projects/${projectSlug}/change-orders/${changeOrderId}`);
  };

  const handleNavigateToNew = () => {
    router.push(`/projects/${projectSlug}/change-orders/new`);
  };

  const getChangeOrderNumber = (co: any) => {
    if (co.coNumber) return co.coNumber;
    if (co.pcoNumber) return co.pcoNumber;
    return "Draft";
  };

  const displayedChangeOrders = React.useMemo(() => {
    if (!changeOrders) return [];
    if (!debouncedSearch.trim()) return changeOrders;
    const q = debouncedSearch.toLowerCase();
    return changeOrders.filter(
      (co) =>
        co.title?.toLowerCase().includes(q) ||
        getChangeOrderNumber(co).toLowerCase().includes(q)
    );
  }, [changeOrders, debouncedSearch]);

  const activeChips: FilterChip[] = [
    ...(statusFilter !== "all"
      ? [{
          label: `Status: ${
            { draft: "Draft", pco_submitted: "PCO Submitted", pending_approval: "Pending Approval",
              approved: "Approved", rejected: "Rejected", void: "Void" }[statusFilter] ?? statusFilter
          }`,
          onRemove: () => setStatusFilter("all"),
        }]
      : []),
    ...(typeFilter !== "all"
      ? [{
          label: `Type: ${{ owner: "Owner", internal: "Internal", subcontractor: "Subcontractor" }[typeFilter] ?? typeFilter}`,
          onRemove: () => setTypeFilter("all"),
        }]
      : []),
  ];

  const clearAllFilters = () => {
    setStatusFilter("all");
    setTypeFilter("all");
    setSearchInput("");
  };

  const hasActiveFilters = statusFilter !== "all" || typeFilter !== "all" || !!debouncedSearch;

  const columns = React.useMemo(() => [
    {
      id: "coNumber",
      accessorFn: (row: any) => getChangeOrderNumber(row),
      header: "CO #",
      enableSorting: true,
    },
    {
      accessorKey: "title",
      header: "Title",
      enableSorting: true,
    },
    {
      id: "type",
      header: "Type",
      enableSorting: false,
    },
    {
      accessorKey: "status",
      header: "Status",
      enableSorting: true,
    },
    {
      accessorKey: "totalAmount",
      header: "Amount",
      enableSorting: true,
      sortingFn: "basic" as const,
    },
    {
      accessorKey: "createdAt",
      header: "Date",
      enableSorting: true,
    },
  ], []);

  const table = useReactTable({
    data: displayedChangeOrders,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
  });

  const exportCsv = () => {
    const rows = table.getRowModel().rows;
    const today = new Date().toISOString().split("T")[0];
    const filename = `change-orders-${projectSlug}-${today}.csv`;

    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;

    const header = ["CO #", "Title", "Type", "Status", "Amount", "Date"].map(escape).join(",");
    const csvRows = rows.map((row) => {
      const co = row.original;
      return [
        getChangeOrderNumber(co),
        co.title ?? "",
        typeLabels[co.type as ChangeOrderType] ?? co.type,
        co.status.replace(/_/g, " "),
        Number(co.totalAmount).toFixed(2),
        new Date(co.createdAt).toLocaleDateString(),
      ].map(escape).join(",");
    });

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
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title or CO number..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        {/* Filter selects + New button row */}
        <div className="flex gap-4 justify-between items-center">
          <div className="flex gap-4 flex-1">
            <div className="flex-1">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pco_submitted">PCO Submitted</SelectItem>
                  <SelectItem value="pending_approval">Pending Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="subcontractor">Subcontractor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={exportCsv}
              disabled={table.getRowModel().rows.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={handleNavigateToNew}>
              <Plus className="h-4 w-4 mr-2" />
              New Change Order
            </Button>
          </div>
        </div>
        {/* Filter chips */}
        <FilterChips chips={activeChips} onClearAll={clearAllFilters} />
      </div>

      {displayedChangeOrders.length === 0 ? (
        <EmptyState
          icon={hasActiveFilters ? SearchX : FilePlus}
          heading={
            hasActiveFilters
              ? "No change orders match your filters"
              : "No change orders yet"
          }
          description={
            hasActiveFilters
              ? "Try adjusting your search or filter criteria."
              : "Track scope changes and amendments to the original contract."
          }
          action={
            !hasActiveFilters
              ? { label: "New Change Order", onClick: handleNavigateToNew }
              : undefined
          }
        />
      ) : (
        <div className="border rounded-md relative w-full overflow-auto max-h-[70vh]">
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-background">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header, index) => {
                    const canSort = header.column.getCanSort();
                    const isSorted = header.column.getIsSorted();
                    return (
                      <TableHead
                        key={header.id}
                        className={index === 0 ? "sticky left-0 z-30 bg-background min-w-[80px] border-r" : undefined}
                      >
                        {header.isPlaceholder ? null : (
                          <div
                            className={canSort ? "flex items-center gap-1.5 cursor-pointer select-none hover:text-foreground" : undefined}
                            onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {canSort && (
                              <span className="text-muted-foreground">
                                {isSorted === "asc" ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : isSorted === "desc" ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                                )}
                              </span>
                            )}
                          </div>
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleNavigateToDetail(row.original.id)}
                >
                  {/* CO # — frozen first column */}
                  <TableCell className="sticky left-0 z-10 bg-background font-mono border-r">
                    {getChangeOrderNumber(row.original)}
                  </TableCell>
                  {/* Title */}
                  <TableCell className="max-w-[300px]">
                    <span className="text-sm font-medium line-clamp-1">{row.original.title}</span>
                  </TableCell>
                  {/* Type */}
                  <TableCell>
                    <Badge className={typeColors[row.original.type as ChangeOrderType]}>
                      {typeLabels[row.original.type as ChangeOrderType]}
                    </Badge>
                  </TableCell>
                  {/* Status */}
                  <TableCell>
                    <StatusBadge variant={statusVariantMap[row.original.status as ChangeOrderStatus]}>
                      {row.original.status.replace(/_/g, " ")}
                    </StatusBadge>
                  </TableCell>
                  {/* Amount */}
                  <TableCell className="text-right tabular-nums font-semibold">
                    <CurrencyDisplay amount={Number(row.original.totalAmount)} />
                  </TableCell>
                  {/* Date */}
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(row.original.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="sticky bottom-0 z-20 bg-muted/50">
              <TableRow>
                <TableCell className="sticky left-0 z-30 bg-muted/50 font-bold border-r">Totals</TableCell>
                <TableCell colSpan={3} />
                <TableCell className="text-right tabular-nums font-bold">
                  <CurrencyDisplay
                    amount={table.getRowModel().rows.reduce((sum, row) => sum + Number(row.original.totalAmount), 0)}
                  />
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </div>
  );
}
