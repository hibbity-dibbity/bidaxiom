"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { trpc } from "@/lib/trpc";

// TODO: Replace with proper type from document.listUnified return type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnifiedDocument = any;

interface BulkActionBarProps {
  selectedCount: number;
  selectedDocuments: UnifiedDocument[];
  projectId: string;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}

export function BulkActionBar({
  selectedCount,
  selectedDocuments,
  projectId,
  onBulkDelete,
  onClearSelection,
}: BulkActionBarProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const deleteMutation = trpc.document.delete.useMutation();

  if (selectedCount === 0) return null;

  const handleBulkDownload = async () => {
    try {
      // Proxied through Next.js API route — avoids CORS, auth handled server-side
      const response = await fetch("/api/documents/bulk-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentIds: selectedDocuments.map((d: UnifiedDocument) => d.id),
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Bulk download failed (${response.status})${errText ? `: ${errText}` : ""}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "documents.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Bulk download error:", err);
      toast.error(err instanceof Error ? err.message : "Bulk download failed");
    }
  };

  const handleConfirmBulkDelete = async () => {
    try {
      await Promise.all(
        selectedDocuments.map((doc: UnifiedDocument) =>
          deleteMutation.mutateAsync({ documentId: doc.id })
        )
      );
      toast.success(`Deleted ${selectedDocuments.length} documents`);
      setDeleteDialogOpen(false);
      onBulkDelete();
    } catch {
      toast.error("Some documents could not be deleted");
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 border-t bg-background p-3">
        <span className="text-sm text-muted-foreground">{selectedCount} selected</span>
        <Button variant="outline" size="sm" onClick={handleBulkDownload}>
          <Download className="mr-2 h-4 w-4" /> Download ZIP
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </Button>
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          Clear
        </Button>
      </div>

      <DeleteConfirmDialog
        documentIds={selectedDocuments.map((d: UnifiedDocument) => d.id)}
        documentNames={selectedDocuments.map((d: UnifiedDocument) => d.name)}
        hasWorkflow={selectedDocuments.some((d: UnifiedDocument) => d.workflowId !== null)}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmBulkDelete}
      />
    </>
  );
}
