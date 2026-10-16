'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReportList } from '@/components/reports/report-list';
import { trpc } from '@/lib/trpc';

export default function ReportsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>();

  const { data: reports, isLoading } = trpc.report.list.useQuery({
    type: typeFilter,
  });

  const filteredReports = reports?.filter((report) =>
    report.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground mt-1">
            Create, view, and manage your custom reports
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/reports/templates')}
          >
            <FileText className="mr-2 h-4 w-4" />
            Browse Templates
          </Button>
          <Button onClick={() => router.push('/reports/create')}>
            <Plus className="mr-2 h-4 w-4" />
            New Report
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Type Filter Tabs */}
      <Tabs value={typeFilter || 'all'} onValueChange={(val) => setTypeFilter(val === 'all' ? undefined : val)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="project_status">Project Status</TabsTrigger>
          <TabsTrigger value="budget_variance">Budget Variance</TabsTrigger>
          <TabsTrigger value="change_order_summary">Change Orders</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Reports List */}
      <ReportList reports={filteredReports || []} loading={isLoading} />
    </div>
  );
}
