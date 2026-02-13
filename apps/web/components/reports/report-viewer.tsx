'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChartPreview } from './chart-preview';
import { trpc } from '@/lib/trpc';
import { formatCurrency, formatDate } from '@/lib/utils/chart-config';

interface ReportViewerProps {
  reportId: string;
}

export function ReportViewer({ reportId }: ReportViewerProps) {
  const [page, setPage] = useState(0);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const rowsPerPage = 50;

  const { data: reportDef, isLoading: defLoading } = trpc.report.getById.useQuery({
    id: reportId,
  });

  const { data: reportData, isLoading: dataLoading } = trpc.report.execute.useQuery(
    { id: reportId },
    { enabled: !!reportDef }
  );

  const isLoading = defLoading || dataLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-64 bg-muted animate-pulse rounded-md" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (!reportDef || !reportData) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        No data available
      </div>
    );
  }

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort and paginate data
  let sortedData = [...(reportData.data || [])];
  if (sortColumn) {
    sortedData.sort((a: any, b: any) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const totalPages = Math.ceil(sortedData.length / rowsPerPage);
  const paginatedData = sortedData.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  const formatCellValue = (value: any, field: string) => {
    if (value === null || value === undefined) return '-';

    // Try to determine type from field name
    if (field.toLowerCase().includes('amount') || field.toLowerCase().includes('cost')) {
      return formatCurrency(Number(value));
    }
    if (field.toLowerCase().includes('date') || field.toLowerCase().includes('at')) {
      return formatDate(value);
    }

    return String(value);
  };

  return (
    <div className="space-y-6">
      {/* Chart Section */}
      {reportDef.chartConfig && reportDef.chartConfig.chartType !== 'table' && (
        <div>
          <h3 className="text-lg font-medium mb-4">Visualization</h3>
          <ChartPreview chartConfig={reportDef.chartConfig as any} data={reportData.data || []} />
        </div>
      )}

      {/* Data Table Section */}
      <div>
        <h3 className="text-lg font-medium mb-4">Data</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {(reportDef.columns || []).map((col: any) => (
                  <TableHead
                    key={col.field}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort(col.field)}
                  >
                    <div className="flex items-center gap-2">
                      {col.label}
                      {sortColumn === col.field && (
                        <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={(reportDef.columns || []).length}
                    className="text-center text-muted-foreground"
                  >
                    No data available
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row: any, idx: number) => (
                  <TableRow key={idx}>
                    {(reportDef.columns || []).map((col: any) => (
                      <TableCell key={col.field}>
                        {formatCellValue(row[col.field], col.field)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {page * rowsPerPage + 1} to {Math.min((page + 1) * rowsPerPage, sortedData.length)} of{' '}
              {sortedData.length} rows
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages - 1}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
