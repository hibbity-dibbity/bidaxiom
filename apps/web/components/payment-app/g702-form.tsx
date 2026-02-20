"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, DollarSign } from "lucide-react";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const statusColors: Record<string, string> = {
  draft: "bg-gray-500/10 text-gray-700 border-gray-200",
  submitted: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  under_review: "bg-orange-500/10 text-orange-700 border-orange-200",
  approved: "bg-green-500/10 text-green-700 border-green-200",
  rejected: "bg-red-500/10 text-red-700 border-red-200",
  paid: "bg-blue-500/10 text-blue-700 border-blue-200",
};

interface G702FormProps {
  paymentApp: any;
}

export function G702Form({ paymentApp }: G702FormProps) {
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  const utils = trpc.useUtils();

  const submitMutation = trpc.paymentApp.submit.useMutation({
    onSuccess: () => {
      utils.paymentApp.getById.invalidate({ id: paymentApp.id });
      toast.success("Payment application submitted for approval");
      setSubmitDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit payment application");
    },
  });

  const markPaidMutation = trpc.paymentApp.markPaid.useMutation({
    onSuccess: () => {
      utils.paymentApp.getById.invalidate({ id: paymentApp.id });
      toast.success("Payment application marked as paid");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to mark as paid");
    },
  });

  const handleSubmit = () => {
    submitMutation.mutate({
      paymentAppId: paymentApp.id,
      approvalSteps: [{ stepOrder: 1, approverRole: "org:admin", requirementType: "all" }],
    });
  };

  const handleMarkPaid = () => {
    if (confirm("Mark this payment application as paid?")) {
      markPaidMutation.mutate({ paymentAppId: paymentApp.id });
    }
  };

  const StatusIcon = paymentApp.status === "approved"
    ? CheckCircle
    : paymentApp.status === "rejected"
    ? XCircle
    : Clock;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>AIA G702 - Application and Certificate for Payment</CardTitle>
            <CardDescription>Application Number: {paymentApp.applicationNumber}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusColors[paymentApp.status] || "bg-gray-500/10 text-gray-700"} variant="outline">
              <StatusIcon className="mr-1 h-3 w-3" />
              {paymentApp.status.replace("_", " ")}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Project Info Section */}
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground">Period</h3>
          <p className="text-sm">
            {new Date(paymentApp.periodStart).toLocaleDateString()} to{" "}
            {new Date(paymentApp.periodEnd).toLocaleDateString()}
          </p>
        </div>

        {/* Contract Summary (G702 numbered items) */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="font-semibold mb-3">Contract Summary</h3>

          <div className="grid gap-2 text-sm">
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">1. Original Contract Sum</span>
              <span className="font-mono">{currencyFormatter.format(Number(paymentApp.originalContractSum))}</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">2. Net Change by Change Orders</span>
              <span className="font-mono">{currencyFormatter.format(Number(paymentApp.netChangeByChangeOrders))}</span>
            </div>

            <div className="flex justify-between items-center py-1 font-medium border-t">
              <span className="text-muted-foreground">3. Contract Sum to Date (1 + 2)</span>
              <span className="font-mono">{currencyFormatter.format(Number(paymentApp.contractSumToDate))}</span>
            </div>

            <div className="flex justify-between items-center py-1 mt-3">
              <span className="text-muted-foreground">4. Total Completed & Stored to Date</span>
              <span className="font-mono">{currencyFormatter.format(Number(paymentApp.totalCompletedAndStored))}</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">5. Retainage</span>
              <span className="font-mono">{currencyFormatter.format(Number(paymentApp.retainageAmount))}</span>
            </div>

            <div className="flex justify-between items-center py-1 font-medium border-t">
              <span className="text-muted-foreground">6. Total Earned Less Retainage (4 - 5)</span>
              <span className="font-mono">{currencyFormatter.format(Number(paymentApp.totalEarnedLessRetainage))}</span>
            </div>

            <div className="flex justify-between items-center py-1 mt-3">
              <span className="text-muted-foreground">7. Less Previous Certificates for Payment</span>
              <span className="font-mono">{currencyFormatter.format(Number(paymentApp.previousPayments))}</span>
            </div>

            <div className="flex justify-between items-center py-3 text-lg font-bold bg-primary/5 px-4 rounded-lg border-2">
              <span className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                8. Current Payment Due (6 - 7)
              </span>
              <span className="font-mono">{currencyFormatter.format(Number(paymentApp.currentPaymentDue))}</span>
            </div>

            <div className="flex justify-between items-center py-1 mt-3">
              <span className="text-muted-foreground">9. Balance to Finish Including Retainage (3 - 6)</span>
              <span className="font-mono">{currencyFormatter.format(Number(paymentApp.balanceToFinish))}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 border-t pt-4">
          {paymentApp.status === "draft" && (
            <Button onClick={() => setSubmitDialogOpen(true)}>
              Submit for Approval
            </Button>
          )}

          {paymentApp.status === "approved" && !paymentApp.paidAt && (
            <Button onClick={handleMarkPaid} disabled={markPaidMutation.isPending}>
              {markPaidMutation.isPending ? "Marking..." : "Mark as Paid"}
            </Button>
          )}

          {paymentApp.status === "paid" && paymentApp.paidAt && (
            <p className="text-sm text-muted-foreground">
              Paid on {new Date(paymentApp.paidAt).toLocaleDateString()}
            </p>
          )}

          {paymentApp.status === "rejected" && (
            <Button variant="outline" disabled>
              Edit & Resubmit
            </Button>
          )}

          {(paymentApp.status === "submitted" || paymentApp.status === "under_review") && (
            <p className="text-sm text-muted-foreground">Approval in progress...</p>
          )}
        </div>
      </CardContent>

      {/* Submit Dialog */}
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit for Approval</DialogTitle>
            <DialogDescription>
              Submit this payment application for approval workflow
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              This payment application will be submitted to the configured approval workflow.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
