# Phase 52: Trade Simplification - Research

**Researched:** 2026-02-24
**Domain:** Subcontractor directory — schema migration, UI multi-select, shared constants
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Existing trade data
- Existing CSI codes are **cleared to null** — no auto-mapping to the new 12 trades
- Subcontractors with no trade assigned display a dash (—) in the list row trade column
- A **new `trade` column** is added to the schema (do not repurpose the existing `csi_division` column)
- The trade filter dropdown does **not** include an "Unassigned" or "No trade" option — subs with null trade always appear in "All" only

#### Multi-trade support
- Each subcontractor can have **multiple trades** (not single-select)
- The form control is a **combobox with checkboxes** — click to open, check each applicable trade
- In the subcontractor list row, trades display as **first trade badge + overflow count**: e.g., `[Plumbing] +2`
- The filter uses **any-match logic**: a sub with Plumbing + HVAC appears when filtering by either Plumbing or HVAC

#### "Other" trade behavior
- When "Other" is selected, an **optional free-text field** appears for the user to specify the trade (e.g., "Elevator installation")
- In the list row, the **custom text is shown** (not "Other") if a custom description was entered; if no custom text, show "Other"
- "Other" **is included** as a filter option in the dropdown — filtering by Other shows all subs that selected Other, regardless of custom text

#### Trade display surfaces
- **Global search (Cmd+K):** The sub's trade(s) appear next to the subcontractor name in search results (plain-English trade names, not CSI codes)
- **Sub detail page:** Trades appear in the **main details field section** (alongside company name, email, phone — not in a header badge)
- **RFQs:** Out of scope — not updated in this phase

### Claude's Discretion
(None specified — all decisions are locked)

### Deferred Ideas (OUT OF SCOPE)
- RFQ trade filter — explicitly out of scope for this phase, but should use the same 12-trade list when updated
- Trade-based subcontractor suggestions during RFQ creation — future capability
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TRADE-01 | The trade selector on the subcontractor create and edit forms shows exactly: Plumbing, Electrical, HVAC, Concrete, Metal Buildings, Framing, Roofing, Painting, Flooring, Drywall, General, Other — no CSI codes or division numbers | Implemented by replacing the CSI_DIVISIONS checkbox list in `SubcontractorForm` with a new `TradeCombobox` component backed by the `SIMPLE_TRADES` constant; Zod schema updated to `z.array(tradeValueEnum)` |
| TRADE-02 | The trade filter dropdown on the subcontractors list page uses the same 12-item list | Implemented by replacing the `CSI_DIVISIONS` Select in `SubcontractorsPage` with the same `SIMPLE_TRADES` constant; filter passes a trade string to the tRPC `list` procedure which uses JSONB `@>` containment on the new `trade` column |
</phase_requirements>

---

## Summary

The current subcontractor system stores trades as `JSONB number[]` referencing CSI division numbers (e.g., `[3, 9, 22]`). The new system replaces this with a plain `text[]` JSONB column storing string trade names from a fixed 12-item list. A new column `trade` is added to `subcontractor_directory`; the old `trades` column is left in place (still used by RFQs — out of scope). The existing `trades` column on `subcontractor_directory` is cleared to `[]` by the migration and the new `trade` column holds the new string array. The "Other" trade carries an optional companion field `tradeOther: text` for the free-text description.

The UI changes are well-bounded: `SubcontractorForm` replaces its scrollable CSI checkbox list with a new `TradeCombobox` component (popover + checkboxes, same Popover primitives the existing `combobox.tsx` uses). The list page replaces its `Select` trade filter with a simple `Select` over the 12 names. The detail page replaces the CSI badge section with plain-English trade names. The command palette adds a subtitle line showing trade names for subcontractor results.

The migration pattern is well-established in this codebase: a standalone `.ts` script under `apps/api/src/db/migrations/` that loops over `tenants WHERE status = 'active'`, uses raw pg client with `BEGIN`/`COMMIT`/`ROLLBACK`, and uses `ADD COLUMN IF NOT EXISTS`. Critically, `apps/api/src/tenant/provision.ts` ALSO contains the raw SQL `CREATE TABLE subcontractor_directory` and must be updated to include the new columns for future new tenants.

**Primary recommendation:** Add a `SIMPLE_TRADES` constant and `TradeValue` union type to `packages/shared`, add `trade text[]` JSONB + `tradeOther text` columns to both the DB schema and provision.ts, write the migration script, then update the form, list, detail page, search router, and command palette in sequence.

---

## Current State Audit

### What exists today (HIGH confidence — read directly from source)

| File | Current behavior | What changes |
|------|-----------------|--------------|
| `apps/api/src/db/schema/tenant.ts` | `trades: jsonb("trades").notNull().default([]).$type<number[]>()` on `subcontractor_directory` | Add `trade: jsonb("trade").notNull().default([]).$type<string[]>()` and `tradeOther: text("trade_other")` |
| `apps/api/src/tenant/provision.ts` | `CREATE TABLE subcontractor_directory` has `trades JSONB NOT NULL DEFAULT '[]'::jsonb` — no `trade` or `trade_other` columns (line 1017) | Add `trade JSONB NOT NULL DEFAULT '[]'::jsonb` and `trade_other TEXT` to this raw SQL block |
| `packages/shared/src/types/bidding.ts` | `createSubcontractorSchema`: `trades: z.array(z.number().int())` | Add `trade: z.array(tradeValueEnum).default([])` and `tradeOther: z.string().max(200).optional()` |
| `apps/api/src/trpc/routers/subcontractor.ts` | `list` procedure: `trade: z.number().int().optional()` filter; JSONB `@>` containment check on old `trades` column | Change `trade` filter to `z.string().optional()`; update JSONB containment to target new `trade` column |
| `apps/api/src/trpc/routers/subcontractor.ts` | `getByTrades` procedure: `trades: z.array(z.number().int())` | Out of scope (RFQ surface) — leave unchanged |
| `apps/web/components/bidding/subcontractor-form.tsx` | Scrollable bordered checkbox list of all CSI divisions | Replace with `TradeCombobox` (popover with checkboxes); add conditional `tradeOther` text input |
| `apps/web/app/(dashboard)/subcontractors/page.tsx` | `Select` populated from `CSI_DIVISIONS`, `tradeFilter: number \| null` state | Change to `tradeFilter: string \| null`; populate from `SIMPLE_TRADES` |
| `apps/web/app/(dashboard)/subcontractors/page.tsx` | `getTradeBadges(trades: number[])` shows first 3 CSI badges | Replace with first 1 trade badge + overflow count (e.g., `[Plumbing] +2`) using StatusBadge |
| `apps/web/app/(dashboard)/subcontractors/[subcontractorSlug]/page.tsx` | "Trade Specialties" section renders CSI division badges and reads from `subcontractor.trades` | Show plain-English trade names from `subcontractor.trade`; show `tradeOther` when "Other" selected |
| `apps/api/src/trpc/routers/search.ts` | Subcontractor results have `subtitle: null` | Select `trade` and `tradeOther`; build subtitle string |
| `apps/web/components/search/command-palette.tsx` | Subcontractor `CommandItem` renders no subtitle | Render subtitle using same pattern as Projects/Customers items |
| `apps/web/lib/csi-divisions.ts` | Client-side CSI_DIVISIONS array (50 divisions) | Not deleted — still needed for RFQ UI |

### What does NOT change (OUT OF SCOPE)

- `apps/api/src/trpc/routers/subcontractor.ts` — `getByTrades` procedure (RFQ surface)
- `rfqs` table `trades: jsonb` column — unchanged
- Any RFQ-related UI or router
- `apps/web/lib/csi-divisions.ts` — keep as-is for RFQs
- `CSI_DIVISIONS` export from `packages/shared` — keep as-is for RFQs

---

## Standard Stack

### Core (no new dependencies needed)

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Drizzle ORM | existing | Schema definition + DB queries | Project standard |
| pg (node-postgres) | existing | Raw SQL in migration scripts | Project migration pattern |
| Zod | existing | Schema validation in `@construction/shared` | Project standard |
| shadcn/ui Popover + Checkbox | existing | Combobox with checkboxes UI | Already used by `combobox.tsx` and the form |
| React Hook Form | existing | Form state management | Used in `subcontractor-form.tsx` |

**No new npm packages required.** All needed primitives already exist.

---

## Architecture Patterns

### Pattern 1: Shared Trade Constant in packages/shared

The TRADES list must live in `packages/shared` so both the API (Zod validation) and web (UI options) reference the same source of truth.

**Where:** `packages/shared/src/constants/trades.ts` (new file) exported from `packages/shared/src/constants/index.ts` and `packages/shared/src/index.ts`

```typescript
// packages/shared/src/constants/trades.ts
import { z } from "zod";

export const SIMPLE_TRADES = [
  "Plumbing",
  "Electrical",
  "HVAC",
  "Concrete",
  "Metal Buildings",
  "Framing",
  "Roofing",
  "Painting",
  "Flooring",
  "Drywall",
  "General",
  "Other",
] as const;

export type TradeValue = (typeof SIMPLE_TRADES)[number];
export const tradeValueEnum = z.enum(SIMPLE_TRADES);
```

Update `packages/shared/src/constants/index.ts` (currently only exports `us-states`):
```typescript
export * from "./us-states";
export * from "./trades";
```

### Pattern 2: New DB Columns on subcontractor_directory

**Decision:** Add `trade` column (new), do NOT repurpose existing `trades`. Clear `trades` to `[]` in migration.

```typescript
// In apps/api/src/db/schema/tenant.ts — add to subcontractorDirectory table
trade: jsonb("trade").notNull().default([]).$type<string[]>(),
tradeOther: text("trade_other"),
// Keep existing:
trades: jsonb("trades").notNull().default([]).$type<number[]>(),  // stays for RFQ compat
```

### Pattern 3: Migration Script (established pattern)

All retroactive schema changes use a standalone `.ts` migration script in `apps/api/src/db/migrations/`. Run with `npx tsx` from `apps/api/` dir. Pattern is identical to `migrate-phase38.ts`.

```typescript
// apps/api/src/db/migrations/migrate-phase52.ts
import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let successCount = 0;
let failureCount = 0;
const failures: Array<{ schema: string; error: string }> = [];

for (const row of tenants.rows) {
  const schemaName = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Add new trade column (string array)
    await client.query(`
      ALTER TABLE "${schemaName}".subcontractor_directory
      ADD COLUMN IF NOT EXISTS trade JSONB NOT NULL DEFAULT '[]'::jsonb
    `);
    // Add tradeOther column for "Other" custom descriptions
    await client.query(`
      ALTER TABLE "${schemaName}".subcontractor_directory
      ADD COLUMN IF NOT EXISTS trade_other TEXT
    `);
    // Clear existing CSI trades per spec (no auto-mapping)
    await client.query(`
      UPDATE "${schemaName}".subcontractor_directory
      SET trades = '[]'::jsonb
    `);
    await client.query("COMMIT");
    successCount++;
    console.log(`  OK ${schemaName}`);
  } catch (err) {
    await client.query("ROLLBACK");
    failureCount++;
    failures.push({ schema: schemaName, error: String(err) });
    console.error(`  FAIL ${schemaName}:`, err);
  } finally {
    client.release();
  }
}
console.log(`\nDone: ${successCount} succeeded, ${failureCount} failed`);
await pool.end();
process.exit(failureCount > 0 ? 1 : 0);
```

### Pattern 4: provision.ts Update (CRITICAL)

`apps/api/src/tenant/provision.ts` contains the raw SQL `CREATE TABLE subcontractor_directory` at ~line 1017. It currently defines `trades JSONB NOT NULL DEFAULT '[]'::jsonb` but has no `trade` or `trade_other` columns. New tenants provisioned after this phase would be missing the columns. Both new columns must be added to this CREATE TABLE statement.

```sql
-- Add to the CREATE TABLE subcontractor_directory in provision.ts:
trade JSONB NOT NULL DEFAULT '[]'::jsonb,
trade_other TEXT,
```

### Pattern 5: TradeCombobox Component

The existing `combobox.tsx` is single-select. The new `TradeCombobox` is multi-select with checkboxes. Use Popover + inline div with Checkbox items (no Command/CommandInput needed — only 12 fixed items, no search required).

**Location:** `apps/web/components/bidding/trade-combobox.tsx` (new file)

Key behavior:
- Trigger button shows: nothing selected → "Select trades..."; 1 selected → trade name; 2+ → "{N} trades"
- Dropdown stays open after each selection (do not close on item click)
- Each item renders a Checkbox + label
- The combobox itself does not handle the "Other" text field — that's rendered by the parent form

```tsx
// apps/web/components/bidding/trade-combobox.tsx
"use client";
import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SIMPLE_TRADES } from "@construction/shared";

interface TradeComboboxProps {
  value: string[];
  onChange: (trades: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function TradeCombobox({ value, onChange, placeholder = "Select trades...", className }: TradeComboboxProps) {
  const [open, setOpen] = useState(false);

  const toggle = (trade: string) => {
    onChange(
      value.includes(trade) ? value.filter((t) => t !== trade) : [...value, trade]
    );
    // Do NOT close popover — multi-select stays open
  };

  const triggerLabel =
    value.length === 0
      ? placeholder
      : value.length === 1
      ? value[0]
      : `${value.length} trades`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}>
          <span className={value.length === 0 ? "text-muted-foreground" : undefined}>
            {triggerLabel}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-2" align="start">
        <div className="space-y-1">
          {SIMPLE_TRADES.map((trade) => (
            <div
              key={trade}
              className="flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer hover:bg-muted"
              onClick={() => toggle(trade)}
            >
              <Checkbox
                checked={value.includes(trade)}
                onCheckedChange={() => toggle(trade)}
                id={`trade-cb-${trade}`}
                onClick={(e) => e.stopPropagation()}
              />
              <label
                htmlFor={`trade-cb-${trade}`}
                className="text-sm cursor-pointer flex-1 select-none"
              >
                {trade}
              </label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

### Pattern 6: Form Integration with Conditional "Other" Field

```tsx
// In SubcontractorForm — replace the CSI checkbox section:
const selectedTrades = form.watch("trade") ?? [];

<div className="space-y-2">
  <h4 className="text-sm font-medium">Trades</h4>
  <TradeCombobox
    value={selectedTrades}
    onChange={(trades) => {
      form.setValue("trade", trades);
      // Clear tradeOther when "Other" is deselected
      if (!trades.includes("Other")) {
        form.setValue("tradeOther", undefined);
      }
    }}
  />
  {selectedTrades.includes("Other") && (
    <FormField
      control={form.control}
      name="tradeOther"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Describe trade (optional)</FormLabel>
          <FormControl>
            <Input
              placeholder="e.g. Elevator installation"
              {...field}
              value={field.value ?? ""}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )}
</div>
```

### Pattern 7: List Row Trade Display

**Decision:** First trade badge + overflow count. Use existing `StatusBadge` for the badge. Empty = dash.

```tsx
const getTradeBadges = (trade: string[], tradeOther?: string | null) => {
  if (!trade || trade.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  const displayName = (t: string) =>
    t === "Other" && tradeOther ? tradeOther : t;

  const first = displayName(trade[0]);
  const overflow = trade.length - 1;

  return (
    <div className="flex items-center gap-1">
      <StatusBadge variant="draft">{first}</StatusBadge>
      {overflow > 0 && (
        <span className="text-xs text-muted-foreground">+{overflow}</span>
      )}
    </div>
  );
};
```

### Pattern 8: List Filter (string-based)

The `list` tRPC procedure filter changes from `trade: z.number().int().optional()` to `trade: z.string().optional()`. The JSONB containment query targets the new `trade` column:

```typescript
// In subcontractor router list procedure
if (input.trade !== undefined) {
  conditions.push(
    sql`${schema.subcontractorDirectory.trade}::jsonb @> ${JSON.stringify([input.trade])}::jsonb`
  );
}
```

The filter state in the list page changes from `number | null` to `string | null`. Remove the `Number(value)` coercion in `onValueChange`.

### Pattern 9: Search Router — Trade Subtitle

The search router query adds `trade` and `tradeOther` to the select. The subtitle is built from the trade array.

```typescript
// In apps/api/src/trpc/routers/search.ts
const subcontractorResults = await ctx.tenant.db
  .select({
    id: subcontractorDirectory.id,
    companyName: subcontractorDirectory.companyName,
    slug: subcontractorDirectory.slug,
    trade: subcontractorDirectory.trade,
    tradeOther: subcontractorDirectory.tradeOther,
  })
  .from(subcontractorDirectory)
  .where(
    and(
      ilike(subcontractorDirectory.companyName, searchPattern),
      isNotNull(subcontractorDirectory.slug)
    )
  )
  .limit(limit);

// Helper:
function buildTradeSubtitle(trade: string[] | null, tradeOther: string | null): string | null {
  if (!trade || trade.length === 0) return null;
  const names = trade.map((t) => (t === "Other" && tradeOther ? tradeOther : t));
  return names.join(", ");
}

// In the results transform:
...subcontractorResults.map((s) => ({
  type: "subcontractor" as const,
  id: s.id,
  title: s.companyName,
  subtitle: buildTradeSubtitle(s.trade, s.tradeOther),
  url: `/subcontractors/${s.slug}`,
})),
```

The `SearchResult` schema already has `subtitle: z.string().nullable()` — no schema change needed.

### Pattern 10: Zod Schema Updates in packages/shared

```typescript
// In packages/shared/src/types/bidding.ts
import { tradeValueEnum } from "../constants/trades";

export const createSubcontractorSchema = z.object({
  companyName: z.string().min(1).max(200),
  contactName: z.string().optional(),
  contactEmail: z.string().email(),
  contactPhone: phoneSchema,
  street1: z.string().max(200).optional(),
  street2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().length(2).optional(),
  zip: z.string().max(10).optional(),
  trades: z.array(z.number().int()),   // KEEP — backward compat (RFQ getByTrades schema)
  trade: z.array(tradeValueEnum).default([]),    // NEW
  tradeOther: z.string().max(200).optional(),    // NEW
  notes: z.string().optional(),
});

export const updateSubcontractorSchema = z.object({
  id: z.string().uuid(),
  // ...existing fields...
  trades: z.array(z.number().int()).optional(),  // KEEP
  trade: z.array(tradeValueEnum).optional(),     // NEW
  tradeOther: z.string().max(200).nullable().optional(),  // NEW
  // ...
});
```

Note: the `createSubcontractorSchema` currently has a discrepancy — the form uses a nested `address` object but the schema has flat `street1/city/state/zip` fields directly. This pre-existing pattern is preserved as-is.

### Pattern 11: CSV Export Update

The `exportCsv` function in the list page currently calls `formatTrades(s.trades)` (CSI numbers). Update to use `s.trade` and `s.tradeOther`:

```typescript
const formatTrades = (trade: string[], tradeOther?: string | null) => {
  if (!trade || trade.length === 0) return "";
  return trade
    .map((t) => (t === "Other" && tradeOther ? tradeOther : t))
    .join(" | ");
};
```

### Anti-Patterns to Avoid

- **Removing the `trades` column** from the DB schema or tRPC router — RFQs still use `getByTrades` which queries this column. Leave it.
- **Deleting `apps/web/lib/csi-divisions.ts`** — still imported by RFQ UI. Leave it.
- **Using `drizzle-kit migrate`** for the migration — this project uses raw pg scripts for all retroactive migrations.
- **Closing the combobox on each checkbox click** — multi-select requires keeping the popover open.
- **Filtering by the old `trades` column** in the updated list procedure — the new filter must target the new `trade` column.
- **Forgetting `provision.ts`** — Drizzle schema update alone does not protect new tenants. The raw SQL CREATE TABLE block in `provision.ts` must also include the new columns.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-select popover | Custom dropdown from scratch | Existing `Popover` + `Checkbox` from shadcn/ui | Already in the project, correct accessibility |
| Trade name validation | Custom enum check | Zod `z.enum(SIMPLE_TRADES)` via `tradeValueEnum` | Single source of truth in shared package |
| "Other" conditional field | Dialog or separate route | Conditional render in same form using `watch("trade").includes("Other")` | RHF `watch` pattern; inline means less UX friction |

---

## Common Pitfalls

### Pitfall 1: Forgetting tradeOther in the tRPC router insert/update
**What goes wrong:** The `tradeOther` text is never persisted — "Other" shows but custom description is lost.
**Why it happens:** The tRPC router's `create` and `update` procedures list explicit fields; new fields must be added manually.
**How to avoid:** Add `tradeOther: input.tradeOther ?? null` to both `create` mutation values and `update` mutation `updateValues` object.
**Warning signs:** `tradeOther` stays null in DB even when user types a description.

### Pitfall 2: TypeScript type error — DB schema type vs Zod type
**What goes wrong:** `subcontractorDirectory.trade` is typed `unknown` unless the `.$type<string[]>()` annotation is added.
**Why it happens:** Drizzle JSONB columns need explicit `.$type<T>()` call in the schema definition.
**How to avoid:** Add `.$type<string[]>()` to the new `trade` column definition in `tenant.ts`.

### Pitfall 3: provision.ts not updated — new tenants break on create
**What goes wrong:** New tenants provisioned after this phase don't have the `trade` and `trade_other` columns — any create/update mutation errors immediately.
**Why it happens:** `apps/api/src/tenant/provision.ts` has a raw SQL `CREATE TABLE subcontractor_directory` block (line ~1017) that is independent of the Drizzle schema definition. Drizzle schema updates only affect queries and types, not the provision script.
**How to avoid:** Add `trade JSONB NOT NULL DEFAULT '[]'::jsonb` and `trade_other TEXT` to the CREATE TABLE statement in `provision.ts`.
**Warning signs:** Fresh tenant creation works but any sub create call returns a column-not-found error.

### Pitfall 4: List filter still passing a number
**What goes wrong:** The filter sends `Number("Plumbing")` → NaN; query returns nothing.
**Why it happens:** The list page state was `tradeFilter: number | null`; if the state type isn't changed to `string | null`, value coercion breaks.
**How to avoid:** Change `useState<number | null>(null)` to `useState<string | null>(null)` and remove the `Number(value)` coercion in the `onValueChange` handler of the trade Select.

### Pitfall 5: "Other" custom text not cleared on deselect
**What goes wrong:** User checks "Other", types "Elevator installation", then unchecks "Other". Next save sends `trade: []` but `tradeOther: "Elevator installation"` — orphaned text is stored.
**Why it happens:** The conditional field hides on deselect but the form value persists unless explicitly cleared.
**How to avoid:** In the `TradeCombobox` `onChange` callback in the form, call `form.setValue("tradeOther", undefined)` when `trades` does not include "Other".

### Pitfall 6: Filter chip label vs list badge mismatch (acceptable)
**What goes wrong (not a bug):** The filter chip says "Trade: Other" but the list badge shows the custom text. This is correct per spec — filtering by "Other" finds all subs with Other regardless of custom text. No fix needed.

### Pitfall 7: React Query stale cache after migration
**What goes wrong:** Existing browser sessions with cached `{ trades: [3, 22] }` data may break rendering of trade badges after the API switches to returning `trade` (new field).
**Why it happens:** tRPC uses React Query with 5-minute staleTime.
**How to avoid:** The new API responses return `trade` field (new column). The old `trades` field is still returned but the UI no longer uses it for the sub list/detail. Stale cache will be replaced on next fetch automatically. No special invalidation needed — just ensure the router selects and returns the `trade` column.

---

## Code Examples

### Drizzle Schema Column Addition
```typescript
// Source: apps/api/src/db/schema/tenant.ts (existing pattern at line 728)
const subcontractorDirectory = schema.table("subcontractor_directory", {
  // ...existing columns...
  trades: jsonb("trades").notNull().default([]).$type<number[]>(),  // KEEP - RFQ compat
  trade: jsonb("trade").notNull().default([]).$type<string[]>(),    // NEW
  tradeOther: text("trade_other"),                                   // NEW
  // ...
});
```

### provision.ts CREATE TABLE Addition
```sql
-- apps/api/src/tenant/provision.ts — add to CREATE TABLE subcontractor_directory:
CREATE TABLE IF NOT EXISTS "${schemaName}".subcontractor_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  street1 TEXT,
  street2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  slug TEXT UNIQUE,
  trades JSONB NOT NULL DEFAULT '[]'::jsonb,
  trade JSONB NOT NULL DEFAULT '[]'::jsonb,    -- NEW
  trade_other TEXT,                             -- NEW
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

### Migration Script (full)
```typescript
// Source: apps/api/src/db/migrations/migrate-phase38.ts (established pattern)
import { config } from "dotenv";
import { resolve } from "path";
import pg from "pg";

config({ path: resolve(process.cwd(), "../../.env.local") });
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const tenants = await pool.query("SELECT schema_name FROM tenants WHERE status = 'active'");
let successCount = 0;
let failureCount = 0;
const failures: Array<{ schema: string; error: string }> = [];

for (const row of tenants.rows) {
  const schemaName = row.schema_name;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`ALTER TABLE "${schemaName}".subcontractor_directory ADD COLUMN IF NOT EXISTS trade JSONB NOT NULL DEFAULT '[]'::jsonb`);
    await client.query(`ALTER TABLE "${schemaName}".subcontractor_directory ADD COLUMN IF NOT EXISTS trade_other TEXT`);
    await client.query(`UPDATE "${schemaName}".subcontractor_directory SET trades = '[]'::jsonb`);
    await client.query("COMMIT");
    successCount++;
    console.log(`  OK ${schemaName}`);
  } catch (err) {
    await client.query("ROLLBACK");
    failureCount++;
    failures.push({ schema: schemaName, error: String(err) });
    console.error(`  FAIL ${schemaName}:`, err);
  } finally {
    client.release();
  }
}
console.log(`\nDone: ${successCount} succeeded, ${failureCount} failed`);
await pool.end();
process.exit(failureCount > 0 ? 1 : 0);
```

---

## File Change Map

Complete list of files that need modification:

### New Files
| File | Purpose |
|------|---------|
| `packages/shared/src/constants/trades.ts` | `SIMPLE_TRADES` array, `TradeValue` type, `tradeValueEnum` |
| `apps/web/components/bidding/trade-combobox.tsx` | Multi-select combobox for trades |
| `apps/api/src/db/migrations/migrate-phase52.ts` | DB migration: add `trade`, `trade_other` columns; clear old `trades` on subs |

### Modified Files
| File | Change |
|------|--------|
| `packages/shared/src/constants/index.ts` | Add `export * from "./trades"` |
| `packages/shared/src/index.ts` | Export `SIMPLE_TRADES`, `TradeValue`, `tradeValueEnum` |
| `packages/shared/src/types/bidding.ts` | Add `trade: z.array(tradeValueEnum).default([])` and `tradeOther` to create/update schemas |
| `apps/api/src/db/schema/tenant.ts` | Add `trade` and `tradeOther` columns to `subcontractorDirectory` table definition |
| `apps/api/src/tenant/provision.ts` | Add `trade JSONB NOT NULL DEFAULT '[]'::jsonb` and `trade_other TEXT` to the raw SQL `CREATE TABLE subcontractor_directory` block (~line 1017) |
| `apps/api/src/trpc/routers/subcontractor.ts` | `list`: change filter from `z.number()` → `z.string()` targeting new `trade` column; `create`/`update`: persist `trade` and `tradeOther` |
| `apps/api/src/trpc/routers/search.ts` | Select `trade` and `tradeOther`; build subtitle from trade array |
| `apps/web/components/bidding/subcontractor-form.tsx` | Replace CSI checkbox list with `TradeCombobox`; add conditional `tradeOther` input; update form field names and default values |
| `apps/web/app/(dashboard)/subcontractors/page.tsx` | Replace CSI Select filter with 12-item string Select; change `tradeFilter` state to `string \| null`; replace `getTradeBadges` with first-badge + overflow using `StatusBadge`; update CSV export |
| `apps/web/app/(dashboard)/subcontractors/[subcontractorSlug]/page.tsx` | Replace trade section: show `trade` string array names; show `tradeOther` when "Other"; update `defaultValues` passed to SubcontractorForm to include `trade` and `tradeOther` |
| `apps/web/components/search/command-palette.tsx` | Render `subtitle` for subcontractor results (already in JSX for Projects/Customers — add same pattern) |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSI division number array (`trades: number[]`) | Plain string array (`trade: string[]`) | This phase | Simpler display, no lookup table needed |
| Single-column trade storage | Two columns: `trade` (array) + `trade_other` (optional text) | This phase | Supports "Other" custom description |
| First 3 trade badges in list row | First 1 trade badge + overflow count | This phase | Cleaner list rows |
| No subtitle in global search for subs | Trade names shown as subtitle | This phase | More useful search results |

**Keep as-is (not deprecated in this phase):**
- `trades: jsonb` on `subcontractor_directory` — kept for RFQ `getByTrades` compatibility
- `apps/web/lib/csi-divisions.ts` — kept for RFQ UI
- `CSI_DIVISIONS` export from `packages/shared` — kept for RFQ UI

---

## Open Questions

1. **Should `tradeOther` be cleared when "Other" is deselected in the form?**
   - What we know: The form uses `watch("trade")` to conditionally show the `tradeOther` field
   - Recommendation: Yes — call `form.setValue("tradeOther", undefined)` when `trades` no longer includes "Other". This avoids orphaned custom text being saved to the DB. Handle in the `onChange` wrapper in the form, not inside `TradeCombobox`.

2. **provision.ts — RESOLVED**
   - Confirmed: `apps/api/src/tenant/provision.ts` contains a raw SQL `CREATE TABLE subcontractor_directory` block at ~line 1017. It does NOT use Drizzle push for new tenant schemas. The `trade` and `trade_other` columns MUST be manually added to this raw SQL block. This is documented in Pitfall 3 and Pattern 4.

---

## Sources

### Primary (HIGH confidence)
- Direct file reads from project source:
  - `apps/api/src/db/schema/tenant.ts` — subcontractor_directory schema, confirmed `trades: jsonb number[]` column
  - `apps/api/src/tenant/provision.ts` — confirmed raw SQL CREATE TABLE for subcontractor_directory at line 1017, confirmed missing `trade`/`trade_other`
  - `apps/api/src/db/migrate.ts` — confirmed migrateTenantSchema only creates audit_logs, user_profiles, company_profiles (not subcontractor_directory)
  - `apps/api/src/trpc/routers/subcontractor.ts` — confirmed current filter uses `z.number()` and targets `trades` column
  - `packages/shared/src/types/bidding.ts` — confirmed current Zod schemas
  - `packages/shared/src/constants/index.ts` — confirmed only exports `us-states` currently
  - `apps/web/components/bidding/subcontractor-form.tsx` — confirmed CSI checkbox list implementation
  - `apps/web/app/(dashboard)/subcontractors/page.tsx` — confirmed current list + filter implementation
  - `apps/web/app/(dashboard)/subcontractors/[subcontractorSlug]/page.tsx` — confirmed detail page trade display
  - `apps/api/src/trpc/routers/search.ts` — confirmed `subtitle: null` for subs
  - `apps/web/components/search/command-palette.tsx` — confirmed no subtitle rendered for subs
  - `apps/web/components/ui/combobox.tsx` — confirmed Popover + Command primitives available
  - `apps/web/components/shared/status-badge.tsx` — confirmed `StatusBadge` variants
  - `packages/shared/src/index.ts` — confirmed exports
  - `packages/shared/src/types/search.ts` — confirmed `subtitle: z.string().nullable()`
  - `apps/api/src/db/migrations/migrate-phase38.ts` — migration pattern reference

### Secondary (MEDIUM confidence)
- Migration script structure cross-verified across `migrate-phase38.ts`, `migrate-phase39.ts`, `tenant/migrate-tenant.ts` — all use same pg pool + loop pattern

---

## Metadata

**Confidence breakdown:**
- Current state audit: HIGH — read directly from all relevant source files
- Migration pattern: HIGH — multiple examples verified in codebase
- provision.ts requirement: HIGH — confirmed by reading provision.ts and db/migrate.ts
- TradeCombobox pattern: HIGH — uses same Popover + Checkbox primitives already in project
- Open questions: 1 remaining (tradeOther clear-on-deselect) — LOW risk, recommendation provided

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable domain, no external dependencies change)
