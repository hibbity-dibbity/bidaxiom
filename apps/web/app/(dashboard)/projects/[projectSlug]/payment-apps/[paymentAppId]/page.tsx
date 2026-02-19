"use client";

import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { G702Form } from "@/components/payment-app/g702-form";
import { G703Continuation } from "@/components/payment-app/g703-continuation";
import { LienWaiverTracker } from "@/components/payment-app/lien-waiver-tracker";
import { RetainageSummary } from "@/components/payment-app/retainage-summary";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaymentAppDetailPage({
  params,
}: {
  params: { projectSlug: string; paymentAppId: string };
}) {
  const { projectSlug, paymentAppId } = params;

  // Resolve project by slug (cached from layout)
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id;

  const { data: paymentApp, isLoading } = trpc.paymentApp.getById.useQuery({ id: paymentAppId });

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

  const isSimpleMode = project.projectMode === "simple";

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
        <h1 className="text-2xl font-bold">Payment Application {paymentApp.applicationNumber}</h1>
        <p className="text-muted-foreground mt-1">
          {new Date(paymentApp.periodStart).toLocaleDateString()} to{" "}
          {new Date(paymentApp.periodEnd).toLocaleDateString()}
        </p>
      </div>

      <Tabs defaultValue="summary" className="space-y-6">
        <TabsList>
          <TabsTrigger value="summary">G702 Summary</TabsTrigger>
          <TabsTrigger value="line-items">G703 Line Items</TabsTrigger>
          {!isSimpleMode && (
            <TabsTrigger value="lien-waivers">Lien Waivers</TabsTrigger>
          )}
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

        {!isSimpleMode && (
          <TabsContent value="lien-waivers">
            <LienWaiverTracker paymentAppId={paymentAppId} projectId={projectId!} />
          </TabsContent>
        )}

        <TabsContent value="retainage">
          <RetainageSummary projectId={projectId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
