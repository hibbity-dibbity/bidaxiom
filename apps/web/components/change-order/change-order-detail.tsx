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
import { Edit, Trash2, Ban, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { ApprovalPanel } from "./approval-panel";
import { ChangeOrderHistory } from "./change-order-history";
import { CSI_DIVISIONS } from "@construction/shared";
import type { ChangeOrderStatus, ChangeOrderType } from "@construction/shared";

interface ChangeOrderDetailProps {
  changeOrderId: string;
  projectId: string;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const statusColors: Record<ChangeOrderStatus, string> = {
  draft: "bg-gray-500",
  pco_submitted: "bg-yellow-500",
  pending_approval: "bg-orange-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
  void: "bg-slate-500",
};

const typeColors: Record<ChangeOrderType, string> = {
  owner: "bg-blue-500",
  internal: "bg-amber-500",
  subcontractor: "bg-purple-500",
};

export function ChangeOrderDetail({ changeOrderId, projectId }: ChangeOrderDetailProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  const { data, isLoading } = trpc.changeOrder.getById.useQuery({ id: changeOrderId });

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
      router.push(`/projects/${projectId}/change-orders`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete change order");
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

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={() => router.push(`/projects/${projectId}/change-orders`)}
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
                <Badge className={statusColors[co.status as ChangeOrderStatus]}>
                  {co.status.replace(/_/g, " ")}
                </Badge>
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
              {canEdit && (
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
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
                          ? "text-red-600"
                          : "text-green-600"
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
                  Number(co.totalAmount) < 0 ? "text-red-600" : "text-green-600"
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
        <ApprovalPanel changeOrderId={changeOrderId} />
      )}

      {/* History */}
      <ChangeOrderHistory changeOrderId={changeOrderId} />
    </div>
  );
}
