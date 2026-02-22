# Phase 43: Budget Domain Redesign - Research

**Researched:** 2026-02-22
**Domain:** TanStack Table v8 column visibility, inline row addition, filter chips, empty states
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Column Picker — Scope**
All financial tables with many columns get a column picker: budget line items, projects list, G703 continuation sheet, commitment list, and any other wide table that benefits from hiding columns.

**Column Picker — Pinned Columns**
Only the frozen first column (the identifier column — Cost Code, Job #, Item #, etc.) is permanently visible and cannot be hidden. All other columns, including financial amount columns, are hideable via the picker.

**Column Picker — Persistence**
Column visibility selection persists in `localStorage` per table. A user who hides "Variance" on the budget table sees it hidden on their next visit without re-selecting. No server round-trip needed.

**Column Picker — Control Placement**
A gear/settings icon sits in the top-right corner of the table header area. Clicking it opens a popover with a checkbox list of all hideable columns. No dedicated "Columns" button in the toolbar — keep the table chrome compact.

### Claude's Discretion
- Inline row add UX: where the new row appears (top vs bottom), auto-focus field, save/cancel mechanism, and validation approach.
- Filter chips: available filter dimensions per entity, chip visual design, and interaction with existing filter dropdowns.
- Empty states: icon, heading, description, and CTA per entity type; also handles the "genuinely empty" vs "no filter matches" distinction.
- Column picker popover design: checkbox list style, ordering of columns, search within picker (if list is long).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TABLE-06 | Users can show or hide individual columns on financial tables and the projects list view via a column picker control (popover with checkbox list). | TanStack Table v8 has a built-in `columnVisibility` state + `onColumnVisibilityChange` pattern; `enableHiding: false` pins first column; `localStorage` persists per table key |
| TABLE-07 | SOV line items and change order line items can be added as a new row directly within the table without opening a modal dialog; inline input fields appear in the new row on "Add line item" click. | Inline row pattern uses optimistic `useState` row appended to data array; `shouldFocus + useRef Map` pattern for auto-focus; Enter/blur saves, Escape cancels |
| LIST-01 | Every major list view has an inline search bar positioned directly above the table that filters the current result set. | `useDebounce` hook already exists in `hooks/use-debounce.ts`; projects page already has a debounced pattern; `use-debounce` npm package is installed |
| LIST-02 | Active filter selections on all list views are displayed as removable filter chips below the search bar; each chip shows the filter label and value with an × dismiss button; a "Clear all" link removes all active filters at once. | Badge component + X button renders as chip; existing `ProjectsFilters` shows clear-all pattern; chips are pure client state derived from active filter values |
| LIST-03 | Every list view shows a contextual empty state (icon + heading + description + CTA button) when no records match the current filters or when the list is genuinely empty. | Multiple pages already have partial empty states; consistent pattern to extract into a shared `EmptyState` component |
</phase_requirements>

---

## Summary

Phase 43 is a pure UI redesign phase — no new data model changes, no new tRPC procedures. Every component being enhanced already exists and uses TanStack Table v8 (`@tanstack/react-table@^8.21.3`). The codebase has strong established patterns (sticky headers with `overflow-auto max-h`, `enableSortingRemoval: false`, sticky first column with `z-30`, `TableFooter` sticky bottom) that this phase extends rather than replaces.

The four feature areas each have a clear implementation path. Column visibility is the most complex: TanStack Table v8's built-in `columnVisibility` state with `onColumnVisibilityChange` eliminates any need to hand-roll visibility logic — the planner only needs to wire `localStorage` initialization and a `Popover` + `Checkbox` picker UI. Inline row add is a local-state appended row that shows inline inputs until saved (Enter/blur) or cancelled (Escape). Filter chips are pure derivation from existing filter state — no new state, just a render of what's already active. Empty states need to be consistent: a shared `EmptyState` component covers all list pages, distinguishing "genuinely empty" (CTA to create) from "no filter matches" (CTA to clear filters).

The note in the phase description about `getGroupedRowModel` + `@tanstack/react-virtual` integration nuances is **not relevant to this phase**. Phase 43 has no grouping (`EstimateLineItemsTable` explicitly avoids TanStack sort to preserve its manual `lineItemsByDivision` grouping, and the SOV editor intentionally omits sort). No virtualisation is needed at current data volumes. The research confirms `getGroupedRowModel` integration nuances do NOT affect any table being redesigned in this phase.

**Primary recommendation:** Use TanStack Table v8's `columnVisibility` state directly; persist to `localStorage` on mount and on every change; use `enableHiding: false` on the first column def to prevent hiding; build a shared `ColumnPicker` component consumed by each table. All other features use existing React patterns already present in the codebase.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-table` | `^8.21.3` (installed) | Column visibility state, row models, column defs | Already used by every table in the codebase |
| `@radix-ui/react-popover` | `^1.1.15` (installed) | Column picker popover | Already installed; `Popover` component exists at `components/ui/popover.tsx` |
| `@radix-ui/react-checkbox` | `^1.3.3` (installed) | Checkbox items in column picker | Already installed; `Checkbox` component exists at `components/ui/checkbox.tsx` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `use-debounce` | `^10.1.0` (installed) | Debounce search input | Already used in `ProjectsFilters`; use for any new search bar |
| `lucide-react` | installed | Settings icon (Settings2), X (dismiss chip), Search | Already imported throughout codebase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `localStorage` for column picker | `nuqs` URL params | nuqs is for URL-scoped state; column visibility is a display preference, not a shareable filter — localStorage is correct here |
| Inline new row | Modal dialog | Phase explicitly requires no modal — inline pattern aligns with Procore-level density goal |
| Shared `EmptyState` component | Per-page inline JSX | Inconsistency already exists across pages; shared component enforces the pattern |

**Installation:** No new packages needed. All required libraries are already installed.

---

## Architecture Patterns

### Recommended Project Structure

New shared components to create:

```
apps/web/components/shared/
├── column-picker.tsx        # Shared ColumnPicker popover consumed by all tables
├── empty-state.tsx          # Shared EmptyState component (icon+heading+desc+CTA)
└── filter-chips.tsx         # Shared FilterChips row (chips + "Clear all")
```

Per-table column visibility hooks:

```
apps/web/hooks/
└── use-column-visibility.ts  # localStorage-backed column visibility hook
```

### Pattern 1: Column Visibility with localStorage Persistence

**What:** `columnVisibility` state initialized from `localStorage`, persisted on every change.
**When to use:** Every financial table and the projects list.

```typescript
// Source: https://github.com/TanStack/table/blob/main/examples/react/column-visibility/src/main.tsx
// + localStorage persistence layer

// hooks/use-column-visibility.ts
import { useState } from "react";
import type { VisibilityState } from "@tanstack/react-table";

export function useColumnVisibility(tableKey: string, defaultVisibility?: VisibilityState) {
  const storageKey = `col-picker:${tableKey}`;

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window === "undefined") return defaultVisibility ?? {};
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : (defaultVisibility ?? {});
    } catch {
      return defaultVisibility ?? {};
    }
  });

  const handleVisibilityChange = (updater: any) => {
    setColumnVisibility((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // localStorage unavailable — degrade silently
      }
      return next;
    });
  };

  return { columnVisibility, onColumnVisibilityChange: handleVisibilityChange };
}

// Usage in table component:
const { columnVisibility, onColumnVisibilityChange } = useColumnVisibility("budget-line-items");

const table = useReactTable({
  data,
  columns,
  state: { sorting, columnVisibility },
  onSortingChange: setSorting,
  onColumnVisibilityChange,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  enableSortingRemoval: false,
});
```

### Pattern 2: Column Definition — First Column Not Hideable

**What:** Set `enableHiding: false` on the identifier column so it cannot be toggled off.
**When to use:** Every table's first (frozen/sticky) column.

```typescript
// Source: TanStack Table v8 column visibility API (enableHiding option)
// https://tanstack.com/table/v8/docs/api/features/column-visibility

const columns: ColumnDef<BudgetLineItem>[] = [
  {
    id: "costCode",
    accessorFn: (row) => getDivisionName(row.costCodeId),
    header: "Cost Code",
    enableHiding: false,   // LOCKED — first column cannot be hidden
    enableSorting: true,
  },
  {
    accessorKey: "description",
    header: "Description",
    // enableHiding defaults to true — hideable
  },
  // ...
];
```

`column.getCanHide()` returns `false` when `enableHiding: false` — use this in the ColumnPicker to render the checkbox as disabled/checked.

### Pattern 3: ColumnPicker Shared Component

**What:** A gear icon button that opens a Popover with checkboxes for all hideable columns.
**When to use:** Drop into any table's header toolbar area (top-right).

```typescript
// components/shared/column-picker.tsx
// Uses existing Popover and Checkbox from components/ui/

interface ColumnPickerProps {
  table: Table<any>;
}

export function ColumnPicker({ table }: ColumnPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Settings2 className="h-4 w-4" />
          <span className="sr-only">Column settings</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-2">
        <div className="space-y-1">
          {table.getAllLeafColumns()
            .filter((col) => col.getCanHide())  // skip columns with enableHiding: false
            .map((col) => (
              <label
                key={col.id}
                className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-muted rounded"
              >
                <Checkbox
                  checked={col.getIsVisible()}
                  onCheckedChange={(checked) => col.toggleVisibility(!!checked)}
                />
                {typeof col.columnDef.header === "string" ? col.columnDef.header : col.id}
              </label>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

### Pattern 4: Inline Row Add

**What:** Clicking "Add line item" appends a draft row to local state; inline inputs appear; Enter/blur saves (tRPC mutation), Escape cancels.
**When to use:** BudgetLineItemTable (replacing current modal), SovEditor (replacing current modal). NOT EstimateLineItemsTable (has its own inline edit pattern already).

The pattern for SOV and budget inline add:

```typescript
// Local draft row state — appended at bottom of data
const [draftRow, setDraftRow] = useState<DraftRow | null>(null);
const [shouldFocusNew, setShouldFocusNew] = useState(false);
const firstInputRef = useRef<HTMLInputElement>(null);

// When "Add line item" clicked:
const handleAddClick = () => {
  setDraftRow({ description: "", scheduledValue: 0 });
  setShouldFocusNew(true);
};

// Auto-focus first field after draft row renders
useEffect(() => {
  if (shouldFocusNew && firstInputRef.current) {
    firstInputRef.current.focus();
    setShouldFocusNew(false);
  }
}, [shouldFocusNew, draftRow]);

// Save on Enter or blur if description is non-empty
const handleDraftBlur = () => {
  if (!draftRow?.description.trim()) {
    setDraftRow(null); // cancel if empty
    return;
  }
  createMutation.mutate({ ... });
  setDraftRow(null);
};

const handleDraftKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "Escape") setDraftRow(null);
  if (e.key === "Enter") handleDraftBlur();
};

// Render: regular rows first, then draft row at bottom inside TableBody
{draftRow && (
  <TableRow>
    <TableCell className="sticky left-0 z-10 bg-background border-r">
      {/* For SOV/budget: description is first cell */}
      <Input
        ref={firstInputRef}
        value={draftRow.description}
        onChange={(e) => setDraftRow({ ...draftRow, description: e.target.value })}
        onBlur={handleDraftBlur}
        onKeyDown={handleDraftKeyDown}
        placeholder="Enter description..."
        className="h-7 text-sm"
      />
    </TableCell>
    <TableCell>
      <CurrencyInput
        value={draftRow.scheduledValue}
        onChange={(n) => setDraftRow({ ...draftRow, scheduledValue: n })}
        onBlur={handleDraftBlur}
        className="h-7"
      />
    </TableCell>
    <TableCell>
      <Button variant="ghost" size="sm" onClick={() => setDraftRow(null)}>
        <X className="h-4 w-4" />
      </Button>
    </TableCell>
  </TableRow>
)}
```

**Important constraint from prior decisions:** SovEditor must NOT get TanStack sort — row order is controlled by up/down mutation buttons. The inline add goes at the bottom of the current items list.

### Pattern 5: Filter Chips

**What:** A row of `Badge`-styled chips below the search bar, one per active filter, each with an × dismiss. A "Clear all" link removes all.
**When to use:** Below the search bar on all list views where multiple filters can be active.

```typescript
// components/shared/filter-chips.tsx
interface FilterChip {
  label: string;      // e.g., "Status: Active"
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
        <Badge key={i} variant="secondary" className="gap-1 pr-1">
          {chip.label}
          <button
            onClick={chip.onRemove}
            className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Remove filter</span>
          </button>
        </Badge>
      ))}
      <button
        onClick={onClearAll}
        className="text-xs text-muted-foreground hover:text-foreground underline"
      >
        Clear all
      </button>
    </div>
  );
}
```

Chips are derived from active filter state in the parent component — they are not a separate state:

```typescript
// In ProjectsFilters or similar:
const activeChips: FilterChip[] = [
  ...(filters.status ? [{ label: `Status: ${statusLabel(filters.status)}`, onRemove: () => setFilters({ status: null, page: 1 }) }] : []),
  ...(filters.customer ? [{ label: `Customer: ${customerName}`, onRemove: () => setFilters({ customer: null, page: 1 }) }] : []),
  // etc.
];
```

### Pattern 6: Empty State Variants

**What:** A shared `EmptyState` component with two modes — "genuinely empty" (create CTA) and "no filter matches" (clear filters CTA).

```typescript
// components/shared/empty-state.tsx
interface EmptyStateProps {
  icon: React.ElementType;
  heading: string;
  description: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
}

export function EmptyState({ icon: Icon, heading, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 space-y-4">
      <div className="rounded-full bg-muted p-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold text-base">{heading}</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">{description}</p>
      </div>
      {action && (
        action.href ? (
          <Button asChild size="sm"><Link href={action.href}>{action.label}</Link></Button>
        ) : (
          <Button size="sm" onClick={action.onClick}>{action.label}</Button>
        )
      )}
    </div>
  );
}
```

Usage pattern per entity:

| Entity | Genuinely Empty | No Filter Match |
|--------|----------------|-----------------|
| Projects | Icon: `FolderOpen`, CTA: "Create Project" | Icon: `SearchX`, CTA: "Clear filters" |
| Customers | Icon: `Building2`, CTA: "Add Customer" | Icon: `SearchX`, CTA: "Clear filters" |
| Subcontractors | Icon: `HardHat`, CTA: "Add Subcontractor" | Icon: `SearchX`, CTA: "Clear filters" |
| Change Orders | Icon: `FilePlus`, CTA: "New Change Order" | Icon: `SearchX`, CTA: "Clear filters" |
| Payment Apps | Icon: `Receipt`, CTA: "New Payment Application" | Icon: `SearchX`, CTA: "Clear filters" |
| Estimates | Icon: `FileText`, CTA: "New Estimate" | Icon: `SearchX`, CTA: "Clear filters" |
| RFQs | Icon: `FileQuestion`, CTA: "New RFQ" | Icon: `SearchX`, CTA: "Clear filters" |
| Budget Line Items | Icon: `BarChart3`, CTA: "Add Line Item" (inline) | Icon: `SearchX`, no CTA |
| SOV Items | Icon: `List`, CTA: "Add SOV Item" (inline) | n/a (no filter) |
| Commitments | Icon: `FileText`, CTA: "Add Commitment" | Icon: `SearchX`, CTA: "Clear filters" |

### Anti-Patterns to Avoid

- **Hiding the first column via the picker:** Set `enableHiding: false` on the column def — do not implement UI-level gating.
- **Running `getAllLeafColumns()` and showing ALL columns in the picker:** Filter with `col.getCanHide()` to exclude the locked first column.
- **Storing columnVisibility in URL params (nuqs):** This is a display preference, not a shareable filter state. localStorage is correct.
- **Opening a modal for "Add line item":** The requirement explicitly prohibits modal dialogs for inline row addition.
- **Firing a mutation on every keystroke in the draft row:** Mutations should fire on blur/Enter, not onChange.
- **Showing chips for the search text:** The search input IS the chip representation. Only secondary filter dims (status, type, customer, etc.) become chips.
- **Re-using the `filter` state object to detect "genuinely empty":** Track separately whether the API returned zero total (no data at all) vs. zero results given filters.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Column visibility toggling | Custom show/hide logic | TanStack `columnVisibility` state | TanStack handles `getVisibleCells()`, header visibility, and footer visibility automatically |
| Column picker checkbox state | Custom boolean map | `column.getIsVisible()` / `column.toggleVisibility()` | Already derived from table state; no sync needed |
| localStorage SSR safety | Custom guard | Initialize state with `useState(() => typeof window === "undefined" ? {} : JSON.parse(localStorage.getItem(key) ?? "{}"))` | One-time lazy initializer avoids SSR hydration errors |
| Debounced search | Custom setTimeout | `useDebounce` hook at `hooks/use-debounce.ts` | Already in codebase; identical to what `ProjectsFilters` uses |
| Chip removal | Custom filter state reset | Derive chips from existing filter state, call `setFilters` with null for removed dim | Chips are a view of state, not state themselves |

**Key insight:** This phase is 100% UI — no new server state. Every interaction either reads existing tRPC data or calls existing tRPC mutations. Nothing new needs to be added to the API layer.

---

## Common Pitfalls

### Pitfall 1: SSR Hydration Mismatch from localStorage
**What goes wrong:** `localStorage` is only available in the browser. Reading it during server render causes hydration mismatch or error.
**Why it happens:** Next.js renders components on the server; `window` is undefined.
**How to avoid:** Use the lazy `useState` initializer pattern: `useState(() => { if (typeof window === "undefined") return {}; ... })`.
**Warning signs:** Hydration error in console on first load; columns flashing from hidden to visible.

### Pitfall 2: Draft Row Visible in Footer Totals
**What goes wrong:** If the draft (unsaved) row gets included in totals calculation, totals jump before save.
**Why it happens:** Footer totals read from `lineItems` data, and if draft row is mixed into data, totals include it.
**How to avoid:** Keep `draftRow` in separate state from the `data` array fed to `useReactTable`. The draft row is rendered manually below `table.getRowModel().rows.map(...)`, not in the table's data.
**Warning signs:** Total changes when "Add line item" is clicked before any data is entered.

### Pitfall 3: `getVisibleCells()` Not Called After Adding columnVisibility
**What goes wrong:** Table shows all columns even after visibility state changes.
**Why it happens:** Cell rendering still uses raw column list instead of `row.getVisibleCells()`.
**How to avoid:** Ensure all `TableBody` cell rendering uses `row.getVisibleCells().map(...)` not a manual column iteration.
**Warning signs:** Hidden columns still render in body even though header shows them hidden.

### Pitfall 4: columnVisibility Key Collision Between Tables
**What goes wrong:** Hiding a column on the budget table also hides a same-named column on the commitment table.
**Why it happens:** Both tables use the same localStorage key.
**How to avoid:** Use fully qualified table-scoped keys: `col-picker:budget-line-items`, `col-picker:commitment-list`, `col-picker:projects-list`, `col-picker:g703-continuation`.
**Warning signs:** Hiding a column on one table affects another.

### Pitfall 5: Infinite Re-Render Loop from onColumnVisibilityChange
**What goes wrong:** Each render triggers `onColumnVisibilityChange`, which updates state, which triggers re-render.
**Why it happens:** Passing an inline function `onColumnVisibilityChange={(v) => { setVis(v); localStorage.setItem(...) }}` creates a new function reference each render, which can trigger TanStack to re-call it.
**How to avoid:** Use the `useColumnVisibility` hook that returns a stable callback reference via `useCallback` or by using the functional `setState` form.
**Warning signs:** Console shows many rapid state updates; browser freezes.

### Pitfall 6: EstimateLineItemsTable — Do NOT Add Column Visibility
**What goes wrong:** Adding column visibility to `EstimateLineItemsTable` breaks its grouped section rendering pattern.
**Why it happens:** `EstimateLineItemsTable` uses `lineItemsByDivision` manual grouping — it does not use `getGroupedRowModel`. Column visibility from TanStack would affect `getVisibleCells()` but the section header rows are rendered manually, so column counts wouldn't align.
**How to avoid:** Only add column picker to the tables explicitly listed in decisions: budget line items, projects list, G703 continuation, commitment list. Skip `EstimateLineItemsTable`.
**Warning signs:** Section subtotal rows have wrong colSpan; column headers don't match cell counts.

### Pitfall 7: SOV Editor — Inline Add Must Not Conflict With Up/Down Ordering
**What goes wrong:** Adding a new row at the top causes the row index to shift for all existing reorder buttons.
**Why it happens:** `handleMoveUp`/`handleMoveDown` use array indices.
**How to avoid:** New draft row always appends at the bottom of the existing items list. After save, the server assigns the last `itemNumber` and `reorder` mutations are not needed for a newly created item.
**Warning signs:** After add, clicking "Move Up" on the second-to-last item moves the newly created item instead.

---

## Code Examples

### Complete useColumnVisibility Hook

```typescript
// Source: TanStack Table v8 column-visibility API + localStorage persistence pattern
// apps/web/hooks/use-column-visibility.ts

import { useState, useCallback } from "react";
import type { VisibilityState, Updater } from "@tanstack/react-table";

export function useColumnVisibility(tableKey: string) {
  const storageKey = `col-picker:${tableKey}`;

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? (JSON.parse(stored) as VisibilityState) : {};
    } catch {
      return {};
    }
  });

  const onColumnVisibilityChange = useCallback(
    (updater: Updater<VisibilityState>) => {
      setColumnVisibility((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* storage unavailable */
        }
        return next;
      });
    },
    [storageKey]
  );

  return { columnVisibility, onColumnVisibilityChange };
}
```

### Column Picker Integration Into Existing Table

```typescript
// Adding ColumnPicker to BudgetLineItemTable header area
// The gear icon goes in the top-right of the table's header div

// Before (existing header div):
<div className="flex justify-between items-center">
  <h3 className="text-lg font-semibold">Budget Line Items</h3>
  <Button onClick={() => setAddDialogOpen(true)}>
    <Plus className="h-4 w-4 mr-2" /> Add Line Item
  </Button>
</div>

// After (with ColumnPicker added):
<div className="flex justify-between items-center">
  <h3 className="text-lg font-semibold">Budget Line Items</h3>
  <div className="flex items-center gap-2">
    <ColumnPicker table={table} />
    <Button onClick={handleAddClick}>
      <Plus className="h-4 w-4 mr-2" /> Add Line Item
    </Button>
  </div>
</div>
```

### Filter Chips Derivation Pattern

```typescript
// In a page or filter component:
// Chips are DERIVED from filter state, not independent state

function buildChips(filters: FilterState, customers: Customer[], users: User[]): FilterChip[] {
  const chips: FilterChip[] = [];

  if (filters.status) {
    chips.push({
      label: `Status: ${STATUS_LABELS[filters.status] ?? filters.status}`,
      onRemove: () => setFilters({ status: null, page: 1 }),
    });
  }
  if (filters.customer) {
    const name = customers.find((c) => c.id === filters.customer)?.companyName ?? filters.customer;
    chips.push({
      label: `Customer: ${name}`,
      onRemove: () => setFilters({ customer: null, page: 1 }),
    });
  }
  // etc.
  return chips;
}
```

---

## Codebase Inventory — Tables Requiring Column Picker

Based on full codebase audit:

| Table | File | Columns | tableKey |
|-------|------|---------|----------|
| BudgetLineItemTable | `components/budget/budget-line-item-table.tsx` | Cost Code (frozen), Description, Budgeted Amount, Status, Actions | `budget-line-items` |
| ProjectsTable | `app/(dashboard)/projects/components/projects-table.tsx` | Job # (frozen), Project Name, Customer, Phase, Start Date, Delete | `projects-list` |
| G703Continuation | `components/payment-app/g703-continuation.tsx` | Item (frozen), Description (frozen — 2 sticky), Scheduled Value, From Previous %, This Period %, Work This Period, Materials Stored, Total Completed, % Complete, Balance to Finish, Retainage | `g703-continuation` |
| CommitmentList | `components/budget/commitment-list.tsx` | Vendor (frozen), Contract #, Type, Status, Amount, Date, Expand | `commitment-list` |

Tables **explicitly excluded** from column picker (per decisions or architectural constraints):

| Table | File | Reason |
|-------|------|--------|
| EstimateLineItemsTable | `components/estimates/line-items/EstimateLineItemsTable.tsx` | Manual grouped rendering incompatible with column visibility |
| SovEditor | `components/payment-app/sov-editor.tsx` | Only 5 columns; manual up/down ordering; column picker not worth the complexity |
| ChangeOrderList | `components/change-order/change-order-list.tsx` | Only 6 columns; user decisions didn't list CO list explicitly |
| PaymentAppList | `components/payment-app/payment-app-list.tsx` | Only 5 columns; not a "wide table" |

Note: ChangeOrderList and PaymentAppList may get column picker if the team decides they qualify as "any other wide table that benefits" per the decisions. Research shows they have 6 and 5 columns respectively — borderline. Treat as Claude's discretion; recommend skipping for Phase 43, enabling in Phase 44.

## Codebase Inventory — Lists Requiring Search + Filter Chips + Empty States

| List | File | Current State | Needs |
|------|------|--------------|-------|
| Projects | `app/(dashboard)/projects/page.tsx` + `projects-filters.tsx` | Has search + filters (no chips) | Add filter chips below search |
| Customers | `app/(dashboard)/customers/page.tsx` | Has search, no chips | Add filter chips (no extra filters to chip) |
| Subcontractors | `app/(dashboard)/subcontractors/page.tsx` | Has search + status/trade filters | Add filter chips |
| Change Orders | `components/change-order/change-order-list.tsx` | Has status/type filters, no search | Add search + chips |
| Payment Apps | `components/payment-app/payment-app-list.tsx` | Has status filter, no search | Add search + chips |
| Estimates | `app/(dashboard)/projects/[projectSlug]/estimates/page.tsx` | No search, no filters | Add search + empty state |
| RFQs | `app/(dashboard)/projects/[projectSlug]/rfqs/page.tsx` | Has status filter, no search | Add search + chips |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Column picker: custom boolean state | TanStack `columnVisibility` built-in | TanStack Table v8.0 (2022) | All column visibility is automatic — `getVisibleCells()` respects it |
| Add row: Dialog/Modal | Inline draft row in TableBody | Industry shift to dense tables (Procore, Linear, Notion) | Faster entry, no focus context lost |
| Empty state: ad-hoc JSX | Shared EmptyState component | Already done in some places (ChangeOrderList, ProjectsTable) | Consolidate into shared component |

**Deprecated/outdated in this codebase:**
- `BudgetLineItemTable` uses Dialog for add — replace with inline draft row (TABLE-07)
- `SovEditor` uses Dialog for add — replace with inline draft row (TABLE-07)
- `customers/page.tsx` wraps search in a `Card` — remove Card wrapper, search goes inline above table

---

## Open Questions

1. **ChangeOrderList — column picker threshold?**
   - What we know: 6 columns, moderate width. User decisions say "any other wide table that benefits."
   - What's unclear: Does 6 columns justify a picker? The decision says commitment list gets one (also 6 columns + expand toggle = 7).
   - Recommendation: Add column picker to ChangeOrderList for consistency with CommitmentList. Both have the same column count and are displayed in the same budget domain context.

2. **G703 has two sticky columns — column picker placement?**
   - What we know: G703 has `Item` frozen at `left-0` and `Description` frozen at `left-[60px]`. Both are identity columns. User decisions say "only the frozen first column cannot be hidden."
   - What's unclear: Should `Description` also be `enableHiding: false`? The Description on G703 is functionally an identifier (it IS the work description, the item identity).
   - Recommendation: Set `enableHiding: false` on BOTH `Item` and `Description` columns for G703. They are both semantic identifiers. The gear icon goes in the top-right of the G703 table wrapper.

3. **Customers page — only 1 non-search filter (no chips)?**
   - What we know: The Customers page only has a search box. No status/type filters. So filter chips would never appear.
   - What's unclear: Should we skip the FilterChips component for Customers entirely, or include it for future extensibility?
   - Recommendation: Include the FilterChips slot but it renders nothing until a filter is active. No visible change for Customers today; ready for future filters.

---

## Sources

### Primary (HIGH confidence)
- TanStack Table v8 column visibility example (GitHub) — `columnVisibility` state, `onColumnVisibilityChange`, `getAllLeafColumns()`, `getIsVisible()`, `toggleVisibility()`, `getToggleVisibilityHandler()`
- TanStack Table v8 `enableHiding` discussion (GitHub #5365) — clarifies `enableHiding: false` prevents toggling; `getCanHide()` is the correct guard
- TanStack Table v8 `initialState.columnVisibility` discussion (GitHub #4106) — confirmed pattern for hiding by default
- `apps/web/components/budget/budget-line-item-table.tsx` — current BudgetLineItemTable implementation
- `apps/web/components/payment-app/sov-editor.tsx` — current SovEditor implementation (Dialog-based add)
- `apps/web/components/payment-app/g703-continuation.tsx` — G703 table (two sticky columns)
- `apps/web/components/budget/commitment-list.tsx` — CommitmentList (7 columns)
- `apps/web/components/change-order/change-order-list.tsx` — ChangeOrderList (6 columns)
- `apps/web/app/(dashboard)/projects/components/projects-table.tsx` — ProjectsTable
- `apps/web/app/(dashboard)/projects/components/projects-filters.tsx` — existing filter + debounce pattern
- `apps/web/hooks/use-debounce.ts` — existing debounce hook
- `apps/web/components/ui/popover.tsx` — Popover component (Radix, already installed)
- `apps/web/components/ui/checkbox.tsx` — Checkbox component (Radix, already installed)
- `apps/web/package.json` — `@tanstack/react-table@^8.21.3`, `@radix-ui/react-popover@^1.1.15`, `@radix-ui/react-checkbox@^1.3.3`

### Secondary (MEDIUM confidence)
- [Auto-focus after adding a new row — Ben Smith Gall](https://bensmithgall.com/blog/react-tanstack-new-row-autofocus) — `shouldFocus` flag + `useRef Map` pattern for focusing first field of new row
- DeepWiki TanStack Table column management — confirmed `enableHiding: false` prevents toggle but not rendering; `getCanHide()` returns false

### Tertiary (LOW confidence)
- shadcn/ui filter chip blocks — visual reference only; implementation is pure Badge + X button

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in `package.json`; components verified in filesystem
- Architecture: HIGH — TanStack Table v8 column visibility API verified via GitHub examples and discussions; patterns cross-referenced with existing codebase
- Pitfalls: HIGH — SSR issue is well-known Next.js pattern; other pitfalls derived from direct codebase reading (grouped rendering, SOV reorder conflict)

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (30 days — TanStack Table v8 is stable; no breaking changes expected)
