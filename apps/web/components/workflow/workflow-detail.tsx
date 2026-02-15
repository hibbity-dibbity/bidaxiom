"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Check,
  X,
  Clock,
  FileText,
  Download,
  Upload,
  Edit,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface WorkflowDetailProps {
  workflowId: string;
  projectId: string;        // For tRPC queries
  projectSlug: string;      // For navigation
}

const statusColors = {
  draft: "secondary",
  submitted: "default",
  under_review: "warning",
  approved: "success",
  rejected: "destructive",
  closed: "secondary",
  cancelled: "secondary",
} as const;

const statusLabels = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  closed: "Closed",
  cancelled: "Cancelled",
};

const priorityColors = {
  low: "secondary",
  medium: "default",
  high: "warning",
  urgent: "destructive",
} as const;

export function WorkflowDetail({ workflowId, projectId, projectSlug }: WorkflowDetailProps) {
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject">("approve");
  const [approvalComments, setApprovalComments] = useState("");

  const utils = trpc.useUtils();

  const { data: workflow, isLoading } = trpc.workflow.getById.useQuery({ workflowId });
  const { data: history } = trpc.workflow.getHistory.useQuery({ workflowId });

  const reviewApprovalMutation = trpc.workflow.reviewApproval.useMutation({
    onSuccess: () => {
      toast.success(`Workflow ${approvalAction}ed successfully`);
      utils.workflow.getById.invalidate({ workflowId });
      utils.workflow.getHistory.invalidate({ workflowId });
      utils.workflow.list.invalidate({ projectId });
      setApprovalDialogOpen(false);
      setSelectedApprovalId(null);
      setApprovalComments("");
    },
    onError: (error) => {
      toast.error(error.message || `Failed to ${approvalAction} workflow`);
    },
  });

  const submitWorkflowMutation = trpc.workflow.submit.useMutation({
    onSuccess: () => {
      toast.success("Workflow submitted successfully");
      utils.workflow.getById.invalidate({ workflowId });
      utils.workflow.getHistory.invalidate({ workflowId });
      utils.workflow.list.invalidate({ projectId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit workflow");
    },
  });

  const handleApprove = (approvalId: string) => {
    setSelectedApprovalId(approvalId);
    setApprovalAction("approve");
    setApprovalDialogOpen(true);
  };

  const handleReject = (approvalId: string) => {
    setSelectedApprovalId(approvalId);
    setApprovalAction("reject");
    setApprovalDialogOpen(true);
  };

  const handleSubmitReview = () => {
    if (!selectedApprovalId) return;

    reviewApprovalMutation.mutate({
      approvalId: selectedApprovalId,
      action: approvalAction,
      comments: approvalComments || undefined,
    });
  };

  const handleSubmitWorkflow = () => {
    submitWorkflowMutation.mutate({ workflowId });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-semibold">Workflow not found</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{workflow.workflowNumber}</h1>
              <Badge variant={statusColors[workflow.status as keyof typeof statusColors] as any}>
                {statusLabels[workflow.status as keyof typeof statusLabels]}
              </Badge>
              <Badge variant="outline">
                {workflow.workflowType.toUpperCase()}
              </Badge>
            </div>
            <h2 className="text-xl">{workflow.title}</h2>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                Priority:{" "}
                <Badge variant={priorityColors[workflow.priority as keyof typeof priorityColors] as any}>
                  {workflow.priority.charAt(0).toUpperCase() + workflow.priority.slice(1)}
                </Badge>
              </span>
              {workflow.dueDate && (
                <span>Due: {new Date(workflow.dueDate).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {workflow.status === "draft" && (
              <>
                <Button variant="outline" size="sm">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button size="sm" onClick={handleSubmitWorkflow} disabled={submitWorkflowMutation.isLoading}>
                  {submitWorkflowMutation.isLoading ? "Submitting..." : "Submit"}
                </Button>
              </>
            )}
            {workflow.status !== "closed" && workflow.status !== "cancelled" && (
              <Button variant="outline" size="sm">
                <XCircle className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="approvals">Approval Steps</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Document</h3>
              <Link
                href={`/projects/${projectSlug}/documents`}
                className="text-primary hover:underline flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                {workflow.document?.name || "View Document"}
              </Link>
            </div>

            {workflow.description && (
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {workflow.description}
                </p>
              </div>
            )}

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-1">Submitted By</h3>
                <p className="text-sm text-muted-foreground">
                  {workflow.submittedByProfile?.fullName || "Not submitted yet"}
                </p>
                {workflow.submittedAt && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(workflow.submittedAt).toLocaleString()}
                  </p>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-1">Created By</h3>
                <p className="text-sm text-muted-foreground">
                  {workflow.createdByProfile?.fullName || "Unknown"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(workflow.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            {workflow.responseDocument && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Response Document</h3>
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download Response
                  </Button>
                </div>
              </>
            )}

            {workflow.status !== "closed" && workflow.status !== "cancelled" && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Respond to Workflow</h3>
                  <Button variant="outline" size="sm">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Response
                  </Button>
                </div>
              </>
            )}
          </Card>
        </TabsContent>

        {/* Approval Steps Tab */}
        <TabsContent value="approvals">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Approval Steps</h3>
            <div className="space-y-4">
              {workflow.approvals?.map((approval: any, index: number) => {
                const isPending = approval.status === "pending";
                const isApproved = approval.status === "approved";
                const isRejected = approval.status === "rejected";

                return (
                  <div key={approval.id} className="flex gap-4">
                    {/* Stepper Icon */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isApproved
                            ? "bg-green-500 text-white"
                            : isRejected
                            ? "bg-red-500 text-white"
                            : isPending
                            ? "bg-blue-500 text-white"
                            : "bg-gray-300 text-gray-600"
                        }`}
                      >
                        {isApproved ? (
                          <Check className="h-4 w-4" />
                        ) : isRejected ? (
                          <X className="h-4 w-4" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )}
                      </div>
                      {index < (workflow.approvals?.length || 0) - 1 && (
                        <div className="w-0.5 h-12 bg-gray-300 my-1" />
                      )}
                    </div>

                    {/* Step Content */}
                    <div className="flex-1 pb-8">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">Step {approval.stepNumber}</span>
                            <Badge variant="outline">{approval.requirementType.replace(/_/g, " ")}</Badge>
                            <Badge variant={isPending ? "default" : isApproved ? "success" : "destructive"}>
                              {approval.status}
                            </Badge>
                          </div>

                          <p className="text-sm text-muted-foreground">
                            {approval.requirementType === "specific_user"
                              ? `Approver: ${approval.approverUserProfile?.fullName || "Unknown"}`
                              : `Role: ${approval.approverRole}`}
                          </p>

                          {approval.reviewedBy && (
                            <div className="mt-2 text-sm">
                              <p className="text-muted-foreground">
                                Reviewed by: {approval.reviewedByProfile?.fullName || "Unknown"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(approval.reviewedAt).toLocaleString()}
                              </p>
                              {approval.comments && (
                                <p className="mt-1 text-sm italic">"{approval.comments}"</p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Approval Actions */}
                        {isPending && approval.canCurrentUserApprove && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 border-green-600 hover:bg-green-50"
                              onClick={() => handleApprove(approval.id)}
                            >
                              <Check className="mr-1 h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-600 hover:bg-red-50"
                              onClick={() => handleReject(approval.id)}
                            >
                              <X className="mr-1 h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">History Timeline</h3>
            {history && history.length > 0 ? (
              <div className="space-y-4">
                {history.map((entry: any) => (
                  <div key={entry.id} className="flex gap-4 pb-4 border-b last:border-0">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">
                          {entry.changedByProfile?.fullName || "System"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {entry.fromStatus && entry.toStatus
                          ? `Status changed from ${entry.fromStatus} to ${entry.toStatus}`
                          : entry.comment}
                      </p>
                      {entry.fieldName && (
                        <p className="text-xs text-muted-foreground">Field: {entry.fieldName}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No history available
              </p>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === "approve" ? "Approve" : "Reject"} Workflow Step
            </DialogTitle>
            <DialogDescription>
              Add optional comments to your decision
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Comments (Optional)</Label>
              <Textarea
                placeholder="Add your comments..."
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setApprovalDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitReview}
                disabled={reviewApprovalMutation.isLoading}
                className={
                  approvalAction === "reject"
                    ? "bg-red-600 hover:bg-red-700"
                    : ""
                }
              >
                {reviewApprovalMutation.isLoading
                  ? "Submitting..."
                  : approvalAction === "approve"
                  ? "Approve"
                  : "Reject"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
