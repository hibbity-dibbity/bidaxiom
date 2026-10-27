"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";

import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronRight, Plus, Upload, RefreshCw, ChevronsUpDown, ChevronUp, ChevronDown, Download, HardHat, SearchX } from "lucide-react";
import { SIMPLE_TRADES } from "@construction/shared";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader, InPageHeader } from "@/components/shared/page-header";
import { ListToolbar, SearchField, MultiFilterSelect } from "@/components/shared/list-toolbar";
import { FilterChips, type FilterChip } from "@/components/shared/filter-chips";
import type { SubcontractorStatus, VendorKind } from "@construction/shared";

// Stable row model factories — must be module-level to avoid
// TanStack Table's useLayoutEffect triggering an infinite re-render loop
// when factory references change on every render.
const stableCoreRowModel = getCoreRowModel();
const stableSortedRowModel = getSortedRowModel();
const stablePaginationRowModel = getPaginationRowModel();
const PAGE_SIZE = 50;

export default function SubcontractorsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tradeFilter, setTradeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<SubcontractorStatus[]>([]);
  const [kindFilter, setKindFilter] = useState<VendorKind[]>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: PAGE_SIZE });

  const { data, isLoading } = trpc.subcontractor.list.useQuery({
    search: search || undefined,
    trades: tradeFilter.length ? tradeFilter : undefined,
    statuses: statusFilter.length ? statusFilter : undefined,
    kinds: kindFilter.length ? kindFilter : undefined,
  });

  const subcontractors = React.useMemo(() => data ?? [], [data]);

  const subStatusToVariant = (status: string) => {
    switch (status) {
      case "active": return "active" as const;
      case "inactive": return "cancelled" as const;
      case "blacklisted": return "rejected" as const;
      default: return "draft" as const;
    }
  };

  const kindLabel = (kind: string) => (kind === "supplier" ? "Supplier" : "Subcontractor");

  const getStatusLabel = (status: string): string => {
    const statusLabels: Record<string, string> = {
      active: "Active",
      inactive: "Inactive",
      blacklisted: "Blacklisted",
    };
    return statusLabels[status] || status;
  };

  const columns = React.useMemo(() => [
    {
      accessorKey: "companyName",
      header: "Company Name",
      enableSorting: true,
    },
    {
      accessorKey: "kind",
      header: "Type",
      enableSorting: true,
    },
    {
      accessorKey: "contactName",
      header: "Contact",
      enableSorting: true,
    },
    {
      id: "email",
      accessorKey: "contactEmail",
      header: "Email",
      enableSorting: true,
    },
    {
      id: "phone",
      accessorKey: "contactPhone",
      header: "Phone",
      enableSorting: false,
    },
    {
      id: "trades",
      header: "Trade / Category",
      enableSorting: false,
    },
    {
      accessorKey: "status",
      header: "Status",
      enableSorting: true,
    },
  ], []);

  const table = useReactTable({
    data: subcontractors,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getPaginationRowModel: stablePaginationRowModel,
    getCoreRowModel: stableCoreRowModel,
    getSortedRowModel: stableSortedRowModel,
    enableSortingRemoval: false,
  });

  const exportCsv = () => {
    // Every row that matches the filters, not just the page on screen.
    const rows = table.getPrePaginationRowModel().rows;
    const today = new Date().toISOString().split("T")[0];
    const filename = `subs-and-vendors-${today}.csv`;

    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;

    const formatTrades = (sub: typeof subcontractors[0]) => {
      const tradeArr = (sub as any).trade as string[] ?? [];
      if (tradeArr.length === 0) return "";
      return tradeArr
        .map((t: string) => t === "Other" && (sub as any).tradeOther ? (sub as any).tradeOther : t)
        .join(" | ");
    };

    const header = ["Company", "Type", "Contact", "Email", "Trade / Category", "Status"].map(escape).join(",");
    const csvRows = rows.map((row) => {
      const s = row.original;
      return [
        s.companyName ?? "",
        kindLabel(s.kind),
        s.contactName ?? "",
        s.contactEmail ?? "",
        s.kind === "supplier" ? s.category ?? "" : formatTrades(s),
        getStatusLabel(s.status),
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

  // Derive filter chips from active secondary filter values
  const activeChips: FilterChip[] = [
    ...(kindFilter.length
      ? [{ label: `Type: ${kindFilter.map(kindLabel).join(", ")}`, onRemove: () => setKindFilter([]) }]
      : []),
    ...(statusFilter.length
      ? [{ label: `Status: ${statusFilter.map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join(", ")}`, onRemove: () => setStatusFilter([]) }]
      : []),
    ...(tradeFilter.length
      ? [{ label: `Trade: ${tradeFilter.join(", ")}`, onRemove: () => setTradeFilter([]) }]
      : []),
  ];

  const utilsQ = trpc.useUtils();
  const qbo = trpc.subcontractor.qboStatus.useQuery(undefined, { retry: false });
  const [confirmPush, setConfirmPush] = useState(false);
  const pushQbo = trpc.subcontractor.pushToQuickbooks.useMutation({
    onSuccess: (r) => {
      setConfirmPush(false);
      const parts = [`${r.created} created`, `${r.linked} matched to vendors already in QuickBooks`, `${r.updated} updated`];
      if (r.failed.length) toast.error(`${r.failed.length} vendors could not be sent`, { description: r.failed.slice(0, 3).map((f) => `${f.name}: ${f.error}`).join(" · ") });
      else toast.success("Sent to QuickBooks", { description: parts.join(", ") + "." });
      qbo.refetch();
    },
    onError: (e) => {
      setConfirmPush(false);
      toast.error("Could not send to QuickBooks", { description: e.message });
    },
  });

  const clearAllFilters = () => {
    setSearch("");
    setStatusFilter([]);
    setKindFilter([]);
    setTradeFilter([]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subs & Vendors"
        description="Subcontractors and suppliers you work with, their terms and compliance"
        actions={
          <>
            {qbo.data?.connected && (
              <Button variant="outline" onClick={() => setConfirmPush(true)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Send to QuickBooks
              </Button>
            )}
            <Button variant="link" onClick={() => router.push("/subcontractors/import")}>
              <Upload className="h-4 w-4 sm:mr-2" />
              <span className="max-sm:sr-only">Import</span>
            </Button>
            <Button onClick={() => router.push("/subcontractors/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Sub or Vendor
            </Button>
          </>
        }
      />

      <ListToolbar activeCount={(search.trim() ? 1 : 0) + (tradeFilter.length ? 1 : 0) + (kindFilter.length ? 1 : 0) + (statusFilter.length ? 1 : 0)} summary={data ? `${subcontractors.length} shown` : undefined}>
        <SearchField value={search} onChange={setSearch} placeholder="Search company, contact or email" />
        <MultiFilterSelect
          label="Trade"
          allLabel="All trades"
          options={SIMPLE_TRADES.map((t) => ({ value: t, label: t }))}
          selected={tradeFilter}
          onChange={setTradeFilter}
        />
        <MultiFilterSelect
          label="Type"
          allLabel="All types"
          options={[{ value: "subcontractor", label: "Subcontractors" }, { value: "supplier", label: "Suppliers" }]}
          selected={kindFilter}
          onChange={(v) => setKindFilter(v as VendorKind[])}
        />
        <MultiFilterSelect
          label="Status"
          allLabel="All statuses"
          options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "blacklisted", label: "Blacklisted" }]}
          selected={statusFilter}
          onChange={(v) => setStatusFilter(v as SubcontractorStatus[])}
        />
      </ListToolbar>
      <FilterChips chips={activeChips} onClearAll={clearAllFilters} />

      {/* Subcontractors Table */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : subcontractors.length > 0 ? (
        <div className="space-y-4">
        <InPageHeader>
          <Button variant="link" onClick={exportCsv} disabled={table.getRowModel().rows.length === 0} aria-label="Export CSV">
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="max-sm:sr-only">Export CSV</span>
          </Button>
        </InPageHeader>
        <Card>
          <div className="relative w-full overflow-auto max-h-[70vh]">
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
                  <TableHead className="w-[48px]" />
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/subcontractors/${row.original.slug}`)}
                  >
                    <TableCell className="font-medium sticky left-0 z-10 bg-background border-r">
                      {row.original.companyName}
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant="draft">{kindLabel(row.original.kind)}</StatusBadge>
                    </TableCell>
                    <TableCell>{row.original.contactName || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.original.contactEmail || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.original.contactPhone || "-"}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        if (row.original.kind === "supplier") {
                          return row.original.category
                            ? <StatusBadge variant="draft">{row.original.category}</StatusBadge>
                            : <span className="text-muted-foreground">—</span>;
                        }
                        const tradeArr = (row.original as any).trade as string[] ?? [];
                        if (tradeArr.length === 0) {
                          return <span className="text-muted-foreground">—</span>;
                        }
                        const displayName = (t: string) =>
                          t === "Other" && (row.original as any).tradeOther
                            ? (row.original as any).tradeOther
                            : t;
                        const overflow = tradeArr.length - 1;
                        return (
                          <div className="flex items-center gap-1">
                            <StatusBadge variant="draft">{displayName(tradeArr[0])}</StatusBadge>
                            {overflow > 0 && (
                              <span className="text-xs text-muted-foreground">+{overflow}</span>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant={subStatusToVariant(row.original.status)}>
                        {getStatusLabel(row.original.status)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="w-[48px]">
                      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t px-4 py-3">
            <div className="text-sm text-muted-foreground">
              Showing {pagination.pageIndex * PAGE_SIZE + 1}-{Math.min((pagination.pageIndex + 1) * PAGE_SIZE, subcontractors.length)} of {subcontractors.length} subs &amp; vendors
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
              <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
            </div>
          </div>
        </Card>
        </div>
      ) : (
        <EmptyState
          icon={search || tradeFilter.length > 0 || statusFilter.length > 0 || kindFilter.length > 0 ? SearchX : HardHat}
          heading={
            search || tradeFilter.length > 0 || statusFilter.length > 0 || kindFilter.length > 0
              ? "No subs or vendors match your filters"
              : "No subs or vendors yet"
          }
          description={
            search || tradeFilter.length > 0 || statusFilter.length > 0 || kindFilter.length > 0
              ? "Try adjusting your search or filter criteria."
              : "Add your first subcontractor or supplier to start building your directory."
          }
          action={
            !(search || tradeFilter.length > 0 || statusFilter.length > 0 || kindFilter.length > 0)
              ? { label: "Add Sub or Vendor", href: "/subcontractors/new" }
              : undefined
          }
        />
      )}

      <AlertDialog open={confirmPush} onOpenChange={setConfirmPush}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send your vendor list to QuickBooks?</AlertDialogTitle>
            <AlertDialogDescription>
              {qbo.data?.preview
                ? `${qbo.data.preview.toCreate} active vendors are not in QuickBooks yet (each is created, or linked if a vendor with the same name already exists there). ${qbo.data.preview.toUpdate} already linked vendors changed here since they were last sent and will be updated there. `
                : ""}
              This only goes one way: nothing is read back from QuickBooks, and inactive or blacklisted vendors are not created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pushQbo.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pushQbo.isPending}
              onClick={(e) => {
                e.preventDefault();
                pushQbo.mutate();
              }}
            >
              {pushQbo.isPending ? "Sending…" : "Send to QuickBooks"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
