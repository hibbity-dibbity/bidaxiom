"use client";

import React from "react";
import { useQueryStates, parseAsString, parseAsStringEnum, parseAsInteger } from "nuqs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

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

interface ProjectsFiltersProps {
  customers: Customer[];
  users: User[];
}

export function ProjectsFilters({ customers, users }: ProjectsFiltersProps) {
  // Define filter state with nuqs
  const [filters, setFilters] = useQueryStates(
    {
      search: parseAsString,
      customer: parseAsString,
      status: parseAsStringEnum(["active", "on_hold", "completed", "archived"]),
      assignedUser: parseAsString,
      startDateFrom: parseAsString,
      startDateTo: parseAsString,
      page: parseAsInteger.withDefault(1),
    },
    {
      history: "push",
    }
  );

  // Local state for search input (debounced)
  const [searchInput, setSearchInput] = React.useState(filters.search || "");
  const debouncedSearch = useDebounce(searchInput, 300);

  // Update URL when debounced search changes
  React.useEffect(() => {
    setFilters({
      search: debouncedSearch || null,
      page: 1, // Reset to page 1 when search changes
    });
  }, [debouncedSearch]);

  // Check if any filters are active
  const hasActiveFilters =
    filters.search ||
    filters.customer ||
    filters.status ||
    filters.assignedUser ||
    filters.startDateFrom ||
    filters.startDateTo;

  // Clear all filters
  const clearFilters = () => {
    setSearchInput("");
    setFilters({
      search: null,
      customer: null,
      status: null,
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

  return (
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

      {/* Status Filter */}
      <Select
        value={filters.status || "all"}
        onValueChange={(value) =>
          handleFilterChange("status", value === "all" ? null : value)
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="on_hold">On Hold</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
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

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}

// Export filter state type for use in page component
export type FilterState = {
  search: string | null;
  customer: string | null;
  status: "active" | "on_hold" | "completed" | "archived" | null;
  assignedUser: string | null;
  startDateFrom: string | null;
  startDateTo: string | null;
  page: number;
};
