"use client";

import type { LifecyclePhase } from "@construction/shared";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useQueryState, useQueryStates, parseAsString, parseAsInteger, parseAsStringEnum, parseAsArrayOf } from "nuqs";
import { ProjectsTable } from "./components/projects-table";
import { ProjectsFilters, type FilterState } from "./components/projects-filters";
import { PageHeader } from "@/components/shared/page-header";

const PHASES: LifecyclePhase[] = ['opportunity', 'estimating', 'submitted', 'awarded', 'active', 'substantial_completion', 'closed', 'warranty', 'archived', 'on_hold', 'lost'];

export default function ProjectsPage() {
  const { orgRole } = useAuth();
  const canFilterLists = !orgRole || ["org:admin", "org:project_manager", "org:accountant", "org:estimator"].includes(orgRole);
  const canCreate = !orgRole || orgRole === "org:admin" || orgRole === "org:project_manager";
  // Set up filter state using nuqs
  const [filters, setFilters] = useQueryStates({
    search: parseAsString,
    customer: parseAsString,
    phases: parseAsArrayOf(parseAsStringEnum<LifecyclePhase>(PHASES)),
    phaseMode: parseAsStringEnum<'show' | 'hide'>(['show', 'hide']),
    assignedUser: parseAsString,
    startDateFrom: parseAsString,
    startDateTo: parseAsString,
    page: parseAsInteger.withDefault(1),
  });

  const pageSize = 50;

  // Sorting happens on the server so it covers every project, not just the page on screen.
  const [sortBy, setSortBy] = useQueryState("sort", parseAsStringEnum(["jobNumber", "name", "customerName", "lifecyclePhase", "startDate", "createdAt"]).withDefault("createdAt"));
  const [sortOrder, setSortOrder] = useQueryState("dir", parseAsStringEnum(["asc", "desc"]).withDefault("desc"));

  // Call project.list with filter values mapped from nuqs state
  const { data, isLoading } = trpc.project.list.useQuery({
    search: filters.search ?? undefined,
    customerId: filters.customer ?? undefined,
    lifecyclePhases: filters.phases?.length && filters.phaseMode !== 'hide' ? filters.phases : undefined,
    excludeLifecyclePhases: filters.phases?.length && filters.phaseMode === 'hide' ? filters.phases : undefined,
    assignedUserId: filters.assignedUser ?? undefined,
    startDateFrom: filters.startDateFrom ? new Date(filters.startDateFrom).toISOString() : undefined,
    startDateTo: filters.startDateTo ? new Date(filters.startDateTo).toISOString() : undefined,
    sortBy,
    sortOrder,
    limit: pageSize,
    offset: ((filters.page ?? 1) - 1) * pageSize,
  });

  // Fetch customer list and user list for filter dropdowns
  const { data: customersData } = trpc.customer.list.useQuery({ sortBy: "customer", sortOrder: "asc", limit: 2000, offset: 0 }, { enabled: canFilterLists, retry: false });
  const { data: usersData } = trpc.user.list.useQuery({ limit: 100, offset: 0 }, { enabled: canFilterLists, retry: false });

  // Compute isFiltered — any secondary filter or search active
  const isFiltered = !!(
    filters.search ||
    filters.customer ||
    filters.phases?.length ||
    filters.assignedUser ||
    filters.startDateFrom ||
    filters.startDateTo
  );

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setFilters({ page: newPage });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Your jobs from opportunity through closeout"
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/projects/new">
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* Filters */}
      <ProjectsFilters
        filters={filters}
        setFilters={setFilters}
        customers={customersData?.items || []}
        users={usersData?.items || []}
        summary={isLoading ? undefined : `${data?.total ?? 0} shown`}
      />

      {/* Table */}
      <ProjectsTable
        data={data?.items || []}
        isLoading={isLoading}
        total={data?.total || 0}
        page={filters.page ?? 1}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={(by, dir) => {
          setSortBy(by);
          setSortOrder(dir);
          setFilters({ page: 1 });
        }}
        isFiltered={isFiltered}
        canCreate={canCreate}
      />
    </div>
  );
}
