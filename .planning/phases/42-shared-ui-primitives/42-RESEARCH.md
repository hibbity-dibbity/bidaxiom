# Phase 42: Shared UI Primitives - Research

**Researched:** 2026-02-21
**Domain:** CSS sticky table layout, TanStack Table v8 client-side sort, CVA status badge consolidation
**Confidence:** HIGH — all findings drawn from direct codebase inspection

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Column freeze scope:**
- All tables get a frozen first column — not just wide financial tables. Projects list, customers list, subcontractors list, CO list, payment app list, and all line item tables all freeze their first column.
- Specific confirmed tables: budget line items (cost code), SOV builder (description), CO line items (description), estimate line items (description/item), G703 continuation sheet (SOV description)
- The frozen column is always the first column (cost code, name, or description depending on table)

**Sort interaction behavior:**
- Single-column sort only — clicking a new header replaces the current sort; no multi-column Shift+click
- Unsorted state shows subtle dual-chevron icon (up/down) on every sortable column header — makes sortability discoverable without waiting for hover
- 2-state cycle: Unsorted → Ascending → Descending — no third click back to unsorted; toggle between ascending and descending once a column is sorted
- Client-side sort only — sorts already-fetched data in the browser; no server re-fetch required

**Footer row content:**
- Budget line items footer: Total budget, total spent, total variance (3 contextually meaningful columns)
- G703 continuation sheet footer: Claude's discretion — pick aggregates appropriate to AIA G702 reconciliation
- CO list and projects list footers: Show total dollar values of the currently displayed rows; if filters are applied, the footer totals must reflect the filtered/visible set only (not all records)
- Other financial line item tables (estimate line items, commitment list): Claude's discretion for what aggregates matter most

### Claude's Discretion
- G703 footer exact column selection (AIA G702 context: scheduled value total + work-to-date + balance to finish is standard)
- Exact sticky positioning implementation (CSS `position: sticky` vs JS scroll listener)
- Whether payment app list and estimate list get footer rows (CO list and projects list confirmed; others at Claude's discretion)
- Frozen column shadow/border treatment (visual separation from scrollable columns)
- Status badge tier mapping for ambiguous statuses (submitted→amber, under_review→amber, active→green, paid→green, closed→gray, archived→gray, won→green, lost→gray, partial_conditional→amber — Claude can finalize this mapping)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TABLE-01 | All financial tables display sticky frozen header row without Radix ScrollArea | CSS `position: sticky; top: 0` on `thead`, wrap in `div` with `overflow-auto` + `max-height`; confirmed prior decision anti-ScrollArea |
| TABLE-02 | Wide financial tables freeze first column (cost code/description) during horizontal scroll | CSS `position: sticky; left: 0` on first `th`/`td`; z-index layering; background fill to prevent bleed-through |
| TABLE-03 | Financial amount columns right-aligned tabular-nums with `$` prefix; CurrencyDisplay for read-only; react-number-format for edit inputs | CurrencyDisplay already exists; react-number-format v5.4.4 installed; pattern is replace `Intl.NumberFormat` inline instances |
| TABLE-04 | All financial tables and list views support column sort with ascending/descending/unsorted cycle and chevron indicator | TanStack Table v8 `getSortedRowModel()` + `enableSortingRemoval: false` for 2-state cycle; `ChevronsUpDown` from lucide for unsorted icon |
| TABLE-05 | All financial tables display sticky summary/totals footer row | CSS `position: sticky; bottom: 0` on `tfoot`; filtered-aware for list views using TanStack `getFilteredRowModel().rows` |
| VISUAL-01 | Delete estimates/lifecycle/StatusBadge.tsx; update its one call site to use shared status-badge.tsx | Only 1 file imports from lifecycle/StatusBadge — `estimates/[estimateSlug]/page.tsx`; replace with shared StatusBadge + inline variantMap |
| VISUAL-02 | Status badges across all surfaces use 4-tier semantic model: gray/amber/green/red | Current shared StatusBadge has 9 CVA variants; need amber tier rename and correct status mappings for all surfaces |
</phase_requirements>

---

## Summary

Phase 42 enhances the existing `table.tsx` primitive and consolidates the status badge system. All work is CSS + component-level — no new npm packages needed, no API changes, and no schema changes. The changes are purely presentational.

The table work has two orthogonal axes: sticky vertical scrolling (frozen header + footer via `position: sticky`) and sticky horizontal scrolling (frozen first column via `position: sticky; left: 0`). These combine in wide tables like budget and G703 but only the header/footer stickiness is needed in narrow tables. TanStack Table v8 is already installed (`^8.21.3`) and already wired in projects-table.tsx with `getSortedRowModel()` — the pattern needs to be applied to the other financial tables. Most financial tables currently use raw `<Table>` without TanStack, so they'll need TanStack added or the sort state managed manually via `useMemo`.

The StatusBadge situation is clean: the `estimates/lifecycle/StatusBadge.tsx` is already a thin wrapper over the shared badge (it delegates to `SharedStatusBadge` with a `variantMap`). Only one file imports it. Deleting it is a 2-file change. The bigger work is auditing all 26 call sites that use the shared `StatusBadge` directly to verify their variant mapping aligns with the 4-tier semantic model (gray=draft/inactive, amber=pending/review, green=approved/active/complete, red=rejected/void).

**Primary recommendation:** Implement sticky table layout as a structural wrapper pattern on the existing `table.tsx` primitive (not a rewrite), and finalize the status badge 4-tier mapping in one audit pass before any other badge work.

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-table` | `^8.21.3` | Client-side sort, filtered row model | Already wired in projects-table.tsx; getSortedRowModel() available |
| `lucide-react` | `^0.460.0` | Sort chevron icons | Already used; ChevronsUpDown icon for unsorted state |
| `class-variance-authority` | (installed) | StatusBadge CVA variants | Already used in status-badge.tsx |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-number-format` | `^5.4.4` | Numeric edit inputs (TABLE-03) | Edit cells in tables; CurrencyInput already wraps it for forms |

### No New Installs Needed
All required libraries are already present. Phase 42 is purely a CSS + component reorganization.

---

## Architecture Patterns

### Recommended File Locations
```
apps/web/
├── components/ui/
│   └── table.tsx                    # Upgrade: add sticky variants, frozen-col support
├── components/shared/
│   ├── status-badge.tsx             # Upgrade: finalize 4-tier tier mapping
│   └── currency-display.tsx         # Already correct — no changes needed
├── components/budget/
│   └── budget-line-item-table.tsx   # Add TanStack sort + sticky + footer
├── components/payment-app/
│   ├── sov-editor.tsx               # Add sticky header/footer, frozen col
│   └── g703-continuation.tsx        # Add TanStack sort + sticky + footer
├── components/change-order/
│   └── change-order-list.tsx        # Add sticky header/footer
└── apps/web/app/(dashboard)/projects/
    └── components/projects-table.tsx  # Add sticky, frozen col, footer
```

### Pattern 1: Sticky Header + Footer Table Container

The existing `table.tsx` wraps `<table>` in `<div className="relative w-full overflow-auto">`. The sticky pattern requires a max-height on that wrapper and `position: sticky` on `<thead>` and `<tfoot>`.

**Current table.tsx wrapping div:**
```tsx
// Current — no max-height, so thead sticky has nothing to stick to:
<div className="relative w-full overflow-auto">
  <table ...>
```

**What sticky headers require:**
```tsx
// The outer div needs a constrained height. In practice this is done
// at the USAGE site, not in table.tsx itself — each table has a different
// max-height based on context. table.tsx should accept a containerClassName prop
// OR callers wrap it in a height-constrained div.

// Preferred: callers add max-height via className on the wrapping div
<div className="relative w-full overflow-auto max-h-[600px] rounded-md border">
  <Table>
    <TableHeader className="sticky top-0 z-10 bg-background">
      ...
    </TableHeader>
    <TableBody>...</TableBody>
    <TableFooter className="sticky bottom-0 z-10 bg-muted/50">
      ...
    </TableFooter>
  </Table>
</div>
```

**Key requirement:** `position: sticky` only works when an ancestor (not `<table>` itself) has `overflow: auto`. The `<table>` element must NOT have `overflow` set — only the outer wrapper div. The existing `table.tsx` already has `overflow-auto` on its wrapper div, but the max-height must be provided at the call site.

**IMPORTANT:** `thead` needs `sticky top-0 z-10 bg-background` (or `bg-card` depending on context). Without a background, scrolling rows bleed through the header.

**IMPORTANT:** `tfoot` needs `sticky bottom-0 z-10 bg-muted/50` (matching the existing TableFooter styling). The tfoot only sticks at the bottom when there's a max-height container.

**Source:** CSS position sticky behavior — confirmed working pattern. MDN docs: `position: sticky` requires nearest scrolling ancestor to have overflow: auto/scroll. HIGH confidence from CSS spec behavior.

### Pattern 2: Frozen First Column

The frozen column approach uses `position: sticky; left: 0` on both the header cell and all data cells in the first column. A shadow or border-right visually separates the frozen column from the scrollable area.

```tsx
// In TableHead (th) for first column:
<TableHead className="sticky left-0 z-20 bg-background">
  Cost Code
</TableHead>

// In TableCell (td) for first column:
<TableCell className="sticky left-0 z-10 bg-background">
  {item.costCode}
</TableCell>
```

**Z-index layering rules:**
- Frozen header cell (top-left corner): `z-30` — must be above both the sticky header row AND the frozen body cells
- Sticky header row (non-frozen): `z-20`
- Frozen body cells: `z-10`
- All other cells: `z-0` (default)

**Background fill:** Every sticky cell must have an explicit background color (`bg-background` or `bg-card`). Without it, scrolling content bleeds through because the cell has no paint. Use `bg-background` on frozen column cells; the header row already has `bg-background` applied.

**Shadow treatment (Claude's discretion):** A right shadow on the frozen column gives a visual cue that content is hidden. Recommended: `after:absolute after:right-0 after:top-0 after:h-full after:w-[1px] after:bg-border after:content-['']` or simply `border-r border-border` on the sticky cell.

**Source:** CSS position sticky on table cells. HIGH confidence — standard browser behavior, no framework needed.

### Pattern 3: TanStack Table Sort with 2-State Cycle

TanStack Table v8 supports `enableSortingRemoval: false` to prevent going back to unsorted state after a column is sorted. The projects-table.tsx already uses `getSortedRowModel()` and `SortingState`.

```tsx
// Source: @tanstack/react-table v8 — verified in projects-table.tsx pattern
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
} from "@tanstack/react-table";

const [sorting, setSorting] = React.useState<SortingState>([]);

const table = useReactTable({
  data,
  columns,
  state: { sorting },
  onSortingChange: setSorting,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  enableSortingRemoval: false,  // 2-state cycle: asc → desc → asc (no unsorted)
});
```

**Unsorted indicator — dual chevron icon:**
```tsx
import { ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";

// In header cell render:
{canSort && (
  <span className="text-muted-foreground">
    {isSorted === "asc" ? (
      <ChevronUp className="h-3.5 w-3.5" />
    ) : isSorted === "desc" ? (
      <ChevronDown className="h-3.5 w-3.5" />
    ) : (
      <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
    )}
  </span>
)}
```

**For raw `<table>` components (no TanStack):** Add `useSortedData()` hook with `useState<{ key: string; dir: 'asc' | 'desc' } | null>` and `useMemo` for sorted output. Budget line items, SOV, G703, and payment-app-list currently use raw table without TanStack. These need either TanStack added OR manual sort state.

**Recommendation:** Add TanStack to all financial tables for consistency. The overhead is minimal (no virtualization needed at these data sizes).

### Pattern 4: Filter-Aware Footer Totals

CO list and projects list show only the visible rows' totals. With TanStack Table, `table.getRowModel().rows` gives the current visible (filtered + sorted) rows:

```tsx
// TanStack: totals from visible rows (filter-aware)
const visibleTotals = React.useMemo(() => {
  const rows = table.getRowModel().rows;
  return {
    totalAmount: rows.reduce((sum, row) => sum + Number(row.original.totalAmount), 0),
  };
}, [table.getRowModel().rows]);
```

For raw table components that filter via `filteredItems.filter(...)`, compute totals from the filtered array directly:

```tsx
// Raw table: totals from filtered data
const filteredTotals = React.useMemo(() => ({
  totalAmount: filteredItems.reduce((sum, item) => sum + Number(item.totalAmount), 0),
}), [filteredItems]);
```

### Pattern 5: Status Badge 4-Tier Semantic Model

The current shared `status-badge.tsx` has 9 CVA variants. The 4-tier model maps to these variants:

| Tier | Color | Variants | Meaning |
|------|-------|----------|---------|
| Gray | `bg-muted text-muted-foreground` | `draft`, `cancelled` | Draft / inactive / archived / closed |
| Amber | `bg-muted text-financial-pending` | `pending`, `warning` | Submitted / under review / pending action |
| Green | `bg-primary/10 text-primary` or `bg-muted text-financial-positive` | `active`, `approved`, `completed` | Active / approved / paid / won |
| Red | `bg-muted text-financial-negative` | `rejected`, `error` | Rejected / void / lost |

**Current variant inventory vs. 4-tier mapping:**
- `draft` → gray (correct)
- `pending` → amber (correct — `text-financial-pending` is amber)
- `active` → green (correct — `text-primary` is the brand color, not green; needs AUDIT)
- `approved` → green (correct — `text-financial-positive` is green)
- `completed` → green (correct — `text-financial-positive`)
- `rejected` → red (correct — `text-financial-negative`)
- `cancelled` → gray (correct)
- `warning` → amber (correct — `text-financial-pending`)
- `error` → red (correct — `text-financial-negative`)

**IMPORTANT FINDING:** The `active` variant currently uses `bg-primary/10 text-primary` — this renders as the brand slate-blue color, NOT green. For the 4-tier model to be consistent, `active` should render as green (`bg-muted text-financial-positive`), matching `approved` and `completed`. This is a behavior change that needs to be made explicitly.

**Status mappings to finalize (Claude's discretion areas):**

| Status Value | Domain | Recommended Variant | Rationale |
|---|---|---|---|
| `submitted` | payment apps | `pending` (amber) | Awaiting review |
| `under_review` | payment apps | `pending` (amber) | In active review |
| `paid` | payment apps | `active` (green) | Complete/successful |
| `pco_submitted` | change orders | `pending` (amber) | Submitted for review |
| `pending_approval` | change orders | `warning` (amber) | Requires decision |
| `void` | change orders | `cancelled` (gray) | Inactive |
| `executed` | commitments | `active` (green) | Active contract |
| `closed` | commitments, projects | `cancelled` (gray) | Closed/finished |
| `won` | estimates | `approved` (green) | Successful outcome |
| `lost` | estimates | `cancelled` (gray) | Unsuccessful |
| `issued` | RFQs | `active` (green) | Active RFQ |
| `awarded` | RFQs | `approved` (green) | Awarded |
| `opportunity` | project lifecycle | `pending` (amber) | Early stage |
| `estimating` | project lifecycle | `pending` (amber) | In process |
| `active` | project lifecycle | `active` (green) | In construction |
| `substantial_completion` | project lifecycle | `active` (green) | Nearly done |
| `warranty` | project lifecycle | `warning` (amber) | Post-completion period |
| `archived` | projects | `cancelled` (gray) | Archived |
| `blacklisted` | subcontractors | `rejected` (red) | Rejected vendor |

### Anti-Patterns to Avoid
- **Sticky without explicit background:** Sticky cells with no background let scroll content bleed through. Always set `bg-background` or `bg-card` on every sticky cell.
- **Using Radix ScrollArea:** Per prior decision, do NOT use Radix ScrollArea for any table (open issue radix-ui/primitives #2783). Use plain `div` with `overflow-auto` and `max-height`.
- **Sticky on `<table>` element directly:** The `table` element itself cannot be the overflow container. Stickiness requires an ancestor div with `overflow-auto`.
- **Z-index conflicts:** The top-left corner cell (frozen column in sticky header) must have higher z-index than both the header row and the column cells. Use `z-30` for this cell.
- **Raw `Intl.NumberFormat` instances:** Per TABLE-03, replace inline `new Intl.NumberFormat(...)` calls with `<CurrencyDisplay>` for read-only display. Currently budget-line-item-table.tsx, sov-editor.tsx, g703-continuation.tsx, change-order-list.tsx, change-order-detail.tsx, payment-app-list.tsx, and commitment-list.tsx all use inline `Intl.NumberFormat`.
- **Filter-unaware footer totals:** CO list and projects list footers MUST compute totals from the filtered/visible rows, not from all data. A footer showing wrong totals when filters are applied is explicitly called out by user as unacceptable.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Client-side column sort | Custom sort comparators | TanStack `getSortedRowModel()` | Already installed; handles string/number/date comparison correctly |
| Sticky positioning | JS scroll listeners to reposition headers | CSS `position: sticky` | Native browser behavior; zero JS overhead; no ResizeObserver needed |
| Currency formatting | New `Intl.NumberFormat` instances | `CurrencyDisplay` component | Centralized; consistent precision; already handles positive/negative colorization |
| Status color logic | Custom `switch` statements per domain | `StatusBadge` with CVA variants | Centralized; dark-mode aware; consistent token usage |
| Filtered row totals | `data.reduce()` against unfiltered array | `table.getRowModel().rows.reduce()` | TanStack-aware totals stay in sync with filter state automatically |

**Key insight:** All the infrastructure (TanStack, CVA, CurrencyDisplay) is already installed and working. Phase 42 is about making existing code use these tools consistently rather than inline equivalents.

---

## Common Pitfalls

### Pitfall 1: Sticky Header Not Sticking
**What goes wrong:** Adding `sticky top-0` to `<thead>` has no effect.
**Why it happens:** `position: sticky` requires a scrollable ancestor. If the wrapper `div` has `overflow-auto` but no height constraint (`max-h-*`), the div expands to fit all content and there's nothing to scroll — so sticky has nothing to stick to.
**How to avoid:** Always pair `overflow-auto` with `max-h-[Npx]` or `max-h-[Nvh]` on the wrapper div. The max-height should be chosen per-table context (e.g., `max-h-[600px]` for line item tables, `max-h-[70vh]` for full-page tables).
**Warning signs:** Header scrolls away with content; `sticky` class is present but has no visual effect.

### Pitfall 2: Frozen Column Background Bleed-Through
**What goes wrong:** Scrolling reveals the row text "through" the frozen column as if the column is transparent.
**Why it happens:** Sticky elements don't have a background by default. The sticky cell visually appears at its stacked position but the scroll area paints behind it.
**How to avoid:** Add explicit `bg-background` to EVERY sticky cell — both `th` and `td` in the first column AND in the thead row. Stripe patterns (`odd:bg-muted`) conflict with frozen column — use explicit background on sticky cells only.
**Warning signs:** Text from scrolled rows shows through the frozen column.

### Pitfall 3: active Variant Is Blue, Not Green
**What goes wrong:** Statuses mapped to `variant="active"` render as brand slate-blue instead of financial green.
**Why it happens:** Current `active` variant in status-badge.tsx is `bg-primary/10 text-primary` — using the primary (brand) color, not `text-financial-positive`.
**How to avoid:** When updating the `active` variant to green, audit ALL call sites that use `variant="active"` to confirm they want green semantics. Payment app "paid" status, commitment "executed" status, project "active/substantial_completion" statuses all correctly want green.
**Warning signs:** Active/paid statuses render in blue instead of green after the variant change.

### Pitfall 4: 2-State Sort Cycle Implementation
**What goes wrong:** Sort toggles back to unsorted instead of staying in asc/desc cycle.
**Why it happens:** TanStack's default sort behavior is `asc → desc → unsorted`. The `enableSortingRemoval: false` option disables the third state.
**How to avoid:** Set `enableSortingRemoval: false` in `useReactTable` config. Without this, clicking a third time removes the sort.
**Warning signs:** A third click on a sorted column header removes the sort indicator.

### Pitfall 5: StatusBadge Call Sites Using Wrong Variant Labels
**What goes wrong:** After deleting lifecycle/StatusBadge.tsx, the estimate detail page either breaks or shows wrong variant.
**Why it happens:** The lifecycle/StatusBadge had a `status` prop (not `variant`) and handled its own mapping. The shared badge takes `variant` directly.
**How to avoid:** The replacement is: import `StatusBadge` from shared, add a local `variantMap: Record<EstimateStatus, variant>`, and render `<StatusBadge variant={variantMap[status]}>`. The existing lifecycle/StatusBadge.tsx can be used as a reference for the exact mapping.
**Warning signs:** TypeScript error on `status` prop not existing on shared StatusBadge.

### Pitfall 6: TanStack sort for tables currently using raw table
**What goes wrong:** Adding `getSortedRowModel()` to a component that manually filters data in a `filteredItems` array produces a mismatch — TanStack sorts after filtering, but the component's filter happens outside TanStack.
**Why it happens:** When data is pre-filtered before passing to `useReactTable`, TanStack only sees the pre-filtered subset and can sort it, but filter-aware totals via `table.getRowModel()` only see the pre-filtered subset, not the original unfiltered data.
**How to avoid:** For components that have both filter state and TanStack sort, either (a) pass all data to TanStack and use `getFilteredRowModel()` for filtering, or (b) keep pre-filtering and compute totals from `filteredItems` directly. Option (b) is simpler for components where the filter is a server-side query param.
**Warning signs:** Footer totals don't match what's visible in the table.

---

## Code Examples

### Sticky Header + Frozen First Column Table Container
```tsx
// Pattern for budget-line-item-table.tsx and similar wide financial tables
// Source: CSS position sticky spec behavior + codebase inspection

<div className="relative w-full overflow-auto max-h-[600px] rounded-md border">
  <Table>
    <TableHeader className="sticky top-0 z-20 bg-background">
      <TableRow>
        {/* Frozen first column header — z-30 so it's above both sticky header and frozen body cells */}
        <TableHead className="sticky left-0 z-30 bg-background min-w-[160px]">
          Cost Code
        </TableHead>
        {/* Normal scrollable columns */}
        <TableHead>Description</TableHead>
        <TableHead className="text-right">Budgeted</TableHead>
        <TableHead className="text-right">Spent</TableHead>
        <TableHead className="text-right">Variance</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {table.getRowModel().rows.map((row) => (
        <TableRow key={row.id}>
          {/* Frozen first column body cell */}
          <TableCell className="sticky left-0 z-10 bg-background font-medium border-r">
            {row.original.costCode}
          </TableCell>
          <TableCell>{row.original.description}</TableCell>
          <TableCell className="text-right tabular-nums">
            <CurrencyDisplay amount={row.original.budgetedAmount} />
          </TableCell>
          <TableCell className="text-right tabular-nums">
            <CurrencyDisplay amount={row.original.spentAmount} />
          </TableCell>
          <TableCell className="text-right tabular-nums">
            <CurrencyDisplay amount={row.original.variance} colorize showSign />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
    <TableFooter className="sticky bottom-0 z-20 bg-muted/50">
      <TableRow>
        <TableCell className="sticky left-0 z-30 bg-muted/50 font-bold border-r">
          Totals
        </TableCell>
        <TableCell />
        <TableCell className="text-right tabular-nums font-bold">
          <CurrencyDisplay amount={totals.budgetedAmount} />
        </TableCell>
        <TableCell className="text-right tabular-nums font-bold">
          <CurrencyDisplay amount={totals.spentAmount} />
        </TableCell>
        <TableCell className="text-right tabular-nums font-bold">
          <CurrencyDisplay amount={totals.variance} colorize showSign />
        </TableCell>
      </TableRow>
    </TableFooter>
  </Table>
</div>
```

### Sort Header Pattern (from existing projects-table.tsx, extended)
```tsx
// Source: apps/web/app/(dashboard)/projects/components/projects-table.tsx
// Extended with dual-chevron unsorted icon (ChevronsUpDown)
import { ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";

// In useReactTable config — add enableSortingRemoval: false
const table = useReactTable({
  data,
  columns,
  state: { sorting },
  onSortingChange: setSorting,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  enableSortingRemoval: false,  // ADD THIS: prevents 3rd click returning to unsorted
});

// In header cell render:
<TableHead
  key={header.id}
  style={{ width: header.column.getSize() }}
>
  {header.isPlaceholder ? null : (
    <div
      className={canSort
        ? "flex items-center gap-1.5 cursor-pointer select-none hover:text-foreground"
        : undefined}
      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
    >
      {flexRender(header.column.columnDef.header, header.getContext())}
      {canSort && (
        <span className="text-muted-foreground">
          {isSorted === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : isSorted === "desc" ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />  // subtle dual-chevron
          )}
        </span>
      )}
    </div>
  )}
</TableHead>
```

### Updated StatusBadge CVA Variants (4-tier model)
```tsx
// Source: apps/web/components/shared/status-badge.tsx — proposed update
// Change: active variant switches from primary (blue) to financial-positive (green)

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        // GRAY TIER: draft/inactive/archived/closed
        draft:     "bg-muted text-muted-foreground",
        cancelled: "bg-muted text-muted-foreground",
        // AMBER TIER: pending/review/submitted
        pending: "bg-muted text-financial-pending",
        warning: "bg-muted text-financial-pending",
        // GREEN TIER: active/approved/complete
        active:    "bg-muted text-financial-positive",   // CHANGED from bg-primary/10 text-primary
        approved:  "bg-muted text-financial-positive",
        completed: "bg-muted text-financial-positive",
        // RED TIER: rejected/void
        rejected: "bg-muted text-financial-negative",
        error:    "bg-muted text-financial-negative",
      },
    },
    defaultVariants: { variant: "draft" },
  }
);
```

### Replacing lifecycle/StatusBadge.tsx call site
```tsx
// Source: apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/page.tsx
// Before:
import { StatusBadge } from "@/components/estimates/lifecycle/StatusBadge";
// Usage: <StatusBadge status={estimate.status} />

// After:
import { StatusBadge } from "@/components/shared/status-badge";
import type { EstimateStatus } from "@construction/shared";

const estimateVariantMap: Record<EstimateStatus, "draft" | "pending" | "approved" | "active"> = {
  draft:          "draft",
  submitted:      "pending",
  accepted:       "approved",
  under_contract: "active",
};
// Usage: <StatusBadge variant={estimateVariantMap[estimate.status]}>{labelMap[estimate.status]}</StatusBadge>
```

### G703 Footer (AIA G702 context — Claude's discretion)
```tsx
// Recommended G703 footer columns — matches AIA G702 payment certification fields:
// Scheduled Value (contract total), Work This Period (current billing), Balance to Finish
<TableFooter className="sticky bottom-0 z-20 bg-muted/50">
  <TableRow className="font-bold">
    <TableCell className="sticky left-0 z-30 bg-muted/50 border-r" colSpan={2}>
      Totals
    </TableCell>
    <TableCell className="text-right tabular-nums">
      <CurrencyDisplay amount={totals.scheduledValue} />  {/* Col C: Scheduled Value */}
    </TableCell>
    <TableCell /> {/* from previous % */}
    <TableCell /> {/* this period % */}
    <TableCell className="text-right tabular-nums">
      <CurrencyDisplay amount={totals.workThisPeriod} />  {/* Col F: Work This Period */}
    </TableCell>
    <TableCell className="text-right tabular-nums">
      <CurrencyDisplay amount={totals.materialsStored} /> {/* Col G: Materials Stored */}
    </TableCell>
    <TableCell className="text-right tabular-nums">
      <CurrencyDisplay amount={totals.totalCompleted} />   {/* Col H: Total Completed */}
    </TableCell>
    <TableCell /> {/* % complete */}
    <TableCell className="text-right tabular-nums">
      <CurrencyDisplay amount={totals.balanceToFinish} />  {/* Col I: Balance to Finish */}
    </TableCell>
    <TableCell className="text-right tabular-nums">
      <CurrencyDisplay amount={totals.retainageAmount} />  {/* Col J: Retainage */}
    </TableCell>
  </TableRow>
</TableFooter>
```

---

## Current State Audit

### Tables That Need Updates

| Table Component | File | Has TanStack? | Has Sticky Header? | Has Frozen Col? | Has Footer? | Uses CurrencyDisplay? |
|---|---|---|---|---|---|---|
| ProjectsTable | `projects/components/projects-table.tsx` | YES | NO | NO | NO | NO (no currency cols) |
| BudgetLineItemTable | `components/budget/budget-line-item-table.tsx` | NO | NO | NO | NO | NO — uses Intl.NumberFormat |
| SovEditor | `components/payment-app/sov-editor.tsx` | NO | NO | NO | Has inline totals row | NO — uses Intl.NumberFormat |
| G703Continuation | `components/payment-app/g703-continuation.tsx` | NO | NO | NO | Has inline totals row | NO — uses Intl.NumberFormat |
| PaymentAppList | `components/payment-app/payment-app-list.tsx` | NO | NO | NO | NO | NO — uses Intl.NumberFormat |
| ChangeOrderList | `components/change-order/change-order-list.tsx` | NO | NO | NO | NO | NO — uses Intl.NumberFormat |

**Note:** `ChangeOrderList` and `ProjectsTable` render card-layout or TanStack rows — they don't have a traditional `<tfoot>`. Footer rows for these are new work.

### Status Badge Call Sites That Need Variant Audit

Only **1 file** imports from the old `estimates/lifecycle/StatusBadge.tsx`:
- `app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/page.tsx` — uses `<StatusBadge status={estimate.status} />` (status-prop API)

All other files already use the shared badge. Their variant mappings need to be verified against the 4-tier model:
- `change-order/change-order-list.tsx` — `pending_approval→warning` (amber) — CORRECT
- `change-order/change-order-detail.tsx` — same mapping — CORRECT
- `payment-app/payment-app-list.tsx` — `paid→active` (currently blue, needs green) — NEEDS UPDATE
- `budget/commitment-list.tsx` — `executed→active` (currently blue, needs green) — NEEDS UPDATE
- `projects/components/columns.tsx` — `active→active` (currently blue, needs green) — NEEDS UPDATE
- `bidding/rfq-status-badge.tsx` — `issued→active` (currently blue, needs green) — NEEDS UPDATE

---

## Open Questions

1. **Payment app list and estimate list footer rows**
   - What we know: CO list and projects list footers are confirmed required. User said "others at Claude's discretion."
   - Recommendation: Add footer to payment-app-list (total current payment due for visible/filtered rows) and estimate list (total cost for visible rows). These are natural aggregates that users would expect.

2. **SovEditor existing inline totals row**
   - What we know: SovEditor already has a totals row rendered inside `<TableBody>` (not `<TableFooter>`), showing "Total Scheduled Value".
   - What's unclear: Should this be migrated to a proper `<TableFooter>` with sticky positioning, or left as-is?
   - Recommendation: Migrate to `<TableFooter className="sticky bottom-0">` for consistency.

3. **G703Continuation existing inline totals row**
   - What we know: Same situation — existing totals row in `<TableBody>`, not `<TableFooter>`.
   - Recommendation: Migrate to `<TableFooter>` and expand to recommended AIA G702 columns.

4. **Max-height values for financial tables**
   - What we know: Sticky requires a max-height. No specific values are defined in the codebase yet.
   - Recommendation: Use `max-h-[70vh]` as the default for full-page financial tables; `max-h-[500px]` for embedded tables within a card.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Radix ScrollArea for table scrolling | Plain div with overflow-auto | Prior decision (v1.6 research) | Sticky headers work correctly |
| Inline `Intl.NumberFormat` instances | `CurrencyDisplay` component | Phase 41 established pattern | TABLE-03 requires migrating old instances |
| Lifecycle-specific StatusBadge wrappers | Shared StatusBadge with variantMap | This phase | One fewer component file |
| `active` variant = brand blue | `active` variant = green | This phase | 4-tier model alignment |

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `apps/web/components/ui/table.tsx` — current table structure, no sticky, no frozen col
- `apps/web/components/shared/status-badge.tsx` — current 9-variant CVA setup; `active` is brand-primary
- `apps/web/components/estimates/lifecycle/StatusBadge.tsx` — thin wrapper over shared badge; 1 call site
- `apps/web/app/(dashboard)/projects/components/projects-table.tsx` — existing TanStack sort pattern with `getSortedRowModel()`
- `apps/web/components/budget/budget-line-item-table.tsx` — inline Intl.NumberFormat, raw table, no TanStack
- `apps/web/components/payment-app/g703-continuation.tsx` — overflow-x-auto wrapper, existing inline totals
- `apps/web/components/payment-app/sov-editor.tsx` — existing inline totals row in TableBody
- `apps/web/package.json` — confirmed: @tanstack/react-table@^8.21.3, react-number-format@^5.4.4, lucide-react@^0.460.0
- `apps/web/tailwind.config.ts` — financial token classes confirmed present

### Secondary (MEDIUM confidence)
- CSS specification for `position: sticky` — well-documented, cross-browser consistent in modern browsers; z-index layering for table cells is established pattern
- Prior codebase decision (v1.6 research): do NOT use Radix ScrollArea — confirmed open GitHub issue radix-ui/primitives #2783

---

## Metadata

**Confidence breakdown:**
- Table sticky/frozen implementation: HIGH — based on CSS spec behavior directly observed in existing overflow-x-auto wrappers
- TanStack sort pattern: HIGH — existing working code in projects-table.tsx; `enableSortingRemoval` is documented TanStack v8 option
- StatusBadge consolidation: HIGH — only 1 legacy call site; mapping is straightforward
- Status badge 4-tier model: HIGH — existing variants already map correctly; only `active` color needs change
- Footer totals: HIGH — direct implementation, no external dependencies

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (stable CSS + stable library versions)
