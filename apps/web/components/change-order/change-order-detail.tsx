"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Trash2, Ban, ArrowLeft, Send, Plus, FileDown, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApprovalPanel } from "./approval-panel";
import { ChangeOrderHistory } from "./change-order-history";
import { StatusBadge } from "@/components/shared/status-badge";
import { CSI_DIVISIONS } from "@construction/shared";
import type { ChangeOrderStatus, ChangeOrderType } from "@construction/shared";

interface ChangeOrderDetailProps {
  changeOrderId: string;
  projectId: string;        // For tRPC queries
  projectSlug: string;      // For navigation
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const statusVariantMap: Record<ChangeOrderStatus, "draft" | "pending" | "approved" | "rejected" | "cancelled" | "warning"> = {
  draft: "draft",
  pco_submitted: "pending",
  pending_approval: "warning",
  approved: "approved",
  rejected: "rejected",
  void: "cancelled",
};

const typeColors: Record<ChangeOrderType, string> = {
  owner: "bg-blue-500",
  internal: "bg-orange-500",
  subcontractor: "bg-purple-500",
};

export function ChangeOrderDetail({ changeOrderId, projectId, projectSlug }: ChangeOrderDetailProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approvalSteps, setApprovalSteps] = useState<
    Array<{
      stepOrder: number;
      approverRole?: string;
      approverUserId?: string;
      requirementType: "all" | "any" | "specific";
    }>
  >([]);

  const { data, isLoading } = trpc.changeOrder.getById.useQuery({ id: changeOrderId });

  const { data: approvalStatus } = trpc.changeOrder.getApprovalStatus.useQuery(
    { changeOrderId },
    { enabled: true }
  );

  const canCurrentUserApprove =
    approvalStatus?.some((s: any) => s.canCurrentUserApprove === true) ?? false;
  const hasPendingStep = approvalStatus?.some((s: any) => s.status === "pending") ?? false;

  const voidMutation = trpc.changeOrder.void.useMutation({
    onSuccess: () => {
      utils.changeOrder.getById.invalidate({ id: changeOrderId });
      utils.changeOrder.list.invalidate({ projectId });
      toast.success("Change order voided");
      setVoidDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to void change order");
    },
  });

  const deleteMutation = trpc.changeOrder.delete.useMutation({
    onSuccess: () => {
      toast.success("Change order deleted");
      router.push(`/projects/${projectSlug}/change-orders`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete change order");
    },
  });

  const submitMutation = trpc.changeOrder.submit.useMutation({
    onSuccess: () => {
      utils.changeOrder.getById.invalidate({ id: changeOrderId });
      utils.changeOrder.list.invalidate({ projectId });
      toast.success("Change order submitted for approval");
      setSubmitDialogOpen(false);
      setApprovalSteps([]);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit change order");
    },
  });

  const generatePdfMutation = trpc.pdf.generateChangeOrder.useMutation({
    onSuccess: () => {
      toast.success("Change Order PDF generated and saved to document library");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate Change Order PDF");
    },
  });

  const getDivisionName = (costCodeId: number) => {
    const division = CSI_DIVISIONS.find((d) => d.division === costCodeId);
    return division
      ? `Div ${costCodeId}: ${division.name}`
      : `Cost Code ${costCodeId}`;
  };

  const handleVoid = () => {
    if (!voidReason.trim()) {
      toast.error("Void reason is required");
      return;
    }
    voidMutation.mutate({
      changeOrderId,
      reason: voidReason,
    });
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this change order?")) {
      deleteMutation.mutate({ id: changeOrderId });
    }
  };

  const handleAddStep = () => {
    const newStep = {
      stepOrder: approvalSteps.length + 1,
      approverRole: "org:project_manager",
      requirementType: "all" as const,
    };
    setApprovalSteps([...approvalSteps, newStep]);
  };

  const handleRemoveStep = (index: number) => {
    const updatedSteps = approvalSteps
      .filter((_, i) => i !== index)
      .map((step, i) => ({ ...step, stepOrder: i + 1 }));
    setApprovalSteps(updatedSteps);
  };

  const handleUpdateStep = (
    index: number,
    field: "approverRole" | "requirementType",
    value: string
  ) => {
    const updatedSteps = [...approvalSteps];
    if (field === "approverRole") {
      updatedSteps[index] = { ...updatedSteps[index], approverRole: value };
    } else {
      updatedSteps[index] = {
        ...updatedSteps[index],
        requirementType: value as "all" | "any" | "specific",
      };
    }
    setApprovalSteps(updatedSteps);
  };

  const handleSubmitForApproval = () => {
    if (approvalSteps.length === 0) {
      toast.error("At least one approval step is required");
      return;
    }
    submitMutation.mutate({
      changeOrderId,
      approvalSteps: approvalSteps.map((step) => ({
        stepOrder: step.stepOrder,
        approverRole: step.approverRole,
        approverUserId: step.approverUserId ?? undefined,
        requirementType: step.requirementType,
      })),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Change order not found</p>
      </div>
    );
  }

  const co = data;
  const lineItems = data.lineItems;
  const displayNumber = co.coNumber || co.pcoNumber || "Draft";
  const canEdit = co.status === "draft" || co.status === "rejected";
  const canVoid = co.status === "approved";
  const canDelete = co.status === "draft";
  const canGeneratePdf =
    co.status === "pco_submitted" ||
    co.status === "pending_approval" ||
    co.status === "approved";
  const canApproveOrReject =
    canCurrentUserApprove &&
    hasPendingStep &&
    (co.status === "pending_approval" || co.status === "pco_submitted");

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={() => router.push(`/projects/${projectSlug}/change-orders`)}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Change Orders
      </Button>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge variant={statusVariantMap[co.status as ChangeOrderStatus]}>
                  {co.status.replace(/_/g, " ")}
                </StatusBadge>
                <Badge className={typeColors[co.type as ChangeOrderType]}>
                  {co.type}
                </Badge>
                <span className="text-2xl font-bold text-muted-foreground">
                  {displayNumber}
                </span>
              </div>
              <CardTitle className="text-3xl">{co.title}</CardTitle>
            </div>
            <div className="flex gap-2">
              {/* VISUAL-03: Approve/Reject buttons in header action area */}
              {canApproveOrReject && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setApproveDialogOpen(true)}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setRejectDialogOpen(true)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </>
              )}
              {co.status === "draft" && (
                <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Send className="h-4 w-4 mr-2" />
                      Submit for Approval
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Submit for Approval</DialogTitle>
                      <DialogDescription>
                        Configure approval workflow for this change order. At least one approval step is required.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      {/* Approval Steps */}
                      {approvalSteps.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No approval steps configured. Click "Add Step" to start.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {approvalSteps.map((step, index) => (
                            <div key={index} className="border rounded-lg p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <Badge variant="outline">Step {step.stepOrder}</Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveStep(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="grid gap-3">
                                <div className="space-y-2">
                                  <Label>Approver Role</Label>
                                  <Select
                                    value={step.approverRole}
                                    onValueChange={(value) =>
                                      handleUpdateStep(index, "approverRole", value)
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="org:project_manager">
                                        Project Manager
                                      </SelectItem>
                                      <SelectItem value="org:superintendent">
                                        Superintendent
                                      </SelectItem>
                                      <SelectItem value="org:accountant">
                                        Accountant
                                      </SelectItem>
                                      <SelectItem value="org:admin">Admin</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Requirement Type</Label>
                                  <Select
                                    value={step.requirementType}
                                    onValueChange={(value) =>
                                      handleUpdateStep(index, "requirementType", value)
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select requirement" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all">All approvers</SelectItem>
                                      <SelectItem value="any">Any approver</SelectItem>
                                      <SelectItem value="specific">
                                        Specific approver
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Add Step Button */}
                      <Button
                        variant="outline"
                        onClick={handleAddStep}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Step
                      </Button>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSubmitDialogOpen(false);
                          setApprovalSteps([]);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSubmitForApproval}
                        disabled={approvalSteps.length === 0 || submitMutation.isPending}
                      >
                        {submitMutation.isPending
                          ? "Submitting..."
                          : "Submit for Approval"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
              {co.status === "rejected" && (
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit & Resubmit
                </Button>
              )}
              {canVoid && (
                <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Ban className="h-4 w-4 mr-2" />
                      Void
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Void Change Order</DialogTitle>
                      <DialogDescription>
                        This will reverse any budget impacts and mark the change order as void.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      <Label htmlFor="voidReason">Reason for Voiding *</Label>
                      <Textarea
                        id="voidReason"
                        value={voidReason}
                        onChange={(e) => setVoidReason(e.target.value)}
                        placeholder="Enter reason for voiding this change order"
                        rows={3}
                      />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setVoidDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleVoid}
                        disabled={voidMutation.isPending}
                      >
                        {voidMutation.isPending ? "Voiding..." : "Void Change Order"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
              {canGeneratePdf && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    generatePdfMutation.mutate({
                      projectSlug,
                      changeOrderId,
                    })
                  }
                  disabled={generatePdfMutation.isPending}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  {generatePdfMutation.isPending ? "Generating..." : "Generate PDF"}
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Description</p>
            <p className="mt-1">{co.description || "No description"}</p>
          </div>
          {co.type === "owner" && co.requestedBy && (
            <div>
              <p className="text-sm text-muted-foreground">Requested By</p>
              <p className="mt-1">{co.requestedBy}</p>
            </div>
          )}
          {co.type === "internal" && co.reason && (
            <div>
              <p className="text-sm text-muted-foreground">Reason</p>
              <p className="mt-1">{co.reason.replace(/_/g, " ")}</p>
            </div>
          )}
          {co.type === "subcontractor" && co.commitmentId && (
            <div>
              <p className="text-sm text-muted-foreground">Related Commitment</p>
              <p className="mt-1">{co.commitmentId}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cost Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {getDivisionName(item.costCodeId)}
                  </TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        Number(item.amountChange) < 0
                          ? "text-financial-negative"
                          : "text-financial-positive"
                      }
                    >
                      {currencyFormatter.format(Number(item.amountChange))}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex justify-end">
            <div className="text-xl font-bold">
              <span className="text-muted-foreground mr-2">Total:</span>
              <span
                className={
                  Number(co.totalAmount) < 0
                    ? "text-financial-negative"
                    : "text-financial-positive"
                }
              >
                {currencyFormatter.format(Number(co.totalAmount))}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Approval Panel */}
      {(co.status === "pco_submitted" ||
        co.status === "pending_approval" ||
        co.status === "approved" ||
        co.status === "rejected") && (
        <ApprovalPanel
          changeOrderId={changeOrderId}
          approveDialogOpen={approveDialogOpen}
          rejectDialogOpen={rejectDialogOpen}
          onApproveDialogChange={setApproveDialogOpen}
          onRejectDialogChange={setRejectDialogOpen}
        />
      )}

      {/* History */}
      <ChangeOrderHistory changeOrderId={changeOrderId} />
    </div>
  );
}
