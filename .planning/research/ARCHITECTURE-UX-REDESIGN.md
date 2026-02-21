# Architecture: UX Redesign Integration

**Domain:** Large-scale UX redesign in existing Next.js 14 + Tailwind CSS + shadcn/ui production application
**Researched:** 2026-02-21
**Confidence:** HIGH — all patterns verified against actual codebase files and official documentation

---

## Executive Summary

This is an integration architecture document, not a greenfield design. BIDAXIOM already has a working, mature design token system, dark mode infrastructure, and component library. The redesign work is about evolving what exists — not replacing it. The five architectural questions map to five concrete patterns below.

Key finding: the existing CSS variable architecture in `globals.css` is already well-structured for a redesign. Dark mode uses the `.dark` class on `<html>` (set by `next-themes`), which means all token changes propagate automatically to dark mode variants as long as both `:root` and `.dark` blocks are updated together. This is the lowest-risk approach possible for a token overhaul.

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     Design Token Layer                            │
│   globals.css: :root { } and .dark { }                           │
│   tailwind.config.ts: extends tokens → utility classes           │
│   No JS re-renders for theme changes (CSS-only cascade)          │
├──────────────────────────────────────────────────────────────────┤
│                  Component Variant Layer (CVA)                    │
│   components/ui/         — shadcn primitives (modify in place)   │
│   components/shared/     — cross-domain shared (StatusBadge etc) │
│   components/[domain]/   — domain-specific (budget, estimates)   │
├──────────────────────────────────────────────────────────────────┤
│                    TanStack Table Layer                           │
│   Two distinct table modes:                                       │
│   1. Read-only display tables (documents, projects list, CO list) │
│   2. Inline-edit spreadsheets (estimate line items, SOV builder)  │
│   Both use @tanstack/react-table v8.21.3 + components/ui/table   │
├──────────────────────────────────────────────────────────────────┤
│                    Page/Route Layer                               │
│   app/(dashboard)/projects/[projectSlug]/  — tabbed project view │
│   project-tabs.tsx = navigation; page.tsx = content per tab      │
│   No layout.tsx exists at [projectSlug] level yet                │
└──────────────────────────────────────────────────────────────────┘
```

---

## Pattern 1: Design Token Overhaul Without Breaking Dark Mode

### The Existing Token Architecture

The application already has a complete, working token system in `apps/web/app/globals.css`. The structure is correct — CSS variables in `:root` (light mode) and `.dark` (dark mode), consumed as Tailwind utilities via `tailwind.config.ts`. The theme provider (`next-themes`) switches the `.dark` class on `<html>` via `attribute="class"`, which cascades instantly without React re-renders.

Current token inventory:
- Spacing: `--spacing-compact-xs` through `--spacing-compact-xl` (4px–24px)
- Colors: full semantic set (`--background`, `--foreground`, `--primary`, `--muted`, `--card`, etc.)
- Sidebar: separate sidebar token namespace (`--sidebar-background`, etc.)
- Typography: `--font-size-xs` through `--font-size-2xl`
- Radius: `--radius: 0.25rem` (already Procore-style sharp, set in Phase 13)
- Brand: `--primary: 188 80% 45%` (cyan-teal H=188), `--brand-slate`, `--accent-construction`

### Token Change Protocol (Preserves Dark Mode)

The rule: **every `:root` change requires a corresponding `.dark` change**. The two blocks must be edited as a unit.

```css
/* SAFE: Both blocks updated together */
:root {
  --card: 0 0% 100%;              /* was: same */
  --card-foreground: 210 25% 25%; /* was: same */
}

.dark {
  --card: 240 10% 8%;             /* adjusted: slightly lighter for redesign */
  --card-foreground: 0 0% 98%;    /* was: same */
}
```

The dangerous pattern is updating `:root` and forgetting `.dark`. This is where redesigns break dark mode — a `text-blue-600` hardcoded in JSX has no dark mode variant, but a `text-primary` does because `--primary` is defined in both blocks.

### Token Addition Strategy for Redesign

For a redesign that needs new semantic tokens (e.g., a "surface" layer between card and background, or a financial-positive/financial-negative color):

```css
/* 1. Add to :root */
:root {
  --surface: 220 14% 97%;          /* subtle off-white surface layer */
  --surface-foreground: 210 25% 25%;
  --financial-positive: 142 71% 35%;  /* semantic green for budget surplus */
  --financial-negative: 0 70% 45%;    /* semantic red for budget deficit */
}

/* 2. ALWAYS add dark variants immediately */
.dark {
  --surface: 240 10% 8%;           /* dark surface (darker than card) */
  --surface-foreground: 0 0% 98%;
  --financial-positive: 142 65% 45%;  /* brighter in dark mode */
  --financial-negative: 0 65% 55%;
}
```

```typescript
/* 3. Register in tailwind.config.ts extend.colors */
surface: {
  DEFAULT: 'hsl(var(--surface))',
  foreground: 'hsl(var(--surface-foreground))',
},
'financial-positive': 'hsl(var(--financial-positive))',
'financial-negative': 'hsl(var(--financial-negative))',
```

### What to Avoid During Token Overhaul

Hardcoded Tailwind color classes bypass the token system entirely and break dark mode:

```tsx
// BAD — hardcoded, no dark mode
<div className="text-blue-600 bg-gray-100">

// GOOD — uses token, dark mode automatic
<div className="text-primary bg-muted">

// ALSO BAD — even if it looks fine in light mode
<div className="text-green-600"> // in CurrencyDisplay, budget-summary-cards etc
// Use CurrencyDisplay colorize prop or a new CSS token instead
```

Current violations to fix during redesign (verified from codebase):
- `budget-summary-cards.tsx`: `text-blue-600`, `text-amber-600`, `text-slate-600` — hardcoded
- `budget-line-item-table.tsx`: `text-red-600`, `text-green-600` on lock icons — hardcoded
- `project-header.tsx`: `bg-slate-500/10 text-slate-600 border-slate-200` on mode badge — hardcoded
- `status-badge.tsx`: uses `dark:` prefix correctly — this is the right pattern to follow

---

## Pattern 2: Phasing a Redesign Across Many Pages — Minimal Regression Risk

### The Page Inventory

Pages affected by redesign (verified from route directories):
- **Project detail tabs** (10 tabs per project): Overview, Documents, Budget, Commitments, Change Orders, SOV, Payment Apps, Invoices, RFQs, Estimates
- **List views**: Projects list, Customers list, Estimates list
- **Detail views**: Change Order detail, Payment App detail, RFQ detail, Estimate detail
- **Forms**: Project create/edit, Customer create/edit, CO create, Payment App create
- **Settings pages**: Company, Integrations, etc.

### Phase Ordering — Low Risk to High Risk

Phase pages by blast radius. Start with surfaces that share no components with high-traffic flows.

**Phase A — Token layer only (zero regression risk):**
Update `globals.css` tokens. This is invisible unless something was hardcoded. Run dark mode smoke test after each token change. Affects entire app simultaneously — but only changes what uses the token system, not hardcoded classes.

**Phase B — Shared UI components (shadcn layer):**
Modify `components/ui/` in place (shadcn's recommended approach for owned components). Changes propagate across all uses automatically. Test: render every variant of every modified component in both light and dark mode before shipping.

Order within Phase B:
1. `table.tsx` — affects all table views, high impact
2. `button.tsx` — affects every page, but changes are usually subtle
3. `card.tsx` — affects summary cards, project header metrics
4. `tabs.tsx` — affects project navigation (currently custom Link-based nav, not Tabs primitive)
5. `badge.tsx` — affects StatusBadge, document type chips

**Phase C — Shared domain components (medium risk):**
`components/shared/` has only two files: `status-badge.tsx` and `currency-display.tsx`. These are used in 10+ locations each. Modify with care; verify at each use site.

**Phase D — Domain components, one domain at a time (contained risk):**
Tackle one feature domain per PR:
1. Budget (budget-summary-cards, budget-line-item-table, commitment-list, forecast-metrics)
2. Change Orders (change-order-list, change-order-detail)
3. Payment Apps
4. Estimates (most complex — EstimateLineItemsTable has inline editing)
5. Documents (unified-document-table from Phase 40 — newest, safest to redesign)

**Phase E — Layout/navigation (highest coordination cost):**
Modify project-header.tsx, project-tabs.tsx, app-shell.tsx last. These are shared across all project detail pages. A regression here breaks the entire project detail experience.

### Regression Detection Strategy

No formal test suite exists in this codebase (no test files found). Regression strategy must be visual and manual:

1. **Component isolation**: For each modified component, verify in both light/dark mode before committing to the branch
2. **Route smoke test list**: Maintain a checklist of the 10 project tabs + 3 list views — spot-check after each domain phase
3. **Dark mode coverage**: Every PR touching JSX must be manually verified in dark mode
4. **Hardcoded color audit**: Run this grep before each phase to catch violations:
   ```bash
   grep -r "text-blue-\|text-green-\|text-red-\|text-gray-\|bg-gray-\|bg-blue-\|bg-green-" \
     apps/web/components/[domain]/ --include="*.tsx"
   ```

---

## Pattern 3: TanStack Table v8 for Dense Procore-Style Financial Data Grids

### Two Table Modes in This Codebase

**Mode 1 — Display grids** (documents, projects list, change orders, payment apps):
- Read-only rows, click to navigate or download
- Needs: compact row height, sort headers, optional selection checkboxes
- Currently used: `unified-document-table.tsx` (most mature example)

**Mode 2 — Spreadsheet/inline-edit grids** (estimate line items, SOV builder):
- Cell-level editing with Input and Select components inside cells
- Needs: no vertical centering waste, minimal cell padding, keyboard tab navigation
- Currently used: `EstimateLineItemsTable.tsx`

### Dense Grid Configuration for Display Mode

The default shadcn `Table` component uses `h-10` on TableHead and `p-2` on TableCell. For a dense Procore-style grid (target: 32px row height vs default ~40px):

```typescript
// In useReactTable configuration:
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  // Column sizing via CSS variables (TanStack v8 recommended approach)
  columnResizeMode: 'onChange',
  defaultColumn: {
    minSize: 60,
    maxSize: 400,
  },
});
```

```tsx
// Dense TableHead — reduce h-10 to h-8, keep px-2
<TableHead
  className="h-8 px-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/50"
  style={{ width: header.column.getSize() }}
>

// Dense TableCell — reduce p-2 to py-1.5 px-2
<TableCell className="py-1.5 px-2 text-sm">
```

**Sticky header pattern for long financial tables:**

```tsx
// Wrap the table in a fixed-height container
<div className="relative overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
  <Table>
    <TableHeader className="sticky top-0 z-10 bg-background">
      {/* headers */}
    </TableHeader>
    <TableBody>
      {/* rows */}
    </TableBody>
  </Table>
</div>
```

Note: The existing `<div className="relative w-full overflow-auto">` wrapper in `components/ui/table.tsx` handles horizontal scroll. For sticky header, wrap the outer div with a max-height constraint, and add `sticky top-0 z-10 bg-background` to `TableHeader`. The `bg-background` is critical — without it, rows scroll behind the transparent header.

### Column Width Strategy for Financial Grids

Financial grids need right-aligned numeric columns with fixed widths. Use `size` in ColumnDef and `tabular-nums` class on cells:

```typescript
const columns: ColumnDef<BudgetLineItem>[] = [
  {
    accessorKey: 'description',
    header: 'Description',
    size: 300,    // fixed pixel width
    minSize: 150,
    maxSize: 600,
    cell: ({ row }) => (
      <span className="block truncate">{row.original.description}</span>
    ),
  },
  {
    accessorKey: 'budgetedAmount',
    header: () => <div className="text-right">Budgeted</div>,
    size: 120,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        <CurrencyDisplay amount={Number(row.original.budgetedAmount)} />
      </div>
    ),
  },
  {
    accessorKey: 'variance',
    header: () => <div className="text-right">Variance</div>,
    size: 120,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        <CurrencyDisplay
          amount={Number(row.original.budgetedAmount) - Number(row.original.actualAmount)}
          colorize
          showSign
        />
      </div>
    ),
  },
];
```

Apply column widths via inline style (TanStack v8 recommendation for performance — avoids getSize() on every cell):

```tsx
// Memoize column sizes upfront
const columnSizeVars = React.useMemo(() => {
  const colSizes: Record<string, number> = {};
  for (const header of table.getFlatHeaders()) {
    colSizes[`--col-${header.id}-size`] = header.column.getSize();
  }
  return colSizes;
}, [table.getState().columnSizingInfo, table.getState().columnSizing]);

// Apply to table element
<table style={columnSizeVars as React.CSSProperties}>
  {/* headers use: style={{ width: `var(--col-${header.id}-size)px` }} */}
```

### Sort Indicator Pattern

```tsx
// Clickable sort header with indicator
<TableHead
  className="cursor-pointer select-none hover:bg-muted/70"
  onClick={header.column.getToggleSortingHandler()}
>
  <div className="flex items-center gap-1">
    {flexRender(header.column.columnDef.header, header.getContext())}
    {{
      asc: <ChevronUp className="h-3 w-3" />,
      desc: <ChevronDown className="h-3 w-3" />,
    }[header.column.getIsSorted() as string] ?? (
      <ChevronsUpDown className="h-3 w-3 opacity-30" />
    )}
  </div>
</TableHead>
```

### Totals Row Pattern (Financial Grids)

The existing `TableFooter` from `components/ui/table.tsx` already has the right styling (`border-t bg-muted/50 font-medium`). Use it for summary/totals rows:

```tsx
<TableFooter>
  <TableRow>
    <TableCell colSpan={2} className="font-semibold">Total</TableCell>
    <TableCell className="text-right tabular-nums font-semibold">
      <CurrencyDisplay amount={totalBudgeted} />
    </TableCell>
    <TableCell className="text-right tabular-nums font-semibold">
      <CurrencyDisplay amount={totalActual} />
    </TableCell>
    <TableCell className="text-right tabular-nums font-semibold">
      <CurrencyDisplay amount={variance} colorize showSign />
    </TableCell>
  </TableRow>
</TableFooter>
```

### Row Grouping for Budget Tables (CSI Division Groups)

For the budget line item table redesign, group rows by CSI division with a sticky group header:

```typescript
// Add grouping to table config
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getGroupedRowModel: getGroupedRowModel(),
  state: { grouping: ['costDivision'] },
  groupedColumnMode: false,
});
```

Group header rows use the `SectionSubtotal` pattern already established in `EstimateLineItemsTable`.

---

## Pattern 4: Component Audit and Cleanup Process

### Audit Targets — Verified from Codebase

**Layer 1: Hardcoded color violations** (highest priority — these break dark mode)

| File | Hardcoded Classes | Fix |
|------|------------------|-----|
| `budget-summary-cards.tsx` | `text-blue-600`, `text-amber-600`, `text-slate-600` | Use `text-primary`, financial tokens |
| `budget-line-item-table.tsx` | `text-red-600`, `text-green-600` on icons | Use `text-destructive`, `text-success` tokens |
| `project-header.tsx` | `bg-slate-500/10 text-slate-600 border-slate-200` | Use `text-muted-foreground` / brand tokens |
| `estimates/StatusBadge.tsx` | Ad-hoc badge (separate from shared StatusBadge) | Consolidate into shared StatusBadge |

**Layer 2: Duplicate component instances**

The estimates domain has its own `StatusBadge` at `components/estimates/lifecycle/StatusBadge.tsx`. The shared `StatusBadge` was built in Phase 19 specifically to replace these. The estimates version predates Phase 19 and was not replaced. Audit and replace during redesign.

**Layer 3: Missing CVA coverage**

The `BudgetSummaryCards` has no CVA variants — the summary card layout is hardcoded inline. If the redesign adds a "compact" variant of summary cards (for sidebar or mobile), CVA should be added.

### Audit Execution Approach

Run a systematic search before starting the redesign:

```bash
# 1. Find all hardcoded color classes
grep -rn "text-blue-\|text-green-\|text-red-\|text-amber-\|text-gray-\|bg-gray-\|bg-blue-" \
  apps/web/components/ --include="*.tsx" > audit-hardcoded-colors.txt

# 2. Find inline formatting (not using CurrencyDisplay)
grep -rn "Intl.NumberFormat\|\.toFixed(2)\|toLocaleString" \
  apps/web/components/ --include="*.tsx" > audit-inline-format.txt

# 3. Find components using p-4, p-6 (potentially inconsistent with compact-* system)
grep -rn "\" p-4\|\" p-6\|\" p-8\| px-4\| px-6\| py-4\| py-6" \
  apps/web/components/ --include="*.tsx" > audit-spacing.txt
```

These three audits should be run before writing any redesign code. The results define the scope of cleanup work.

### CVA Variant Pattern for New Components

All new shared components must use CVA with explicit dark mode support via CSS variables (not `dark:` prefix classes):

```typescript
// PREFER: CSS token (automatic dark mode)
const cardVariants = cva(
  "rounded border bg-card text-card-foreground",
  {
    variants: {
      density: {
        default: "p-4",
        compact: "p-2",
        dense: "p-1.5",
      },
    },
    defaultVariants: { density: "default" },
  }
)

// AVOID: dark: prefix (manual, brittle)
const cardVariants = cva(
  "rounded border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100",
  // ...
)
```

The existing `StatusBadge` in `components/shared/status-badge.tsx` uses the `dark:` prefix pattern. This works but is more brittle than CSS variables. For the redesign, prefer token-based colors for new components.

---

## Pattern 5: CSS Architecture for Tailwind-Based Design Systems at This Scale

### The Three-Layer Model

This codebase correctly separates concerns across three layers. The redesign must preserve this separation:

```
Layer 1: globals.css         — semantic tokens (:root, .dark)
Layer 2: tailwind.config.ts  — token → utility class mapping
Layer 3: component classes   — utility composition via CVA or cn()
```

Never skip layers. Do not define colors in `tailwind.config.ts` without a CSS variable backing them (or they won't be theme-switchable). Do not define hardcoded colors in components (they bypass the token system).

### Spacing Discipline

The project already has a compact spacing system (`--spacing-compact-xs` through `--spacing-compact-xl`). These map to Tailwind utilities `compact-xs`, `compact-sm`, etc. The problem: most components use Tailwind's default spacing (`p-2`, `p-4`, `gap-4`) rather than the compact tokens.

**Recommendation:** The compact tokens are the right system for a dense financial app. The redesign is an opportunity to enforce their use. Establish a rule: all new or redesigned components in domain directories use `compact-*` spacing. The `components/ui/` primitives keep standard spacing (they're used in dialogs, forms, etc. where density isn't the goal).

### The `cn()` Composition Pattern

The `cn()` utility (from `@/lib/utils`, wraps `clsx` + `tailwind-merge`) is the correct composition mechanism. All class merging goes through `cn()`:

```typescript
// This is already the pattern in use — preserve it
<TableCell
  className={cn(
    "py-1.5 px-2 text-sm tabular-nums",
    isOverBudget && "text-destructive font-semibold",
    className  // allow caller override
  )}
/>
```

The `className` passthrough pattern (always include `className` as a prop with `cn(baseClasses, className)`) must be preserved on all shared and UI components. This is how the redesign can layer visual changes from outside without modifying internals.

### What Tailwind v4 Means for This Project

The search results indicate Tailwind v4 has shipped and changes the config model (`@theme` directive replaces `tailwind.config.ts`). However, this project uses Tailwind v3.4.x (verified from `package.json`: `"tailwindcss": "^3.4.0"`). Do NOT migrate to Tailwind v4 as part of this redesign milestone. The existing v3 CSS variable + `tailwind.config.ts` pattern is stable and correct. Mixing v4 migration into a UX redesign doubles the risk surface.

### Import Discipline — No Barrel Exports

The `COMPONENT-ORGANIZATION.md` already specifies this: import directly from file path, not through a barrel index. This prevents tree-shaking issues at scale (164K lines is large enough that tree-shaking matters):

```typescript
// CORRECT
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";

// WRONG — breaks tree-shaking
import { StatusBadge, CurrencyDisplay } from "@/components/shared";
```

---

## Component Boundary Map

### What Exists and Must Not Be Replaced

| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| `Button` | `ui/button.tsx` | Modify | CVA variants already correct; extend size/variant if needed |
| `Table` / `TableHead` / etc | `ui/table.tsx` | Modify | Reduce row height for dense mode |
| `Badge` | `ui/badge.tsx` | No change | Used for type/status chips |
| `Tabs` / `TabsList` / etc | `ui/tabs.tsx` | No change | Currently not used for project nav (custom Link-based nav instead) |
| `Card` / `CardHeader` / etc | `ui/card.tsx` | Modify | Adjust border/shadow for flat design |
| `StatusBadge` | `shared/status-badge.tsx` | Modify | Extend with new variants if needed; consolidate estimates StatusBadge into this |
| `CurrencyDisplay` | `shared/currency-display.tsx` | No change | Already correct |

### What Must Be Created (New)

| Component | Location | Purpose |
|-----------|----------|---------|
| `DataTable` (generic) | `shared/data-table.tsx` | Reusable TanStack table shell with dense defaults, sort headers, empty state, skeleton — if 3+ tables need the same chrome |
| Financial summary row | `shared/financial-summary-row.tsx` | Consistent footer row for budget totals (if shared across Budget, CO, Payment Apps) |

Note: `DataTable` extraction is only warranted if Budget, CO, and Payment Apps all converge on the same visual chrome. If they differ, keep separate tables in domain folders per the extraction rule.

### What Must NOT Be Extracted

| Component | Where to keep | Why |
|-----------|--------------|-----|
| `EstimateLineItemsTable` | `estimates/line-items/` | Inline editing, drag-drop, section subtotals — too domain-specific |
| `SOVBuilder` | `estimates/sov/` | Drag-and-drop SOV card layout — completely unique |
| `BudgetVarianceChart` | `budget/` | Recharts component specific to budget alerts |
| `WorkflowDetail` | `workflow/` | Complex workflow state machine UI |

---

## Data Flow for Redesign Changes

### Token Change Propagation

```
Edit globals.css (:root + .dark together)
    ↓
Tailwind JIT recompiles utilities from updated CSS vars
    ↓
All components using token-based utilities update automatically
    ↓ (only if violations exist)
Hardcoded classes (text-blue-600 etc.) do NOT update — manual fix required
```

### Component Modification Path

```
Identify target component (e.g., TableHead)
    ↓
Check all use sites (grep for import path)
    ↓
Apply visual change with className passthrough preserved
    ↓
Verify in light mode → dark mode → both
    ↓
Run hardcoded color grep on modified file
    ↓
Commit as atomic change (one component per commit)
```

---

## Integration Points — Explicit File List

### Files to Modify (Existing)

| File | Type | What Changes |
|------|------|-------------|
| `apps/web/app/globals.css` | Token definitions | Add/adjust tokens for redesign; ensure `:root` + `.dark` parity |
| `apps/web/tailwind.config.ts` | Config | Register any new token-backed color utilities |
| `apps/web/components/ui/table.tsx` | Shared primitive | Dense row height: TableHead `h-10` → `h-8`; TableCell `p-2` → `py-1.5 px-2` |
| `apps/web/components/ui/button.tsx` | Shared primitive | Extend with icon-only compact variant if needed |
| `apps/web/components/ui/card.tsx` | Shared primitive | Remove shadow if moving to flat design; adjust padding |
| `apps/web/components/ui/badge.tsx` | Shared primitive | Add `success`, `warning`, `info` variants for document type/status chips |
| `apps/web/components/shared/status-badge.tsx` | Domain shared | Consolidate estimates StatusBadge; potentially token-ize dark: prefix classes |
| `apps/web/components/budget/budget-summary-cards.tsx` | Domain | Replace hardcoded color classes with semantic tokens |
| `apps/web/components/budget/budget-line-item-table.tsx` | Domain | Migrate to TanStack Table (currently uses manual Table primitives); add dense config |
| `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx` | Layout | Replace hardcoded `bg-slate-500/10` etc. with tokens |

### Files to Create (New)

| File | Purpose | Dependencies |
|------|---------|-------------|
| `apps/web/components/shared/data-table.tsx` | Generic TanStack table shell (if warranted by audit) | `@tanstack/react-table`, `ui/table`, `ui/skeleton` |
| `apps/web/components/shared/financial-summary-row.tsx` | Reusable totals footer row | `ui/table`, `CurrencyDisplay` |

### Files That Must NOT Change (Scope Boundary)

- All files in `apps/api/` — no backend changes in this milestone
- `apps/web/middleware.ts` — auth middleware, not touched
- `apps/web/lib/trpc.ts`, `apps/web/lib/auth-context.tsx` — data layer unchanged
- `apps/web/app/providers.tsx` — provider stack unchanged (ThemeProvider already correct)

---

## Build Order

Dependencies flow from tokens → primitives → shared → domain → layout. This order minimizes rework:

```
Step 1: Token audit and update (globals.css)
  - Run hardcoded color grep across all components first
  - Update :root and .dark blocks atomically
  - Verify dark mode on layout, sidebar, topbar

Step 2: UI primitive modifications (components/ui/)
  - table.tsx dense row heights
  - badge.tsx new variants
  - card.tsx flat design adjustments
  - Verify each in light + dark

Step 3: Shared component cleanup (components/shared/)
  - Consolidate estimates/StatusBadge into shared/status-badge
  - Extend StatusBadge variants as needed

Step 4: Domain component redesign (one domain PR each)
  - Budget domain first (most tables, most financial data)
  - Change Orders / Payment Apps (similar layout to Budget)
  - Documents (Phase 40 already redesigned — verify new design is consistent)
  - Estimates (most complex — inline editing requires care)

Step 5: Layout/navigation (project-header, project-tabs, app-shell)
  - Last because these are shared across all project pages
  - Highest regression risk if modified first
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Hardcoded Colors in Domain Components

**What happens:** Developer writes `text-green-600` for "positive" financial values. Works perfectly in light mode. In dark mode, `text-green-600` is still `text-green-600` — it doesn't get lighter. The contrast against a dark background is fine but the tone is wrong.

**Prevention:** Use `CurrencyDisplay colorize` prop or a `--financial-positive` token. The `CurrencyDisplay` component already exists and handles the colorize pattern correctly.

### Anti-Pattern 2: Modifying shadcn UI Primitives Without Checking All Use Sites

**What happens:** TableHead height is changed from `h-10` to `h-8` in `ui/table.tsx`. The BudgetLineItemTable gets denser — desired. But a dialog somewhere uses a Table inside a Card inside a Dialog, and the reduced height makes the dialog feel cramped in an unintended way.

**Prevention:** Before modifying any `ui/` component, grep for every import of that component across the app. Spot-check 3-4 use sites before committing.

### Anti-Pattern 3: Extracting to `shared/` Prematurely During Redesign

**What happens:** Developer notices BudgetSummaryCards and ChangeOrderSummary look similar during redesign. They extract a generic `SummaryCards` component with many props to handle both. Six months later the two components diverge in ways that make the abstraction painful.

**Prevention:** Apply the documented extraction threshold: 3+ uses, unlikely to diverge. Budget summary cards are used in exactly one place. Keep them in `components/budget/`.

### Anti-Pattern 4: Migrating to Tailwind v4 During This Redesign

**What happens:** Developer discovers Tailwind v4's `@theme` directive is "the right way" to do design tokens. They migrate. The shadcn CLI, the existing `components.json` configuration, and the animation plugin (`tailwindcss-animate`) all need changes. The redesign takes 3x longer.

**Prevention:** This project is on Tailwind v3.4.x with a working, correct token system. Do not migrate. Flag Tailwind v4 upgrade as a separate future milestone.

### Anti-Pattern 5: Creating a New Table Component Instead of Configuring TanStack

**What happens:** Developer finds the BudgetLineItemTable hard to style and creates a new `ProFinancialTable` component from scratch using divs and CSS grid for "full control." The existing TanStack infrastructure (sorting, selection, column sizing) is reimplemented manually.

**Prevention:** The existing `@tanstack/react-table` v8 is already installed and used in `unified-document-table.tsx` and `EstimateLineItemsTable.tsx`. Configuration (row height, column widths, sticky headers) is CSS-only. No new table library needed.

---

## Scaling Considerations

| Context | Architecture Concern | Resolution |
|---------|---------------------|-----------|
| Dense grids with 100+ rows | Render performance | Use `React.useMemo` for column definitions (already done in `unified-document-table`). Add `@tanstack/react-virtual` if > 500 visible rows needed. |
| Many pages touching same tokens | Dark mode regression | Single-file CSS token ownership (`globals.css`) means changes are centralized. Run dark mode smoke test per token change. |
| Designers adding new brand colors | Token proliferation | Gate new token additions — they must have a semantic name and both `:root` and `.dark` variants. Reject raw color values without semantic wrapper. |
| Multiple developers editing shared components | Merge conflicts | Keep `components/ui/` changes small and atomic. Never batch multiple component changes in one PR. |

---

## Sources

All findings are HIGH confidence, drawn from:

- **Codebase inspection (primary source):**
  - `apps/web/app/globals.css` — token structure, dark mode blocks
  - `apps/web/tailwind.config.ts` — token registration, custom utilities
  - `apps/web/components/ui/table.tsx` — current row height (`h-10`, `p-2`)
  - `apps/web/components/project/documents/unified-document-table.tsx` — TanStack v8 in use
  - `apps/web/components/estimates/line-items/EstimateLineItemsTable.tsx` — TanStack v8 inline edit mode
  - `apps/web/components/shared/status-badge.tsx` — CVA + dark: prefix pattern
  - `apps/web/components/shared/currency-display.tsx` — correct token-based colorize
  - `apps/web/components/budget/budget-summary-cards.tsx` — hardcoded color violations
  - `apps/web/COMPONENT-ORGANIZATION.md` — extraction rules and extraction threshold
  - `apps/web/components.json` — shadcn config (`style: new-york`, `cssVariables: true`)

- **Official Documentation (MEDIUM confidence — verified at time of research):**
  - [TanStack Table v8 Column Sizing Guide](https://tanstack.com/table/v8/docs/guide/column-sizing)
  - [shadcn/ui Theming Documentation](https://ui.shadcn.com/docs/theming)
  - [TanStack Table v8 Sticky Column Pinning Example](https://tanstack.com/table/v8/docs/framework/react/examples/column-pinning-sticky)

- **Web Research (LOW-MEDIUM confidence):**
  - [Tailwind v4 + shadcn/ui theming](https://ui.shadcn.com/docs/tailwind-v4) — confirmed v4 migration NOT warranted for this project (v3 is stable and correct)
  - [Building a Scalable Design System with shadcn/UI and Tailwind CSS](https://shadisbaih.medium.com/building-a-scalable-design-system-with-shadcn-ui-tailwind-css-and-design-tokens-031474b03690)

---

*Architecture research for: BIDAXIOM UX Redesign Integration*
*Researched: 2026-02-21*
*Confidence: HIGH (codebase-grounded, official docs verified)*
