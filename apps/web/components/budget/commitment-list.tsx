"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, FileText, ChevronsUpDown } from "lucide-react";
import { CSI_DIVISIONS } from "@construction/shared";
import type { CommitmentType, CommitmentStatus } from "@construction/shared";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CommitmentListProps {
  projectId: string;
}

const statusVariants: Record<CommitmentStatus, "draft" | "pending" | "approved" | "active" | "cancelled"> = {
  draft: "draft",
  pending: "pending",
  approved: "approved",
  executed: "active",
  closed: "cancelled",
};

const typeLabels: Record<CommitmentType, string> = {
  subcontract: "Subcontract",
  purchase_order: "Purchase Order",
};

export function CommitmentList({ projectId }: CommitmentListProps) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedCommitmentId, setExpandedCommitmentId] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  const { data: commitments, isLoading } = trpc.commitment.list.useQuery({
    projectId,
  });

  const { data: lineItems } = trpc.commitment.getLineItems.useQuery(
    { commitmentId: expandedCommitmentId! },
    { enabled: !!expandedCommitmentId }
  );

  const toggleExpand = (commitmentId: string) => {
    setExpandedCommitmentId(
      expandedCommitmentId === commitmentId ? null : commitmentId
    );
  };

  const getDivisionName = (costCodeId: number) => {
    const division = CSI_DIVISIONS.find((d) => d.division === costCodeId);
    return division ? `Div ${costCodeId}: ${division.name}` : `Cost Code ${costCodeId}`;
  };

  const filteredCommitments = commitments?.filter((c) => {
    if (typeFilter !== "all" && c.type !== typeFilter) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    return true;
  });

  const columns = React.useMemo(() => [
    {
      id: "vendorName",
      accessorKey: "vendorName",
      header: "Vendor",
      enableSorting: true,
    },
    {
      id: "contractNumber",
      accessorKey: "contractNumber",
      header: "Contract #",
      enableSorting: false,
    },
    {
      id: "type",
      header: "Type",
      enableSorting: false,
    },
    {
      id: "status",
      accessorKey: "status",
      header: "Status",
      enableSorting: true,
    },
    {
      id: "totalAmount",
      accessorKey: "totalAmount",
      header: "Amount",
      enableSorting: true,
      sortingFn: "basic" as const,
    },
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: "Date",
      enableSorting: true,
    },
    {
      id: "expand",
      header: "",
      enableSorting: false,
    },
  ], []);

  const table = useReactTable({
    data: filteredCommitments ?? [],
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
      <div className="flex gap-4">
        <div className="flex-1">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="subcontract">Subcontract</SelectItem>
              <SelectItem value="purchase_order">Purchase Order</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="executed">Executed</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!filteredCommitments || filteredCommitments.length === 0 ? (
        typeFilter !== "all" || statusFilter !== "all" ? (
          <div className="text-center py-12 border rounded-lg border-dashed">
            <p className="text-muted-foreground">No commitments match the selected filters</p>
          </div>
        ) : (
          <div className="text-center py-12 border rounded-lg border-dashed">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-full bg-muted p-3">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">No commitments yet</h3>
                <p className="text-sm text-muted-foreground mt-1">Subcontracts and purchase orders will appear here</p>
              </div>
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
                        className={index === 0 ? "sticky left-0 z-30 bg-background min-w-[160px] border-r" : undefined}
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
              {table.getRowModel().rows.map((row) => {
                const commitment = row.original;
                const isExpanded = expandedCommitmentId === commitment.id;
                return (
                  <React.Fragment key={row.id}>
                    <TableRow className="cursor-pointer hover:bg-muted/50">
                      {/* Vendor — frozen first column */}
                      <TableCell className="sticky left-0 z-10 bg-background font-medium border-r">
                        {commitment.vendorName}
                      </TableCell>
                      {/* Contract # */}
                      <TableCell className="text-muted-foreground text-sm">
                        {commitment.contractNumber || "-"}
                      </TableCell>
                      {/* Type */}
                      <TableCell>
                        <StatusBadge variant="draft">
                          {typeLabels[commitment.type as CommitmentType]}
                        </StatusBadge>
                      </TableCell>
                      {/* Status */}
                      <TableCell>
                        <StatusBadge variant={statusVariants[commitment.status as CommitmentStatus]}>
                          {commitment.status}
                        </StatusBadge>
                      </TableCell>
                      {/* Amount */}
                      <TableCell className="text-right tabular-nums font-semibold">
                        <CurrencyDisplay amount={Number(commitment.totalAmount)} />
                      </TableCell>
                      {/* Date */}
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(commitment.createdAt).toLocaleDateString()}
                      </TableCell>
                      {/* Expand toggle */}
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(commitment.id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {isExpanded && lineItems && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 p-0">
                          <div className="p-4 space-y-2">
                            {lineItems.map((item) => (
                              <div
                                key={item.id}
                                className="flex justify-between items-start p-3 bg-background rounded-lg border"
                              >
                                <div>
                                  <p className="font-medium text-sm">
                                    {getDivisionName(item.costCodeId)}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {item.description}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <CurrencyDisplay amount={Number(item.amount)} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
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
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </div>
  );
}
