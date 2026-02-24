"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { G702Form } from "@/components/payment-app/g702-form";
import { G703Continuation } from "@/components/payment-app/g703-continuation";
import { LienWaiverTracker } from "@/components/payment-app/lien-waiver-tracker";
import { RetainageSummary } from "@/components/payment-app/retainage-summary";
import { ChevronLeft, FileDown, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function PaymentAppDetailPage({
  params,
}: {
  params: { projectSlug: string; paymentAppId: string };
}) {
  const { projectSlug, paymentAppId } = params;
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  // Resolve project by slug (cached from layout)
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id;

  const { data: paymentApp, isLoading } = trpc.paymentApp.getById.useQuery({ id: paymentAppId });

  const utils = trpc.useUtils();

  const generatePdfMutation = trpc.pdf.generatePaymentApp.useMutation({
    onSuccess: () => {
      toast.success("Payment Application PDF (AIA G702/G703) saved to document library");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const submitMutation = trpc.paymentApp.submit.useMutation({
    onSuccess: () => {
      utils.paymentApp.getById.invalidate({ id: paymentAppId });
      toast.success("Payment application submitted for approval");
      setSubmitDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit payment application");
    },
  });

  const markPaidMutation = trpc.paymentApp.markPaid.useMutation({
    onSuccess: () => {
      utils.paymentApp.getById.invalidate({ id: paymentAppId });
      toast.success("Payment application marked as paid");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to mark as paid");
    },
  });

  const handleSubmitForApproval = () => {
    submitMutation.mutate({
      paymentAppId,
      approvalSteps: [{ stepOrder: 1, approverRole: "org:admin", requirementType: "all" }],
    });
  };

  const handleMarkAsPaid = () => {
    if (confirm("Mark this payment application as paid?")) {
      markPaidMutation.mutate({ paymentAppId });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!paymentApp) {
    return (
      <div className="p-6">
        <p className="text-center text-muted-foreground">Payment application not found</p>
      </div>
    );
  }

  const g703LineItems = (paymentApp.lineItems || []).map((item: any) => {
    const scheduledValue = Number(item.sovItem?.scheduledValue || 0);
    const previousPercent = Number(item.previousPercentComplete || 0);
    const currentPercent = Number(item.currentPercentComplete || 0);
    const materialsStored = Number(item.materialsStoredThisPeriod || 0);

    const workThisPeriod = ((currentPercent - previousPercent) / 100) * scheduledValue;
    const totalCompleted = (currentPercent / 100) * scheduledValue + materialsStored;
    const balanceToFinish = scheduledValue - totalCompleted;

    const retainagePercent = 10;
    const retainageAmount = (retainagePercent / 100) * totalCompleted;

    return {
      sovItemNumber: item.sovItem?.itemNumber || 0,
      sovDescription: item.sovItem?.description || "",
      scheduledValue,
      previousPercent,
      currentPercent,
      workThisPeriod,
      materialsStored,
      totalCompleted,
      retainagePercent,
      retainageAmount,
      balanceToFinish,
    };
  });

  if (!project) {
    return null; // Layout handles loading/error states
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${projectSlug}/payment-apps`}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Payment Apps
          </Link>
        </Button>
      </div>

      {/* Header with action buttons — VISUAL-03 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payment Application {paymentApp.applicationNumber}</h1>
          <p className="text-muted-foreground mt-1">
            {new Date(paymentApp.periodStart).toLocaleDateString()} to{" "}
            {new Date(paymentApp.periodEnd).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {paymentApp.status === "draft" && (
            <Button variant="default" onClick={() => setSubmitDialogOpen(true)}>
              Submit for Approval
            </Button>
          )}
          {paymentApp.status === "approved" && !paymentApp.paidAt && (
            <Button
              variant="default"
              onClick={handleMarkAsPaid}
              disabled={markPaidMutation.isPending}
            >
              {markPaidMutation.isPending ? "Marking..." : "Mark as Paid"}
            </Button>
          )}
          <Button
            variant="outline"
            disabled={generatePdfMutation.isPending}
            onClick={() =>
              generatePdfMutation.mutate({
                projectSlug,
                paymentAppId,
              })
            }
          >
            {generatePdfMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Generate AIA G702/G703 PDF
          </Button>
        </div>
      </div>

      <Tabs defaultValue="summary" className="space-y-6">
        <TabsList>
          <TabsTrigger value="summary">G702 Summary</TabsTrigger>
          <TabsTrigger value="line-items">G703 Line Items</TabsTrigger>
          <TabsTrigger value="retainage">Retainage</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <G702Form paymentApp={paymentApp} />
        </TabsContent>

        <TabsContent value="line-items">
          <Card>
            <CardHeader>
              <CardTitle>AIA G703 - Continuation Sheet</CardTitle>
              <CardDescription>Line item detail for this payment application</CardDescription>
            </CardHeader>
            <CardContent>
              <G703Continuation lineItems={g703LineItems} editable={false} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="retainage">
          <RetainageSummary projectId={projectId!} />
        </TabsContent>
      </Tabs>

      {/* Submit for Approval Dialog */}
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
            <Button onClick={handleSubmitForApproval} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
