"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgingReportTable } from "@/components/payment-app/aging-report-table";
import { PageHeader } from "@/components/shared/page-header";

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
      <PageHeader
        title="Invoices"
        description="Accounts receivable and payable aging for this project"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="ar">Accounts Receivable</TabsTrigger>
          <TabsTrigger value="ap">Accounts Payable</TabsTrigger>
        </TabsList>

        <TabsContent value="ar">
          <AgingReportTable type="ar" projectId={projectId} />
        </TabsContent>

        <TabsContent value="ap">
          <AgingReportTable type="ap" projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
