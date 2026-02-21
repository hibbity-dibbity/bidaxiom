"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface SendDocumentDialogProps {
  documentId: string;
  documentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendDocumentDialog({
  documentId,
  documentName,
  open,
  onOpenChange,
}: SendDocumentDialogProps) {
  const [recipientEmail, setRecipientEmail] = useState("");

  const sendMutation = trpc.document.sendByEmail.useMutation({
    onSuccess: () => {
      toast.success("Document sent to " + recipientEmail);
      setRecipientEmail("");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Failed to send document");
    },
  });

  const handleSend = () => {
    if (!recipientEmail) return;
    sendMutation.mutate({ documentId, recipientEmail });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Document</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Send a download link for <span className="font-medium">{documentName}</span> by email.
          </p>
          <Input
            type="email"
            placeholder="recipient@example.com"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={!recipientEmail || sendMutation.isPending}
            >
              {sendMutation.isPending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
