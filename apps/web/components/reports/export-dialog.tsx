'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface ExportDialogProps {
  reportId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportFormat = 'pdf' | 'excel' | 'csv';
type PageOrientation = 'portrait' | 'landscape';

export function ExportDialog({ reportId, open, onOpenChange }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [orientation, setOrientation] = useState<PageOrientation>('portrait');

  const exportMutation = trpc.reportExport.export.useMutation({
    onSuccess: (data: any) => {
      // Open download URL in new tab
      window.open(data.downloadUrl, '_blank');
      toast.success('Export started - Download will start shortly');
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to export report');
    },
  });

  const handleExport = () => {
    exportMutation.mutate({
      reportId,
      format,
      options: {
        includeCharts: format === 'pdf' ? includeCharts : undefined,
        pageOrientation: format === 'pdf' ? orientation : undefined,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Report</DialogTitle>
          <DialogDescription>
            Choose the export format and options for your report.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label>Export Format</Label>
            <RadioGroup value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf" id="format-pdf" />
                <Label htmlFor="format-pdf" className="font-normal">
                  PDF - Best for sharing and printing
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="excel" id="format-excel" />
                <Label htmlFor="format-excel" className="font-normal">
                  Excel - Best for further analysis
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="format-csv" />
                <Label htmlFor="format-csv" className="font-normal">
                  CSV - Simple data export
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* PDF Options */}
          {format === 'pdf' && (
            <div className="space-y-4 rounded-md border p-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-charts"
                  checked={includeCharts}
                  onCheckedChange={(checked) => setIncludeCharts(checked as boolean)}
                />
                <Label htmlFor="include-charts" className="font-normal">
                  Include charts
                </Label>
              </div>

              <div className="space-y-2">
                <Label>Page Orientation</Label>
                <RadioGroup
                  value={orientation}
                  onValueChange={(value) => setOrientation(value as PageOrientation)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="portrait" id="orientation-portrait" />
                    <Label htmlFor="orientation-portrait" className="font-normal">
                      Portrait
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="landscape" id="orientation-landscape" />
                    <Label htmlFor="orientation-landscape" className="font-normal">
                      Landscape
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exportMutation.isPending}>
            <Download className="mr-2 h-4 w-4" />
            {exportMutation.isPending ? 'Exporting...' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
