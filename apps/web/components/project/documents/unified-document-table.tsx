"use client";

import React, { useState } from "react";
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
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
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

const CATEGORY_OPTIONS = [
  { value: "rfi", label: "RFI" },
  { value: "submittal", label: "Submittal" },
  { value: "transmittal", label: "Transmittal" },
  { value: "proposal", label: "Proposal" },
  { value: "change_order", label: "Change Order" },
  { value: "payment_app", label: "Pay App" },
  { value: "rfq", label: "RFQ" },
  { value: "file", label: "File" },
];

const FILE_FORMAT_COLORS: Record<string, string> = {
  pdf: "bg-red-100 text-red-700",
  xlsx: "bg-green-100 text-green-700",
  xls: "bg-green-100 text-green-700",
  docx: "bg-blue-100 text-blue-700",
  doc: "bg-blue-100 text-blue-700",
  png: "bg-purple-100 text-purple-700",
  jpg: "bg-purple-100 text-purple-700",
  jpeg: "bg-purple-100 text-purple-700",
};

function stripExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot > 0 ? filename.slice(0, lastDot) : filename;
}

function getFileFormat(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot <= 0) return "FILE";
  return filename.slice(lastDot + 1).toUpperCase();
}

function getFormatStyle(format: string): string {
  return FILE_FORMAT_COLORS[format.toLowerCase()] ?? "bg-muted text-muted-foreground";
}

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

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editNameError, setEditNameError] = useState("");

  const updateMutation = trpc.document.update.useMutation({
    onSuccess: () => {
      toast.success("Document updated");
      setEditingId(null);
      utils.document.listUnified.invalidate({ projectId });
    },
    onError: (err) => {
      // Surface duplicate name error inline, not as toast
      if (err.message.includes("already exists")) {
        setEditNameError("A document with this name already exists");
      } else {
        toast.error("Failed to update document");
      }
    },
  });

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

  const startEdit = (doc: UnifiedDocument) => {
    setEditingId(doc.id);
    setEditName(stripExtension(doc.name));
    setEditCategory(doc.category ?? "file");
    setEditNameError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditNameError("");
  };

  const saveEdit = (doc: UnifiedDocument) => {
    if (!editName.trim()) {
      setEditNameError("Name is required");
      return;
    }
    setEditNameError("");
    updateMutation.mutate({
      documentId: doc.id,
      name: editName.trim(),
      category: editCategory as "rfi" | "submittal" | "transmittal" | "proposal" | "change_order" | "payment_app" | "rfq" | "file",
    });
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
        cell: ({ row }) =>
          row.original.id === editingId ? (
            <div>
              <Input
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  setEditNameError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit(row.original);
                  if (e.key === "Escape") cancelEdit();
                }}
                className="h-9 text-sm"
                autoFocus
              />
              {editNameError && (
                <p className="mt-1 text-xs text-destructive">{editNameError}</p>
              )}
            </div>
          ) : (
            <button
              className="text-left hover:underline"
              onClick={() => handleRowClick(row.original)}
            >
              {stripExtension(row.original.name)}
            </button>
          ),
      },
      // Type column (file format badge, read-only)
      {
        id: "fileFormat",
        header: "Type",
        enableSorting: false,
        cell: ({ row }) => {
          const format = getFileFormat(row.original.name);
          return (
            <span
              className={cn(
                "text-xs font-medium px-1.5 py-0.5 rounded",
                getFormatStyle(format)
              )}
            >
              {format}
            </span>
          );
        },
      },
      // Category column (document category badge; editable)
      {
        accessorKey: "documentType",
        header: "Category",
        cell: ({ row }) =>
          row.original.id === editingId ? (
            <Select
              value={editCategory}
              onValueChange={(val) => setEditCategory(val)}
            >
              <SelectTrigger className="h-9 text-sm w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <StatusBadge variant="draft">
              {TYPE_LABELS[row.original.documentType] ?? row.original.documentType}
            </StatusBadge>
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
        cell: ({ row }) =>
          editingId === row.original.id ? (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="default"
                onClick={() => saveEdit(row.original)}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={cancelEdit}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <DocumentRowMenu
              document={row.original}
              projectSlug={projectSlug}
              onDelete={onDeleteSuccess}
              onEdit={() => startEdit(row.original)}
            />
          ),
        size: 48,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectSlug, onDeleteSuccess, editingId, editName, editCategory, editNameError, updateMutation.isPending]
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

  // Skeleton columns count (select, Name, Category, Type, Created By, Date, Actions)
  const COLUMN_COUNT = 7;

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
    <Card>
      <div className="relative w-full overflow-auto max-h-[70vh]">
      <Table>
        <TableHeader className="sticky top-0 z-20 bg-background">
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
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </Card>
  );
}
