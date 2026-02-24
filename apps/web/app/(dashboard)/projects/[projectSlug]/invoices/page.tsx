"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgingReportTable } from "@/components/payment-app/aging-report-table";

export default function InvoicesPage({
  params,
}: {
  params: { projectSlug: string };
}) {
  const { projectSlug } = params;
  const [activeTab, setActiveTab] = useState("ar");

  // Resolve project by slug (cached from layout)
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id;

  if (!project) {
    return null; // Layout handles loading/error states
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invoice Tracking</h1>
        <p className="text-muted-foreground mt-1">
          Accounts receivable and payable aging reports
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="ar">Accounts Receivable</TabsTrigger>
          <TabsTrigger value="ap">Accounts Payable</TabsTrigger>
        </TabsList>

        <TabsContent value="ar">
          <AgingReportTable type="ar" />
        </TabsContent>

        <TabsContent value="ap">
          <AgingReportTable type="ap" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
