'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

export default function ReportTemplatesPage() {
  const router = useRouter();
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [customizeName, setCustomizeName] = useState('');
  const utils = trpc.useUtils();

  const { data: templates, isLoading } = trpc.report.listTemplates.useQuery({});

  const createFromTemplateMutation = trpc.report.createFromTemplate.useMutation({
    onSuccess: (data: any) => {
      toast.success('Report created from template');
      router.push(`/reports/${data.id}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create report from template');
    },
  });

  const handleUseTemplate = (template: any) => {
    setSelectedTemplate(template);
    setCustomizeName(template.name);
  };

  const handleConfirmCreate = () => {
    if (!selectedTemplate) return;

    createFromTemplateMutation.mutate({
      templateId: selectedTemplate.id,
      name: customizeName || selectedTemplate.name,
    });
  };

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
        <span className="mx-2">/</span>
        <span>Templates</span>
      </div>

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Report Templates</h1>
        <p className="text-muted-foreground mt-1">
          Choose from pre-built templates to quickly create reports
        </p>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
      ) : templates && templates.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {template.name}
                    </CardTitle>
                    {template.description && (
                      <CardDescription className="mt-2">{template.description}</CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={template.isSystem ? 'default' : 'secondary'}>
                      {template.isSystem ? 'System' : 'Custom'}
                    </Badge>
                    <Badge variant="outline">{formatReportType(template.type)}</Badge>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => handleUseTemplate(template)}
                  >
                    Use Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-12 text-center">
          <h3 className="text-lg font-medium">No templates available</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Check back later for pre-built report templates.
          </p>
        </div>
      )}

      {/* Customize Template Dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customize Report</DialogTitle>
            <DialogDescription>
              Customize the report name before creating from template
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="report-name">Report Name</Label>
              <Input
                id="report-name"
                value={customizeName}
                onChange={(e) => setCustomizeName(e.target.value)}
                placeholder="Enter report name"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmCreate}
              disabled={!customizeName || createFromTemplateMutation.isPending}
            >
              {createFromTemplateMutation.isPending ? 'Creating...' : 'Create Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
