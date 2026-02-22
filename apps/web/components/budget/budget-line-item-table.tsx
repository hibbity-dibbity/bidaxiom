"use client";

import React, { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CSI_DIVISIONS } from "@construction/shared";
import { Lock, Unlock, Pencil, Trash2, Plus, ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { ColumnPicker } from "@/components/shared/column-picker";

interface BudgetLineItemTableProps {
  projectId: string;
}

export function BudgetLineItemTable({ projectId }: BudgetLineItemTableProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    costCodeId: "",
    description: "",
    budgetedAmount: 0,
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const { columnVisibility, onColumnVisibilityChange } = useColumnVisibility("budget-line-items");

  const utils = trpc.useUtils();
  const { data: lineItems, isLoading } = trpc.budget.listLineItems.useQuery({
    projectId,
  });

  const createMutation = trpc.budget.createLineItem.useMutation({
    onSuccess: () => {
      utils.budget.listLineItems.invalidate({ projectId });
      utils.budget.getProjectSummary.invalidate({ projectId });
      toast.success("Budget line item created");
      setAddDialogOpen(false);
      setFormData({ costCodeId: "", description: "", budgetedAmount: 0 });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create budget line item");
    },
  });

  const updateMutation = trpc.budget.updateLineItem.useMutation({
    onSuccess: () => {
      utils.budget.listLineItems.invalidate({ projectId });
      utils.budget.getProjectSummary.invalidate({ projectId });
      toast.success("Budget line item updated");
      setEditDialogOpen(false);
      setSelectedItem(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update budget line item");
    },
  });

  const deleteMutation = trpc.budget.deleteLineItem.useMutation({
    onSuccess: () => {
      utils.budget.listLineItems.invalidate({ projectId });
      utils.budget.getProjectSummary.invalidate({ projectId });
      toast.success("Budget line item deleted");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete budget line item");
    },
  });

  const handleAdd = () => {
    createMutation.mutate({
      projectId,
      costCodeId: parseInt(formData.costCodeId),
      description: formData.description,
      budgetedAmount: formData.budgetedAmount,
    });
  };

  const handleEdit = () => {
    if (!selectedItem) return;
    updateMutation.mutate({
      id: selectedItem.id,
      description: formData.description,
      budgetedAmount: formData.budgetedAmount,
    });
  };

  const handleDelete = (id: string, isLocked: boolean) => {
    if (isLocked) {
      toast.error("Cannot delete locked budget line item");
      return;
    }
    if (confirm("Are you sure you want to delete this budget line item?")) {
      deleteMutation.mutate({ id });
    }
  };

  const openEditDialog = (item: any) => {
    setSelectedItem(item);
    setFormData({
      costCodeId: item.costCodeId.toString(),
      description: item.description,
      budgetedAmount: Number(item.budgetedAmount),
    });
    setEditDialogOpen(true);
  };

  const getDivisionName = (costCodeId: number) => {
    const division = CSI_DIVISIONS.find((d) => d.division === costCodeId);
    return division
      ? `Div ${costCodeId}: ${division.name}`
      : `Cost Code ${costCodeId}`;
  };

  const columns: ColumnDef<NonNullable<typeof lineItems>[0]>[] = React.useMemo(
    () => [
      {
        id: "costCode",
        accessorFn: (row) => getDivisionName(row.costCodeId),
        header: "Cost Code",
        enableSorting: true,
        enableHiding: false,
      },
      {
        accessorKey: "description",
        header: "Description",
        enableSorting: true,
      },
      {
        accessorKey: "budgetedAmount",
        header: "Budgeted Amount",
        enableSorting: true,
        sortingFn: "basic",
      },
      {
        id: "status",
        header: "Status",
        enableSorting: false,
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lineItems]
  );

  const table = useReactTable({
    data: lineItems ?? [],
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-10 w-32 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Budget Line Items</h3>
        <div className="flex items-center gap-2">
          <ColumnPicker table={table} />
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Line Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Budget Line Item</DialogTitle>
                <DialogDescription>
                  Create a new budget line item for this project
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="costCode">Cost Code</Label>
                  <Select
                    value={formData.costCodeId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, costCodeId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select cost code" />
                    </SelectTrigger>
                    <SelectContent>
                      {CSI_DIVISIONS.map((division) => (
                        <SelectItem
                          key={division.division}
                          value={division.division.toString()}
                        >
                          Div {division.division}: {division.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Enter description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budgetedAmount">Budgeted Amount</Label>
                  <CurrencyInput
                    id="budgetedAmount"
                    value={formData.budgetedAmount}
                    onChange={(n) => setFormData({ ...formData, budgetedAmount: n })}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAdd}
                    disabled={
                      !formData.costCodeId ||
                      !formData.description ||
                      !formData.budgetedAmount ||
                      createMutation.isPending
                    }
                  >
                    {createMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!lineItems || lineItems.length === 0 ? (
        <div className="text-center py-12 border rounded-lg border-dashed">
          <p className="text-muted-foreground">
            No budget line items yet. Add your first line item above.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg relative w-full overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-background">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header, colIndex) => {
                    const isFirstCol = colIndex === 0;
                    const canSort = header.column.getCanSort();
                    const sortDir = header.column.getIsSorted();
                    return (
                      <TableHead
                        key={header.id}
                        className={
                          isFirstCol
                            ? "sticky left-0 z-30 bg-background min-w-[160px] border-r"
                            : undefined
                        }
                      >
                        {canSort ? (
                          <div
                            className="flex items-center gap-1.5 cursor-pointer select-none hover:text-foreground"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            {sortDir === "asc" ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : sortDir === "desc" ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                            )}
                          </div>
                        ) : (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => {
                const item = row.original;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="sticky left-0 z-10 bg-background font-medium border-r">
                      {getDivisionName(item.costCodeId)}
                    </TableCell>
                    {table.getColumn("description")?.getIsVisible() && (
                      <TableCell>{item.description}</TableCell>
                    )}
                    {table.getColumn("budgetedAmount")?.getIsVisible() && (
                      <TableCell className="text-right tabular-nums">
                        <CurrencyDisplay amount={Number(item.budgetedAmount)} />
                      </TableCell>
                    )}
                    {table.getColumn("status")?.getIsVisible() && (
                      <TableCell className="text-center">
                        {item.isLocked ? (
                          <Lock className="h-4 w-4 text-financial-negative mx-auto" />
                        ) : (
                          <Unlock className="h-4 w-4 text-financial-positive mx-auto" />
                        )}
                      </TableCell>
                    )}
                    {table.getColumn("actions")?.getIsVisible() && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(item)}
                            disabled={item.isLocked}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item.id, item.isLocked)}
                            disabled={item.isLocked}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter className="sticky bottom-0 z-20 bg-muted/50">
              <TableRow>
                <TableCell className="sticky left-0 z-30 bg-muted/50 font-bold border-r">
                  Totals
                </TableCell>
                {table.getColumn("description")?.getIsVisible() && (
                  <TableCell />
                )}
                {table.getColumn("budgetedAmount")?.getIsVisible() && (
                  <TableCell className="text-right tabular-nums font-bold">
                    <CurrencyDisplay
                      amount={lineItems.reduce(
                        (sum, item) => sum + Number(item.budgetedAmount),
                        0
                      )}
                    />
                  </TableCell>
                )}
                {table.getColumn("status")?.getIsVisible() && (
                  <TableCell />
                )}
                {table.getColumn("actions")?.getIsVisible() && (
                  <TableCell />
                )}
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Budget Line Item</DialogTitle>
            <DialogDescription>
              Update the description or budgeted amount
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cost Code</Label>
              <Input
                value={
                  selectedItem ? getDivisionName(selectedItem.costCodeId) : ""
                }
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-budgetedAmount">Budgeted Amount</Label>
              <CurrencyInput
                id="edit-budgetedAmount"
                value={formData.budgetedAmount}
                onChange={(n) => setFormData({ ...formData, budgetedAmount: n })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEdit}
                disabled={
                  !formData.description ||
                  !formData.budgetedAmount ||
                  updateMutation.isPending
                }
              >
                {updateMutation.isPending ? "Updating..." : "Update"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
