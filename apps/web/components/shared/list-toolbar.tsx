"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
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
