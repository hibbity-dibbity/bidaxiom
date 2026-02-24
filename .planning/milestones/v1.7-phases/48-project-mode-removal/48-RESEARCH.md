# Phase 48: Project Mode Removal - Research

**Researched:** 2026-02-23
**Domain:** Next.js UI surgery — removing mode controls from project pages without deleting route files
**Confidence:** HIGH (all findings are from direct file reads, no external lookups needed)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Hidden tab URL behavior: show a placeholder page at that URL (not a redirect, not a 404), consistent across all four tabs
- A brief informational toast ("That page isn't available") appears when the user lands on a placeholder
- Route files are kept on disk — only the tab navigation links are removed; the page route components stay as placeholder pages
- Mode badge on project detail page: remove it entirely from the UI; keep the underlying code
- 3-dot menu: remove only the mode-switch item; the "Delete project" button remains
- Project creation form "Project Mode" field: hide it from the UI; keep the field code intact
- All newly created projects should default to `simple` mode in the database
- Remove any GC-specific CTAs on the project Overview tab that link to Budget, SOV, Commitments, or Payment Applications
- Financial stat bar in the sticky project header: no changes needed
- Audit and remove any mode-conditional UI inside the Change Orders and Proposals/Estimates tabs

### Claude's Discretion
- Exact placeholder page copy and empty-state design
- Toast styling and duration
- How to handle any mode-conditional rendering found by grep inside the retained tabs

### Deferred Ideas (OUT OF SCOPE)
- (none declared — everything is in scope or Claude's discretion)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MODE-01 | The project mode switcher (GC/Advanced ↔ Simple) is removed from all UI surfaces; underlying code is preserved but no mode-related controls are shown to users | Mode badge is in `project-header.tsx` lines 124-126; mode-switch DropdownMenuItem is lines 136-145; ProjectForm `projectMode` field is lines 407-430 |
| MODE-02 | All GC/Advanced-specific features (Budget, SOV, Commitments, Payment Applications tabs and entry points) are hidden from the project UI; data and code are preserved | Tab definitions in `project-tabs.tsx`; GC CTAs in Overview `page.tsx`; `isSimpleMode` rendering in `payment-apps/[id]/page.tsx` and `EstimateLineItemsTable.tsx` |
| TABS-04 | Budget, SOV, Commitments, and Payment Applications tabs are removed from the project tab bar | `ALL_SECTIONS` array in `project-tabs.tsx` lines 21-32 |
</phase_requirements>

---

## Summary

Phase 48 is a focused UI surgery on the project detail area. The entire mode concept is implemented in about six discrete locations. No backend changes are required and no route files need to be deleted — only rendered markup needs to change.

The work breaks cleanly into four groups: (1) strip mode controls from the project header and the project creation form, (2) remove four tab entries from the tab bar and convert their route pages to placeholder pages, (3) purge GC-specific Overview cards that link to the hidden tabs, and (4) remove the one meaningful in-tab mode-conditional block found in the Payment App detail page.

The Estimates/workflow tab has a secondary mode-conditional in `EstimateLineItemsTable` (CSI Code column vs. Cost Type column). Since all projects will henceforth default to `simple`, the CSI Code column will never render. The decision here (Claude's discretion) is to remove the conditional and always show the simpler column set — documented below.

**Primary recommendation:** All six surfaces are fully mapped. No surprises; execution is straightforward JSX deletion with one new placeholder component pattern.

---

## 1. Project Tab Bar

**File:** `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx`

### Current tab definitions (lines 21-32)

```typescript
const ALL_SECTIONS = [
  { name: "Overview",        href: "" },
  { name: "Documents",       href: "/documents" },
  { name: "Budget",          href: "/budget" },          // REMOVE from tab bar
  { name: "Commitments",     href: "/commitments" },     // REMOVE from tab bar
  { name: "Change Orders",   href: "/change-orders", phaseGated: "change_orders" },
  { name: "SOV",             href: "/sov",       gcOnly: true },  // REMOVE from tab bar
  { name: "Payment Apps",    href: "/payment-apps" },    // REMOVE from tab bar
  { name: "Invoices",        href: "/invoices" },
  { name: "RFQs",            href: "/rfqs", gcOnly: true },  // NOTE: gcOnly — currently hidden in Simple mode
  { name: "Estimates",       href: "/estimates" },
] as const;
```

Tabs that must be removed from `ALL_SECTIONS`:
- `Budget` — `/budget`
- `Commitments` — `/commitments`
- `SOV` — `/sov`
- `Payment Apps` — `/payment-apps`

Note on `RFQs`: Currently has `gcOnly: true`, meaning it is already hidden in Simple mode. Since the plan defaults all projects to `simple`, RFQs would become invisible via existing logic. However, to be complete and not rely on mode logic, RFQs should also be removed from the tab bar in this phase (it is a GC-only feature).

### How filtering works (lines 43-51)

The `sections` array is filtered at render time using `projectMode !== "gc_advanced"` to hide `gcOnly` tabs. After this phase, the filtering logic itself can remain but becomes dead code since the four tabs will no longer be in `ALL_SECTIONS`.

### Prefetch handlers

`project-tabs.tsx` has named prefetch handlers for all tabs including `prefetchBudget`, `prefetchCommitments`, `prefetchSOV`, `prefetchPaymentApps` (lines 69-94). These can stay — they are inert once the tab links are removed. No action required.

### The `projectMode` prop

`ProjectTabs` receives `projectMode` as a prop from `layout.tsx` line 119. After removing the four tabs from `ALL_SECTIONS`, the prop becomes unused. It should be removed from the interface and call site once the filtering logic is also cleaned up (Claude's discretion on cleanliness level).

---

## 2. Mode Badge

**File:** `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx`

**Location:** Lines 124-126, inside Row 1 of the header

```tsx
<Badge variant="outline" className="bg-muted text-muted-foreground text-xs shrink-0">
  {project.projectMode === "simple" ? "Simple" : "GC/Advanced"}
</Badge>
```

This `<Badge>` element is a direct sibling of `<LifecyclePhaseBadge>` and the project name `<h1>`. Remove the entire `<Badge>` element. The `projectMode` field must remain in the `ProjectHeaderProps` interface because the mode-switch `handleModeSwitch` function (line 91) uses it. That function will still exist (just unreachable via UI), so the prop signature stays.

---

## 3. Mode Switcher in the 3-Dot Ellipsis Menu

**File:** `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx`

**Location:** Lines 136-145 inside `<DropdownMenuContent>`

```tsx
<DropdownMenuItem
  onClick={handleModeSwitch}
  disabled={setModeMutation.isPending}
>
  {setModeMutation.isPending
    ? "Switching..."
    : project.projectMode === "simple"
    ? "Switch to GC/Advanced"
    : "Switch to Simple"}
</DropdownMenuItem>
```

Remove this entire `<DropdownMenuItem>`. The `<DeleteProjectButton>` immediately below it (lines 146-155) stays unchanged. The `setModeMutation` declaration (lines 74-82) and `handleModeSwitch` function (lines 90-93) can remain — they are dead UI code but keeping them honors the "preserve underlying code" contract.

---

## 4. Project Creation Form "Project Mode" Field

**File:** `apps/web/components/project/project-form.tsx`

**Location:** Lines 407-430 (a complete `<FormField>` block inside the "Basic Information" card)

```tsx
<FormField
  control={form.control}
  name="projectMode"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Project Mode</FormLabel>
      <Select onValueChange={field.onChange} defaultValue={field.value}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="gc_advanced">GC / Advanced</SelectItem>
          <SelectItem value="simple">Simple</SelectItem>
        </SelectContent>
      </Select>
      <FormDescription>
        Simple mode hides advanced GC features (SOV, RFQs, lien waivers).
      </FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Decision: default to `simple`

The form's `defaultValues` at line 217 currently sets `projectMode: "gc_advanced"`. This must be changed to `"simple"` to satisfy the database default requirement.

The `projectMode` field is optional in `createProjectSchema` (packages/shared, line 112: `projectMode: projectModeEnum.optional()`). The API fallback at `project.ts` line 176 is `input.projectMode ?? "gc_advanced"` and then checks the user's `defaultProjectMode` preference. Since the form will now submit `"simple"` (hardcoded hidden), the API fallback path is not reached.

**Two-part change:**
1. Change `defaultValues.projectMode` from `"gc_advanced"` to `"simple"` (line 217)
2. Remove/hide the `<FormField>` block (lines 407-430) — the field still submits because it's in `defaultValues`; only the rendered UI control is hidden

---

## 5. Route Files for Removed Tabs — Existence Confirmed

All four route `page.tsx` files exist on disk and must be converted to placeholder pages:

| Tab | Route File | Current Content Summary |
|-----|------------|------------------------|
| Budget | `apps/web/app/(dashboard)/projects/[projectSlug]/budget/page.tsx` | Full budget dashboard with variance charts, line items; uses tRPC queries |
| SOV | `apps/web/app/(dashboard)/projects/[projectSlug]/sov/page.tsx` | SOV editor page; uses `SovEditor` component |
| Commitments | `apps/web/app/(dashboard)/projects/[projectSlug]/commitments/page.tsx` | Commitments list page; uses `CommitmentList` component |
| Payment Apps | `apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/page.tsx` | Payment apps list page; uses `PaymentAppList` component |

Sub-routes also exist but are not tab targets:
- `budget/line-items/page.tsx`
- `commitments/new/page.tsx`
- `payment-apps/new/page.tsx`
- `payment-apps/[paymentAppId]/page.tsx`

The task scope is to convert only the four tab-level `page.tsx` files to placeholder pages. Sub-routes (new, detail) are navigated to from within those pages — since the pages are now placeholders, the sub-routes become unreachable but still preserved on disk.

---

## 6. Mode-Conditional Rendering Inside Tab Content — Complete Inventory

Grep results for `projectMode`, `isSimpleMode`, `gc_advanced`, `gcOnly` across all `.tsx` files:

### In `payment-apps/[paymentAppId]/page.tsx` — REQUIRES CHANGE

Lines 131, 192-194, 214-218:

```tsx
const isSimpleMode = project.projectMode === "simple";

// Line 192-194: Lien Waivers tab trigger hidden in Simple mode
{!isSimpleMode && (
  <TabsTrigger value="lien-waivers">Lien Waivers</TabsTrigger>
)}

// Line 214-218: Lien Waivers tab content hidden in Simple mode
{!isSimpleMode && (
  <TabsContent value="lien-waivers">
    <LienWaiverTracker paymentAppId={paymentAppId} projectId={projectId!} />
  </TabsContent>
)}
```

This page is inside the Payment Apps tab (which is being converted to a placeholder). However, the detail page at `payment-apps/[paymentAppId]/page.tsx` is a sub-route that will remain on disk as preserved code. Since all new projects default to `simple`, `isSimpleMode` will always be `true` and lien waivers will never render.

**Decision (Claude's discretion):** Remove the `isSimpleMode` variable and both `{!isSimpleMode && ...}` conditionals. Always omit the lien waivers tab from this detail page. This cleans up the mode logic without deleting functional code (the `LienWaiverTracker` component import and the underlying tab infrastructure stays).

### In `components/estimates/line-items/EstimateLineItemsTable.tsx` — REQUIRES CHANGE

Lines 67-68, 84, 95, 98-99, 300, 503 — this component is used inside the Estimates workflow (`estimates/[estimateSlug]/workflow/page.tsx`), which is a **retained** tab.

Mode-conditional behavior:
1. Line 300: `...(isSimpleMode ? [] : [csiCodeColumn])` — In Simple mode, the CSI Code column is omitted from the table
2. Line 503: `<TableCell colSpan={isSimpleMode ? 4 : 5} />` — footer column span changes based on mode

Since all projects will be `simple`, `csiCodeColumn` will never render. `resolvedProjectMode` defaults to `"gc_advanced"` at line 98 if `project?.projectMode` is undefined — after this phase that fallback means a fresh project without a stored mode would show CSI columns briefly. To prevent that:

**Decision (Claude's discretion):** Change the fallback from `"gc_advanced"` to `"simple"` at line 98:
```typescript
// Before:
const resolvedProjectMode = projectModeProp ?? project?.projectMode ?? "gc_advanced";
// After:
const resolvedProjectMode = projectModeProp ?? project?.projectMode ?? "simple";
```

Optionally, remove the conditional entirely and always use the Simple-mode column set. This is cleaner but is a larger change. Recommendation: change the fallback only, leave the conditional logic intact (it preserves the GC path for future use).

### In `components/project/project-form.tsx` — handled in item 4 above

Lines 217, 409: `defaultValues.projectMode: "gc_advanced"` and the rendered `<FormField>` block.

### In `project-header.tsx` — handled in items 2 and 3 above

Lines 27, 91, 92, 125, 142: projectMode prop, badge, and mode-switch logic.

### In `project-tabs.tsx` — handled in item 1 above

Lines 11, 45: projectMode prop and gcOnly filter.

### In `layout.tsx` — secondary, no UI change needed

Lines 101, 119: passes `project.projectMode ?? "gc_advanced"` to `ProjectHeader` and `ProjectTabs`. These pass-throughs remain; the receiving components will simply not display mode UI after the changes.

### Change Orders tab — CLEAN (no mode-conditional content)

`change-orders/page.tsx` uses `<ChangeOrderList>`. Grep of `components/change-order/` shows no `projectMode` or `isSimpleMode` references. No changes needed.

### Estimates tab — NO PAGE-LEVEL MODE CONDITIONALS

`estimates/[estimateSlug]/page.tsx` and `estimates/page.tsx` have no projectMode references. The mode-conditional is only inside `EstimateLineItemsTable.tsx` (the workflow sub-page), handled above.

---

## 7. Overview GC CTAs — FOUND, REQUIRES REMOVAL

**File:** `apps/web/app/(dashboard)/projects/[projectSlug]/page.tsx`

The Overview page renders a grid of cards. Several cards contain links to the hidden tabs:

### Budget card (lines 341-372)
```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-sm font-medium">Budget</CardTitle>
    <DollarSign className="h-4 w-4 text-muted-foreground" />
  </CardHeader>
  <CardContent>
    {budgetSummary ? (
      <Button variant="link" asChild>
        <Link href={`/projects/${project.slug}/budget`}>View budget details</Link>
      </Button>
    ) : (
      <Button variant="link" asChild>
        <Link href={`/projects/${project.slug}/budget`}>Set up budget</Link>
      </Button>
    )}
  </CardContent>
</Card>
```

### SOV card (lines 446-478)
Links to `/sov` with "Manage SOV" / "Set up SOV" CTAs. Also fetches `trpc.sov.list` (line 227) and `trpc.paymentApp.getRetainage` (line 234) — these are prefetched but their card CTAs must be removed.

### Payment Apps card (lines 480-507)
Links to `/payment-apps` with "View payment apps" / "Create payment app" CTAs. Fetches `trpc.paymentApp.getSummary` (line 220).

### Retainage card (lines 509-533)
Shows retainage totals but **no link** — only displays `$0 No retainage` or amount. No CTA to remove.

### RFQs card (lines 535-562)
Links to `/rfqs` with "View RFQs" / "Create RFQ" CTAs. Fetches `trpc.rfq.list` (line 241). RFQs is being removed from the tab bar, so this card should also be removed.

### Commitments
No dedicated Commitments overview card found. The Budget card does not separately call out commitments. Commitments are navigated to from within the Budget page.

### Cards to keep unchanged
- Schedule card — no GC tab links
- Team card — no GC tab links
- Documents card — links to `/documents` which stays
- Change Orders card — links to `/change-orders` which stays

### tRPC queries to remove from Overview
Since the Budget, SOV, Payment Apps, RFQs, and Retainage cards are removed, their `trpc.*` query hooks at lines 206-247 can also be removed from the Overview page:
- `trpc.budget.getProjectSummary` (line 206-212)
- `trpc.paymentApp.getSummary` (line 220-226)
- `trpc.sov.list` (line 227-233)
- `trpc.paymentApp.getRetainage` (line 234-240)
- `trpc.rfq.list` (line 241-247)

And the unused imports: `DollarSign` (still used by Payment Apps card), `FileText` (still used by Change Orders card and Documents card — keep). After removal, check which Lucide icon imports become unused.

---

## 8. Toast System

**Library:** `sonner` (not shadcn's `useToast`)

**How toasts are called:**
```typescript
import { toast } from "sonner";

toast.success("message");
toast.error("message");
toast("message");           // neutral/info toast
toast.info("message");      // info toast with blue styling
```

**Toaster mounted at:** `apps/web/app/providers.tsx` line 85:
```tsx
import { Toaster } from "@/components/ui/sonner";
// ...
<Toaster />
```

The `Toaster` is `@/components/ui/sonner`, which is the shadcn-wrapped re-export of sonner's `<Toaster>`. It is mounted globally inside `<AbilityContext.Provider>`, which wraps the entire dashboard. Toasts fired from any page component will display correctly.

**For the placeholder page toast:**
```typescript
import { useEffect } from "react";
import { toast } from "sonner";

// Inside the placeholder component:
useEffect(() => {
  toast("That page isn't available");
}, []);
```

The `useEffect` with empty deps fires once on mount. This follows the same pattern used in `documents/page.tsx` (line 73-78) for error toasts.

---

## 9. Existing Placeholder Pattern

**No dedicated placeholder component exists in the codebase.** The closest patterns are:

### Empty state inline (most common)
Used in `budget/page.tsx` lines 39-58:
```tsx
<Card>
  <CardContent className="flex flex-col items-center justify-center py-12">
    <FileText className="h-16 w-16 text-muted-foreground mb-4" />
    <h3 className="text-lg font-semibold mb-2">No Budget Set Up Yet</h3>
    <p className="text-muted-foreground text-center mb-6 max-w-md">...</p>
    <Button asChild>...</Button>
  </CardContent>
</Card>
```

### Not-found inline (used in layout)
Used in `layout.tsx` lines 73-87 for "project not found" state:
```tsx
<div className="flex items-center justify-center min-h-[400px]">
  <div className="text-center space-y-3">
    <h3 className="text-lg font-semibold">Project not found</h3>
    <p className="text-sm text-muted-foreground">...</p>
    <Button asChild>...</Button>
  </div>
</div>
```

**Recommended placeholder pattern (Claude's discretion):**

Combine both: a centered card with an icon, "This section isn't available" heading, brief body text, and a back-to-overview button. The `useEffect` toast fires once on mount. Example structure:

```tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { toast } from "sonner";

export default function BudgetPage() {
  const params = useParams<{ projectSlug: string }>();

  useEffect(() => {
    toast("That page isn't available");
  }, []);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-3 max-w-sm">
        <Lock className="h-10 w-10 text-muted-foreground mx-auto" />
        <h3 className="text-lg font-semibold">This section isn't available</h3>
        <p className="text-sm text-muted-foreground">
          Budget tracking isn't part of your current plan.
        </p>
        <Button variant="outline" asChild>
          <Link href={`/projects/${params.projectSlug}`}>Back to Overview</Link>
        </Button>
      </div>
    </div>
  );
}
```

Each of the four placeholder pages should use its own relevant noun ("Budget tracking", "Schedule of Values", "Commitments", "Payment Applications") but otherwise follow the same structure.

---

## 10. Risk Areas and Special Handling

### Risk 1: The `projectMode` prop chain still exists after the changes

`layout.tsx` passes `projectMode` to both `ProjectHeader` and `ProjectTabs`. After removing the mode badge and the tab filter, this prop becomes dead. It is safe to leave in place (no runtime error). If cleaning up, remove the prop from both component interfaces and the call sites in `layout.tsx` (lines 101 and 119).

Recommendation: Leave the prop chain in place for this phase to minimize scope. Mark for cleanup in a future housekeeping phase.

### Risk 2: `defaultValues.projectMode: "gc_advanced"` in ProjectForm

Must be changed to `"simple"`. If overlooked, newly created projects will have `gc_advanced` stored in the database even though the UI hides the field. Verify this change is included in the plan.

### Risk 3: API project.create fallback

`apps/api/src/trpc/routers/project.ts` line 176: `let projectMode: string = input.projectMode ?? "gc_advanced"`. The form now always submits `"simple"` (from defaultValues), so this fallback is not reached in practice. However, if the form ever submits without `projectMode` (e.g., via direct API call), it falls back to `"gc_advanced"`. This is a backend default that is out of scope for this phase (UI-only changes), but it is a data quality risk. Document for awareness.

### Risk 4: Sub-route pages for hidden tabs still function

`budget/line-items/page.tsx`, `commitments/new/page.tsx`, `payment-apps/new/page.tsx`, and `payment-apps/[paymentAppId]/page.tsx` all remain on disk. They are not reachable via the tab bar or Overview CTAs after this phase. However, a user with a saved bookmark can still navigate there. This is acceptable per the CONTEXT.md decision (route files are kept, data is preserved).

### Risk 5: Overview page tRPC query removal

Removing the 5 tRPC queries from the Overview page (`budget.getProjectSummary`, `paymentApp.getSummary`, `sov.list`, `paymentApp.getRetainage`, `rfq.list`) reduces the data fetched on Overview load. Verify that no other part of the Overview page uses these query results after the card removals. A quick scan confirms: `budgetSummary` is only used in the Budget card, `sovItems` only in the SOV card, `paymentAppSummary` only in Payment Apps card, `retainage` only in the Retainage card, `rfqs` only in the RFQs card. Safe to remove all five.

Note: `layout.tsx` also fetches `budget.getProjectSummary` at line 28 with comment "consumed by Overview tab via React Query cache." After the Overview card is removed, this layout-level prefetch becomes unnecessary but harmless. It can remain for now.

### Risk 6: `RFQs` tab

The `RFQs` tab has `gcOnly: true`, making it already hidden when `projectMode` is `simple`. Since all projects will now be `simple`, it is effectively hidden by existing logic. However, to be explicit and not rely on mode logic that is being deprecated, remove `RFQs` from `ALL_SECTIONS` as well, alongside the four stated tabs. This makes the cleanup complete and independent of the mode filtering code.

---

## Code Examples

### Sonner toast on mount (for placeholder pages)
```typescript
// Source: documents/page.tsx pattern (lines 73-78) adapted
import { useEffect } from "react";
import { toast } from "sonner";

useEffect(() => {
  toast("That page isn't available");
}, []);
```

### Removing a DropdownMenuItem (mode switcher removal)
Before (`project-header.tsx` lines 136-145):
```tsx
<DropdownMenuContent align="end">
  <DropdownMenuItem
    onClick={handleModeSwitch}
    disabled={setModeMutation.isPending}
  >
    {setModeMutation.isPending
      ? "Switching..."
      : project.projectMode === "simple"
      ? "Switch to GC/Advanced"
      : "Switch to Simple"}
  </DropdownMenuItem>
  {canDelete && (
    <DeleteProjectButton ... />
  )}
</DropdownMenuContent>
```

After:
```tsx
<DropdownMenuContent align="end">
  {canDelete && (
    <DeleteProjectButton ... />
  )}
</DropdownMenuContent>
```

---

## Sources

### Primary (HIGH confidence)
All findings are from direct file reads within the codebase. No external documentation was needed for this UI-surgery phase.

- `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx` — tab definitions and mode filtering
- `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx` — mode badge, ellipsis menu
- `apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx` — prop passing to header and tabs
- `apps/web/app/(dashboard)/projects/[projectSlug]/page.tsx` — Overview GC CTAs (all four removed tabs linked)
- `apps/web/components/project/project-form.tsx` — projectMode field in creation form
- `apps/web/app/(dashboard)/projects/[projectSlug]/budget/page.tsx` — route file confirmed present
- `apps/web/app/(dashboard)/projects/[projectSlug]/sov/page.tsx` — route file confirmed present
- `apps/web/app/(dashboard)/projects/[projectSlug]/commitments/page.tsx` — route file confirmed present
- `apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/page.tsx` — route file confirmed present
- `apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/[paymentAppId]/page.tsx` — isSimpleMode lien waiver conditional
- `apps/web/components/estimates/line-items/EstimateLineItemsTable.tsx` — isSimpleMode CSI column conditional
- `apps/web/app/providers.tsx` — Toaster mount location, sonner confirmed
- `apps/api/src/trpc/routers/project.ts` — setMode mutation, create fallback default
- `apps/api/src/db/schema/tenant.ts` — projectMode column schema, defaultProjectMode column

---

## Metadata

**Confidence breakdown:**
- Tab bar changes: HIGH — all tab definitions read directly from source
- Mode badge and menu: HIGH — exact line numbers confirmed
- Project form field: HIGH — field code read directly, defaultValues confirmed
- Route file existence: HIGH — all four `page.tsx` files confirmed on disk
- Mode-conditional inventory: HIGH — grep confirmed exactly two in-tab instances (payment app detail, EstimateLineItemsTable)
- Overview CTAs: HIGH — page.tsx read in full, all four GC cards identified with line numbers
- Toast system: HIGH — sonner confirmed via providers.tsx, useEffect pattern confirmed via documents/page.tsx
- Placeholder pattern: HIGH — no existing pattern, recommendation based on existing empty-state conventions in codebase
- Risk areas: HIGH — all based on direct code reading, no speculation

**Research date:** 2026-02-23
**Valid until:** No external dependencies — valid indefinitely (codebase state may change)
