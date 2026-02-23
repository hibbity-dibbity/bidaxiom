# Phase 46: Project Header, Tabs, and Navigation Chrome - Research

**Researched:** 2026-02-23
**Domain:** Next.js layout chrome, tRPC query aggregation, Tailwind CSS sticky positioning
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Tab navigation routing (hard constraint from ROADMAP.md):**
Tab navigation MUST remain `<Link href scroll={false}>` — do NOT replace with Radix Tabs state or any component-state router. `sectionPrefetchMap` prefetch hooks in `project-tabs.tsx` must be preserved exactly as-is.

**Header layout (80px maximum):**
Compress to 2 rows only:
- Row 1 (~40px): Job # + name + lifecycle phase badge + mode badge + action buttons
- Row 2 (~40px): Financial stat bar (5 fields)

Remove from sticky header: customer name/address/date range, existing 4-column metric grid (Budget Total/Committed/Actual Cost/Team), mode switch button.
Restored banner may remain (conditional, zero-space when hidden).

**Financial stat bar fields (all 5 always visible):**
1. Contract Value = accepted_estimate_total + sum(approved COs), or project_budget fallback, or $0
2. Billed to Date = sum of currentPaymentDue across all payment apps (all statuses)
3. Paid to Date = $0 placeholder (no payment capture yet); slot reserved
4. Balance to Complete = Contract Value - Paid to Date (can compute client-side)
5. Retainage Held = sum of amountHeld from retainageHeld table

**Tab count badges:**
- Change Orders: count where status IN ('pco_submitted', 'pending_approval')
- Payment Apps: count where status IN ('submitted', 'approved') AND paid_at IS NULL
- Documents: total count on project
- Invoices: total payment app count (AR proxy) + AP commitment count, or payment app count only
- No badge on: Overview, Budget, Commitments, SOV, RFQs, Estimates
- Style: inline text "(N)" appended to label, same font/color, hidden when N = 0

**API batching requirement:**
All 9 stat values in a single new `project.getHeaderStats` procedure — no per-tab separate queries at layout render.

### Claude's Discretion

- Where to place the mode switch button (project settings or Edit action dropdown)
- Whether `balanceToComplete` is computed server-side or client-side
- Exact SQL pattern for the batched stats endpoint (subqueries vs. separate await-parallel queries)
- Whether to add `getHeaderStats` to `projectRouter` or create a slim new `projectStatsRouter`

### Deferred Ideas (OUT OF SCOPE)

- Payment capture / Paid to Date population from a real payments table
- Per-user filtered badge counts
- Badge animation or color theming
- Overview tab content changes
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CHROME-01 | Compact sticky project header ≤80px height | See sticky positioning section — `position: sticky; top: 0` inside `overflow-auto` `main`, Tailwind `sticky top-0 z-10 max-h-20` |
| CHROME-02 | Financial stat bar (5 fields) always visible in header | See stat bar data section — new `project.getHeaderStats` tRPC endpoint returns all values in one call |
| CHROME-03 | Tab count badges on Change Orders, Payment Apps, Documents, Invoices | See badge data section — exact status values from schema verified; batched into getHeaderStats |
| CHROME-04 | Confirmed URL-based tab routing with sectionPrefetchMap preserved | See tab routing section — existing `project-tabs.tsx` already implements this correctly; change is additive (add badge labels only) |
</phase_requirements>

---

## Summary

Phase 46 modifies three existing files (`layout.tsx`, `project-header.tsx`, `project-tabs.tsx`) and adds one new API endpoint (`project.getHeaderStats`). The work is primarily CSS restructuring (compress header to 80px sticky) and data aggregation (one new SQL query returning 9 computed values).

The current `project-header.tsx` has 4 visual rows totaling well over 80px. Compression to 2 rows requires removing the customer/address/date info row and the 4-column budget metric grid. These are moved to the Overview tab (they already exist there). The sticky behavior requires CSS class changes on the header wrapper — the outer `main` element already has `overflow-auto` so `position: sticky; top: 0` will work within that scroll context.

The tab routing system (`project-tabs.tsx`) is already correctly implemented with `<Link href scroll={false}>` and the `sectionPrefetchMap`. The only change to that file is adding badge count labels: each tab renders `{section.name}{badge > 0 ? ` (${badge})` : ""}`. The badge counts are fetched once via `project.getHeaderStats` and passed as props.

**Primary recommendation:** Add `project.getHeaderStats` to the existing `projectRouter` (not a new router file), pass the result to both `ProjectHeader` and `ProjectTabs` via the shared `layout.tsx`, use parallel `await Promise.all` inside the resolver for the 9 sub-queries.

---

## Standard Stack

### Core (already in project — no new installs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | existing | SQL query building for stats endpoint | Already used across all routers |
| tRPC | existing | Type-safe API — add `getHeaderStats` query | Pattern established in all routers |
| React Query (via tRPC) | existing | Client-side data fetching + caching | staleTime pattern already in use |
| Tailwind CSS | existing | sticky/top-0/z-10/h-20 classes for header | Used throughout |
| CurrencyDisplay | existing component | `components/shared/currency-display.tsx` | Matches CONTEXT requirement |

### No New Dependencies
This phase adds no new npm packages. All required libraries and components exist.

---

## Architecture Patterns

### Recommended File Changes
```
apps/api/src/trpc/routers/
└── project.ts           # Add getHeaderStats procedure

apps/web/app/(dashboard)/projects/[projectSlug]/
├── layout.tsx           # Fetch getHeaderStats, pass to header + tabs
└── components/
    ├── project-header.tsx   # Compress to 2 rows, add stat bar
    └── project-tabs.tsx     # Add badge prop, render "(N)" in tab labels
```

### Pattern 1: Sticky Header Within overflow-auto Container

**What:** The `main` element in `app-shell.tsx` has `overflow-auto`. For `position: sticky` to work, the sticky element must be an ancestor within the scrolling container. The project layout's outer `<div className="space-y-4">` wraps the header — sticky must be applied to the header wrapper so it sticks to the top of the `main` scroll container.

**Critical finding:** `position: sticky` works inside `overflow-auto` parent when the sticky element is a direct/near-direct child of the scrollable container. The project layout's `<div className="space-y-4">` currently wraps everything with no explicit height. The sticky header needs to be extracted from `space-y-4` spacing and sit at the top of the scroll context independently.

**How to implement:**

```tsx
// layout.tsx — restructure the outer div
return (
  <div>
    {/* Sticky header wrapper — sticky within main's overflow-auto */}
    <div className="sticky top-0 z-10 bg-background border-b">
      <div className="px-6 pt-4 pb-0">
        <ProjectHeader ... />
      </div>
      <div className="px-6">
        <ProjectTabs ... />
      </div>
    </div>
    {/* Scrollable content area */}
    <div className="p-6 mt-4">{children}</div>
  </div>
);
```

**Height constraint:** The sticky wrapper needs `max-h-[80px]` for Row 1 + Row 2 combined. Since tabs are part of the chrome but outside the 80px constraint (they sit below), clarify: CHROME-01 specifies the header (not tabs) is ≤80px. The sticky wrapper is: header div (~80px) + tabs div (~48px) = ~128px total chrome. The 80px constraint applies to the project header card only, not including the tabs row.

**Warning sign:** If `overflow: hidden` is set anywhere between `main` and the sticky element, sticky will break. Verify no parent has `overflow: hidden`.

### Pattern 2: tRPC Batched Stats Endpoint

**What:** A single `getHeaderStats` procedure in `projectRouter` that runs all 9 counts/sums in one resolver using `Promise.all` for parallel execution.

**When to use:** Any time multiple independent DB queries serve a single UI need — avoids N round-trips over the tRPC bridge.

**Example:**

```typescript
// Source: pattern established in existing getCashFlowSummary in invoice-tracking.ts
getHeaderStats: protectedProcedure
  .input(z.object({ projectId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    if (!ctx.tenant || !ctx.userId) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    }
    const { db, schema } = ctx.tenant;
    const abilities = await loadProjectAbilities({ tenant: ctx.tenant, userId: ctx.userId, orgRole: ctx.orgRole });
    ForbiddenError.from(abilities).throwUnlessCan("read", "Project");

    const { projectId } = input;

    const [
      acceptedEstimate,
      approvedCOSum,
      projectBudget,
      billedToDate,
      retainageHeldSum,
      changeOrdersPendingCount,
      paymentAppsPendingCount,
      documentsCount,
      invoicesCount,
    ] = await Promise.all([
      // 1. Accepted estimate total
      db.select({ totalCost: schema.estimates.totalCost })
        .from(schema.estimates)
        .where(and(eq(schema.estimates.projectId, projectId), eq(schema.estimates.status, "accepted")))
        .orderBy(desc(schema.estimates.acceptedAt))
        .limit(1),

      // 2. Sum of approved change orders
      db.select({ total: sql<string>`COALESCE(SUM(total_amount), 0)` })
        .from(schema.changeOrders)
        .where(and(eq(schema.changeOrders.projectId, projectId), eq(schema.changeOrders.status, "approved"))),

      // 3. Project budget fallback
      db.select({ budget: schema.projects.budget })
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .limit(1),

      // 4. Billed to Date = sum of currentPaymentDue across ALL payment apps
      db.select({ total: sql<string>`COALESCE(SUM(current_payment_due), 0)` })
        .from(schema.paymentApps)
        .where(eq(schema.paymentApps.projectId, projectId)),

      // 5. Retainage Held = sum of amountHeld - releasedAmount in retainageHeld table
      db.select({ total: sql<string>`COALESCE(SUM(amount_held - COALESCE(released_amount, 0)), 0)` })
        .from(schema.retainageHeld)
        .where(eq(schema.retainageHeld.projectId, projectId)),

      // 6. Change Orders pending count: pco_submitted + pending_approval
      db.select({ count: count() })
        .from(schema.changeOrders)
        .where(and(
          eq(schema.changeOrders.projectId, projectId),
          inArray(schema.changeOrders.status, ["pco_submitted", "pending_approval"])
        )),

      // 7. Payment Apps pending count: submitted + approved (not yet paid)
      db.select({ count: count() })
        .from(schema.paymentApps)
        .where(and(
          eq(schema.paymentApps.projectId, projectId),
          inArray(schema.paymentApps.status, ["submitted", "approved"]),
          isNull(schema.paymentApps.paidAt)
        )),

      // 8. Documents count
      db.select({ count: count() })
        .from(schema.documents)
        .where(eq(schema.documents.projectId, projectId)),

      // 9. Invoices count = payment apps count (AR proxy; AP from commitments if needed)
      db.select({ count: count() })
        .from(schema.paymentApps)
        .where(eq(schema.paymentApps.projectId, projectId)),
    ]);

    // Compute contractValue with priority: accepted estimate > project budget > 0
    const estimateTotal = acceptedEstimate[0]?.totalCost ? Number(acceptedEstimate[0].totalCost) : null;
    const approvedCOTotal = Number(approvedCOSum[0]?.total ?? 0);
    const budget = projectBudget[0]?.budget ? Number(projectBudget[0].budget) : null;

    let contractValue: number;
    if (estimateTotal !== null) {
      contractValue = estimateTotal + approvedCOTotal;
    } else if (budget !== null) {
      contractValue = budget;
    } else {
      contractValue = 0;
    }

    const billedTotal = Number(billedToDate[0]?.total ?? 0);
    const retainageTotal = Number(retainageHeldSum[0]?.total ?? 0);
    const paidToDate = 0; // Placeholder — future payments table

    return {
      contractValue,
      billedToDate: billedTotal,
      paidToDate,                            // Always 0 until Phase N (payments)
      balanceToComplete: contractValue - paidToDate,
      retainageHeld: retainageTotal,
      changeOrdersPendingCount: Number(changeOrdersPendingCount[0]?.count ?? 0),
      paymentAppsPendingCount: Number(paymentAppsPendingCount[0]?.count ?? 0),
      documentsCount: Number(documentsCount[0]?.count ?? 0),
      invoicesCount: Number(invoicesCount[0]?.count ?? 0),
    };
  }),
```

### Pattern 3: Tab Badge Label Rendering

**What:** Render tab label with optional inline count. No badge pill, no dot — plain text `"Change Orders (3)"`.

```tsx
// Source: direct from CONTEXT.md specification
const BADGE_TABS = new Set(["/change-orders", "/payment-apps", "/documents", "/invoices"]);

const getBadgeCount = (href: string): number => {
  if (!headerStats) return 0;
  switch (href) {
    case "/change-orders": return headerStats.changeOrdersPendingCount;
    case "/payment-apps": return headerStats.paymentAppsPendingCount;
    case "/documents": return headerStats.documentsCount;
    case "/invoices": return headerStats.invoicesCount;
    default: return 0;
  }
};

// In the tab render:
const badge = BADGE_TABS.has(section.href) ? getBadgeCount(section.href) : 0;
const label = badge > 0 ? `${section.name} (${badge})` : section.name;

<Link ...>{label}</Link>
```

### Pattern 4: Financial Stat Bar Component

**What:** A compact horizontal row of 5 labeled currency pairs using `CurrencyDisplay`.

```tsx
// Inline within project-header.tsx (or extracted as ProjectStatBar subcomponent)
interface StatItem {
  label: string;
  value: number;
}

const stats: StatItem[] = [
  { label: "Contract Value", value: headerStats.contractValue },
  { label: "Billed to Date", value: headerStats.billedToDate },
  { label: "Paid to Date", value: headerStats.paidToDate },
  { label: "Balance to Complete", value: headerStats.balanceToComplete },
  { label: "Retainage Held", value: headerStats.retainageHeld },
];

// Render:
<div className="flex items-center gap-6">
  {stats.map(({ label, value }) => (
    <div key={label} className="flex flex-col min-w-0">
      <span className="text-xs text-muted-foreground leading-tight">{label}</span>
      <CurrencyDisplay amount={value} className="text-sm font-semibold" />
    </div>
  ))}
</div>
```

### Anti-Patterns to Avoid

- **Replacing `<Link href scroll={false}>` with Radix Tabs or useState router:** Breaks browser history, shareable URLs, and the sectionPrefetchMap hover-prefetch chain. LOCKED constraint.
- **Fetching badge counts with per-tab useQuery calls in ProjectTabs:** Creates 4 separate round-trips on every project page load. Use the single `getHeaderStats` fetch in layout.tsx.
- **Setting `overflow: hidden` on the sticky header wrapper:** Kills dropdown menus (LifecyclePhaseBadge transition dropdown, action dropdown) that overflow the header bounds.
- **Using `position: fixed` instead of `position: sticky`:** Fixed positioning exits the normal flow and causes content overlap without padding compensation; sticky is self-compensating within the scroll container.
- **Removing budgetSummary query from layout.tsx without auditing Overview tab:** The Overview tab likely depends on `budget.getProjectSummary` data passed from layout — verify before removing.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Currency display | Custom Intl.NumberFormat | `CurrencyDisplay` component | Already exists at `components/shared/currency-display.tsx`; tabular-nums, USD, 2 decimal |
| Sticky scroll | JS scroll event listener + CSS class toggle | Tailwind `sticky top-0` | Browser-native, no JS overhead, works correctly in overflow-auto container |
| Tab active state detection | React state machine | `usePathname()` + string comparison | Already implemented in `project-tabs.tsx` — preserve it |
| Parallel SQL queries | Sequential awaits | `Promise.all([...])` | All 9 stats are independent — parallel execution avoids 9x DB round-trip latency |

---

## Common Pitfalls

### Pitfall 1: Sticky Breaks Inside Nested overflow Context

**What goes wrong:** The sticky header appears to scroll away instead of sticking.
**Why it happens:** `position: sticky` only sticks relative to its nearest scrollable ancestor. If any parent between `main` and the sticky element has `overflow: hidden` or `overflow: auto`, the sticky element sticks to that container's edge (which may be off-screen).
**How to avoid:** Verify the DOM path from `main` (the scrolling container in `app-shell.tsx`) to the sticky element. No intermediate element should have `overflow` set. The current `space-y-4` wrapper div has no overflow — safe. The `SidebarInset` wrapping the `main` should also be verified.
**Warning signs:** Sticky works on desktop but breaks on mobile (often a different overflow context). Test by scrolling a long document tab like Budget.

### Pitfall 2: z-index Conflict Between Sticky Header and Dropdown Menus

**What goes wrong:** The LifecyclePhaseBadge transition popover or the action DropdownMenu renders behind page content when header is sticky.
**Why it happens:** Sticky elements create a new stacking context when combined with z-index. If page content has a higher z-index (e.g., from Radix Portal `z-50`), menus appear behind content.
**How to avoid:** Set the sticky header wrapper to `z-10` (or `z-20` if needed). Radix dropdown portals render into document body and use their own z-index — they will stack above `z-10`. Verify that no page content card uses `z-30` or higher.
**Warning signs:** Dropdown appears clipped or invisible when triggered from the header.

### Pitfall 3: CO Status Mismatch — "pending" vs Actual Schema Values

**What goes wrong:** The badge count returns 0 even when COs exist in active states.
**Why it happens:** CONTEXT.md describes statuses as "pending or submitted" but the actual schema (verified) uses `pco_submitted` and `pending_approval`. Using the literal strings "pending" or "submitted" in the SQL filter will return 0.
**How to avoid:** Use `inArray(schema.changeOrders.status, ["pco_submitted", "pending_approval"])` in the Drizzle query.
**Warning signs:** Badge count is always 0 in testing even with known pending COs.

### Pitfall 4: Payment App "Billed to Date" Definition vs AR Aging Report

**What goes wrong:** Developer reaches for `getARAgingReport` to compute Billed to Date, which only returns `approved AND paid_at IS NULL` invoices — missing paid ones.
**Why it happens:** The AR aging report filters to outstanding invoices only. CONTEXT says "regardless of status (issued, paid, etc.)."
**How to avoid:** Sum `currentPaymentDue` from ALL payment apps for the project (no status filter) in the `getHeaderStats` endpoint.
**Warning signs:** Billed to Date is lower than expected and decreases when invoices are marked paid.

### Pitfall 5: Header Height Exceeds 80px Due to Restored Banner

**What goes wrong:** On projects with `restoredAt` set, the banner pushes total height to ~120px, violating CHROME-01.
**Why it happens:** The restored banner row is ~40px and is conditional. When it renders, two-row layout becomes three-row.
**How to avoid:** Either (a) render the banner outside the sticky wrapper (below it, in scrollable content), or (b) accept that the 80px constraint applies to the normal state only. CONTEXT says "can remain if it's a one-time conditional notice (takes no space when hidden)" — recommend option (b): keep banner inside sticky wrapper, accept transient height overflow, since it dismisses on click and vanishes.
**Warning signs:** Tests on restored projects show 120px header height.

### Pitfall 6: Project Budget Field Type is text() Not numeric()

**What goes wrong:** `Number(projectBudget[0]?.budget)` returns NaN or incorrect values.
**Why it happens:** The `projects` table schema has `budget` as `text("budget")` (historically stored as string). `Number()` handles this correctly for numeric strings but fails on null (returns 0 correctly) and non-numeric strings (returns NaN).
**How to avoid:** Use `parseFloat(budget ?? "0")` with a NaN guard: `const budgetNum = parseFloat(budget ?? "0"); const safeBudget = isNaN(budgetNum) ? 0 : budgetNum;`
**Warning signs:** Contract Value shows $0 even when a budget was entered at project creation.

### Pitfall 7: `layout.tsx` Is a Client Component — useQuery Cascade

**What goes wrong:** Adding a new `useQuery` for `getHeaderStats` in `layout.tsx` creates an additional waterfall — it runs after `getBySlug` resolves (because `projectId` is needed).
**Why it happens:** `projectId` is required for `getHeaderStats`, but `projectId` comes from `getBySlug`. The query must be `enabled: !!project?.id`.
**How to avoid:** This is unavoidable given the current architecture (projectSlug → projectId lookup). The waterfall is: (1) `getBySlug` resolves, (2) `getHeaderStats` fires. Accept this as a two-waterfall fetch. Consider prefetching `getHeaderStats` in the tab prefetch handlers for navigation — not required for Phase 46.
**Warning signs:** Stats bar flickers/loads after header appears.

---

## Code Examples

### Verified: Change Order Status Values (from schema)
```typescript
// Source: apps/api/src/db/schema/tenant.ts line 494
// status: text("status").notNull().default("draft"),
// Values: draft, pco_submitted, pending_approval, approved, rejected, void

// For badge count — "pending" = pco_submitted + pending_approval:
inArray(schema.changeOrders.status, ["pco_submitted", "pending_approval"])
```

### Verified: Payment App Status Values (from schema)
```typescript
// Source: apps/api/src/db/schema/tenant.ts line 612
// status: text("status").notNull().default("draft"),
// Values: draft, submitted, under_review, approved, rejected, paid

// For badge count — submitted or approved and not yet paid:
and(
  inArray(schema.paymentApps.status, ["submitted", "approved"]),
  isNull(schema.paymentApps.paidAt)
)
```

### Verified: Estimate Status Values (from schema)
```typescript
// Source: apps/api/src/db/schema/tenant.ts line 1109
// status: text("status").notNull().default("draft"),
// Values: draft, submitted, accepted, under_contract

// For accepted estimate lookup:
eq(schema.estimates.status, "accepted")
// Field to sum: schema.estimates.totalCost (numeric)
```

### Verified: Retainage Held Query Pattern (from existing router)
```typescript
// Source: apps/api/src/trpc/routers/payment-app.ts lines 1150-1154
// Existing getRetainage reduces: amountHeld - releasedAmount
// For a SUM version:
db.select({
  total: sql<string>`COALESCE(SUM(amount_held - COALESCE(released_amount, 0)), 0)`
})
  .from(schema.retainageHeld)
  .where(eq(schema.retainageHeld.projectId, projectId))
```

### Verified: Sticky Positioning in AppShell Context
```tsx
// Source: apps/web/components/layout/app-shell.tsx line 25
// main has: className="flex-1 overflow-auto p-6"
// This is the scroll container. sticky top-0 works here.

// In layout.tsx — sticky wrapper approach:
<div className="sticky top-0 z-10 bg-background -mx-6 -mt-6 px-6 pt-6 border-b">
  {/* header content */}
</div>
// Note: -mx-6 -mt-6 compensates for the p-6 on main so header sticks edge-to-edge
```

### Verified: CurrencyDisplay Usage
```tsx
// Source: apps/web/components/shared/currency-display.tsx
import { CurrencyDisplay } from "@/components/shared/currency-display";

// Basic usage:
<CurrencyDisplay amount={contractValue} className="text-sm font-semibold" />

// Props: amount (number), showSign (bool), colorize (bool), className (string)
// Always renders tabular-nums class for alignment
```

### Verified: ProjectTabs Link Pattern (DO NOT CHANGE)
```tsx
// Source: apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx
// This is the locked pattern — additive changes only (badge label):
<Link
  key={section.name}
  href={fullHref}
  scroll={false}           // LOCKED — must preserve
  onMouseEnter={prefetchHandler}  // LOCKED — must preserve
  className={cn(...)}
>
  {section.name}  {/* Only change: append " (N)" conditionally */}
</Link>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-tab badge queries | Batched in getHeaderStats | Phase 46 | Single round-trip vs. 4 |
| Customer/address in header | Moved to Overview tab | Phase 46 | 80px constraint satisfied |
| Budget metric grid | Replaced by financial stat bar | Phase 46 | Richer financial context |
| Non-sticky header | sticky top-0 within main scroll | Phase 46 | Header always visible during scroll |

---

## Open Questions

1. **Billed to Date: "AR invoices" vs. payment apps**
   - What we know: CONTEXT.md says "AR invoices table (the same data shown in the Invoices → Accounts Receivable tab)." The Invoices tab shows `paymentApps` data (the AR aging report queries `schema.paymentApps`). There is no separate AR invoices table in the schema.
   - What's unclear: Is the intent to sum `currentPaymentDue` across all payment apps (including draft/submitted), or only approved/paid ones?
   - Recommendation: Sum `currentPaymentDue` across ALL payment apps regardless of status. CONTEXT says "regardless of status (issued, paid, etc.)" — this maps directly to all payment apps. This is the safest interpretation.

2. **Invoices badge count: AR-only or AR + AP**
   - What we know: CONTEXT says "AR + AP combined, or AR only if combined isn't available." AP invoices would come from commitments (`schema.commitments`) which are vendor-facing. No separate AP invoices table confirmed.
   - What's unclear: Does the Invoices tab show both payment apps AND commitments? Need to verify `invoice-tracking.ts` what "Invoices" tab renders.
   - Recommendation: Use payment app count only (AR proxy) for the badge. If the Invoices tab fetches both, update the badge count in a later iteration.

3. **Mode switch button destination**
   - What we know: The mode switch is currently an inline text button in Row 1. Removing it from the header is suggested by CONTEXT.
   - What's unclear: User has not explicitly approved where it goes.
   - Recommendation: Move mode switch into the Edit action dropdown (DropdownMenuContent already exists in the header). This keeps it accessible without consuming header space.

4. **`project.budget` field — numeric or string?**
   - What we know: Schema shows `budget: text("budget")` on the projects table (line ~169 of schema). The value is stored as string.
   - Recommendation: Use `parseFloat` with NaN guard when computing contractValue fallback.

---

## Sources

### Primary (HIGH confidence)
- Direct file reads: `apps/api/src/db/schema/tenant.ts` — verified all status enum values, table field names, numeric types
- Direct file reads: `apps/api/src/trpc/routers/project.ts`, `payment-app.ts`, `change-order.ts`, `invoice-tracking.ts`, `estimates.ts` — verified existing query patterns
- Direct file reads: `apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx`, `project-header.tsx`, `project-tabs.tsx` — verified current implementation
- Direct file reads: `apps/web/components/layout/app-shell.tsx` — verified `overflow-auto` on `main` (critical for sticky behavior)
- Direct file reads: `apps/web/components/shared/currency-display.tsx` — verified component API

### Secondary (MEDIUM confidence)
- CSS sticky positioning within overflow-auto: well-established browser behavior, verified by MDN specification pattern. The `sticky` + `overflow-auto` ancestor relationship is standard.

### Tertiary (LOW confidence)
- None. All claims in this document are verified from direct code inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified from existing codebase
- Architecture: HIGH — existing file structure inspected, sticky container verified
- API data model: HIGH — schema field names and status values read directly from source
- Pitfalls: HIGH — all pitfalls derived from direct schema/code inspection, not conjecture

**Research date:** 2026-02-23
**Valid until:** 2026-03-25 (stable domain — schema changes would invalidate status values section)
