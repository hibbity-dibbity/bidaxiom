"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Download, Link2, Mail, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { SendDocumentDialog } from "./send-document-dialog";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";

// TODO: Replace with proper type from document.listUnified return type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnifiedDocument = any;

interface DocumentRowMenuProps {
  document: UnifiedDocument;
  projectSlug: string;
  onDelete: () => void;
}

export function DocumentRowMenu({ document, projectSlug, onDelete }: DocumentRowMenuProps) {
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const utils = trpc.useUtils();

  const deleteMutation = trpc.document.delete.useMutation({
    onSuccess: () => {
      toast.success("Document deleted");
      setDeleteDialogOpen(false);
      onDelete();
    },
    onError: () => {
      toast.error("Failed to delete document");
    },
  });

  const handleDownload = async () => {
    try {
      const result = await utils.document.getDownloadUrl.fetch({ documentId: document.id });
      window.open(result.downloadUrl, "_blank");
    } catch {
      toast.error("Download failed");
    }
  };

  const handleCopyLink = () => {
    const path = document.workflowId
      ? `/projects/${projectSlug}/workflows/${document.workflowId}`
      : `/projects/${projectSlug}/documents`;
    navigator.clipboard.writeText(window.location.origin + path);
    toast.success("Link copied");
  };

  const handleConfirmDelete = () => {
    deleteMutation.mutate({ documentId: document.id });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyLink}>
            <Link2 className="mr-2 h-4 w-4" />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSendDialogOpen(true)}>
            <Mail className="mr-2 h-4 w-4" />
            Send (Email)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteDialogOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SendDocumentDialog
        documentId={document.id}
        documentName={document.name}
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
      />

      <DeleteConfirmDialog
        documentIds={[document.id]}
        documentNames={[document.name]}
        hasWorkflow={!!document.workflowId}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
