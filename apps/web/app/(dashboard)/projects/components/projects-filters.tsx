"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { FilterChips, type FilterChip } from "@/components/shared/filter-chips";

interface Customer {
  id: string;
  companyName: string | null;
  contactName: string;
}

interface User {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

// Filter state type matching what nuqs returns
export type FilterState = {
  search: string | null;
  customer: string | null;
  lifecyclePhase: string | null;  // nuqs returns string, not the specific enum
  assignedUser: string | null;
  startDateFrom: string | null;
  startDateTo: string | null;
  page: number;
};

interface ProjectsFiltersProps {
  customers: Customer[];
  users: User[];
  filters: FilterState;
  setFilters: (filters: Partial<FilterState>) => void;
}

export function ProjectsFilters({ customers, users, filters, setFilters }: ProjectsFiltersProps) {

  // Local state for search input (debounced)
  const [searchInput, setSearchInput] = React.useState(filters.search || "");
  const debouncedSearch = useDebounce(searchInput, 300);

  // Update URL when debounced search changes
  React.useEffect(() => {
    setFilters({
      search: debouncedSearch || null,
      page: 1, // Reset to page 1 when search changes
    });
  }, [debouncedSearch, setFilters]);

  // Clear all filters
  const clearFilters = () => {
    setSearchInput("");
    setFilters({
      search: null,
      customer: null,
      lifecyclePhase: null,
      assignedUser: null,
      startDateFrom: null,
      startDateTo: null,
      page: 1,
    });
  };

  // Handle filter changes (reset page to 1)
  const handleFilterChange = (key: string, value: string | null) => {
    setFilters({
      [key]: value,
      page: 1,
    });
  };

  // Derive filter chips from active secondary filter values
  // Search input is NOT chipped — the search box itself represents the search
  const lifecyclePhaseLabels: Record<string, string> = {
    opportunity: "Opportunity",
    estimating: "Estimating",
    submitted: "Submitted",
    awarded: "Awarded",
    active: "Active",
    substantial_completion: "Substantial Completion",
    closed: "Closed",
    warranty: "Warranty",
    archived: "Archived",
  };

  const activeChips: FilterChip[] = [
    ...(filters.lifecyclePhase
      ? [{
          label: `Phase: ${lifecyclePhaseLabels[filters.lifecyclePhase] ?? filters.lifecyclePhase}`,
          onRemove: () => handleFilterChange("lifecyclePhase", null),
        }]
      : []),
    ...(filters.customer
      ? [{
          label: `Customer: ${
            customers.find((c) => c.id === filters.customer)?.companyName ||
            customers.find((c) => c.id === filters.customer)?.contactName ||
            "Unknown"
          }`,
          onRemove: () => handleFilterChange("customer", null),
        }]
      : []),
    ...(filters.assignedUser
      ? [{
          label: `User: ${
            users.find((u) => u.id === filters.assignedUser)
              ? `${users.find((u) => u.id === filters.assignedUser)?.firstName ?? ""} ${users.find((u) => u.id === filters.assignedUser)?.lastName ?? ""}`.trim() ||
                users.find((u) => u.id === filters.assignedUser)?.email
              : "Unknown"
          }`,
          onRemove: () => handleFilterChange("assignedUser", null),
        }]
      : []),
    ...(filters.startDateFrom
      ? [{
          label: `From: ${filters.startDateFrom}`,
          onRemove: () => handleFilterChange("startDateFrom", null),
        }]
      : []),
    ...(filters.startDateTo
      ? [{
          label: `To: ${filters.startDateTo}`,
          onRemove: () => handleFilterChange("startDateTo", null),
        }]
      : []),
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by job # or project name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Phase Filter */}
        <Select
          value={filters.lifecyclePhase || "all"}
          onValueChange={(value) =>
            handleFilterChange("lifecyclePhase", value === "all" ? null : value)
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Phase" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Phases</SelectItem>
            <SelectItem value="opportunity">Opportunity</SelectItem>
            <SelectItem value="estimating">Estimating</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="awarded">Awarded</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="substantial_completion">Substantial Completion</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="warranty">Warranty</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        {/* Customer Filter */}
        <Select
          value={filters.customer || "all"}
          onValueChange={(value) =>
            handleFilterChange("customer", value === "all" ? null : value)
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Customer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Customers</SelectItem>
            {customers.map((customer) => (
              <SelectItem key={customer.id} value={customer.id}>
                {customer.companyName || customer.contactName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Assigned User Filter */}
        <Select
          value={filters.assignedUser || "all"}
          onValueChange={(value) =>
            handleFilterChange("assignedUser", value === "all" ? null : value)
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Assigned User" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {users.map((user) => {
              const displayName =
                user.firstName && user.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user.email;
              return (
                <SelectItem key={user.id} value={user.id}>
                  {displayName}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Date Range From */}
        <Input
          type="date"
          placeholder="Start Date From"
          value={filters.startDateFrom || ""}
          onChange={(e) =>
            handleFilterChange("startDateFrom", e.target.value || null)
          }
          className="w-[160px]"
        />

        {/* Date Range To */}
        <Input
          type="date"
          placeholder="Start Date To"
          value={filters.startDateTo || ""}
          onChange={(e) =>
            handleFilterChange("startDateTo", e.target.value || null)
          }
          className="w-[160px]"
        />
      </div>

      {/* Filter chips row — renders nothing when no secondary filters are active */}
      <FilterChips chips={activeChips} onClearAll={clearFilters} />
    </div>
  );
}
