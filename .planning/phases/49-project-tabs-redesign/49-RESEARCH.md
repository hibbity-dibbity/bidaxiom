# Phase 49: Project Tabs Redesign - Research

**Researched:** 2026-02-23
**Domain:** Next.js UI surgery — tab order change, label rename (Estimates → Proposals), new Expenses placeholder tab
**Confidence:** HIGH (all findings from direct file reads; no external lookups required)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TABS-01 | Project detail page displays tabs in order: Overview → Documents → Proposals → Change Orders → Invoices → Expenses | `ALL_SECTIONS` array in `project-tabs.tsx` lines 21-27 must be reordered and the new `Expenses` entry added |
| TABS-02 | The "Proposals" tab replaces the former Estimates tab; "Proposals" is used throughout the project context (tab, page heading, action buttons, breadcrumbs) | `estimates/page.tsx` h1, button labels, empty state text; `estimates/new/page.tsx` breadcrumb + h1 + form label + cancel; `estimates/[estimateSlug]/page.tsx` heading + back-link text |
| TABS-03 | An Expenses tab exists as a navigable placeholder page with a contextual empty state; no data model is built yet | New file: `apps/web/app/(dashboard)/projects/[projectSlug]/expenses/page.tsx` — follow Phase 48 placeholder pattern (Lock icon, toast, Back to Overview) |
</phase_requirements>

---

## Summary

Phase 49 is pure frontend UI surgery with no backend changes. Three independent areas of work exist: (1) reorder and relabel the tab array in `project-tabs.tsx`, (2) rename every user-visible "Estimate"/"Estimates" string inside the estimates route tree to "Proposal"/"Proposals", and (3) create a new `/expenses` route directory with a placeholder `page.tsx`.

The URL path `/estimates` stays unchanged — the URL slug is NOT being renamed to `/proposals`. Only the displayed text changes. This means there is no risk of broken links or router rewrites. The route directory stays at `estimates/`, the tRPC queries stay as `trpc.estimates.*`, and the internal prefetch map key stays as `"/estimates"` — only the `name` property in `ALL_SECTIONS` and user-facing string literals inside those pages change.

The Expenses placeholder follows the exact Phase 48 pattern already live in `sov/page.tsx`, `budget/page.tsx`, `commitments/page.tsx`, and `payment-apps/page.tsx`. No new pattern needs to be invented.

The global `breadcrumbs.tsx` component does NOT hardcode "estimates" — it falls through to the raw URL segment. The breadcrumb for `/estimates` will render as the raw string `"estimates"` (lowercase) unless a `segmentLabels` entry is added. This is an explicit action item: add `estimates: "Proposals"` to `segmentLabels` in `breadcrumbs.tsx`.

**Primary recommendation:** Three files to edit, one file to create, one lookup table entry to add. All changes are isolated to the web app only.

---

## 1. Current Tab Array State (Post-Phase 48)

**File:** `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx`
**Lines 21-27:**

```typescript
const ALL_SECTIONS = [
  { name: "Overview",      href: "" },
  { name: "Documents",     href: "/documents" },
  { name: "Change Orders", href: "/change-orders", phaseGated: "change_orders" },
  { name: "Invoices",      href: "/invoices" },
  { name: "Estimates",     href: "/estimates" },
] as const;
```

Phase 48 confirmed: Budget, Commitments, SOV, Payment Apps, and RFQs have all been removed from `ALL_SECTIONS`. The five remaining tabs are exactly as shown above.

**Target order and labels (TABS-01 + TABS-02):**

```typescript
const ALL_SECTIONS = [
  { name: "Overview",      href: "" },
  { name: "Documents",     href: "/documents" },
  { name: "Proposals",     href: "/estimates" },           // renamed; href unchanged
  { name: "Change Orders", href: "/change-orders", phaseGated: "change_orders" },
  { name: "Invoices",      href: "/invoices" },
  { name: "Expenses",      href: "/expenses" },            // new
] as const;
```

**Changes to `ALL_SECTIONS`:**
- Move the Estimates entry from last position to position 3 (after Documents)
- Change its `name` from `"Estimates"` to `"Proposals"` — `href` stays `"/estimates"`
- Add new `{ name: "Expenses", href: "/expenses" }` at the end (position 6)

**Changes to the prefetch map in the same file (lines 108-119):**

The existing prefetch map key `"/estimates": prefetchEstimates` remains valid because the href is unchanged. No changes to the prefetch map are needed.

A new Expenses entry should be added to avoid an undefined handler:
```typescript
"/expenses": () => {},  // no-op: no data to prefetch for placeholder
```

**projectMode and gcOnly filtering:**

The existing `gcOnly` filter logic at lines 38-46 can remain. The new Expenses tab has no `gcOnly` or `phaseGated` flag, so it will always appear.

---

## 2. Estimates Route Slug and Directory Structure

The route lives at:
```
apps/web/app/(dashboard)/projects/[projectSlug]/estimates/
├── page.tsx                       ← list page (TABS-02: rename strings)
├── new/
│   └── page.tsx                   ← create form (TABS-02: rename strings)
└── [estimateSlug]/
    ├── page.tsx                   ← detail page (TABS-02: rename strings)
    └── workflow/
        └── page.tsx               ← workflow page (NO user-visible "Estimate" labels in headers)
```

**The directory slug `/estimates` does NOT change.** The rename is label-only. All `href` attributes, `router.push(...)` calls, and link destinations that reference `/estimates` stay intact. No file moves or redirects required.

---

## 3. All "Estimates" Label Locations Requiring Rename to "Proposals"

Only project-context user-visible strings need to change. Internal code identifiers (component names, variable names, tRPC procedure names, TypeScript types) do NOT change.

### 3a. `estimates/page.tsx` — List Page

| Line | Current Text | Change To |
|------|-------------|-----------|
| 90 | `<h1>Estimates</h1>` | `<h1>Proposals</h1>` |
| 103-104 | `<Link href=".../estimates/new">New Estimate</Link>` | `New Proposal` (link href unchanged) |
| 115 | `placeholder="Search estimates by name..."` | `placeholder="Search proposals by name..."` |
| 173 | `"No estimates match your search"` | `"No proposals match your search"` |
| 173 | `"No estimates yet"` | `"No proposals yet"` |
| 177 | `"Create your first estimate to begin..."` | `"Create your first proposal to begin..."` |
| 181 | `{ label: "New Estimate", href: .../estimates/new }` | `label: "New Proposal"` (href unchanged) |

**Note:** The CSV filename (line 52) uses `estimates-${projectSlug}-...` — this is a programmatic filename, not a visible UI label. Do not change it.

### 3b. `estimates/new/page.tsx` — Create Form

| Line | Current Text | Change To |
|------|-------------|-----------|
| 59 | `toast.success("Estimate created successfully")` | `toast.success("Proposal created successfully")` |
| 89-90 | Breadcrumb link text: `"Estimates"` | `"Proposals"` (href unchanged) |
| 93 | Breadcrumb current page: `"New Estimate"` | `"New Proposal"` |
| 98 | `<h1>Create New Estimate</h1>` | `<h1>Create New Proposal</h1>` |
| 100 | `"Start a new pre-bid cost estimate..."` | `"Start a new pre-bid cost proposal..."` |
| 121 | `<FormLabel>Estimate Name</FormLabel>` | `<FormLabel>Proposal Name</FormLabel>` |
| 164 | Cancel button `router.push(.../estimates)` | href unchanged, no visible text to change |

### 3c. `estimates/[estimateSlug]/page.tsx` — Detail Page

| Line | Current Text | Change To |
|------|-------------|-----------|
| 70 | `<h2>Estimate Not Found</h2>` | `<h2>Proposal Not Found</h2>` |
| 72 | `"The estimate you're looking for doesn't exist."` | `"The proposal you're looking for doesn't exist."` |
| 75-77 | `<Link .../estimates>Back to Estimates</Link>` | `Back to Proposals` (href unchanged) |
| 92 | Back button ArrowLeft link to `.../estimates` | href unchanged, no visible text |
| 96 | `<h1>Estimate Details</h1>` | `<h1>Proposal Details</h1>` |
| 118-120 | `<Link .../workflow>Edit Estimate</Link>` | `Edit Proposal` (href unchanged) |
| 126 | Comment `{/* Estimate Overview */}` | Not user-visible; can optionally change |

### 3d. `estimates/[estimateSlug]/workflow/page.tsx` — Workflow Page

No user-visible "Estimate"/"Estimates" labels are present in the page heading area. The page header shows `{estimate.name}` (the user-defined name of the estimate record, unchanged) and `Status: {estimate.status}`. The "Estimate Not Found" fallback text (lines 46-48) is not project-context UI in the normal flow, but can be updated for consistency:

| Line | Current Text | Change To |
|------|-------------|-----------|
| 46 | `<h2>Estimate Not Found</h2>` | `<h2>Proposal Not Found</h2>` |
| 48 | `"The estimate you're looking for doesn't exist."` | `"The proposal you're looking for doesn't exist."` |

**Note:** The saving indicator ("Saving...") and status text are generic. No changes needed there.

### 3e. `components/estimates/workflow/WorkflowSidebar.tsx`

Line 37: `<h2>Estimate Workflow</h2>` — this is inside the workflow sidebar component. This IS a user-visible label in the project context. Change to `<h2>Proposal Workflow</h2>`.

Line 39: `"Complete each step to build your estimate"` — Change to `"Complete each step to build your proposal"`.

**Note:** `WorkflowSidebar` may be unused/replaced by `EstimateStepperBar` in the current workflow implementation. Confirm whether it is still rendered before changing it.

### 3f. `components/estimates/lifecycle/NextStepsPanel.tsx`

| Line | Current Text | Change To |
|------|-------------|-----------|
| 23 | `"Your estimate is ready."` | `"Your proposal is ready."` |
| 44 | `"Estimate has been submitted."` | `"Proposal has been submitted."` |
| 60 | `"Congratulations! Convert this estimate..."` | `"Congratulations! Convert this proposal..."` |
| 76 | `"This estimate has been converted..."` | `"This proposal has been converted..."` |

### 3g. `components/estimates/actions/SubmitEstimateButton.tsx`

| Line | Current Text | Change To |
|------|-------------|-----------|
| 17 | `toast.success("Estimate submitted for approval")` | `toast.success("Proposal submitted for approval")` |
| 21 | `toast.error("Failed to submit estimate")` | `toast.error("Failed to submit proposal")` |
| 31 | `"Submit for Approval"` | No change needed (generic action label) |

### 3h. `project-tabs.tsx` — Tab Bar Name

Line 26: `{ name: "Estimates", href: "/estimates" }` → `{ name: "Proposals", href: "/estimates" }` — already covered in Section 1.

### Summary: Strings to Change

Scope boundary: **Only project-context user-visible strings.** Do NOT rename:
- tRPC procedure names (`trpc.estimates.*`)
- TypeScript type names (`EstimateStatus`, `EstimateLineItem`)
- Component names (`EstimatesPage`, `EstimateDetailPage`, `EstimateStepperBar`)
- URL paths (`/estimates`, `/estimates/new`, `/estimates/${slug}`)
- Variable names (`estimates`, `estimate`, `displayedEstimates`)
- CSV filename (`estimates-${projectSlug}-...`)
- Database column/table names

---

## 4. Current Tab Order vs. Target Tab Order

### Current (Post-Phase 48)
```
[Overview] [Documents] [Change Orders] [Invoices] [Estimates]
   pos 1      pos 2        pos 3          pos 4      pos 5
```

### Target (Phase 49)
```
[Overview] [Documents] [Proposals] [Change Orders] [Invoices] [Expenses]
   pos 1      pos 2       pos 3        pos 4          pos 5      pos 6
```

### Changes Required in `ALL_SECTIONS`

1. Move `{ name: "Estimates", href: "/estimates" }` from position 5 to position 3 (after Documents, before Change Orders)
2. Rename its `name` from `"Estimates"` to `"Proposals"`
3. Add `{ name: "Expenses", href: "/expenses" }` at position 6 (after Invoices)
4. The `phaseGated: "change_orders"` attribute on Change Orders stays unchanged

The `as const` assertion at the end of the array must remain.

---

## 5. Expenses Tab — Route to Create, Placeholder Pattern to Use

### Route to Create

**New file:** `apps/web/app/(dashboard)/projects/[projectSlug]/expenses/page.tsx`

No subdirectories needed. This is a single placeholder page — no `new/`, no `[id]/` sub-routes.

### Placeholder Pattern (Phase 48 — Currently Live in `sov/page.tsx`)

The exact pattern implemented by Phase 48 and currently running in production:

```tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { toast } from "sonner";

export default function SovPage() {
  const params = useParams<{ projectSlug: string }>();

  useEffect(() => {
    toast("That page isn't available");
  }, []);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-3 max-w-sm">
        <Lock className="h-10 w-10 text-muted-foreground mx-auto" />
        <h3 className="text-lg font-semibold">This section isn't available</h3>
        <p className="text-muted-foreground text-sm">
          Schedule of Values isn't part of your current plan.
        </p>
        <Button variant="outline" asChild>
          <Link href={"/projects/" + params.projectSlug}>Back to Overview</Link>
        </Button>
      </div>
    </div>
  );
}
```

**For the Expenses placeholder, adapt:**
- Function name: `ExpensesPage`
- Toast message: `"That page isn't available"` (same neutral message)
- Heading: `"This section isn't available"` (same generic heading)
- Body text: `"Expense tracking isn't available yet."` (or similar contextual copy — Claude's discretion)
- Back link: identical `href={"/projects/" + params.projectSlug}`

**Important:** The success criteria says "contextual empty state (icon, heading, description)" with no toast requirement for the Expenses tab. The toast is the Phase 48 pattern for "hidden" content. For Expenses, which is a "coming soon" placeholder rather than "hidden GC feature," the icon + heading + description empty state is appropriate. Determine whether to include the toast: the Phase 48 CONTEXT locked "a brief informational toast" for that phase's tabs, but that locked decision does not carry forward to Phase 49. The success criterion does not mention a toast for Expenses.

Recommendation: Omit the `useEffect` toast for Expenses (it's a coming-soon feature, not a locked/removed one). Use a non-Lock icon — for example `Receipt` from Lucide — since Expenses is a future feature rather than a locked/removed feature.

---

## 6. Breadcrumbs Handling

**File:** `apps/web/components/layout/breadcrumbs.tsx`

The `segmentLabels` lookup table (lines 18-24) currently maps top-level segments:

```typescript
const segmentLabels: Record<string, string> = {
  projects: "Projects",
  bids: "Bidding",
  financials: "Financials",
  documents: "Documents",
  settings: "Settings",
};
```

**Critical finding:** `estimates` is NOT in `segmentLabels`. The breadcrumb component falls through to `const label = segmentLabels[segment] ?? segment` — rendering the raw segment string `"estimates"` (lowercase, no capitalization) for any URL segment that isn't in the map.

**What this means in practice:**
- The breadcrumbs do NOT currently display "Estimates" (title case) — they render `estimates` (raw URL segment, lowercase)
- Adding `estimates: "Proposals"` to `segmentLabels` would display "Proposals" for the estimates URL segment in breadcrumbs

**Action required for TABS-02:** Add `estimates: "Proposals"` to `segmentLabels`. This makes breadcrumbs show "Proposals" when navigating to `/projects/[slug]/estimates`.

**Additional note:** The `expenses` segment will also fall through to raw `"expenses"` (lowercase). Add `expenses: "Expenses"` as well.

**Change:**
```typescript
const segmentLabels: Record<string, string> = {
  projects: "Projects",
  bids: "Bidding",
  financials: "Financials",
  documents: "Documents",
  settings: "Settings",
  estimates: "Proposals",   // ADD: maps /estimates URL segment to "Proposals" label
  expenses: "Expenses",     // ADD: maps /expenses URL segment to "Expenses" label
};
```

**Note:** The breadcrumb component renders ALL path segments, including project slugs and estimate slugs, which fall through to raw segment display. This is existing behavior and is not changed by this phase.

---

## 7. Invoices Tab Status

**File:** `apps/web/app/(dashboard)/projects/[projectSlug]/invoices/page.tsx`

Invoices is a **real, functional page** — not a placeholder. It renders:
- Page heading: `"Invoice Tracking"`
- Sub-heading: `"Accounts receivable and payable aging reports"`
- Two sub-tabs: "Accounts Receivable" and "Accounts Payable" (using `<Tabs>` from shadcn)
- Uses `<AgingReportTable>` component with `type="ar"` and `type="ap"`
- Fetches data via `trpc.project.getBySlug` and uses `projectId` for data queries
- Has a "Back to Project" button

This tab requires NO changes in Phase 49. It is already in the correct position (after Change Orders in the new order). The only change is that it will shift visually from position 4 to position 5 as Proposals moves to position 3 and Change Orders stays at position 4.

The "Invoices" tab was introduced in Phase 48 (confirmed present in `ALL_SECTIONS` before and after). It is NOT a placeholder.

---

## 8. Risk Areas and Special Handling

### Risk 1: `estimates/new/page.tsx` in-page breadcrumbs are manual (not `breadcrumbs.tsx`)

The `new/page.tsx` file builds its own inline breadcrumb at lines 84-94 using a flex div with `<Link>` elements and `<ChevronRight>`. This is separate from the `breadcrumbs.tsx` component in the top bar.

Both must be updated independently:
- `breadcrumbs.tsx` segmentLabels: add `estimates: "Proposals"` → affects top-bar breadcrumb
- `estimates/new/page.tsx` inline breadcrumb: change "Estimates" text → affects in-page breadcrumb trail

### Risk 2: Verify `WorkflowSidebar.tsx` is actually rendered

The `estimates/[estimateSlug]/workflow/page.tsx` uses `EstimateStepperBar` (not `WorkflowSidebar`). Search confirms `WorkflowSidebar` is imported only from within the estimates components but may not be mounted in any page-level tree. Verify whether `WorkflowSidebar` renders before including it in the rename task. If it renders, rename its heading copy. If it is dead UI, skip it to avoid scope creep.

**Verification step:** Grep for `WorkflowSidebar` usage in rendered pages — if it only appears in `components/estimates/workflow/WorkflowSidebar.tsx` itself and not in any `page.tsx`, it is dead UI and can be skipped.

### Risk 3: The `sectionPrefetchMap` in `project-tabs.tsx` must be updated

The prefetch map (lines 108-119) maps href strings to handler functions. After adding `{ name: "Expenses", href: "/expenses" }` to `ALL_SECTIONS`, accessing `sectionPrefetchMap["/expenses"]` returns `undefined`. The code at line 144 is:

```typescript
const prefetchHandler = sectionPrefetchMap[section.href];
```

This value is passed to `onMouseEnter={prefetchHandler}`. React accepts `undefined` as a valid event handler (it's a no-op), so this will not throw. However, a no-op entry is cleaner and more explicit. Add `"/expenses": () => {}` to the map.

### Risk 4: `as const` on `ALL_SECTIONS`

The `as const` assertion makes the array readonly and types the `name` and `href` values as string literals. Adding a new entry or reordering entries is safe — TypeScript will re-infer the union types. No special handling required.

### Risk 5: The `getBadgeCount` function

`project-tabs.tsx` lines 121-130 maps hrefs to badge counts from `headerStats`. The `"/estimates"` and `"/expenses"` hrefs are not in the switch cases, so they return `0`. No badge will appear on either tab. This is correct behavior — no change needed.

### Risk 6: phaseGated on Change Orders

The `phaseGated: "change_orders"` attribute on the Change Orders tab relies on `isFeatureAvailableInPhase` from `@construction/shared`. Reordering the tab in the array does not affect this logic — the filtering at lines 38-46 evaluates each section independently. The Change Orders tab will continue to be hidden in lifecycle phases where change orders are not available.

### Risk 7: Scope of "Proposals" rename

The success criterion TABS-02 says "no 'Estimates' label appears anywhere in the project tab context." The project tab context means: the tab bar, and the pages accessed via the tab (the estimates list, the create form, the detail page, the workflow page). It does NOT mean:
- Dashboard widgets (`company-widgets.tsx` line 244: "Active estimates" / "No estimates yet") — these are dashboard-level, not project-tab-context
- Budget metrics (`forecast-metrics.tsx`: "Estimate at completion") — these are financial estimation terms, not the Proposals tab
- Command palette (`command-palette.tsx` lines 164-165: `CommandGroup heading="Estimates"`) — this is global search, not project-tab-context

Confirm the scope boundary with the requirements: only files under `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/` and referenced components that render within the project tab context.

---

## Code Examples

### ALL_SECTIONS array after Phase 49

```typescript
// Source: project-tabs.tsx (modified)
const ALL_SECTIONS = [
  { name: "Overview",      href: "" },
  { name: "Documents",     href: "/documents" },
  { name: "Proposals",     href: "/estimates" },
  { name: "Change Orders", href: "/change-orders", phaseGated: "change_orders" },
  { name: "Invoices",      href: "/invoices" },
  { name: "Expenses",      href: "/expenses" },
] as const;
```

### Expenses placeholder page

```tsx
// Source: Based on sov/page.tsx (Phase 48 pattern, currently live)
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Receipt } from "lucide-react";

export default function ExpensesPage() {
  const params = useParams<{ projectSlug: string }>();

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-3 max-w-sm">
        <Receipt className="h-10 w-10 text-muted-foreground mx-auto" />
        <h3 className="text-lg font-semibold">Expense Tracking</h3>
        <p className="text-muted-foreground text-sm">
          Expense tracking is coming soon. Check back in a future update.
        </p>
        <Button variant="outline" asChild>
          <Link href={"/projects/" + params.projectSlug}>Back to Overview</Link>
        </Button>
      </div>
    </div>
  );
}
```

Note: Icon choice and copy are Claude's discretion per success criteria (contextual empty state).

### breadcrumbs.tsx segmentLabels addition

```typescript
// Source: breadcrumbs.tsx (modified)
const segmentLabels: Record<string, string> = {
  projects: "Projects",
  bids: "Bidding",
  financials: "Financials",
  documents: "Documents",
  settings: "Settings",
  estimates: "Proposals",  // ADD
  expenses: "Expenses",    // ADD
};
```

---

## Files to Change (Complete Inventory)

| File | Type | Changes |
|------|------|---------|
| `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx` | Edit | Reorder ALL_SECTIONS, rename "Estimates" to "Proposals", add Expenses entry, add no-op prefetch handler |
| `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/page.tsx` | Edit | 7 string replacements (h1, button, placeholder, empty state) |
| `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/new/page.tsx` | Edit | 5 string replacements (breadcrumbs, h1, form label, toast) |
| `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/page.tsx` | Edit | 4 string replacements (not-found, back link text, heading, edit button) |
| `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/workflow/page.tsx` | Edit | 2 string replacements (not-found fallback only) |
| `apps/web/components/layout/breadcrumbs.tsx` | Edit | Add `estimates: "Proposals"` and `expenses: "Expenses"` to segmentLabels |
| `apps/web/components/estimates/lifecycle/NextStepsPanel.tsx` | Edit | 4 string replacements in status copy |
| `apps/web/components/estimates/actions/SubmitEstimateButton.tsx` | Edit | 2 toast string replacements |
| `apps/web/components/estimates/workflow/WorkflowSidebar.tsx` | Edit (if rendered) | 2 string replacements (heading + body) |
| `apps/web/app/(dashboard)/projects/[projectSlug]/expenses/page.tsx` | Create | New placeholder page file |

---

## Sources

### Primary (HIGH confidence)

All findings are from direct file reads within the codebase. No external documentation was needed.

- `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx` — current ALL_SECTIONS array, prefetch map structure
- `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/page.tsx` — full read, all "Estimate"/"Estimates" strings catalogued
- `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/new/page.tsx` — full read, breadcrumb + form + heading strings
- `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/page.tsx` — full read, detail page strings
- `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/workflow/page.tsx` — full read, no page-level UI labels besides not-found fallback
- `apps/web/app/(dashboard)/projects/[projectSlug]/invoices/page.tsx` — confirmed real functional page, not a placeholder
- `apps/web/app/(dashboard)/projects/[projectSlug]/sov/page.tsx` — Phase 48 placeholder pattern confirmed live
- `apps/web/components/layout/breadcrumbs.tsx` — segmentLabels confirmed, "estimates" not present
- `.planning/phases/48-project-mode-removal/48-RESEARCH.md` — placeholder pattern specification and confirmation that Phase 48 produced current ALL_SECTIONS state

---

## Metadata

**Confidence breakdown:**
- Current tab array state: HIGH — read directly from source file
- Estimates route structure: HIGH — directory listing confirmed, files read
- User-visible string inventory: HIGH — full file reads + grep output reviewed
- Breadcrumbs behavior: HIGH — breadcrumbs.tsx read in full; segmentLabels confirmed missing "estimates"
- Invoices status (real vs placeholder): HIGH — invoices/page.tsx read in full
- Expenses placeholder pattern: HIGH — sov/page.tsx (the live Phase 48 placeholder) read in full
- Risk areas: HIGH — all based on direct code reading

**Research date:** 2026-02-23
**Valid until:** Stable codebase — valid until a future phase modifies the estimates route tree or breadcrumbs component
