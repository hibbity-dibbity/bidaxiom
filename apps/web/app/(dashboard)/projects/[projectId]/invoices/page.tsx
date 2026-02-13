"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgingReportTable } from "@/components/payment-app/aging-report-table";
import { ChevronLeft } from "lucide-react";

export default function InvoicesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState("ar");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${projectId}`}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Project
          </Link>
        </Button>
      </div>

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
