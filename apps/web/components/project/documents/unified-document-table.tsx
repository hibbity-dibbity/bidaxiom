"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { DocumentRowMenu } from "./document-row-menu";

// TODO: Replace with proper inferred type from tRPC AppRouter once inference is set up
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnifiedDocument = any;

const TYPE_LABELS: Record<string, string> = {
  rfi: "RFI",
  submittal: "Submittal",
  transmittal: "Transmittal",
  proposal: "Proposal",
  change_order: "Change Order",
  payment_app: "Pay App",
  rfq: "RFQ",
  file: "File",
};

const STATUS_BADGE_VARIANTS: Record<string, string> = {
  draft: "secondary",
  submitted: "default",
  under_review: "warning",
  approved: "success",
  rejected: "destructive",
  closed: "secondary",
  cancelled: "secondary",
};

interface UnifiedDocumentTableProps {
  documents: UnifiedDocument[];
  isLoading: boolean;
  projectSlug: string;
  projectId: string;
  onSelectionChange: (selected: UnifiedDocument[]) => void;
  onDeleteSuccess: () => void;
}

export function UnifiedDocumentTable({
  documents,
  isLoading,
  projectSlug,
  projectId,
  onSelectionChange,
  onDeleteSuccess,
}: UnifiedDocumentTableProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const handleRowClick = async (row: UnifiedDocument) => {
    if (
      row.workflowId !== null &&
      ["rfi", "submittal", "transmittal"].includes(row.documentType)
    ) {
      router.push(`/projects/${projectSlug}/workflows/${row.workflowId}`);
    } else {
      try {
        const result = await utils.document.getDownloadUrl.fetch({ documentId: row.id });
        window.open(result.downloadUrl, "_blank");
      } catch {
        toast.error("Could not download document");
      }
    }
  };

  const columns: ColumnDef<UnifiedDocument>[] = React.useMemo(
    () => [
      // Checkbox column
      {
        id: "select",
        enableSorting: false,
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                ? "indeterminate"
                : false
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            onClick={(e) => e.stopPropagation()}
          />
        ),
        size: 40,
      },
      // Name column
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <button
            className="text-left hover:underline"
            onClick={() => handleRowClick(row.original)}
          >
            {row.original.name}
          </button>
        ),
      },
      // Type column
      {
        accessorKey: "documentType",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant="secondary">
            {TYPE_LABELS[row.original.documentType] ?? row.original.documentType}
          </Badge>
        ),
      },
      // Status column
      {
        accessorKey: "workflowStatus",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.workflowStatus;
          if (!status) return <span className="text-muted-foreground">—</span>;
          const variant = STATUS_BADGE_VARIANTS[status] ?? "secondary";
          return <Badge variant={variant as "secondary" | "default" | "destructive" | "outline"}>{status.replace(/_/g, " ")}</Badge>;
        },
      },
      // Related entity column
      {
        id: "relatedEntity",
        header: "Related",
        cell: ({ row }) =>
          row.original.relatedEntity ? (
            <span className="text-sm">{row.original.relatedEntity}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      // Created by column
      {
        id: "createdBy",
        header: "Created By",
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.createdByName ?? row.original.createdBy ?? "—"}
          </span>
        ),
      },
      // Date column
      {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleDateString()}
          </span>
        ),
      },
      // Actions column
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <DocumentRowMenu
            document={row.original}
            projectSlug={projectSlug}
            onDelete={onDeleteSuccess}
          />
        ),
        size: 48,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectSlug, onDeleteSuccess]
  );

  const memoizedData = React.useMemo(() => documents, [documents]);

  const table = useReactTable<UnifiedDocument>({
    data: memoizedData,
    columns,
    state: { rowSelection },
    onRowSelectionChange: (updater) => {
      const newSelection =
        typeof updater === "function" ? updater(rowSelection) : updater;
      setRowSelection(newSelection);
      // Map selected row indices back to UnifiedDocument objects
      const selectedRows = memoizedData.filter((_, idx) => newSelection[idx]);
      onSelectionChange(selectedRows);
    },
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // Skeleton columns count
  const COLUMN_COUNT = 8;

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: COLUMN_COUNT }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-full" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: COLUMN_COUNT }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No documents in this project yet.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} style={{ width: header.column.getSize() }}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className="hover:bg-muted/50">
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="py-2 text-sm">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
