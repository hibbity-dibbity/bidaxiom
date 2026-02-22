"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { ChevronsUpDown, ChevronUp, ChevronDown, Plus, AlertTriangle, Receipt } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PaymentAppListProps {
  projectId: string;        // For tRPC queries
  projectSlug: string;      // For navigation
}


type PaymentAppStatus = "draft" | "submitted" | "under_review" | "approved" | "rejected" | "paid";

const statusVariantMap: Record<PaymentAppStatus, "draft" | "pending" | "approved" | "rejected" | "active"> = {
  draft: "draft",
  submitted: "pending",
  under_review: "pending",
  approved: "approved",
  rejected: "rejected",
  paid: "active",
};

export function PaymentAppList({ projectId, projectSlug }: PaymentAppListProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const { data: paymentApps, isLoading } = trpc.paymentApp.list.useQuery({
    projectId,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const { data: summary } = trpc.paymentApp.getSummary.useQuery({ projectId });
  const { data: retainage } = trpc.paymentApp.getRetainage.useQuery({ projectId });
  const { data: sovItems } = trpc.sov.list.useQuery({ projectId });

  const hasSovItems = (sovItems?.items.length || 0) > 0;

  const columns = React.useMemo<ColumnDef<NonNullable<typeof paymentApps>[number]>[]>(() => [
    {
      accessorKey: "applicationNumber",
      header: "Application #",
      enableSorting: true,
    },
    {
      id: "period",
      header: "Period",
      enableSorting: false,
    },
    {
      accessorKey: "currentPaymentDue",
      header: "Current Payment Due",
      enableSorting: true,
      sortingFn: "basic" as const,
    },
    {
      accessorKey: "status",
      header: "Status",
      enableSorting: true,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
    },
  ], []);

  const table = useReactTable({
    data: paymentApps ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
  });

  const visibleTotal = React.useMemo(
    () => table.getRowModel().rows.reduce((sum, row) => sum + Number(row.original.currentPaymentDue), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table.getRowModel().rows]
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[120px] bg-muted animate-pulse rounded" />
          ))}
        </div>
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary
                ? <CurrencyDisplay amount={Number(summary.amounts.totalApproved)} />
                : "$0.00"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary
                ? <CurrencyDisplay amount={Number(summary.amounts.totalPending)} />
                : "$0.00"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary
                ? <CurrencyDisplay amount={Number(summary.amounts.totalPaid)} />
                : "$0.00"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Retainage Held</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {retainage?.totals?.totalHeld
                ? <CurrencyDisplay amount={Number(retainage.totals.totalHeld)} />
                : "$0.00"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasSovItems ? (
          <Button asChild>
            <Link href={`/projects/${projectSlug}/payment-apps/new`}>
              <Plus className="mr-2 h-4 w-4" />
              New Payment Application
            </Link>
          </Button>
        ) : (
          <div className="flex flex-col items-end gap-2">
            <Button disabled>
              <Plus className="mr-2 h-4 w-4" />
              New Payment Application
            </Button>
            <p className="text-sm text-muted-foreground">
              Set up SOV first
            </p>
          </div>
        )}
      </div>

      {!hasSovItems && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You must set up a Schedule of Values before creating payment applications.{" "}
            <Link
              href={`/projects/${projectSlug}/sov`}
              className="font-medium underline underline-offset-4"
            >
              Set up SOV
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Payment Apps Table */}
      {paymentApps && paymentApps.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Payment Applications</CardTitle>
            <CardDescription>
              {paymentApps.length} payment application{paymentApps.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative w-full overflow-auto max-h-[600px]">
              <Table>
                <TableHeader className="sticky top-0 z-20 bg-background">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header, idx) => {
                        const canSort = header.column.getCanSort();
                        const isSorted = header.column.getIsSorted();
                        const isFirst = idx === 0;

                        return (
                          <TableHead
                            key={header.id}
                            className={
                              isFirst
                                ? "sticky top-0 left-0 z-30 bg-background min-w-[120px] border-r"
                                : "sticky top-0 z-20 bg-background"
                            }
                          >
                            {header.isPlaceholder ? null : (
                              <div
                                className={
                                  canSort
                                    ? "flex items-center gap-1.5 cursor-pointer select-none hover:text-foreground"
                                    : undefined
                                }
                                onClick={
                                  canSort
                                    ? header.column.getToggleSortingHandler()
                                    : undefined
                                }
                              >
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                {canSort && (
                                  <span className="text-muted-foreground">
                                    {isSorted === "asc" ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : isSorted === "desc" ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronsUpDown className="h-4 w-4" />
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
                    <TableRow key={row.id}>
                      <TableCell className="font-mono sticky left-0 z-10 bg-background border-r">
                        {row.original.applicationNumber}
                      </TableCell>
                      <TableCell>
                        {new Date(row.original.periodStart).toLocaleDateString()} &mdash;{" "}
                        {new Date(row.original.periodEnd).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <CurrencyDisplay amount={Number(row.original.currentPaymentDue)} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={statusVariantMap[row.original.status as PaymentAppStatus] || "draft"}>
                          {row.original.status.replace("_", " ")}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/projects/${projectSlug}/payment-apps/${row.original.id}`}>
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="sticky bottom-0 z-20 bg-muted/50">
                  <TableRow>
                    <TableCell className="sticky left-0 z-30 bg-muted/50 font-bold border-r">Totals</TableCell>
                    <TableCell />
                    <TableCell className="text-right tabular-nums font-bold">
                      <CurrencyDisplay amount={visibleTotal} />
                    </TableCell>
                    <TableCell />
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-12 border rounded-lg border-dashed">
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-full bg-muted p-3">
              <Receipt className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">No payment applications yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {hasSovItems
                  ? "Create your first payment application to begin billing"
                  : "Set up a Schedule of Values before creating payment applications"}
              </p>
            </div>
            {hasSovItems && (
              <Button asChild>
                <Link href={`/projects/${projectSlug}/payment-apps/new`}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Payment Application
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
