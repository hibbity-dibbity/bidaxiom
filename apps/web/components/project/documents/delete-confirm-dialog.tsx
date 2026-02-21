"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteConfirmDialogProps {
  documentIds: string[];
  documentNames: string[];
  hasWorkflow: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({
  documentIds,
  documentNames,
  hasWorkflow,
  open,
  onOpenChange,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const isBulk = documentIds.length > 1;
  const title = isBulk ? `Delete ${documentIds.length} Documents` : "Delete Document";

  const displayedNames = documentNames.slice(0, 3);
  const remainingCount = documentNames.length - 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {hasWorkflow && (
            <div className="rounded border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              This document has a linked workflow (RFI/Submittal/Transmittal). Deleting it will also
              permanently delete the workflow and all its approvals and comments.
            </div>
          )}

          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>

          <ul className="space-y-1 text-sm">
            {displayedNames.map((name) => (
              <li key={name} className="truncate font-medium">
                {name}
              </li>
            ))}
            {remainingCount > 0 && (
              <li className="text-muted-foreground">and {remainingCount} more</li>
            )}
          </ul>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirm}>
              Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
