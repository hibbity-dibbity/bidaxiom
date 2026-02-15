"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { G703Continuation } from "@/components/payment-app/g703-continuation";
import { ChevronLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export default function NewPaymentAppPage({
  params,
}: {
  params: { projectSlug: string };
}) {
  const { projectSlug } = params;
  const router = useRouter();

  const [periodStartDate, setPeriodStartDate] = useState("");
  const [periodEndDate, setPeriodEndDate] = useState("");
  const [lineItems, setLineItems] = useState<any[]>([]);

  // Resolve project by slug (cached from layout)
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id;

  const { data: sovItems, isLoading: sovLoading } = trpc.sov.list.useQuery({ projectId: projectId! }, { enabled: !!projectId });
  const { data: previousPaymentApps } = trpc.paymentApp.list.useQuery({ projectId: projectId! }, { enabled: !!projectId });
  const { data: changeOrders } = trpc.changeOrder.list.useQuery({ projectId: projectId! }, { enabled: !!projectId });

  const createMutation = trpc.paymentApp.create.useMutation({
    onSuccess: (data) => {
      toast.success("Payment application created");
      router.push(`/projects/${projectSlug}/payment-apps/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create payment application");
    },
  });

  // Initialize line items from SOV
  useEffect(() => {
    if (sovItems?.items) {
      const lastApprovedApp = previousPaymentApps
        ?.filter((app) => app.status === "approved")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      const items = sovItems.items.map((sovItem) => {
        const previousPercent = 0;
        const currentPercent = previousPercent;
        const scheduledValue = Number(sovItem.scheduledValue);

        const workThisPeriod = ((currentPercent - previousPercent) / 100) * scheduledValue;
        const materialsStored = 0;
        const totalCompleted = (currentPercent / 100) * scheduledValue + materialsStored;
        const balanceToFinish = scheduledValue - totalCompleted;

        const retainagePercent = 10;
        const retainageAmount = (retainagePercent / 100) * totalCompleted;

        return {
          sovItemId: sovItem.id,
          sovItemNumber: sovItem.itemNumber,
          sovDescription: sovItem.description,
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

      setLineItems(items);
    }
  }, [sovItems, previousPaymentApps]);

  const handleLineItemChange = (index: number, field: "currentPercent" | "materialsStored", value: number) => {
    const newLineItems = [...lineItems];
    const item = { ...newLineItems[index] };

    if (field === "currentPercent") {
      item.currentPercent = value;
    } else if (field === "materialsStored") {
      item.materialsStored = value;
    }

    item.workThisPeriod = ((item.currentPercent - item.previousPercent) / 100) * item.scheduledValue;
    item.totalCompleted = (item.currentPercent / 100) * item.scheduledValue + item.materialsStored;
    item.balanceToFinish = item.scheduledValue - item.totalCompleted;
    item.retainageAmount = (item.retainagePercent / 100) * item.totalCompleted;

    newLineItems[index] = item;
    setLineItems(newLineItems);
  };

  const handleSubmit = () => {
    if (!periodStartDate || !periodEndDate) {
      toast.error("Period dates are required");
      return;
    }

    const hasErrors = lineItems.some((item) => item.currentPercent < item.previousPercent);
    if (hasErrors) {
      toast.error("Current percent cannot be less than previous percent");
      return;
    }

    createMutation.mutate({
      projectId: projectId!,
      periodStart: new Date(periodStartDate).toISOString(),
      periodEnd: new Date(periodEndDate).toISOString(),
      lineItems: lineItems.map((item) => ({
        sovItemId: item.sovItemId,
        currentPercentComplete: item.currentPercent,
        materialsStoredThisPeriod: item.materialsStored,
      })),
    });
  };

  const originalContractSum = lineItems.reduce((sum, item) => sum + item.scheduledValue, 0);
  const approvedChangeOrders = changeOrders?.filter((co) => co.status === "approved") || [];
  const netChangeByChangeOrders = approvedChangeOrders.reduce(
    (sum, co) => sum + Number(co.totalAmount || 0),
    0
  );
  const contractSumToDate = originalContractSum + netChangeByChangeOrders;

  const totalCompletedAndStored = lineItems.reduce((sum, item) => sum + item.totalCompleted, 0);
  const retainageAmount = lineItems.reduce((sum, item) => sum + item.retainageAmount, 0);
  const totalEarnedLessRetainage = totalCompletedAndStored - retainageAmount;

  const previousPayments = previousPaymentApps
    ?.filter((app) => app.status === "approved" || app.status === "paid")
    .reduce((sum, app) => sum + Number(app.currentPaymentDue || 0), 0) || 0;

  const currentPaymentDue = totalEarnedLessRetainage - previousPayments;
  const balanceToFinish = contractSumToDate - totalCompletedAndStored;

  if (sovLoading) {
    return (
      <div className="p-6">
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!sovItems?.items || sovItems.items.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No Schedule of Values found. Please set up the SOV before creating a payment application.
            <Link
              href={`/projects/${projectSlug}/sov`}
              className="ml-2 font-medium underline underline-offset-4"
            >
              Set up SOV
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

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

      <div>
        <h1 className="text-2xl font-bold">New Payment Application</h1>
        <p className="text-muted-foreground mt-1">
          Create a new AIA G702/G703 payment application
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Billing Period</CardTitle>
          <CardDescription>Select the date range for this payment application</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="period-start">Period Start Date</Label>
              <Input
                id="period-start"
                type="date"
                value={periodStartDate}
                onChange={(e) => setPeriodStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period-end">Period End Date</Label>
              <Input
                id="period-end"
                type="date"
                value={periodEndDate}
                onChange={(e) => setPeriodEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AIA G702 - Application and Certificate for Payment</CardTitle>
          <CardDescription>Summary of payment application</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">1. Original Contract Sum:</span>
              <span className="font-mono">{currencyFormatter.format(originalContractSum)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">2. Net Change by Change Orders:</span>
              <span className="font-mono">{currencyFormatter.format(netChangeByChangeOrders)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-muted-foreground">3. Contract Sum to Date (1 + 2):</span>
              <span className="font-mono">{currencyFormatter.format(contractSumToDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">4. Total Completed & Stored:</span>
              <span className="font-mono">{currencyFormatter.format(totalCompletedAndStored)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">5. Retainage:</span>
              <span className="font-mono">{currencyFormatter.format(retainageAmount)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-muted-foreground">6. Total Earned Less Retainage (4 - 5):</span>
              <span className="font-mono">{currencyFormatter.format(totalEarnedLessRetainage)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">7. Less Previous Payments:</span>
              <span className="font-mono">{currencyFormatter.format(previousPayments)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>8. Current Payment Due (6 - 7):</span>
              <span className="font-mono">{currencyFormatter.format(currentPaymentDue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">9. Balance to Finish (3 - 6):</span>
              <span className="font-mono">{currencyFormatter.format(balanceToFinish)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AIA G703 - Continuation Sheet</CardTitle>
          <CardDescription>Enter percent complete for each line item</CardDescription>
        </CardHeader>
        <CardContent>
          <G703Continuation
            lineItems={lineItems}
            editable
            onLineItemChange={handleLineItemChange}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button variant="outline" asChild>
          <Link href={`/projects/${projectSlug}/payment-apps`}>Cancel</Link>
        </Button>
        <Button onClick={handleSubmit} disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creating..." : "Create Payment Application"}
        </Button>
      </div>
    </div>
  );
}
