"use client";

import { useState, useRef, useEffect } from "react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, X, Pencil, Trash2, Upload, AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CurrencyDisplay } from "@/components/shared/currency-display";

interface SovEditorProps {
  projectId: string;
}

type DraftSovRow = {
  description: string;
  scheduledValue: number;
  budgetLineItemId: string;
};

export function SovEditor({ projectId }: SovEditorProps) {
  const [draftRow, setDraftRow] = useState<DraftSovRow | null>(null);
  const [shouldFocusDraft, setShouldFocusDraft] = useState(false);
  const firstDraftInputRef = useRef<HTMLInputElement>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    description: "",
    scheduledValue: 0,
    budgetLineItemId: "",
  });

  const utils = trpc.useUtils();
  const { data: sovItems, isLoading } = trpc.sov.list.useQuery({ projectId });
  const { data: budgetItems } = trpc.budget.listLineItems.useQuery({ projectId });
  const { data: paymentApps } = trpc.paymentApp.list.useQuery({ projectId });

  useEffect(() => {
    if (shouldFocusDraft && firstDraftInputRef.current) {
      firstDraftInputRef.current.focus();
      setShouldFocusDraft(false);
    }
  }, [shouldFocusDraft, draftRow]);

  const createMutation = trpc.sov.create.useMutation({
    onSuccess: () => {
      utils.sov.list.invalidate({ projectId });
      toast.success("SOV item created");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create SOV item");
    },
  });

  const updateMutation = trpc.sov.update.useMutation({
    onSuccess: () => {
      utils.sov.list.invalidate({ projectId });
      toast.success("SOV item updated");
      setEditDialogOpen(false);
      setSelectedItem(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update SOV item");
    },
  });

  const deleteMutation = trpc.sov.delete.useMutation({
    onSuccess: () => {
      utils.sov.list.invalidate({ projectId });
      toast.success("SOV item deleted");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete SOV item");
    },
  });

  const importMutation = trpc.sov.importFromBudget.useMutation({
    onSuccess: (result) => {
      utils.sov.list.invalidate({ projectId });
      toast.success(`Imported ${result.created.length} items from budget`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to import from budget");
    },
  });

  const reorderMutation = trpc.sov.reorder.useMutation({
    onSuccess: () => {
      utils.sov.list.invalidate({ projectId });
      toast.success("SOV items reordered");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reorder items");
    },
  });

  const handleDraftSave = () => {
    if (!draftRow || !draftRow.description.trim()) {
      setDraftRow(null);
      return;
    }
    createMutation.mutate({
      projectId,
      itemNumber: "1", // auto-assigned by server
      description: draftRow.description,
      scheduledValue: draftRow.scheduledValue,
      budgetLineItemId: draftRow.budgetLineItemId || undefined,
    });
    setDraftRow(null);
  };

  const handleDraftKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setDraftRow(null);
    }
    if (e.key === "Enter") {
      e.preventDefault();
      handleDraftSave();
    }
  };

  const handleEdit = () => {
    if (!selectedItem) return;
    updateMutation.mutate({
      id: selectedItem.id,
      description: formData.description,
      scheduledValue: formData.scheduledValue,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this SOV item? This cannot be undone if payment apps reference it.")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleImportFromBudget = () => {
    if (confirm("Import all budget line items as SOV items? Existing SOV items will not be affected.")) {
      importMutation.mutate({ projectId });
    }
  };

  const handleMoveUp = (item: any, index: number) => {
    if (index === 0) return;
    const itemsList = sovItems?.items || [];
    const itemIds = [...itemsList.map((i) => i.id)];
    // Swap with previous
    [itemIds[index - 1], itemIds[index]] = [itemIds[index], itemIds[index - 1]];
    reorderMutation.mutate({ projectId, itemIds });
  };

  const handleMoveDown = (item: any, index: number) => {
    const itemsList = sovItems?.items || [];
    if (index === itemsList.length - 1) return;
    const itemIds = [...itemsList.map((i) => i.id)];
    // Swap with next
    [itemIds[index], itemIds[index + 1]] = [itemIds[index + 1], itemIds[index]];
    reorderMutation.mutate({ projectId, itemIds });
  };

  const openEditDialog = (item: any) => {
    setSelectedItem(item);
    setFormData({
      description: item.description,
      scheduledValue: Number(item.scheduledValue),
      budgetLineItemId: item.budgetLineItemId || "",
    });
    setEditDialogOpen(true);
  };

  // Check if SOV is locked (any submitted payment apps exist)
  const hasSubmittedPaymentApps = paymentApps?.some(
    (pa) => pa.status !== "draft"
  );

  const items = sovItems?.items || [];
  const totalScheduledValue = items.reduce(
    (sum, item) => sum + Number(item.scheduledValue || 0),
    0
  );

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
      {hasSubmittedPaymentApps && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            SOV is locked. Changes require all payment apps to be in draft status.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setDraftRow({ description: "", scheduledValue: 0, budgetLineItemId: "" });
              setShouldFocusDraft(true);
            }}
            disabled={hasSubmittedPaymentApps || !!draftRow}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add SOV Item
          </Button>

          <Button
            variant="outline"
            onClick={handleImportFromBudget}
            disabled={importMutation.isPending || hasSubmittedPaymentApps || items.length > 0}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import from Budget
          </Button>
        </div>
      </div>

      {items.length === 0 && !draftRow ? (
        <Alert>
          <AlertDescription>
            No SOV items yet. Import from budget or add items manually.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="border rounded-md relative w-full overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-background">
              <TableRow>
                <TableHead className="w-[80px] sticky left-0 z-30 bg-background border-r">Item #</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[150px]">Scheduled Value</TableHead>
                <TableHead className="w-[200px]">Budget Link</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono sticky left-0 z-10 bg-background border-r">{item.itemNumber}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <CurrencyDisplay amount={Number(item.scheduledValue)} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.budgetLineItemId
                      ? `Linked to budget`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveUp(item, index)}
                        disabled={index === 0 || hasSubmittedPaymentApps}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveDown(item, index)}
                        disabled={index === items.length - 1 || hasSubmittedPaymentApps}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(item)}
                        disabled={hasSubmittedPaymentApps}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                        disabled={hasSubmittedPaymentApps}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {draftRow && !hasSubmittedPaymentApps && (
                <TableRow className="bg-muted/20">
                  {/* Item # — sticky first column, read-only: will be assigned by server */}
                  <TableCell className="font-mono sticky left-0 z-10 bg-muted/20 border-r text-muted-foreground">
                    —
                  </TableCell>
                  {/* Description — auto-focused */}
                  <TableCell>
                    <Input
                      ref={firstDraftInputRef}
                      value={draftRow.description}
                      onChange={(e) => setDraftRow({ ...draftRow, description: e.target.value })}
                      onKeyDown={handleDraftKeyDown}
                      placeholder="Enter description..."
                      className="h-7 text-sm"
                    />
                  </TableCell>
                  {/* Scheduled Value */}
                  <TableCell>
                    <CurrencyInput
                      value={draftRow.scheduledValue}
                      onChange={(n) => setDraftRow({ ...draftRow, scheduledValue: n })}
                      onBlur={handleDraftSave}
                      onKeyDown={handleDraftKeyDown}
                      className="h-7"
                    />
                  </TableCell>
                  {/* Budget Link — optional select */}
                  <TableCell>
                    <select
                      value={draftRow.budgetLineItemId}
                      onChange={(e) => setDraftRow({ ...draftRow, budgetLineItemId: e.target.value })}
                      onKeyDown={handleDraftKeyDown}
                      className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
                    >
                      <option value="">None</option>
                      {budgetItems?.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.description}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  {/* Actions — just cancel */}
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDraftRow(null)}
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter className="sticky bottom-0 z-20 bg-muted/50">
              <TableRow>
                <TableCell className="sticky left-0 z-30 bg-muted/50 font-bold border-r">Totals</TableCell>
                <TableCell className="font-bold">Total Scheduled Value</TableCell>
                <TableCell className="text-right tabular-nums font-bold">
                  <CurrencyDisplay amount={totalScheduledValue} />
                </TableCell>
                <TableCell />
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit SOV Item</DialogTitle>
            <DialogDescription>
              Update Schedule of Values line item
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Work description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-scheduledValue">Scheduled Value</Label>
              <CurrencyInput
                id="edit-scheduledValue"
                value={formData.scheduledValue}
                onChange={(n) => setFormData({ ...formData, scheduledValue: n })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-budgetLineItemId">Budget Line Item (Optional)</Label>
              <select
                id="edit-budgetLineItemId"
                value={formData.budgetLineItemId}
                onChange={(e) =>
                  setFormData({ ...formData, budgetLineItemId: e.target.value })
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="">None</option>
                {budgetItems?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.description} - ${Number(item.budgetedAmount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedItem(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
