"use client";

import * as React from "react";
import Link from "next/link";
import { Search, ChevronDown, SlidersHorizontal, EllipsisVertical, Plus, Upload, Download } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * The row under a list page's header: search on the left, filters next to it, a count or summary on the right.
 * Every list page (Projects, Customers, Subs & Vendors, Invoices, PO & WO, Outstanding) uses these pieces,
 * so they look and sit the same everywhere. `actions` (a <ListActions />) sits at the right, in line with the search and filters.
 */
export function ListToolbar({
  children,
  summary,
  activeCount = 0,
  actions,
  className,
}: {
  children?: React.ReactNode;
  summary?: React.ReactNode;
  /** How many filters (including a search) are in use. Shown on the phone's Filters button so a hidden filter is never a surprise. */
  activeCount?: number;
  actions?: React.ReactNode;
  className?: string;
}) {
  // On a phone the search and filters stay folded away behind one button, so the list gets the screen.
  const [open, setOpen] = React.useState(false);
  const hasSummary = summary != null && summary !== false;
  const hasFilters = React.Children.toArray(children).length > 0;
  return (
    <div className={cn("space-y-3 sm:space-y-0", className)}>
      <div className="flex items-center justify-between gap-3 sm:hidden">
        {hasFilters && (
          <Button variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filters
            {activeCount > 0 && (
              <span className="ml-2 rounded-full bg-primary px-1.5 text-xs font-medium leading-5 text-primary-foreground">{activeCount}</span>
            )}
          </Button>
        )}
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {hasSummary && <span className="min-w-0 truncate text-right text-sm text-muted-foreground max-[420px]:hidden">{summary}</span>}
          {actions}
        </div>
      </div>
      <div className={cn("flex-col gap-3 sm:flex sm:flex-row sm:flex-wrap sm:items-center", open && hasFilters ? "flex" : "hidden")}>
        {children}
        {hasSummary && <span className="hidden text-sm text-muted-foreground sm:ml-auto sm:inline">{summary}</span>}
        {actions && <div className={cn("hidden items-center gap-2 sm:flex", !hasSummary && "sm:ml-auto")}>{actions}</div>}
      </div>
    </div>
  );
}

/** "Add New" plus a ⋯ menu holding Import and Export CSV. The same on every list. */
export function ListActions({
  addLabel = "Add New",
  addHref,
  onAdd,
  addDisabled,
  addMenu,
  importHref,
  onExport,
  exportDisabled,
}: {
  addLabel?: string;
  addHref?: string;
  onAdd?: () => void;
  addDisabled?: boolean;
  /** Several kinds of thing can be added: Add New opens a menu of them instead of acting directly. */
  addMenu?: Array<{ label: string; onSelect: () => void }>;
  importHref?: string;
  onExport?: () => void;
  exportDisabled?: boolean;
}) {
  const hasAdd = !!addHref || !!onAdd || !!addMenu;
  const hasMenu = !!importHref || !!onExport;
  if (!hasAdd && !hasMenu) return null;
  return (
    <>
      {hasAdd &&
        (addMenu ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={addDisabled}>
                <Plus className="mr-2 h-4 w-4" />
                {addLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {addMenu.map((m) => (
                <DropdownMenuItem key={m.label} onSelect={m.onSelect}>{m.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : addHref ? (
          <Button asChild>
            <Link href={addHref}>
              <Plus className="mr-2 h-4 w-4" />
              {addLabel}
            </Link>
          </Button>
        ) : (
          <Button onClick={onAdd} disabled={addDisabled}>
            <Plus className="mr-2 h-4 w-4" />
            {addLabel}
          </Button>
        ))}
      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="More actions">
              <EllipsisVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {importHref && (
              <DropdownMenuItem asChild>
                <Link href={importHref}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </Link>
              </DropdownMenuItem>
            )}
            {onExport && (
              <DropdownMenuItem disabled={exportDisabled} onSelect={onExport}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
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
        <Button variant="outline" aria-label={label} className={cn("w-full justify-between font-normal sm:w-[170px]", selected.length > 0 && "ring-1 ring-primary/60", className)}>
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
