"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useQueryStates, parseAsString, parseAsInteger, parseAsStringEnum } from "nuqs";
import { ProjectsTable } from "./components/projects-table";
import { ProjectsFilters } from "./components/projects-filters";

export default function ProjectsPage() {
  // Set up filter state using nuqs
  const [filters, setFilters] = useQueryStates({
    search: parseAsString,
    customer: parseAsString,
    status: parseAsStringEnum(['active', 'on_hold', 'completed', 'archived']),
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
    status: filters.status ?? undefined,
    assignedUserId: filters.assignedUser ?? undefined,
    startDateFrom: filters.startDateFrom ? new Date(filters.startDateFrom).toISOString() : undefined,
    startDateTo: filters.startDateTo ? new Date(filters.startDateTo).toISOString() : undefined,
    limit: pageSize,
    offset: ((filters.page ?? 1) - 1) * pageSize,
  });

  // Fetch customer list and user list for filter dropdowns
  const { data: customersData } = trpc.customer.list.useQuery({ limit: 100, offset: 0 });
  const { data: usersData } = trpc.user.list.useQuery({ limit: 100, offset: 0 });

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setFilters({ page: newPage });
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
      />
    </div>
  );
}
