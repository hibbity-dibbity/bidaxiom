"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface FilterChip {
  label: string;
  onRemove: () => void;
}

interface FilterChipsProps {
  chips: FilterChip[];
  onClearAll: () => void;
}

export function FilterChips({ chips, onClearAll }: FilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip, i) => (
        <Badge key={i} variant="secondary" className="gap-1 pr-1 h-6">
          <span className="text-xs">{chip.label}</span>
          <button
            onClick={chip.onRemove}
            className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5 transition-colors"
            type="button"
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Remove {chip.label} filter</span>
          </button>
        </Badge>
      ))}
      <button
        onClick={onClearAll}
        className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
        type="button"
      >
        Clear all
      </button>
    </div>
  );
}
