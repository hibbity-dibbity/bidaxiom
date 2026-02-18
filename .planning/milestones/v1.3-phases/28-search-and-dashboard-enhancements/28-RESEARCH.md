# Phase 28: Search & Dashboard Enhancements - Research

**Researched:** 2026-02-17
**Domain:** Frontend feature enhancement — tRPC search augmentation, URL filter pre-population, UI type labeling
**Confidence:** HIGH (all findings from direct codebase inspection)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SRCH-01 | Global search results include estimates alongside projects and customers | Search router extension with estimates JOIN to get project slug for URL construction |
| SRCH-02 | Search result items display their type label (Project, Estimate, Customer) | CommandPalette renders by type group; add visual badge inline with each result item |
| DASH-01 | Clicking a dashboard KPI widget navigates to the relevant page with pre-filtered results | KpiCard already accepts `onClick` prop; nuqs URL params drive projects page filters |
</phase_requirements>

---

## Summary

Phase 28 touches three independent areas: the global search backend and frontend, the dashboard KPI widget click behavior, and visual type labeling in search results. All three areas have clearly identified extension points that minimize new code — no new components or routers need to be created, only existing files extended.

The global search is implemented as `trpc.search.global` query in `apps/api/src/trpc/routers/search.ts`. It currently searches projects (by name and job number) and customers (by company name and contact name). The shared type `searchResultSchema` in `packages/shared/src/types/search.ts` locks the result type to `type: z.enum(["project", "customer"])`. Extending search for estimates requires (1) updating the enum, (2) adding a Drizzle query in the search router that JOINs estimates to projects to get the project slug for URL construction, and (3) adding an "Estimates" `CommandGroup` section in the command palette UI.

Dashboard KPI widgets are already wired: `KpiCard` accepts an optional `onClick` prop, `MyActiveProjects` is the only widget that passes one (`router.push("/projects")`), and several others pass none at all. The projects list page uses `nuqs` v2 (`useQueryStates`) to store filters as URL query parameters, so navigating to `/projects?status=active&assignedUser={userId}` pre-populates the filter dropdowns on mount. The planner needs to add `onClick` handlers to all 7 widgets with correct filter URLs.

**Primary recommendation:** Extend the three files that need changing (search types, search router, command palette) for SRCH-01/SRCH-02; add `onClick` handlers to the 6 widgets missing them for DASH-01. All work is additive — no refactoring required.

---

## Standard Stack

### Already in Use (No New Dependencies)
| Library | Version | Purpose | Role in Phase |
|---------|---------|---------|---------------|
| nuqs | ^2.8.8 | URL query state management | Drives projects page filter pre-population |
| tRPC | existing | Type-safe API layer | Search router extension |
| Drizzle ORM | existing | DB query builder | Estimate search JOIN query |
| shadcn/ui Badge | existing | UI badge component | Type label rendering |
| next/navigation useRouter | existing | Navigation | Widget click handlers |

**No new packages needed.** All required libraries are already installed.

---

## Architecture Patterns

### Current Search Data Flow
```
CommandPalette (command-palette.tsx)
  → trpc.search.global({ query, limit: 10 })
  → search.ts router (authorizedProcedure)
    → Drizzle: SELECT from projects WHERE name ILIKE or jobNumber ILIKE
    → Drizzle: SELECT from customers WHERE companyName ILIKE or contactName ILIKE
  → SearchResult[] (type + id + title + subtitle + url)
  → CommandGroup "Projects" + CommandGroup "Customers"
```

### Current URL Filter Pattern (projects page)
```
/projects?search=&customer=&status=active&assignedUser={userId}&startDateFrom=&startDateTo=&page=1
```
The `useQueryStates` call in `projects/page.tsx` line 13-21 maps these params directly:
- `search` → search text filter
- `customer` → customer UUID
- `status` → enum: `active | on_hold | completed | archived`
- `assignedUser` → user UUID (passed to `assignedUserId` in tRPC)
- `startDateFrom` / `startDateTo` → ISO date strings

Pre-filtered navigation is achieved simply by constructing the URL with the desired params and calling `router.push()`.

### Estimate URL Pattern
Estimates live nested under projects: `/projects/[projectSlug]/estimates/[estimateSlug]`

The search result for an estimate must therefore carry BOTH `projectSlug` and `estimateSlug`. The search router JOIN must fetch:
```sql
SELECT estimates.name, estimates.slug, estimates.status,
       projects.slug as project_slug
FROM estimates
INNER JOIN projects ON estimates.project_id = projects.id
WHERE estimates.name ILIKE '%query%'
LIMIT N
```

### Dashboard Widget Click Target Map
| Widget Component | tRPC Procedure | Data Shown | Recommended onClick URL |
|-----------------|----------------|------------|------------------------|
| `MyActiveProjects` | `dashboard.myActiveProjects` | Current user's active projects | `/projects?status=active&assignedUser={userId}` (ALREADY done — goes to `/projects` without filters) |
| `MyOpenBids` | `dashboard.myOpenBids` | Current user's open bids | No good filter target on projects page; best target is `/projects` (bids are per-project, no global bids page) |
| `MyTodo` | `dashboard.myTodo` | Pending approvals across change orders, pay apps, workflows | No single filter target — each breakdown has a different section; best: no-op or future work |
| `TotalActiveProjects` | `dashboard.totalActiveProjects` | Company-wide active projects count | `/projects?status=active` |
| `CompanyOpenBids` | `dashboard.openBids` | Company-wide open bids count | `/projects` (no global bids list page exists) |
| `PendingPayApps` | `dashboard.pendingPayApps` | Pending pay apps count + amount | `/projects` (pay apps are per-project, no global list page) |
| `BidOpportunities` | `dashboard.bidOpportunities` | Open RFQs count | `/projects` (RFQs are per-project) |
| `RevenueInProgress` | `dashboard.revenueInProgress` | Sum of budget on active projects | `/projects?status=active` |
| `Backlog` | `dashboard.backlog` | Committed minus earned on active projects | `/projects?status=active` |
| `EstimatingPipeline` | `dashboard.estimatingPipeline` | Total cost of estimates in pipeline (currently placeholder returning 0) | Estimates don't have a dedicated top-level list page; best: no-op |

**Critical finding for DASH-01:** The projects list page is the primary filter target for project-related widgets. Several widgets show metrics for sub-resources (bids, pay apps, RFQs) that have no global list page — they are always accessed through a project. The meaningful navigation targets are the projects list with filters, not the sub-resource pages.

**`MyActiveProjects` needs a fix:** Currently navigates to `/projects` without the `assignedUser` filter. The user's userId is needed. This widget receives data from `trpc.dashboard.myActiveProjects` but does not have access to the current user's UUID to pass as a URL param. The `useAuth()` hook from `@/lib/auth-context` is available (used in `dashboard/page.tsx`) and returns `orgId`. Need to check if it also returns `userId`.

---

## SRCH-01: Estimate Search Implementation Plan

### What Changes

**1. `packages/shared/src/types/search.ts`**
- Extend `searchResultSchema` type enum from `["project", "customer"]` to `["project", "customer", "estimate"]`

**2. `apps/api/src/trpc/routers/search.ts`**
- Add Drizzle query for estimates with JOIN to projects:
```typescript
// Join estimates with projects to get project slug for URL construction
const estimateResults = await ctx.tenant.db
  .select({
    id: estimates.id,
    name: estimates.name,
    status: estimates.status,
    slug: estimates.slug,
    projectSlug: projects.slug,
    projectName: projects.name,
  })
  .from(estimates)
  .innerJoin(projects, eq(estimates.projectId, projects.id))
  .where(ilike(estimates.name, searchPattern))
  .limit(limit);
```
- Add estimate results to the returned array:
```typescript
...estimateResults.map((e) => ({
  type: "estimate" as const,
  id: e.id,
  title: e.name,
  subtitle: e.projectName,           // project name as context
  url: `/projects/${e.projectSlug}/estimates/${e.slug}`,
})),
```

**Note on null slug risk:** Estimates get a slug generated after insert (two-step: insert then update slug). The schema has `slug: text("slug").unique()` without `.notNull()`. A freshly-created estimate could theoretically have a null slug briefly, but slug generation happens in the same mutation immediately after insert. The search query should filter out null slugs:
```typescript
.where(and(ilike(estimates.name, searchPattern), isNotNull(estimates.slug)))
```

**3. `apps/web/components/search/command-palette.tsx`**
- Add `CommandGroup heading="Estimates"` section filtering by `r.type === "estimate"`
- Add appropriate icon (e.g., `Calculator` from lucide-react, matches EstimatingPipeline widget icon)
- Add type label badge (see SRCH-02 below)

---

## SRCH-02: Type Label Display

### Current Result Rendering
Each `CommandItem` renders:
```tsx
<FileText className="mr-2 h-4 w-4" />
<div className="flex flex-col">
  <span>{result.title}</span>
  {result.subtitle && <span className="text-xs text-muted-foreground">{result.subtitle}</span>}
</div>
```

### Recommended Type Label Approach
The results are already grouped by type in `CommandGroup` sections (heading="Projects", heading="Customers"). The groups themselves serve as type context. The requirement for "type label" can be satisfied two ways:

**Option A (Groups Only):** The existing `CommandGroup` headings already provide type labels. This satisfies the spirit of SRCH-02 — "Project", "Estimate", "Customer" headings appear above each group. No per-item badge needed.

**Option B (Inline Badge):** Add a small `Badge` component with `variant="secondary"` inside each `CommandItem` to show the type alongside each result item. This is more visible when the list is mixed.

**Recommendation:** Since the `CommandGroup` already provides section headings, the planner should use Option A (groups act as labels) for SRCH-02, which is already handled by adding the "Estimates" `CommandGroup`. No additional badge rendering is needed per item unless explicit per-item badges are desired.

If per-item badges are added, use the existing `Badge` component from `components/ui/badge.tsx` with `variant="secondary"`:
```tsx
<Badge variant="secondary" className="ml-auto text-xs">{result.type}</Badge>
```

---

## DASH-01: Widget Navigation — userId Access

### Critical Detail: Getting userId for MyActiveProjects filter

The `MyActiveProjects` widget is in `apps/web/components/dashboard/user-widgets.tsx`. It currently calls `router.push("/projects")` without any filter. To pass `assignedUser={userId}`, the widget needs the current user's UUID.

Check `useAuth()` hook availability:
- `apps/web/app/(dashboard)/page.tsx` imports `useAuth` from `@/lib/auth-context` and uses `orgId` and `orgName`
- The auth context likely also exposes `userId` — this must be verified when implementing

**Implementation approach for user-widget onClick:**
```tsx
import { useAuth } from "@/lib/auth-context";

export function MyActiveProjects() {
  const router = useRouter();
  const { userId } = useAuth();  // verify this field exists
  // ...
  return (
    <KpiCard
      onClick={() => router.push(`/projects?status=active${userId ? `&assignedUser=${userId}` : ''}`)}
      // ...
    />
  );
}
```

### Widget-to-URL Mapping (Final Recommendations)

| Widget | Navigates To | Rationale |
|--------|-------------|-----------|
| `MyActiveProjects` | `/projects?status=active&assignedUser={userId}` | Directly filters to current user's active projects |
| `MyOpenBids` | `/projects` | No global bids page; projects list is closest context |
| `MyTodo` | Omit onClick (no clean target) | Three different sub-resource types, no unified view |
| `TotalActiveProjects` | `/projects?status=active` | All active projects across company |
| `CompanyOpenBids` | `/projects` | No global bids list |
| `PendingPayApps` | `/projects` | No global pay apps list |
| `BidOpportunities` | `/projects` | No global RFQ list |
| `RevenueInProgress` | `/projects?status=active` | Active projects drive this metric |
| `Backlog` | `/projects?status=active` | Same scope as metric |
| `EstimatingPipeline` | Omit onClick (placeholder, returns 0) | No estimates list page exists at top level |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL filter state | Custom state management | nuqs `useQueryStates` (already used) | Already in use on projects page; navigation sets params via URL |
| Type indicator styling | Custom badge CSS | `Badge` from `components/ui/badge.tsx` | Already exists, consistent styling |
| Debounced search input | Custom debounce hook | `useDebounce` from `@/hooks/use-debounce` (already used) | Already used in CommandPalette at 300ms |
| ILIKE search pattern | Custom text matching | Drizzle `ilike()` function (already used) | Already imported in search.ts |

---

## Common Pitfalls

### Pitfall 1: Customer URL Bug in Search Router
**What goes wrong:** The existing search router maps customers to `url: /customers/${c.id}` (using UUID). But the customers page and `[customerSlug]` route use slug-based routing (`/customers/${customer.slug}`). This means clicking a customer search result navigates to a 404.
**Why it happens:** The search router was written before slug-based customer routing was added (likely Phase 13+). The customer list query in `search.ts` does not select the `slug` column.
**How to avoid:** Fix the customer search query to select `customers.slug` and use `/customers/${c.slug}` in the URL mapping. This is a bug fix, not a new feature, but it must happen alongside SRCH-01.
**Warning signs:** Clicking a customer result from the command palette gives a 404.

### Pitfall 2: Estimate Slug Can Be Null
**What goes wrong:** The estimates table has `slug: text("slug").unique()` without `notNull()`. A query without a null check could return null slugs and construct broken URLs like `/projects/abc/estimates/null`.
**How to avoid:** Add `isNotNull(estimates.slug)` to the WHERE clause in the estimates search query.

### Pitfall 3: MyActiveProjects Already Has onClick But Wrong Target
**What goes wrong:** `MyActiveProjects` in `user-widgets.tsx` already has `onClick={() => router.push("/projects")}` — it navigates but doesn't filter. The requirement is pre-filtered navigation. Overwriting this handler is the fix, but must include `assignedUser` param.
**Warning signs:** Widget appears to "work" (it navigates) but shows all projects instead of the current user's.

### Pitfall 4: nuqs Filter Parameters Are URL-Encoded Strings
**What goes wrong:** The `assignedUser` param in nuqs uses `parseAsString`, so the value in the URL is the raw UUID string. Passing `me` or a sentinel value won't work — it must be the actual UUID of the current user.
**How to avoid:** Use the actual `userId` from `useAuth()`, not a sentinel like `"me"`.

### Pitfall 5: estimatingPipeline Returns Placeholder (0 Always)
**What goes wrong:** `dashboard.estimatingPipeline` currently returns `{ total: 0, hasEstimatingModule: false }` — it's a stub that doesn't query estimates at all. If DASH-01 adds an onClick to this widget, clicking it leads to a list with zero items (since estimates live under projects, not at top level).
**How to avoid:** Omit onClick for `EstimatingPipeline` or add it only after a real estimates list page exists.

---

## Code Examples

### Search Router: Estimate Query Pattern
```typescript
// Source: Verified from apps/api/src/trpc/routers/search.ts + tenant schema
// Pattern mirrors existing project query with JOIN added

const { projects, customers, estimates } = ctx.tenant.schema;

const estimateResults = await ctx.tenant.db
  .select({
    id: estimates.id,
    name: estimates.name,
    status: estimates.status,
    slug: estimates.slug,
    projectSlug: projects.slug,
    projectName: projects.name,
  })
  .from(estimates)
  .innerJoin(projects, eq(estimates.projectId, projects.id))
  .where(
    and(
      ilike(estimates.name, searchPattern),
      isNotNull(estimates.slug)
    )
  )
  .limit(limit);
```

Required import additions to `search.ts`:
```typescript
import { ilike, or, and, isNotNull, eq } from "drizzle-orm";
```

### Command Palette: Estimates Group
```tsx
// Source: Verified pattern from apps/web/components/search/command-palette.tsx
// Add after existing CommandGroup "Customers"

<CommandGroup heading="Estimates">
  {results
    .filter((r) => r.type === "estimate")
    .map((result) => (
      <CommandItem
        key={result.id}
        value={result.title}
        onSelect={() => handleSelect(result.url)}
      >
        <Calculator className="mr-2 h-4 w-4" />
        <div className="flex flex-col">
          <span>{result.title}</span>
          {result.subtitle && (
            <span className="text-xs text-muted-foreground">
              {result.subtitle}
            </span>
          )}
        </div>
      </CommandItem>
    ))}
</CommandGroup>
```

Add `Calculator` to lucide-react imports: `import { Search, FileText, User, Loader2, Calculator } from "lucide-react";`

### KpiCard Widget onClick: Projects with Status Filter
```tsx
// Source: Verified from apps/web/components/dashboard/company-widgets.tsx + projects/page.tsx nuqs setup
// Pattern for company-scoped widgets

return (
  <KpiCard
    title="Total Active Projects"
    value={data.count}
    description="Across all teams"
    icon={Building2}
    status="neutral"
    onClick={() => router.push("/projects?status=active")}
  />
);
```

Add `useRouter` import: `import { useRouter } from "next/navigation";`

### KpiCard Widget onClick: User-Scoped (MyActiveProjects)
```tsx
// Source: Verified from apps/web/components/dashboard/user-widgets.tsx + auth-context usage
// Needs userId from auth context

export function MyActiveProjects() {
  const router = useRouter();
  const { userId } = useAuth();  // verify useAuth exports userId
  // ...
  return (
    <KpiCard
      onClick={() => {
        const params = new URLSearchParams({ status: "active" });
        if (userId) params.set("assignedUser", userId);
        router.push(`/projects?${params.toString()}`);
      }}
    />
  );
}
```

---

## Files to Modify

### SRCH-01 + SRCH-02 (Search Extensions)
1. **`packages/shared/src/types/search.ts`** — Extend type enum to include `"estimate"`. Also fix `searchResultSchema` if the planner wants type safety on "estimate" type.
2. **`apps/api/src/trpc/routers/search.ts`** — Add estimate JOIN query, fix customer URL bug (use `slug` not `id`), merge estimate results into output.
3. **`apps/web/components/search/command-palette.tsx`** — Add "Estimates" CommandGroup, add Calculator icon import. Type labels handled by group headings already.

### DASH-01 (Widget Navigation)
4. **`apps/web/components/dashboard/company-widgets.tsx`** — Add `useRouter` import; add `onClick` to `TotalActiveProjects`, `CompanyOpenBids`, `PendingPayApps`, `BidOpportunities`, `RevenueInProgress`, `Backlog`.
5. **`apps/web/components/dashboard/user-widgets.tsx`** — Update existing `onClick` on `MyActiveProjects` to pass `assignedUser` param; add `useAuth` import if userId is needed.

### No Changes Needed
- `apps/api/src/trpc/routers/dashboard.ts` — No dashboard data changes
- `apps/web/components/dashboard/kpi-card.tsx` — Already supports `onClick` prop
- `apps/web/app/(dashboard)/projects/page.tsx` — Already reads URL params via nuqs
- `apps/api/src/trpc/router.ts` — No new routers needed

---

## Open Questions

1. **Does `useAuth()` export `userId`?**
   - What we know: `useAuth` is imported from `@/lib/auth-context` in the dashboard page and exposes `orgId`, `orgName`. The auth context file was not read.
   - What's unclear: Whether `userId` is also exported.
   - Recommendation: Planner should add a task step to read `apps/web/lib/auth-context.tsx` to verify `userId` availability before implementing `MyActiveProjects` fix.

2. **Is `MyTodo` widget actionable for DASH-01?**
   - What we know: Todo items span three types (change order approvals, payment app approvals, workflow approvals), each living in different project sub-pages. There's no unified approval inbox page.
   - What's unclear: Whether the product intention is to link `MyTodo` to `/projects` generically or omit onClick.
   - Recommendation: Omit onClick on `MyTodo` in this phase. If needed, add a task to discuss before implementing.

3. **Should the customer URL bug be a separate sub-task or bundled?**
   - What we know: It's definitely broken (search.ts uses `c.id` for customer URL, but routes use `customer.slug`).
   - Recommendation: Bundle the fix into the SRCH-01 task since it's in the same file and is a correctness issue, not scope expansion.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `apps/web/components/search/command-palette.tsx` — Full component implementation
- `apps/api/src/trpc/routers/search.ts` — Full search router
- `packages/shared/src/types/search.ts` — SearchResult schema
- `apps/web/app/(dashboard)/page.tsx` — Dashboard page widget imports
- `apps/web/components/dashboard/user-widgets.tsx` — User KPI widgets
- `apps/web/components/dashboard/company-widgets.tsx` — Company KPI widgets
- `apps/web/components/dashboard/kpi-card.tsx` — KpiCard component props
- `apps/api/src/trpc/routers/dashboard.ts` — Dashboard tRPC procedures
- `apps/web/app/(dashboard)/projects/page.tsx` — nuqs filter URL params
- `apps/web/app/(dashboard)/projects/components/projects-filters.tsx` — Filter component
- `apps/api/src/db/schema/tenant.ts` (lines 1048-1072) — Estimates table schema
- `apps/api/src/trpc/routers/estimates.ts` — Estimates router (for list + search patterns)
- `apps/web/app/(dashboard)/customers/page.tsx` — Customer slug routing confirmation
- `apps/api/src/trpc/routers/customer.ts` — Customer slug query verification

---

## Metadata

**Confidence breakdown:**
- Current search implementation: HIGH — read full source
- Estimate data shape and URL pattern: HIGH — read schema and router
- Dashboard widget inventory: HIGH — read all widget files
- Filter URL pattern: HIGH — read nuqs setup and projects page
- Customer URL bug: HIGH — verified in search router and customer page
- `useAuth()` userId availability: LOW — auth-context.tsx not read

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable codebase, 30-day window)
