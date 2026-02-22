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
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
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
import { ChevronsUpDown, ChevronUp, ChevronDown, Plus, FilePlus } from "lucide-react";
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
    data: changeOrders ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
  });

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
        <Button onClick={handleNavigateToNew}>
          <Plus className="h-4 w-4 mr-2" />
          New Change Order
        </Button>
      </div>

      {!changeOrders || changeOrders.length === 0 ? (
        statusFilter !== "all" || typeFilter !== "all" ? (
          <div className="text-center py-12 border rounded-lg border-dashed">
            <p className="text-muted-foreground">No change orders match the selected filters</p>
          </div>
        ) : (
          <div className="text-center py-12 border rounded-lg border-dashed">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-full bg-muted p-3">
                <FilePlus className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">No change orders yet</h3>
                <p className="text-sm text-muted-foreground mt-1">Track scope changes and amendments to the original contract</p>
              </div>
              <Button onClick={handleNavigateToNew}>
                <Plus className="h-4 w-4 mr-2" />
                New Change Order
              </Button>
            </div>
          </div>
        )
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
