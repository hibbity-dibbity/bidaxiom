"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Circle, Minus } from "lucide-react";
import { toast } from "sonner";
import type { ApprovalStepStatus } from "@construction/shared";

interface ApprovalPanelProps {
  changeOrderId: string;
  approveDialogOpen: boolean;
  rejectDialogOpen: boolean;
  onApproveDialogChange: (open: boolean) => void;
  onRejectDialogChange: (open: boolean) => void;
}

const statusIcons: Record<ApprovalStepStatus, React.ReactNode> = {
  pending: <Circle className="h-5 w-5 text-muted-foreground" />,
  approved: <CheckCircle2 className="h-5 w-5 text-financial-positive" />,
  rejected: <XCircle className="h-5 w-5 text-financial-negative" />,
  skipped: <Minus className="h-5 w-5 text-muted-foreground" />,
};

export function ApprovalPanel({
  changeOrderId,
  approveDialogOpen,
  rejectDialogOpen,
  onApproveDialogChange,
  onRejectDialogChange,
}: ApprovalPanelProps) {
  const utils = trpc.useUtils();
  const [comments, setComments] = useState("");

  const { data: approvalStatus, isLoading } = trpc.changeOrder.getApprovalStatus.useQuery({
    changeOrderId,
  });

  const approveMutation = trpc.changeOrder.approve.useMutation({
    onSuccess: () => {
      utils.changeOrder.getById.invalidate();
      utils.changeOrder.getApprovalStatus.invalidate({ changeOrderId });
      utils.changeOrder.list.invalidate();
      toast.success("Change order approved");
      onApproveDialogChange(false);
      setComments("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to approve change order");
    },
  });

  const rejectMutation = trpc.changeOrder.reject.useMutation({
    onSuccess: () => {
      utils.changeOrder.getById.invalidate();
      utils.changeOrder.getApprovalStatus.invalidate({ changeOrderId });
      utils.changeOrder.list.invalidate();
      toast.success("Change order rejected");
      onRejectDialogChange(false);
      setComments("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reject change order");
    },
  });

  const handleApprove = () => {
    approveMutation.mutate({
      changeOrderId,
      comments: comments || undefined,
    });
  };

  const handleReject = () => {
    if (!comments.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    rejectMutation.mutate({
      changeOrderId,
      comments,
    });
  };

  if (isLoading || !approvalStatus || approvalStatus.length === 0) {
    return null;
  }

  const steps = approvalStatus;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Approval Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {steps.map((step: any) => (
              <div key={step.id} className="flex items-start gap-4">
                <div className="mt-1">{statusIcons[step.status as ApprovalStepStatus]}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Step {step.stepOrder}</span>
                    {step.approverRole && (
                      <span className="text-sm text-muted-foreground">
                        ({step.approverRole})
                      </span>
                    )}
                    {step.approverUserId && (
                      <span className="text-sm text-muted-foreground">
                        (User: {step.approverUserId.substring(0, 8)})
                      </span>
                    )}
                  </div>
                  {step.status === "approved" && step.approvedBy && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Approved by {step.approvedBy} on{" "}
                      {new Date(step.approvedAt!).toLocaleString()}
                    </p>
                  )}
                  {step.status === "rejected" && step.rejectedBy && (
                    <div className="mt-1">
                      <p className="text-sm text-muted-foreground">
                        Rejected by {step.rejectedBy} on{" "}
                        {new Date(step.rejectedAt!).toLocaleString()}
                      </p>
                      {step.comments && (
                        <p className="text-sm text-financial-negative mt-1">{step.comments}</p>
                      )}
                    </div>
                  )}
                  {step.comments && step.status === "approved" && (
                    <p className="text-sm text-muted-foreground mt-1">{step.comments}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Approve Dialog — triggered from page header */}
      <Dialog open={approveDialogOpen} onOpenChange={onApproveDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Change Order</DialogTitle>
            <DialogDescription>
              Approve this change order at the current approval step.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="approveComments">Comments (Optional)</Label>
            <Textarea
              id="approveComments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add any comments about your approval"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onApproveDialogChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? "Approving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog — triggered from page header */}
      <Dialog open={rejectDialogOpen} onOpenChange={onRejectDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Change Order</DialogTitle>
            <DialogDescription>
              Reject this change order and provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejectComments">Reason for Rejection *</Label>
            <Textarea
              id="rejectComments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Explain why you are rejecting this change order"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onRejectDialogChange(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
