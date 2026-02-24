"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Edit,
  Trash2,
  Ban,
  ArrowLeft,
  Send,
  MoreVertical,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { ChangeOrderHistory } from "./change-order-history";
import { StatusBadge } from "@/components/shared/status-badge";
import { SendToCustomerDialog } from "@/components/shared/send-to-customer-dialog";
import { CSI_DIVISIONS } from "@construction/shared";
import type { ChangeOrderStatus, ChangeOrderType } from "@construction/shared";

interface ChangeOrderDetailProps {
  changeOrderId: string;
  projectId: string;        // For tRPC queries
  projectSlug: string;      // For navigation
  customerEmail?: string | null;
}


const statusVariantMap: Record<ChangeOrderStatus, "draft" | "pending" | "approved" | "rejected" | "cancelled" | "warning"> = {
  draft: "draft",
  pco_submitted: "pending",
  pending_approval: "warning",
  approved: "approved",
  rejected: "rejected",
  void: "cancelled",
};

const statusLabelMap: Record<ChangeOrderStatus, string> = {
  draft: "Draft",
  pco_submitted: "PCO Submitted",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  void: "Void",
};

const typeColors: Record<ChangeOrderType, string> = {
  owner: "bg-blue-500",
  internal: "bg-orange-500",
  subcontractor: "bg-purple-500",
};

export function ChangeOrderDetail({ changeOrderId, projectId, projectSlug, customerEmail }: ChangeOrderDetailProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  const { data, isLoading } = trpc.changeOrder.getById.useQuery({ id: changeOrderId });

  const voidMutation = trpc.changeOrder.void.useMutation({
    onSuccess: () => {
      void utils.changeOrder.getById.invalidate({ id: changeOrderId });
      void utils.changeOrder.list.invalidate({ projectId });
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

  const generatePdfMutation = trpc.pdf.generateChangeOrder.useMutation({
    onSuccess: () => {
      toast.success("Change Order PDF generated and saved to document library");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate Change Order PDF");
    },
  });

  const sendToCustomerMutation = trpc.changeOrder.sendToCustomer.useMutation({
    onSuccess: () => {
      void utils.changeOrder.getById.invalidate({ id: changeOrderId });
      toast.success("Change order sent to customer");
      setSendDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to send change order");
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

  const handleGeneratePdf = () => {
    if (!data) return;
    generatePdfMutation.mutate({ projectSlug, changeOrderId });
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
  const canVoid = co.status === "approved";
  const canDelete = co.status === "draft";

  return (
    <div className="space-y-6">
      {/* Two-row header */}
      <div className="space-y-4">
        {/* Row 1: Back navigation */}
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${projectSlug}/change-orders`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Change Orders
          </Link>
        </Button>

        {/* Row 2: Name, status badge, actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{co.title}</h1>
            <StatusBadge variant={statusVariantMap[co.status as ChangeOrderStatus]}>
              {statusLabelMap[co.status as ChangeOrderStatus]}
            </StatusBadge>
            <Badge className={typeColors[co.type as ChangeOrderType]}>
              {co.type}
            </Badge>
            <span className="text-lg font-semibold text-muted-foreground">
              {displayNumber}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleGeneratePdf} disabled={generatePdfMutation.isPending}>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSendDialogOpen(true)}>
                  <Send className="h-4 w-4 mr-2" />
                  Send to Customer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild>
              <Link href={`/projects/${projectSlug}/change-orders/${co.id}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Change Order
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Additional actions row for destructive actions */}
      {(canVoid || canDelete) && (
        <div className="flex gap-2">
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
      )}

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
          <div className="relative w-full overflow-auto max-h-[400px] rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 z-20 bg-background">
                <TableRow>
                  <TableHead className="sticky left-0 z-30 bg-background min-w-[180px] border-r">
                    Cost Code
                  </TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium sticky left-0 z-10 bg-background border-r">
                      {getDivisionName(item.costCodeId)}
                    </TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={
                          Number(item.amountChange) < 0
                            ? "text-financial-negative"
                            : "text-financial-positive"
                        }
                      >
                        <CurrencyDisplay amount={Number(item.amountChange)} />
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter className="sticky bottom-0 z-20 bg-muted/50">
                <TableRow>
                  <TableCell className="sticky left-0 z-30 bg-muted/50 font-bold border-r">Total</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums font-bold">
                    <span
                      className={
                        Number(co.totalAmount) < 0
                          ? "text-financial-negative"
                          : "text-financial-positive"
                      }
                    >
                      <CurrencyDisplay amount={Number(co.totalAmount)} />
                    </span>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <ChangeOrderHistory changeOrderId={changeOrderId} />

      {/* Send to Customer Dialog */}
      <SendToCustomerDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        documentName={co.title}
        prePopulatedEmail={customerEmail}
        prePopulatedSubject={`Change Order: ${co.title}`}
        isPending={sendToCustomerMutation.isPending}
        onSend={({ recipients, subject, note }) => {
          void subject;
          void note;
          sendToCustomerMutation.mutate({ changeOrderId: co.id });
        }}
      />
    </div>
  );
}
