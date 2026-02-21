"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { CheckCircle, XCircle, Clock, DollarSign } from "lucide-react";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const statusVariantMap: Record<string, "draft" | "pending" | "approved" | "rejected" | "cancelled" | "active"> = {
  draft: "draft",
  submitted: "pending",
  under_review: "pending",
  approved: "approved",
  rejected: "rejected",
  paid: "active",
};

interface G702FormProps {
  paymentApp: any;
}

export function G702Form({ paymentApp }: G702FormProps) {
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
            <StatusBadge variant={statusVariantMap[paymentApp.status] || "draft"}>
              <StatusIcon className="mr-1 h-3 w-3 inline" />
              {paymentApp.status.replace("_", " ")}
            </StatusBadge>
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

        {/* Paid info (read-only) */}
        {paymentApp.status === "paid" && paymentApp.paidAt && (
          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground">
              Paid on {new Date(paymentApp.paidAt).toLocaleDateString()}
            </p>
          </div>
        )}

        {(paymentApp.status === "submitted" || paymentApp.status === "under_review") && (
          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground">Approval in progress...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
