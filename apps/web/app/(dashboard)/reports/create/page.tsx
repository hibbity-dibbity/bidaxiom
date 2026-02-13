'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReportBuilder } from '@/components/reports/report-builder';

export default function CreateReportPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-muted-foreground">
        <button
          onClick={() => router.push('/reports')}
          className="hover:text-foreground flex items-center"
        >
          <ChevronLeft className="h-4 w-4" />
          Reports
        </button>
        <span className="mx-2">/</span>
        <span>Create</span>
      </div>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Create Report</h1>
          <p className="text-muted-foreground mt-1">
            Build a custom report with drag-and-drop interface
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push('/reports')}>
          Cancel
        </Button>
      </div>

      {/* Report Builder */}
      <ReportBuilder onSuccess={(reportId) => router.push(`/reports/${reportId}`)} />
    </div>
  );
}
