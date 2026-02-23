"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useQueryStates, parseAsString, parseAsInteger, parseAsStringEnum } from "nuqs";
import { ProjectsTable } from "./components/projects-table";
import { ProjectsFilters, type FilterState } from "./components/projects-filters";
import { useAuth } from "@/lib/auth-context";

export default function ProjectsPage() {
  const { orgRole } = useAuth();
  const isAdmin = orgRole === "org:admin";
  const utils = trpc.useUtils();

  // Set up filter state using nuqs
  const [filters, setFilters] = useQueryStates({
    search: parseAsString,
    customer: parseAsString,
    lifecyclePhase: parseAsStringEnum(['opportunity', 'estimating', 'submitted', 'awarded', 'active', 'substantial_completion', 'closed', 'warranty', 'archived']),
    assignedUser: parseAsString,
    startDateFrom: parseAsString,
    startDateTo: parseAsString,
    page: parseAsInteger.withDefault(1),
  });

  const pageSize = 50;

  // Call project.list with filter values mapped from nuqs state
  const { data, isLoading } = trpc.project.list.useQuery({
    search: filters.search ?? undefined,
    customerId: filters.customer ?? undefined,
    lifecyclePhase: filters.lifecyclePhase ?? undefined,
    assignedUserId: filters.assignedUser ?? undefined,
    startDateFrom: filters.startDateFrom ? new Date(filters.startDateFrom).toISOString() : undefined,
    startDateTo: filters.startDateTo ? new Date(filters.startDateTo).toISOString() : undefined,
    limit: pageSize,
    offset: ((filters.page ?? 1) - 1) * pageSize,
  });

  // Fetch customer list and user list for filter dropdowns
  const { data: customersData } = trpc.customer.list.useQuery({ limit: 100, offset: 0 });
  const { data: usersData } = trpc.user.list.useQuery({ limit: 100, offset: 0 });

  // Compute isFiltered — any secondary filter or search active
  const isFiltered = !!(
    filters.search ||
    filters.customer ||
    filters.lifecyclePhase ||
    filters.assignedUser ||
    filters.startDateFrom ||
    filters.startDateTo
  );

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setFilters({ page: newPage });
  };

  // Invalidate project list after deletion so deleted row disappears immediately
  const handleProjectDeleted = () => {
    utils.project.list.invalidate();
  };

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <ProjectsFilters
        filters={filters}
        setFilters={setFilters}
        customers={customersData?.items || []}
        users={usersData?.items || []}
      />

      {/* Table */}
      <ProjectsTable
        data={data?.items || []}
        isLoading={isLoading}
        total={data?.total || 0}
        page={filters.page ?? 1}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        isAdmin={isAdmin}
        onDelete={handleProjectDeleted}
        isFiltered={isFiltered}
      />
    </div>
  );
}
