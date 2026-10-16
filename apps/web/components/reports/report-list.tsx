'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreVertical, Eye, Download, Calendar, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { ExportDialog } from './export-dialog';
import { ScheduleDialog } from './schedule-dialog';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface Report {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  dataSource: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface ReportListProps {
  reports: Report[];
  loading?: boolean;
  onReportClick?: (reportId: string) => void;
}

export function ReportList({ reports, loading, onReportClick }: ReportListProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const deleteMutation = trpc.report.delete.useMutation({
    onSuccess: () => {
      toast.success('Report deleted successfully');
      utils.report.list.invalidate();
      setDeleteDialogOpen(false);
      setReportToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete report');
    },
  });

  const handleView = (reportId: string) => {
    if (onReportClick) {
      onReportClick(reportId);
    } else {
      router.push(`/reports/${reportId}`);
    }
  };

  const handleExport = (reportId: string) => {
    setSelectedReportId(reportId);
    setExportDialogOpen(true);
  };

  const handleSchedule = (reportId: string) => {
    setSelectedReportId(reportId);
    setScheduleDialogOpen(true);
  };

  const handleDelete = (reportId: string) => {
    setReportToDelete(reportId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (reportToDelete) {
      deleteMutation.mutate({ id: reportToDelete });
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'custom':
        return 'secondary';
      case 'project_status':
      case 'budget_variance':
        return 'default';
      default:
        return 'outline';
    }
  };

  const formatReportType = (type: string) => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="space-y-2">
              <div className="h-5 bg-muted rounded" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </CardHeader>
            <CardContent>
              <div className="h-4 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center">
        <h3 className="text-lg font-medium">No reports yet</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Create your first report or choose from templates.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Card key={report.id} className="hover:bg-muted/50 transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{report.name}</CardTitle>
                  {report.description && (
                    <CardDescription className="mt-1">{report.description}</CardDescription>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleView(report.id)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport(report.id)}>
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSchedule(report.id)}>
                      <Calendar className="mr-2 h-4 w-4" />
                      Schedule
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(report.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Badge variant={getTypeBadgeVariant(report.type) as any}>
                    {formatReportType(report.type)}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    Data source: {formatReportType(report.dataSource)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    Updated {format(new Date(report.updatedAt), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Export Dialog */}
      {selectedReportId && (
        <ExportDialog
          reportId={selectedReportId}
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
        />
      )}

      {/* Schedule Dialog */}
      {selectedReportId && (
        <ScheduleDialog
          reportDefinitionId={selectedReportId}
          open={scheduleDialogOpen}
          onOpenChange={setScheduleDialogOpen}
        />
      )}

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
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
