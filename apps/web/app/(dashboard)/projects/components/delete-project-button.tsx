"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";

interface DeleteProjectButtonProps {
  projectId: string;
  projectName: string;
  onDeleted?: () => void;
  variant?: "table-row" | "menu-item";
}

type DialogState = "idle" | "checking" | "blocked" | "confirming";

export function DeleteProjectButton({
  projectId,
  projectName,
  onDeleted,
  variant = "table-row",
}: DeleteProjectButtonProps) {
  const [dialogState, setDialogState] = useState<DialogState>("idle");
  const [blockingReasons, setBlockingReasons] = useState<string[]>([]);
  const [reason, setReason] = useState("");

  const utils = trpc.useUtils();

  const softDelete = trpc.project.softDelete.useMutation({
    onSuccess: () => {
      toast.success("Project deleted");
      setDialogState("idle");
      setReason("");
      onDeleted?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete project");
    },
  });

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDialogState("checking");
    try {
      const result = await utils.project.checkDeletable.fetch({ projectId });
      if (!result.canDelete) {
        setBlockingReasons(result.reasons ?? []);
        setDialogState("blocked");
      } else {
        setDialogState("confirming");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to check if project can be deleted";
      toast.error(message);
      setDialogState("idle");
    }
  };

  const handleClose = () => {
    setDialogState("idle");
    setBlockingReasons([]);
    setReason("");
  };

  const handleConfirmDelete = () => {
    softDelete.mutate({ projectId, reason });
  };

  const isChecking = dialogState === "checking";

  return (
    <>
      {variant === "table-row" ? (
        <Button
          variant="destructive"
          size="sm"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleClick}
          disabled={isChecking}
          title={`Delete ${projectName}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : (
        <button
          className="text-destructive flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-accent"
          onClick={handleClick}
          disabled={isChecking}
        >
          <Trash2 className="h-4 w-4" />
          Delete Project
        </button>
      )}

      {/* Blocked dialog — lists all reasons why deletion is prevented */}
      <AlertDialog open={dialogState === "blocked"} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cannot Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              This project cannot be deleted for the following reasons:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">
            {blockingReasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleClose}>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation dialog — requires a reason before enabling Delete */}
      <AlertDialog open={dialogState === "confirming"} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be easily undone. The project will be permanently deleted after
              30 days. You can recover it within 30 days via Company Settings &rarr; Deleted Projects.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="deletion-reason">
              Reason for deletion <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="deletion-reason"
              placeholder="Enter the reason for deleting this project..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleClose} disabled={softDelete.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={reason.trim().length === 0 || softDelete.isPending}
            >
              {softDelete.isPending ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
