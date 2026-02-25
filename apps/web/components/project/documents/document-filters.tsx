"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SlidersHorizontal, X } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

export interface DocumentFilters {
  search: string | null;
  type: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  author: string | null;
}

interface DocumentFiltersProps {
  filters: DocumentFilters;
  onChange: (f: Partial<DocumentFilters>) => void;
  authorOptions: { id: string; name: string }[];
}

const TYPE_OPTIONS = [
  { label: "RFI", value: "rfi" },
  { label: "Submittal", value: "submittal" },
  { label: "Transmittal", value: "transmittal" },
  { label: "Proposal", value: "proposal" },
  { label: "Change Order", value: "change_order" },
  { label: "Payment App", value: "payment_app" },
  { label: "RFQ", value: "rfq" },
  { label: "File", value: "file" },
];

export function DocumentFilters({ filters, onChange, authorOptions }: DocumentFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const debouncedSearch = useDebounce(searchInput, 300);

  // Sync debounced search to parent
  useEffect(() => {
    onChange({ search: debouncedSearch || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const activeFilters: { key: keyof DocumentFilters; label: string; value: string }[] = [];
  if (filters.type) {
    const option = TYPE_OPTIONS.find((o) => o.value === filters.type);
    activeFilters.push({ key: "type", label: "Type", value: option?.label ?? filters.type });
  }
  if (filters.dateFrom) {
    activeFilters.push({ key: "dateFrom", label: "From", value: filters.dateFrom });
  }
  if (filters.dateTo) {
    activeFilters.push({ key: "dateTo", label: "To", value: filters.dateTo });
  }
  if (filters.author) {
    const option = authorOptions.find((o) => o.id === filters.author);
    activeFilters.push({ key: "author", label: "Author", value: option?.name ?? filters.author });
  }

  return (
    <div className="space-y-2">
      {/* Search + filter toggle row */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search documents..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-xs"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFilters((prev) => !prev)}
          aria-label="Toggle filters"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {activeFilters.map(({ key, label, value }) => (
            <Badge key={key} variant="secondary" className="gap-1 text-xs">
              {label}: {value}
              <button
                onClick={() => onChange({ [key]: null })}
                aria-label={`Remove ${label} filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Expanded filter panel */}
      {showFilters && (
        <div className="grid grid-cols-2 gap-3 rounded-md border p-3 sm:grid-cols-4">
          {/* Type */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <Select
              value={filters.type ?? ""}
              onValueChange={(val) => onChange({ type: val || null })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date From */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">From</label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={filters.dateFrom ?? ""}
              onChange={(e) => onChange({ dateFrom: e.target.value || null })}
            />
          </div>

          {/* Date To */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={filters.dateTo ?? ""}
              onChange={(e) => onChange({ dateTo: e.target.value || null })}
            />
          </div>

          {/* Author */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Author</label>
            <Select
              value={filters.author ?? ""}
              onValueChange={(val) => onChange({ author: val || null })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Authors" />
              </SelectTrigger>
              <SelectContent>
                {authorOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
