"use client";

import type { LifecyclePhase } from "@construction/shared";
import React from "react";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { FilterChips, type FilterChip } from "@/components/shared/filter-chips";
import { ListToolbar, SearchField, FilterSelect, MultiFilterSelect } from "@/components/shared/list-toolbar";

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
  phases: LifecyclePhase[] | null;
  phaseMode: "show" | "hide" | null;
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
  summary?: React.ReactNode;
  actions?: React.ReactNode;
}

export function ProjectsFilters({ customers, users, filters, setFilters, summary, actions }: ProjectsFiltersProps) {

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
      phases: null,
      phaseMode: null,
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
    on_hold: "On Hold",
    lost: "Lost",
  };

  const activeChips: FilterChip[] = [
    ...(filters.phases?.length
      ? [{
          label: `${filters.phaseMode === "hide" ? "Hiding" : "Phase"}: ${filters.phases.map((p) => lifecyclePhaseLabels[p] ?? p).join(", ")}`,
          onRemove: () => setFilters({ phases: null, phaseMode: null, page: 1 }),
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

  const userName = (u: User) => (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email);
  return (
    <div className="space-y-2">
      <ListToolbar activeCount={activeChips.length + (searchInput.trim() ? 1 : 0)} summary={summary} actions={actions}>
        <SearchField value={searchInput} onChange={setSearchInput} placeholder="Search job number or project name" />
        <MultiFilterSelect
          label="Phase"
          allLabel="All phases"
          options={Object.entries(lifecyclePhaseLabels).map(([value, label]) => ({ value, label }))}
          selected={filters.phases ?? []}
          onChange={(v) => setFilters({ phases: v.length ? (v as LifecyclePhase[]) : null, phaseMode: v.length ? filters.phaseMode : null, page: 1 })}
          mode={filters.phaseMode ?? "show"}
          onModeChange={(m) => setFilters({ phaseMode: m, page: 1 })}
        />
        <FilterSelect
          label="Customer"
          className="sm:w-[150px]"
          value={filters.customer || "all"}
          onChange={(v) => handleFilterChange("customer", v === "all" ? null : v)}
          options={[{ value: "all", label: "All customers" }, ...customers.map((c) => ({ value: c.id, label: c.companyName || c.contactName }))]}
        />
        <FilterSelect
          label="Assigned user"
          className="sm:w-[150px]"
          value={filters.assignedUser || "all"}
          onChange={(v) => handleFilterChange("assignedUser", v === "all" ? null : v)}
          options={[{ value: "all", label: "All users" }, ...users.map((u) => ({ value: u.id, label: userName(u) }))]}
        />
        <Input
          type="date"
          aria-label="Start date from"
          title="Start date from"
          value={filters.startDateFrom || ""}
          onChange={(e) => handleFilterChange("startDateFrom", e.target.value || null)}
          className="w-full sm:w-[140px]"
        />
        <Input
          type="date"
          aria-label="Start date to"
          title="Start date to"
          value={filters.startDateTo || ""}
          onChange={(e) => handleFilterChange("startDateTo", e.target.value || null)}
          className="w-full sm:w-[140px]"
        />
      </ListToolbar>

      {/* Filter chips row — renders nothing when no secondary filters are active */}
      <FilterChips chips={activeChips} onClearAll={clearFilters} />
    </div>
  );
}
