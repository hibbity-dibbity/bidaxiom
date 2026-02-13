'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Download, Calendar, RefreshCw, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ReportViewer } from '@/components/reports/report-viewer';
import { ExportDialog } from '@/components/reports/export-dialog';
import { ScheduleDialog } from '@/components/reports/schedule-dialog';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

export default function ReportDetailPage({ params }: { params: { reportId: string } }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: report, isLoading } = trpc.report.getById.useQuery({
    id: params.reportId,
  });

  const deleteMutation = trpc.report.delete.useMutation({
    onSuccess: () => {
      toast.success('Report deleted successfully');
      router.push('/reports');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete report');
    },
  });

  const handleRefresh = () => {
    utils.report.execute.invalidate({ id: params.reportId });
    toast.success('Report data refreshed');
  };

  const handleDelete = () => {
    deleteMutation.mutate({ id: params.reportId });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded w-1/3" />
        <div className="h-64 bg-muted animate-pulse rounded-md" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Report not found
      </div>
    );
  }

  const formatReportType = (type: string) => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

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
      </div>

      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{report.name}</h1>
            <Badge>{formatReportType(report.type)}</Badge>
          </div>
          {report.description && (
            <p className="text-muted-foreground mt-2">{report.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExportDialogOpen(true)}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setScheduleDialogOpen(true)}>
            <Calendar className="mr-2 h-4 w-4" />
            Schedule
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Report Viewer */}
      <ReportViewer reportId={params.reportId} />

      {/* Export Dialog */}
      <ExportDialog
        reportId={params.reportId}
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
      />

      {/* Schedule Dialog */}
      <ScheduleDialog
        reportDefinitionId={params.reportId}
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this report? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
