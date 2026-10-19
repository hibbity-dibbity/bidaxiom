"use client";

import * as React from "react";
import { Search, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * The row under a list page's header: search on the left, filters next to it, a count or summary on the right.
 * Every list page (Projects, Customers, Subs & Vendors, Invoices, PO & WO, Outstanding) uses these pieces,
 * so they look and sit the same everywhere.
 */
export function ListToolbar({ children, summary, className }: { children: React.ReactNode; summary?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {children}
      {summary != null && summary !== false && <span className="text-sm text-muted-foreground sm:ml-auto">{summary}</span>}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  label = "Search",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label?: string;
}) {
  return (
    <div className="relative w-full sm:w-80">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input type="search" aria-label={label} className="pl-9" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function FilterSelect({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  /** Read aloud for screen readers. */
  label: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className={cn("w-full sm:w-[170px]", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Pick any number of values. With `mode` and `onModeChange` the list can also be turned around to
 * "Hide selected", so "everything except Closed, Archived and On Hold" is three clicks.
 */
export function MultiFilterSelect({
  label,
  allLabel,
  options,
  selected,
  onChange,
  mode = "show",
  onModeChange,
  className,
}: {
  /** Read aloud for screen readers and used on the button, e.g. "Phase". */
  label: string;
  /** What the button says when nothing is selected, e.g. "All phases". */
  allLabel: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  mode?: "show" | "hide";
  onModeChange?: (mode: "show" | "hide") => void;
  className?: string;
}) {
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const text =
    selected.length === 0
      ? allLabel
      : mode === "hide"
        ? `${label}: hiding ${selected.length}`
        : selected.length === 1
          ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
          : `${label}: ${selected.length}`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" aria-label={label} className={cn("w-full justify-between font-normal sm:w-[170px]", selected.length > 0 && "border-primary/60", className)}>
          <span className="truncate">{text}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        {onModeChange && (
          <div className="mb-2 grid grid-cols-2 gap-1 rounded-md bg-muted p-1 text-sm">
            {(["show", "hide"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onModeChange(m)}
                className={cn("rounded px-2 py-1", mode === m ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
              >
                {m === "show" ? "Show selected" : "Hide selected"}
              </button>
            ))}
          </div>
        )}
        <div className="max-h-72 overflow-auto">
          {options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
              <Checkbox checked={selected.includes(o.value)} onCheckedChange={() => toggle(o.value)} />
              {o.label}
            </label>
          ))}
        </div>
        <div className="mt-2 flex justify-between border-t pt-2 text-sm">
          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => onChange(options.map((o) => o.value))}>Select all</button>
          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => onChange([])}>Clear</button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
