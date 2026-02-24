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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ChevronsUpDown, ChevronUp, ChevronDown, Download, HardHat, SearchX } from "lucide-react";
import { SIMPLE_TRADES } from "@construction/shared";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterChips, type FilterChip } from "@/components/shared/filter-chips";
import type { SubcontractorStatus } from "@construction/shared";

export default function SubcontractorsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tradeFilter, setTradeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<SubcontractorStatus | "all">("all");
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const { data, isLoading } = trpc.subcontractor.list.useQuery({
    search: search || undefined,
    trade: tradeFilter ?? undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const subcontractors = data || [];

  const subStatusToVariant = (status: string) => {
    switch (status) {
      case "active": return "active" as const;
      case "inactive": return "cancelled" as const;
      case "blacklisted": return "rejected" as const;
      default: return "draft" as const;
    }
  };

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
      header: "Trades",
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
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
  });

  const exportCsv = () => {
    const rows = table.getRowModel().rows;
    const today = new Date().toISOString().split("T")[0];
    const filename = `subcontractors-${today}.csv`;

    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;

    const formatTrades = (sub: typeof subcontractors[0]) => {
      const tradeArr = (sub as any).trade as string[] ?? [];
      if (tradeArr.length === 0) return "";
      return tradeArr
        .map((t: string) => t === "Other" && (sub as any).tradeOther ? (sub as any).tradeOther : t)
        .join(" | ");
    };

    const header = ["Company", "Contact", "Email", "Trade", "Status"].map(escape).join(",");
    const csvRows = rows.map((row) => {
      const s = row.original;
      return [
        s.companyName ?? "",
        s.contactName ?? "",
        s.contactEmail ?? "",
        formatTrades(s),
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
    ...(statusFilter !== "all"
      ? [{
          label: `Status: ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}`,
          onRemove: () => setStatusFilter("all"),
        }]
      : []),
    ...(tradeFilter !== null
      ? [{
          label: `Trade: ${tradeFilter}`,
          onRemove: () => setTradeFilter(null),
        }]
      : []),
  ];

  const clearAllFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTradeFilter(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subcontractor Directory</h1>
          <p className="text-muted-foreground">
            Manage your subcontractor relationships and bid history
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={table.getRowModel().rows.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={() => router.push("/subcontractors/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Subcontractor
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Input
              placeholder="Search by company name, contact, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="md:max-w-md"
            />

            <Select
              value={tradeFilter ?? "all"}
              onValueChange={(value) => setTradeFilter(value === "all" ? null : value)}
            >
              <SelectTrigger className="md:w-[200px]">
                <SelectValue placeholder="Filter by trade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trades</SelectItem>
                {SIMPLE_TRADES.map((trade) => (
                  <SelectItem key={trade} value={trade}>
                    {trade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as SubcontractorStatus | "all")}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="inactive">Inactive</TabsTrigger>
              <TabsTrigger value="blacklisted">Blacklisted</TabsTrigger>
            </TabsList>
          </Tabs>
          <FilterChips chips={activeChips} onClearAll={clearAllFilters} />
        </CardContent>
      </Card>

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
                    <TableCell>{row.original.contactName || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.original.contactEmail || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.original.contactPhone || "-"}
                    </TableCell>
                    <TableCell>
                      {(() => {
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={search || tradeFilter !== null || statusFilter !== "all" ? SearchX : HardHat}
          heading={
            search || tradeFilter !== null || statusFilter !== "all"
              ? "No subcontractors match your filters"
              : "No subcontractors yet"
          }
          description={
            search || tradeFilter !== null || statusFilter !== "all"
              ? "Try adjusting your search or filter criteria."
              : "Add your first subcontractor to start building your directory."
          }
          action={
            !(search || tradeFilter !== null || statusFilter !== "all")
              ? { label: "Add Subcontractor", href: "/subcontractors/new" }
              : undefined
          }
        />
      )}
    </div>
  );
}
