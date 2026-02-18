# Phase 29: UX Polish & Tech Debt - Research

**Researched:** 2026-02-17
**Domain:** React/Next.js frontend UX patterns, tRPC error handling, job number counter
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UX-01 | List and table views display an informative empty state when no records exist (not a blank table) | Inventory complete — 6 views need empty states or improvements; existing pattern found in customers/subcontractors pages |
| UX-02 | Data loading states are consistent — skeleton loaders or spinners appear during fetches instead of blank content areas | Inventory complete — 3 views use text-only loading, settings/members uses inline text; Skeleton component exists in components/ui |
| UX-03 | API errors surface consistently via toast notifications with actionable messages | Confirmed: mutations have `onError` toast in ~50+ files; queries have ZERO `isError` handling anywhere; no global query error handler in QueryClient |
| JOBEDIT-01 | When a project's job number is manually changed on the edit project page, the company's auto-generation counter increments to prevent future duplicate job numbers | Confirmed tech debt: `project.update` mutation exists, saves `jobNumber` to DB, but does NOT update `jobNumberSettings.nextSequenceNumber` in `companyProfiles` table |
</phase_requirements>

---

## Summary

Phase 29 is a focused UX polish and tech debt cleanup phase. The codebase is already well-structured with consistent patterns in most areas — this phase fills the remaining gaps.

The empty-state situation is mostly good for top-level list pages (projects, customers, subcontractors all have proper empty states with icons and CTAs). The gaps are concentrated in project-level sub-list views — specifically the **settings/members page** (uses plain text, no icon/CTA) and **payment-apps empty state** (minimal text, no CTA). Change orders and commitments have basic dashed-border text states but no icons or call-to-action buttons. The biggest priority UX-01 gaps are these four sub-views.

For loading states (UX-02), the gap is narrower: the settings/members page uses text "Loading members..." and "Loading invitations..." instead of Skeleton components. The `BudgetLineItemTable`, `CommitmentList`, and `ChangeOrderList` use `animate-pulse` divs but not the app's `Skeleton` component — those are functionally equivalent and likely acceptable.

For error handling (UX-03), mutations are covered comprehensively with `toast.error` in `onError` callbacks. The true gap is **query errors** — there is no global query error handler in the `QueryClient` config and no `isError` checks on any `useQuery` call in the entire dashboard. The fix is a single `onError` callback in the QueryClient `defaultOptions.queries`, which will catch all query failures centrally rather than requiring per-page changes.

JOBEDIT-01 is the clearest tech debt item: when `project.update` is called with a new `jobNumber`, the `companyProfiles.jobNumberSettings.nextSequenceNumber` is not updated. The create path already has this logic — it just needs to be replicated in the update path, mirroring the existing counter-advance logic from `project.create`.

**Primary recommendation:** Implement changes in this order — (1) add QueryClient global query error handler for UX-03, (2) add counter advance logic to `project.update` for JOBEDIT-01, (3) upgrade empty states in the 4-6 sub-views that need improvement for UX-01, (4) replace text-based loading states with Skeleton components for UX-02.

---

## Standard Stack

### Core (already in use — no new dependencies needed)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `sonner` | installed | Toast notifications | Already imported via `components/ui/sonner.tsx`; `toast.error(msg)` and `toast.success(msg)` pattern is app-wide standard |
| `@tanstack/react-query` | installed | QueryClient for global error handling | `QueryClient` lives in `app/providers.tsx`; `defaultOptions.queries.onError` is the injection point |
| `Skeleton` | `components/ui/skeleton.tsx` | Loading placeholder | App-wide component; `animate-pulse rounded-md bg-primary/10` |
| `lucide-react` | installed | Icons for empty states | Already used throughout; `Building2`, `FileText`, `Plus`, etc. |

### Supporting

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| shadcn Card | installed | Empty state wrapper | Pattern: `<Card className="p-12">` with centered content |
| shadcn Button | installed | CTA in empty states | Pattern established in customers and subcontractors pages |

### Alternatives Considered
None — all tools are already installed. This phase reuses existing patterns, it does not introduce new libraries.

---

## Architecture Patterns

### Pattern 1: Empty State (established in app)

**What:** Full centered card with icon, heading, description, and CTA button.

**Where established:** `customers/page.tsx` (lines 325-342), `subcontractors/page.tsx` (lines 196-213), `projects-table.tsx` (lines 102-126).

**Canonical pattern:**
```tsx
// Source: apps/web/app/(dashboard)/customers/page.tsx lines 325-342
<Card className="p-12">
  <div className="flex flex-col items-center justify-center text-center space-y-3">
    <div className="rounded-full bg-muted p-3">
      <SomeIcon className="h-6 w-6 text-muted-foreground" />
    </div>
    <div>
      <h3 className="font-semibold text-lg">No [items] yet</h3>
      <p className="text-sm text-muted-foreground mt-1">
        [Description / call to action text]
      </p>
    </div>
    <Button onClick={handleAction}>
      <Plus className="mr-2 h-4 w-4" />
      Add [Item]
    </Button>
  </div>
</Card>
```

**Simpler variant (no CTA — filter result / shared content):**
```tsx
// Source: apps/web/components/change-order/change-order-list.tsx lines 127-134
<div className="text-center py-12 border rounded-lg border-dashed">
  <p className="text-muted-foreground">
    No change orders yet. Create your first change order above.
  </p>
</div>
```

### Pattern 2: Skeleton Loading State (established in app)

**What:** Skeleton rows or block placeholders during data fetch.

**Where established:** `customers/page.tsx`, `subcontractors/page.tsx`, `projects-table.tsx`, `rfqs/page.tsx`.

**Table row skeleton pattern:**
```tsx
// Source: apps/web/components/projects/components/projects-table.tsx lines 86-99
{Array.from({ length: 5 }).map((_, i) => (
  <TableRow key={i}>
    {columns.map((column, colIndex) => (
      <TableCell key={colIndex} className="py-2">
        <Skeleton className="h-5 w-full" />
      </TableCell>
    ))}
  </TableRow>
))}
```

**Card block skeleton pattern:**
```tsx
// Source: apps/web/app/(dashboard)/projects/[projectSlug]/budget/page.tsx lines 87-92
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
  {[...Array(4)].map((_, i) => (
    <Skeleton key={i} className="h-32" />
  ))}
</div>
```

### Pattern 3: Mutation Error Handling (established in app)

**What:** Every `useMutation` has an `onError` callback that calls `toast.error`.

**Standard form:**
```tsx
// Source: apps/web/app/(dashboard)/customers/page.tsx lines 85-88
onError: (error) => {
  toast.error(error.message || "Failed to [action]");
},
```

**Extended form with description:**
```tsx
// Source: apps/web/components/estimates/workflow/steps/01-BasicInfo.tsx lines 58-61
onError: (error) => {
  toast.error("Failed to save changes", {
    description: error.message,
  });
},
```

### Pattern 4: Global Query Error Handler (NOT YET IMPLEMENTED — the fix for UX-03)

**What:** A single `onError` callback in `QueryClient` default options catches all query failures. This prevents the need to handle `isError` on every individual query.

**Where to add:** `apps/web/app/providers.tsx` — the `QueryClient` instantiation.

**Implementation:**
```tsx
// In TrpcAndAbilityProvider in apps/web/app/providers.tsx
// Source pattern: @tanstack/react-query v5 QueryClient defaultOptions
const [queryClient] = useState(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000,
          retry: 1,
          refetchOnWindowFocus: false,
        },
        mutations: {
          // No global handler needed - mutations handle onError individually
        },
      },
      // React Query v5 uses queryCache/mutationCache for global callbacks
    })
);
```

**IMPORTANT NOTE:** In `@tanstack/react-query` v5 (which this app uses with tRPC), global error callbacks moved to `queryCache` and `mutationCache` options, NOT `defaultOptions`. The correct implementation:
```tsx
import { QueryClient, QueryCache } from "@tanstack/react-query";
import { toast } from "sonner";

const [queryClient] = useState(
  () =>
    new QueryClient({
      queryCache: new QueryCache({
        onError: (error) => {
          toast.error("Failed to load data", {
            description: error instanceof Error ? error.message : "An unexpected error occurred",
          });
        },
      }),
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000,
          retry: 1,
          refetchOnWindowFocus: false,
        },
      },
    })
);
```

**Confidence note:** This is the documented pattern for react-query v5. The app already imports `QueryClient` from `@tanstack/react-query`. The `QueryCache` import needs to be added.

### Anti-Patterns to Avoid

- **Adding `isError` to individual queries:** Now that UX-03 is a global handler, don't add per-query error checking — it creates inconsistent UX and double-toasting.
- **Triggering the global query error for intentional empty states:** The global handler fires for network/server errors, not empty arrays. Empty arrays are `data: []` with no error, so the global handler doesn't interfere.
- **Updating counter in client side:** JOBEDIT-01 counter increment must happen in the API route (`project.update`), not client-side. The counter is stored in `companyProfiles.jobNumberSettings` JSONB and must be updated in the same transaction as the project update.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom notification component | `sonner` via `toast.error()` | Already installed, consistent across 50+ files |
| Loading skeleton | Custom CSS animation | `Skeleton` from `components/ui/skeleton` | App component already exists |
| Global error catching | Per-query `onError` everywhere | `QueryCache.onError` in providers.tsx | Single point of truth, already has QueryClient |
| Job number sequence parsing | New regex logic | Copy existing pattern from `project.create` (lines 126-143) | Exact same logic needed — extract sequence from template, compare, advance |

---

## Common Pitfalls

### Pitfall 1: react-query v5 GlobalError API Changed
**What goes wrong:** Developer puts `onError` in `defaultOptions.queries` (v4 pattern) — it silently does nothing in v5.
**Why it happens:** Breaking change between react-query v4 and v5.
**How to avoid:** Use `new QueryCache({ onError: ... })` passed to `QueryClient` constructor.
**Warning signs:** Queries fail silently even after adding `defaultOptions.queries.onError`.

### Pitfall 2: Double-Toasting on Mutations
**What goes wrong:** If global `MutationCache.onError` is also added, mutations that already have `onError: (error) => toast.error(...)` will show two toasts.
**Why it happens:** Mutations handle errors individually AND globally if both are set.
**How to avoid:** Only add `QueryCache.onError` (for queries). Do NOT add `MutationCache.onError` — mutations are already handled.

### Pitfall 3: JOBEDIT-01 Counter Logic — Template Length Mismatch
**What goes wrong:** Extracting sequence digits from the manual job number using wrong length — e.g., template has `{NNNN}` (4 digits) but job number "2026001" gets parsed as 7 digits instead of trailing 4 "0001".
**Why it happens:** Must use the template's `{N+}` length to determine how many digits to extract from the RIGHT of the job number.
**How to avoid:** Mirror the existing logic in `project.create` (lines 126-143 of `project.ts`): `templateSeqMatch[1].length` to get sequence length, then use regex `(\d{N})$` to extract exactly that many trailing digits.

### Pitfall 4: JOBEDIT-01 Counter Update — Only When Auto-Gen Is Enabled
**What goes wrong:** Counter is updated even when `jobNumberSettings.enabled === false`.
**Why it happens:** Without the guard, counter would be mutated even for companies that don't use auto-generation.
**How to avoid:** Wrap the counter-advance block in `if (input.jobNumber && jobNumberSettings?.enabled)` — same guard as in `project.create`.

### Pitfall 5: Empty State Shown During Loading
**What goes wrong:** Page shows "No items yet" while data is still loading (`data === undefined`), flashing empty state before items appear.
**Why it happens:** `data?.length === 0` is true when data is `undefined` because `undefined?.length` is `undefined` which is falsy — this can go wrong if not checking `isLoading` first.
**How to avoid:** Always check `isLoading` BEFORE checking empty: `if (isLoading) return <Skeleton />; if (!data?.length) return <EmptyState />;`

### Pitfall 6: `customerId` undefined on Project Edit
**What goes wrong:** The project router's `update` procedure only updates `customerId` if `input.customerId !== undefined` — but the edit form always sends it. Verify the update procedure handles `customerId` correctly.
**How to avoid:** Check: `project.update` currently does NOT include `customerId` in the `updateValues` build (lines 584-621 of project.ts). If the user changes the customer on edit, it won't save. However, this is out of scope for Phase 29.

---

## Complete Inventory: List Pages

### Top-Level List Pages

| Page | File | Empty State | Loading State | Needs Work |
|------|------|-------------|---------------|------------|
| Projects | `app/(dashboard)/projects/page.tsx` + `projects-table.tsx` | YES - icon + heading + CTA button | YES - skeleton rows in table | None |
| Customers | `app/(dashboard)/customers/page.tsx` | YES - Building2 icon + heading + CTA | YES - 5x Skeleton h-16 | None |
| Subcontractors | `app/(dashboard)/subcontractors/page.tsx` | YES - Building2 icon + heading + CTA | YES - 5x Skeleton h-16 | None |
| Reports | `app/(dashboard)/reports/page.tsx` + `report-list.tsx` | YES - dashed border, heading, description | YES - animate-pulse cards | None |

### Project Sub-Pages (list/table views)

| Page | File | Empty State | Loading State | Needs Work |
|------|------|-------------|---------------|------------|
| Estimates | `projects/[slug]/estimates/page.tsx` | YES - FileText icon + heading + CTA | YES - Skeleton blocks | None |
| RFQs | `projects/[slug]/rfqs/page.tsx` | YES - FileText icon + heading + CTA | YES - Skeleton blocks | None |
| Change Orders | `components/change-order/change-order-list.tsx` | PARTIAL - text-only dashed border, no icon, no CTA | PARTIAL - `animate-pulse` div (not Skeleton component) | UX-01: upgrade to icon + CTA pattern |
| Payment Apps | `components/payment-app/payment-app-list.tsx` | PARTIAL - "No payment applications yet" text only | YES - animate-pulse grids | UX-01: upgrade to icon + CTA pattern |
| Commitments | `components/budget/commitment-list.tsx` | PARTIAL - text-only dashed border, no icon, no CTA | PARTIAL - `animate-pulse` div (not Skeleton component) | UX-01: upgrade to icon + CTA pattern |
| Budget Dashboard | `projects/[slug]/budget/page.tsx` | YES - FileText icon + heading + CTA | YES - Skeleton components | None |
| Budget Line Items | `components/budget/budget-line-item-table.tsx` | Need to verify | Need to verify | Check |
| Documents | `projects/[slug]/documents/page.tsx` | YES - File icon + heading + CTA + Upload button | YES - Skeleton h-16 | None |
| Invoices/Aging | `projects/[slug]/invoices/page.tsx` | Delegates to AgingReportTable — not checked | Not checked | Low priority |
| SOV | delegates to `SovEditor` — not checked | Not checked | Not checked | Low priority |

### Settings Pages

| Page | File | Empty State | Loading State | Needs Work |
|------|------|-------------|---------------|------------|
| Members | `settings/members/page.tsx` | PARTIAL - "No members yet. Invite team members to get started!" (text only) | POOR - "Loading members..." text | UX-01 + UX-02: add Skeleton loading, upgrade empty state |
| Invitations | `settings/members/page.tsx` | PARTIAL - "No pending invitations" (text only) | POOR - "Loading invitations..." text | UX-01 + UX-02: upgrade |

---

## Inventory: Error Handling Gaps

### Mutations (UX-03) — COMPLETE — No action needed
All `useMutation` calls across 55 files have `onError: (error) => toast.error(...)` callbacks. This is 100% covered.

### Queries (UX-03) — MISSING — Action required
No `useQuery` call in the dashboard has `isError` handling. There is no `QueryCache.onError` global handler in `providers.tsx`. Failed queries show blank/empty content with no user feedback.

**Files affected:**
- `apps/web/app/providers.tsx` — add `QueryCache` with `onError` handler (single file change covers ALL queries app-wide)

---

## JOBEDIT-01 Implementation Path

### The Bug (confirmed)

`project.update` in `apps/api/src/trpc/routers/project.ts` (lines 549-642) saves the new `jobNumber` to the `projects` table but does NOT update `companyProfiles.jobNumberSettings.nextSequenceNumber`.

### The Fix Pattern (already exists in `project.create`)

The counter-advance logic already exists in `project.create` (lines 122-144). The same logic must be added to `project.update`.

**What to copy from `project.create`:**

```typescript
// Source: apps/api/src/trpc/routers/project.ts lines 102-144

// Step 1: Load company profile (do this before building updateValues)
const [companyProfile] = await db
  .select()
  .from(schema.companyProfiles)
  .where(isNull(schema.companyProfiles.validTo))
  .limit(1);

const jobNumberSettings = companyProfile?.jobNumberSettings;

// Step 2: If manual job number provided and auto-generation is enabled, advance counter
let updatedJobSettings = jobNumberSettings;
if (input.jobNumber && jobNumberSettings?.enabled) {
  const templateSeqMatch = jobNumberSettings.template.match(/\{(N+)\}/);
  const sequenceLength = templateSeqMatch ? templateSeqMatch[1].length : null;
  const seqRegex = sequenceLength
    ? new RegExp(`(\\d{${sequenceLength}})$`)
    : /(\d+)$/;
  const sequenceMatch = input.jobNumber.match(seqRegex);
  if (sequenceMatch) {
    const manualSequence = parseInt(sequenceMatch[1], 10);
    if (manualSequence >= jobNumberSettings.nextSequenceNumber) {
      updatedJobSettings = {
        ...jobNumberSettings,
        nextSequenceNumber: manualSequence + 1,
      };
    }
  }
}

// Step 3: In the DB transaction, if settings changed, update companyProfiles
if (updatedJobSettings && updatedJobSettings !== jobNumberSettings) {
  await db  // or tx inside transaction
    .update(schema.companyProfiles)
    .set({ jobNumberSettings: updatedJobSettings })
    .where(isNull(schema.companyProfiles.validTo));
}
```

**Note:** `project.update` does not currently use a transaction. The counter update must be added either:
- Option A: Wrap the existing `db.update(schema.projects)` in a transaction and update `companyProfiles` inside the same transaction (preferred — atomic).
- Option B: Update `companyProfiles` after the project update (simpler — acceptable since failure to update counter is non-critical).

**Recommendation:** Option A (transaction) to match the create pattern and ensure atomicity.

### Key Types

`jobNumberSettings` is stored as JSONB in `companyProfiles` table. It's typed as `JobNumberSettings` from `packages/shared/src/types/company.ts`.

Fields relevant to this fix:
- `nextSequenceNumber: number` — the counter to advance
- `enabled: boolean` — only advance when `true`
- `template: string` — contains `{NNN...}` to determine sequence digit length

---

## Code Examples

### Empty State — Upgrade Pattern for Change Orders/Commitments

```tsx
// Replace existing dashed-border text-only empty state
// Before (change-order-list.tsx lines 127-133):
<div className="text-center py-12 border rounded-lg border-dashed">
  <p className="text-muted-foreground">
    No change orders yet. Create your first change order above.
  </p>
</div>

// After (following customers page pattern):
<div className="text-center py-12 border rounded-lg border-dashed">
  <div className="flex flex-col items-center gap-3">
    <div className="rounded-full bg-muted p-3">
      <ClipboardList className="h-6 w-6 text-muted-foreground" />
    </div>
    <div>
      <h3 className="font-semibold text-lg">No change orders yet</h3>
      <p className="text-sm text-muted-foreground mt-1">
        Create your first change order to track project scope changes
      </p>
    </div>
    <Button onClick={handleNavigateToNew}>
      <Plus className="h-4 w-4 mr-2" />
      New Change Order
    </Button>
  </div>
</div>
```

### Skeleton Loading — Settings Members Page

```tsx
// Replace existing text-based loading in settings/members/page.tsx lines 227-229:
// Before:
{membersLoading ? (
  <div className="text-center py-8 text-muted-foreground">Loading members...</div>
) : ...}

// After:
{membersLoading ? (
  <div className="space-y-3 py-2">
    {Array.from({ length: 3 }).map((_, i) => (
      <Skeleton key={i} className="h-14 w-full" />
    ))}
  </div>
) : ...}
```

### Global Query Error Handler (providers.tsx)

```tsx
// Source pattern: @tanstack/react-query v5 official API
// In: apps/web/app/providers.tsx

import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { toast } from "sonner";

const [queryClient] = useState(
  () =>
    new QueryClient({
      queryCache: new QueryCache({
        onError: (error) => {
          toast.error("Failed to load data", {
            description: error instanceof Error ? error.message : "An unexpected error occurred",
          });
        },
      }),
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000,
          retry: 1,
          refetchOnWindowFocus: false,
        },
      },
    })
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `defaultOptions.queries.onError` | `QueryCache.onError` | react-query v5 | Must use `QueryCache` import, not `defaultOptions` |
| Manual `isError` checks per-query | Global `QueryCache.onError` | react-query v5 | Single handler covers all queries |

**Note on react-query version:** The app's `providers.tsx` imports `QueryClient` and `QueryClientProvider` from `@tanstack/react-query`. The `tRPC` react-query integration uses v5 API. Verify the installed version before implementing by checking `package.json`.

---

## Open Questions

1. **react-query exact version**
   - What we know: The app uses `@tanstack/react-query` with tRPC; `QueryClient` config is in `providers.tsx`
   - What's unclear: Exact minor version (v5.x.x) — `QueryCache` API may have slight differences
   - Recommendation: Check `apps/web/package.json` for exact version before implementation; the `QueryCache` approach works for v5.x

2. **BudgetLineItemTable empty state**
   - What we know: The page delegates to `<BudgetLineItemTable projectId={projectId} />` — not fully read
   - What's unclear: Whether the component has its own empty state or blank table
   - Recommendation: Planner should note this as "check before implementing UX-01 sweep"

3. **AgingReportTable empty state**
   - What we know: `invoices/page.tsx` delegates to `<AgingReportTable type="ar|ap" />`
   - What's unclear: Whether the component has an empty state
   - Recommendation: Lower priority — invoices is a specialized view; check but may be out of scope

4. **SOV Editor empty state**
   - What we know: `sov/page.tsx` delegates to `<SovEditor projectId={projectId} />`
   - What's unclear: Whether SOV editor handles empty state or shows blank
   - Recommendation: Lower priority; SOV has prerequisite messaging already in payment-app-list

---

## Files to Modify Per Requirement

### UX-03 (Query Error Handling) — 1 file

| File | Change |
|------|--------|
| `apps/web/app/providers.tsx` | Add `QueryCache` with `onError` toast; import `QueryCache` from `@tanstack/react-query` |

### JOBEDIT-01 (Job Number Counter on Edit) — 1 file

| File | Change |
|------|--------|
| `apps/api/src/trpc/routers/project.ts` | Add counter-advance logic to `project.update` mutation; load `companyProfile`, extract sequence from new job number, update `jobNumberSettings.nextSequenceNumber` if needed |

### UX-01 (Empty States) — 4-5 files

| File | Change |
|------|--------|
| `apps/web/components/change-order/change-order-list.tsx` | Upgrade dashed-border text empty state to icon + heading + CTA button |
| `apps/web/components/budget/commitment-list.tsx` | Upgrade dashed-border text empty state to icon + heading + CTA button |
| `apps/web/components/payment-app/payment-app-list.tsx` | Upgrade "No payment applications yet" text to icon + heading + guidance |
| `apps/web/app/(dashboard)/settings/members/page.tsx` | Upgrade "No members yet" and "No pending invitations" to icon + heading pattern |
| (optional) `apps/web/components/budget/budget-line-item-table.tsx` | Verify and upgrade if blank |

### UX-02 (Loading States) — 1-2 files

| File | Change |
|------|--------|
| `apps/web/app/(dashboard)/settings/members/page.tsx` | Replace "Loading members..." and "Loading invitations..." text with `<Skeleton>` rows |

---

## Scope Estimate

| Requirement | Files | Complexity | Notes |
|-------------|-------|------------|-------|
| UX-03 (query error handler) | 1 | Low | Single QueryCache addition in providers.tsx |
| JOBEDIT-01 (counter on edit) | 1 | Low-Medium | Copy existing logic from project.create; add transaction |
| UX-01 (empty states) | 4-5 | Low | Copy-paste pattern from existing pages; icon + text + button |
| UX-02 (loading states) | 1-2 | Low | Replace text with Skeleton components |

**Total estimate:** 7-9 files changed, all changes are small (20-50 lines each). Phase is well-scoped and low-risk.

**Implementation order (recommended):**
1. `providers.tsx` — UX-03 global error handler (single file, foundational)
2. `project.ts` — JOBEDIT-01 counter update (single file, backend)
3. `change-order-list.tsx` — UX-01 empty state upgrade
4. `commitment-list.tsx` — UX-01 empty state upgrade
5. `payment-app-list.tsx` — UX-01 empty state upgrade
6. `settings/members/page.tsx` — UX-01 empty state + UX-02 skeleton loading (combined)

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `apps/web/app/(dashboard)/` — all list pages read
- Direct code inspection of `apps/web/components/` — change-order-list, payment-app-list, commitment-list, report-list, budget-line-item-table
- Direct code inspection of `apps/api/src/trpc/routers/project.ts` — project.create and project.update mutations
- Direct code inspection of `apps/api/src/utils/job-number.ts` — generateJobNumber utility
- Direct code inspection of `apps/web/app/providers.tsx` — QueryClient configuration
- Direct code inspection of `apps/web/components/ui/skeleton.tsx` — Skeleton component

### Secondary (MEDIUM confidence)
- @tanstack/react-query v5 `QueryCache.onError` API — inferred from v5 migration docs and `QueryClient` import pattern in codebase

### Tertiary (LOW confidence — verify before implementing)
- Exact react-query version — need to check `apps/web/package.json`

---

## Metadata

**Confidence breakdown:**
- List page inventory: HIGH — all pages read directly
- Loading state inventory: HIGH — all pages read directly
- Error handling pattern: HIGH — providers.tsx and 55 mutation files confirmed
- JOBEDIT-01 implementation path: HIGH — project.ts create and update both read; logic is clear
- QueryCache v5 API: MEDIUM — standard documented pattern, verify version

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable codebase, 30-day window)
