"use client";

import React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp, ChevronsUpDown, Download, FolderOpen, SearchX } from "lucide-react";
import { createColumns } from "./columns";
import { cn } from "@/lib/utils";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { ColumnPicker } from "@/components/shared/column-picker";
import { EmptyState } from "@/components/shared/empty-state";

interface Project {
  id: string;
  jobNumber: string | null;
  name: string;
  slug: string;
  customerName: string | null;
  lifecyclePhase: string | null;
  startDate: string | null;
}

interface ProjectsTableProps {
  data: Project[];
  isLoading: boolean;
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  isAdmin: boolean;
  onDelete: (projectId: string) => void;
  /** True when any filter or search is active — selects EmptyState variant */
  isFiltered: boolean;
}

export function ProjectsTable({
  data,
  isLoading,
  total,
  page,
  onPageChange,
  pageSize,
  isAdmin,
  onDelete,
  isFiltered,
}: ProjectsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const { columnVisibility, onColumnVisibilityChange } = useColumnVisibility("projects-list");

  // Wrap data in useMemo to prevent infinite re-renders
  const memoizedData = React.useMemo(() => data, [data]);

  // Build columns based on admin status
  const columns = React.useMemo(
    () => createColumns(isAdmin, onDelete),
    [isAdmin, onDelete]
  );

  const table = useReactTable<Project>({
    data: memoizedData,
    columns: columns as ColumnDef<Project>[],
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
  });

  // Skeleton columns for loading state (non-admin baseline)
  const skeletonColumns = React.useMemo(() => createColumns(false, () => {}), []);

  // Calculate pagination info
  const offset = (page - 1) * pageSize;
  const startIndex = total === 0 ? 0 : offset + 1;
  const endIndex = Math.min(offset + pageSize, total);

  const exportCsv = () => {
    const rows = table.getRowModel().rows;
    const today = new Date().toISOString().split("T")[0];
    const filename = `projects-${today}.csv`;

    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;

    const header = ["Job #", "Name", "Customer", "Phase", "Start Date"].map(escape).join(",");
    const csvRows = rows.map((row) => {
      const p = row.original;
      return [
        p.jobNumber ?? "",
        p.name,
        p.customerName ?? "",
        p.lifecyclePhase ?? "",
        p.startDate ? new Date(p.startDate).toLocaleDateString() : "",
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
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {skeletonColumns.map((column, index) => (
                <TableHead key={(column as ColumnDef<Project> & { id?: string }).id || index}>
                  {typeof column.header === "string" ? column.header : ""}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {skeletonColumns.map((_, colIndex) => (
                  <TableCell key={colIndex} className="py-2">
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={isFiltered ? SearchX : FolderOpen}
        heading={isFiltered ? "No projects match your filters" : "No projects yet"}
        description={
          isFiltered
            ? "Try adjusting your search or filter criteria."
            : "Create your first project to get started."
        }
        action={!isFiltered ? { label: "Create Project", href: "/projects/new" } : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={exportCsv}
          disabled={table.getRowModel().rows.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
        <ColumnPicker table={table} />
      </div>
      <div className="rounded-md border relative w-full overflow-auto max-h-[70vh]">
        <Table>
          <TableHeader className="sticky top-0 z-20 bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const isSorted = header.column.getIsSorted();
                  const isFirstCol = header.id === "jobNumber";

                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: header.column.getSize() }}
                      className={isFirstCol ? "sticky left-0 z-30 bg-background border-r" : undefined}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={
                            canSort
                              ? "flex items-center gap-2 cursor-pointer select-none hover:text-foreground"
                              : undefined
                          }
                          onClick={
                            canSort
                              ? header.column.getToggleSortingHandler()
                              : undefined
                          }
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
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
                className="hover:bg-muted/50 group"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      "py-2 text-sm",
                      cell.column.id === "jobNumber" && "sticky left-0 z-10 bg-background border-r"
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-muted-foreground">
          Showing {startIndex}-{endIndex} of {total} projects
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={endIndex >= total}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
