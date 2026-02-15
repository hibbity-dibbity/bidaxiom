# Phase 15: Dashboard Redesign - Research

**Researched:** 2026-02-15
**Domain:** React dashboard UI, KPI widgets, data aggregation
**Confidence:** HIGH

## Summary

Phase 15 transforms the current placeholder-heavy dashboard into a production-grade KPI dashboard with user-level and company-level widgets. The phase builds on Phase 13's navigation and theme foundation to deliver a Procore-style dense, data-rich dashboard optimized for construction management workflows.

The project already has the necessary technical foundation: Recharts 3.7.0 for charting, shadcn/ui Card components for KPI widgets, tRPC with React Query for type-safe data fetching, and existing patterns for KPI cards (BudgetSummaryCards) and charts (BudgetVarianceChart). The primary work involves creating new tRPC endpoints for dashboard data aggregation, building reusable KPI widget components, and implementing user-scoped vs company-scoped data filtering.

Key insight: Modern dashboard design in 2026 emphasizes "show the data, hide the chrome" - minimal decorative elements, no flashy animations, just clear readable data visualization. This aligns perfectly with Phase 13's Procore-style compact spacing and sharp corners.

**Primary recommendation:** Use the existing stack (Recharts + shadcn/ui Card + tRPC) with composition-based widget architecture. Create specialized tRPC dashboard endpoints that aggregate data efficiently at the database level rather than client-side aggregation. Implement user-level scoping using existing CASL permissions and project team memberships.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Recharts | 3.7.0 | Charts and data visualization | Already installed, proven in BudgetVarianceChart and ChartPreview, 2026 industry standard for React charts |
| shadcn/ui Card | Latest | KPI card structure | Already used in BudgetSummaryCards, provides consistent styling with Phase 13 theme |
| tRPC + React Query | 11.10.0 + 5.90.21 | Type-safe data fetching | Existing pattern throughout app, handles caching/refetching automatically |
| Lucide React | 0.460.0 | Icons for widgets | Already installed, used consistently throughout app |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 2.30.0 | Date formatting in widgets | Already installed, lightweight date utilities |
| Intl.NumberFormat | Native | Currency and number formatting | Already used in BudgetSummaryCards, no dependencies |
| Drizzle ORM | Current | Database aggregation queries | Efficient server-side data aggregation for KPIs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Tremor | Tremor provides pre-built KPI components but adds another dependency; Recharts already installed and working |
| Custom widgets | Template libraries | Custom widgets maintain design system consistency and avoid bloat |
| Client aggregation | Server aggregation | Server aggregation is more efficient and secure for company-wide metrics |

**Installation:**
```bash
# No new dependencies required - all libraries already installed
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/
├── components/
│   └── dashboard/            # New directory for Phase 15
│       ├── kpi-card.tsx      # Reusable KPI widget base
│       ├── user-widgets/     # User-scoped widgets
│       │   ├── my-active-projects.tsx
│       │   ├── my-open-bids.tsx
│       │   └── my-todo.tsx
│       └── company-widgets/  # Company-scoped widgets
│           ├── total-active-projects.tsx
│           ├── open-bids.tsx
│           ├── pending-pay-apps.tsx
│           ├── bid-opportunities.tsx
│           ├── revenue-in-progress.tsx
│           ├── backlog.tsx
│           └── estimating-pipeline.tsx
apps/api/src/trpc/routers/
└── dashboard.ts              # New router for dashboard data
```

### Pattern 1: Composition-Based KPI Widget
**What:** Base KPI card component that child widgets compose with their specific data and display logic
**When to use:** All dashboard widgets to maintain consistency
**Example:**
```typescript
// apps/web/components/dashboard/kpi-card.tsx
interface KpiCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: {
    value: number;
    direction: "up" | "down";
    label: string;
  };
  status?: "success" | "warning" | "error" | "neutral";
  onClick?: () => void;
}

export function KpiCard({ title, value, description, icon: Icon, trend, status, onClick }: KpiCardProps) {
  const statusColors = {
    success: "text-green-600",
    warning: "text-amber-600",
    error: "text-red-600",
    neutral: "text-slate-600"
  };

  return (
    <Card className={onClick ? "cursor-pointer hover:shadow-sm transition-shadow" : undefined} onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${status ? statusColors[status] : ""}`}>
          {value}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className="flex items-center mt-2 text-xs">
            <TrendingUp className={`h-3 w-3 mr-1 ${trend.direction === "up" ? "text-green-600" : "text-red-600 rotate-180"}`} />
            <span className={trend.direction === "up" ? "text-green-600" : "text-red-600"}>
              {trend.value}%
            </span>
            <span className="text-muted-foreground ml-1">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Usage in widget
export function MyActiveProjects() {
  const { data, isLoading } = trpc.dashboard.myActiveProjects.useQuery();

  if (isLoading) return <Skeleton className="h-[140px]" />;

  return (
    <KpiCard
      title="My Active Projects"
      value={data?.count ?? 0}
      description={`${data?.overdueCount ?? 0} overdue`}
      icon={FolderKanban}
      status={data?.overdueCount ? "warning" : "success"}
      onClick={() => router.push("/projects?filter=my-active")}
    />
  );
}
```

### Pattern 2: Server-Side Data Aggregation
**What:** Dashboard endpoints aggregate data at database level, not in client
**When to use:** Company-wide metrics, complex calculations, data across multiple tables
**Example:**
```typescript
// apps/api/src/trpc/routers/dashboard.ts
export const dashboardRouter = router({
  /**
   * User-scoped: Returns count of projects where user is team member
   */
  myActiveProjects: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const { db, schema } = ctx.tenant;

    // Join projects with team memberships, filter by active status
    const result = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${schema.projects.id})`,
        overdueCount: sql<number>`COUNT(DISTINCT CASE WHEN ${schema.projects.endDate} < NOW() THEN ${schema.projects.id} END)`
      })
      .from(schema.projects)
      .innerJoin(
        schema.projectTeamMembers,
        eq(schema.projectTeamMembers.projectId, schema.projects.id)
      )
      .where(
        and(
          eq(schema.projectTeamMembers.userId, ctx.userId),
          eq(schema.projects.status, "active")
        )
      );

    return {
      count: Number(result[0]?.count ?? 0),
      overdueCount: Number(result[0]?.overdueCount ?? 0)
    };
  }),

  /**
   * Company-scoped: Total revenue in progress across all active projects
   */
  revenueInProgress: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const { db, schema } = ctx.tenant;

    // Sum total budget for all active projects
    const result = await db
      .select({
        total: sql<string>`COALESCE(SUM(${schema.budgetLineItems.budgetedAmount}), 0)`
      })
      .from(schema.budgetLineItems)
      .innerJoin(
        schema.projects,
        eq(schema.projects.id, schema.budgetLineItems.projectId)
      )
      .where(eq(schema.projects.status, "active"));

    return {
      total: parseFloat(result[0]?.total ?? "0")
    };
  })
});
```

### Pattern 3: User-Scoped vs Company-Scoped Filtering
**What:** Widgets automatically filter data based on scope using existing CASL abilities
**When to use:** All widgets - determines data access boundaries
**Example:**
```typescript
// User-scoped widget: Uses projectTeamMembers join
const myProjects = await db
  .select()
  .from(schema.projects)
  .innerJoin(
    schema.projectTeamMembers,
    and(
      eq(schema.projectTeamMembers.projectId, schema.projects.id),
      eq(schema.projectTeamMembers.userId, ctx.userId)
    )
  );

// Company-scoped widget: No user filter, just tenant schema scope
const allProjects = await db
  .select()
  .from(schema.projects)
  .where(eq(schema.projects.status, "active"));
```

### Pattern 4: Loading States and Error Handling
**What:** Consistent skeleton loaders during data fetch, graceful error displays
**When to use:** All widgets to maintain professional UX
**Example:**
```typescript
export function DashboardWidget() {
  const { data, isLoading, error } = trpc.dashboard.someMetric.useQuery();

  if (isLoading) {
    return <Skeleton className="h-[140px] rounded-xl" />;
  }

  if (error) {
    return (
      <Card className="h-[140px]">
        <CardContent className="flex items-center justify-center h-full">
          <p className="text-sm text-muted-foreground">Failed to load metric</p>
        </CardContent>
      </Card>
    );
  }

  return <KpiCard title="Metric" value={data?.value ?? 0} />;
}
```

### Anti-Patterns to Avoid
- **Client-side aggregation:** Don't fetch all projects and count in React - aggregate at database level
- **N+1 queries:** Batch related data in single query with joins, not separate queries per widget
- **Hardcoded colors:** Use theme variables from Phase 13, not inline color values
- **Inline widget logic:** Extract widgets to separate components for testability and reusability
- **Missing error states:** Always handle loading, error, and empty states

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart components | Custom SVG/Canvas charts | Recharts (already installed) | Handles responsive containers, tooltips, legends, accessibility, animations |
| Number formatting | String manipulation for currency | Intl.NumberFormat (native) | Handles locales, currencies, edge cases automatically |
| Date relative time | Custom date math | date-fns (already installed) | Timezone-safe, tested, handles edge cases |
| Loading skeletons | Custom pulse animations | shadcn/ui Skeleton | Consistent with design system, accessible |
| KPI trend calculations | Manual percentage math | Server-side aggregation with SQL | Database is more efficient, handles NULL/edge cases |

**Key insight:** Dashboard widgets involve deceptively complex edge cases - what if there are no projects? What about division by zero in trends? What about users with no team memberships? Database aggregation with COALESCE and proper NULL handling is far more robust than client-side logic.

## Common Pitfalls

### Pitfall 1: Client-Side Data Aggregation
**What goes wrong:** Fetching all projects/bids/payments to client and counting/summing in React causes performance issues and memory problems
**Why it happens:** It seems simpler to use existing list endpoints and count on client
**How to avoid:** Create specialized dashboard aggregation endpoints that use SQL COUNT/SUM/GROUP BY
**Warning signs:** Dashboard slows down as company grows, high memory usage, slow initial load

### Pitfall 2: Inconsistent User Scoping
**What goes wrong:** Some widgets show user-scoped data, others show company-wide data, confusing users
**Why it happens:** Mixing up which endpoints to use, unclear naming
**How to avoid:** Clear naming convention: `my*` for user-scoped, `total*` or `company*` for company-scoped
**Warning signs:** Users see confusing numbers that don't match their expectations, support tickets about "wrong counts"

### Pitfall 3: Missing Cache Invalidation
**What goes wrong:** Dashboard shows stale data after user creates project/bid/payment
**Why it happens:** React Query cache not invalidated after mutations
**How to avoid:** Add `utils.dashboard.*.invalidate()` to relevant mutations in project/bid/payment routers
**Warning signs:** Users refresh page to see updated counts, data feels "laggy"

### Pitfall 4: Division by Zero in Trends
**What goes wrong:** Trend calculations crash or show NaN/Infinity when previous period has zero
**Why it happens:** Not handling edge case: `(current - previous) / previous` when `previous = 0`
**How to avoid:** Handle zero case: `previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100`
**Warning signs:** NaN in UI, crashes on new companies with no historical data

### Pitfall 5: Over-Fetching Related Data
**What goes wrong:** Dashboard loads slowly because each widget makes separate database queries
**Why it happens:** Creating separate tRPC endpoint per widget without considering query batching
**How to avoid:** Consider a single `dashboard.overview` endpoint that returns all metrics in one query, or use React Query's parallel query batching
**Warning signs:** Waterfall of sequential requests in network tab, slow dashboard load

### Pitfall 6: Not Handling Empty States
**What goes wrong:** Widgets show "0" everywhere for new companies, feels broken
**Why it happens:** Only handling data, not the "getting started" UX
**How to avoid:** Show helpful empty states with CTAs when counts are zero: "No projects yet - Create your first project"
**Warning signs:** New user demos look unprofessional, users think features are broken

## Code Examples

Verified patterns from existing codebase and official sources:

### Existing KPI Card Pattern
```typescript
// Source: apps/web/components/budget/budget-summary-cards.tsx (lines 27-40)
<Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
    <DollarSign className="h-4 w-4 text-blue-600" />
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold text-blue-600">
      {currencyFormatter.format(summary.totalBudgeted)}
    </div>
    <p className="text-xs text-muted-foreground mt-1">
      {summary.lineItemCount} line items
    </p>
  </CardContent>
</Card>
```

### Existing Chart Pattern
```typescript
// Source: apps/web/components/budget/budget-variance-chart.tsx (lines 78-98)
<ResponsiveContainer width="100%" height={400}>
  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 60, bottom: 60 }}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
    <YAxis tickFormatter={(value) => currencyFormatter.format(value).replace(/\.00$/, "")} />
    <Tooltip content={<CustomTooltip />} />
    <Legend wrapperStyle={{ paddingTop: "20px" }} />
    <Bar dataKey="budgeted" fill="#2563eb" name="Budgeted" radius={[4, 4, 0, 0]} />
    <Bar dataKey="committed" fill="#d97706" name="Committed" radius={[4, 4, 0, 0]} />
  </BarChart>
</ResponsiveContainer>
```

### Existing User Scoping Pattern
```typescript
// Source: apps/api/src/trpc/routers/project.ts (lines 240-242)
const userProjects = await db
  .select()
  .from(schema.projects)
  .innerJoin(
    schema.projectTeamMembers,
    eq(schema.projectTeamMembers.projectId, schema.projects.id)
  )
  .where(eq(schema.projectTeamMembers.userId, ctx.userId));
```

### Existing Dashboard Aggregation Pattern
```typescript
// Source: apps/api/src/trpc/routers/audit.ts (lines 74-100)
summary: protectedProcedure.query(async ({ ctx }) => {
  if (!ctx.tenant) {
    return { totalToday: 0, totalWeek: 0, recentActions: [] };
  }

  const { db, schema } = ctx.tenant;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Count today's actions
  const todayActions = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.auditLogs)
    .where(sql`${schema.auditLogs.timestamp} >= ${today}`);

  // Fetch recent actions
  const recentActions = await db
    .select()
    .from(schema.auditLogs)
    .orderBy(desc(schema.auditLogs.timestamp))
    .limit(10);

  return {
    totalToday: Number(todayActions[0]?.count ?? 0),
    recentActions
  };
});
```

### shadcn/ui Chart Pattern (2026 Standard)
```typescript
// Source: Official shadcn/ui docs - https://ui.shadcn.com/docs/components/radix/chart
// NOTE: Project uses Recharts directly (pre-shadcn charts), this is reference for future
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, ResponsiveContainer } from "recharts"

<ChartContainer config={chartConfig} className="min-h-[200px]">
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} accessibilityLayer>
      <Bar dataKey="value" fill="var(--color-bar)" radius={4} />
      <ChartTooltip content={<ChartTooltipContent />} />
    </BarChart>
  </ResponsiveContainer>
</ChartContainer>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Placeholder "Coming in Phase X" widgets | Functional KPI widgets with real data | Phase 15 (this phase) | Dashboard becomes production-ready, users can make data-driven decisions |
| Activity feed on dashboard | Activity moved to Settings | Phase 15 (this phase) | Dashboard focuses on KPIs, not audit logs |
| Recharts v2 | Recharts v3 | 2024-2025 | Better TypeScript support, improved performance, updated APIs |
| Tremor as standalone library | shadcn/ui charts wrapping Recharts | 2025-2026 | shadcn philosophy: copy components, don't add dependencies |
| Client-side dashboard aggregation | Server-side SQL aggregation | Best practice always | Performance scales with company size |

**Deprecated/outdated:**
- **Tremor library:** While popular in 2024, 2026 best practice is shadcn/ui's chart components (composition pattern) - though project currently uses Recharts directly which is still valid
- **Dashboard placeholder widgets:** Remove all "Coming in Phase X" placeholders per DASH-13
- **Activity feed on dashboard:** Move to Settings page per DASH-11
- **Invite Team Members widget:** Remove per DASH-12

## Open Questions

1. **"My To-Do" widget data source**
   - What we know: DASH-03 requires "My To-Do" widget, but no task/todo tables exist in schema
   - What's unclear: Should we build task management system or use proxy data (assigned change orders, pending approvals)?
   - Recommendation: Use proxy data for Phase 15: count of items requiring user action (pending approvals on change orders assigned to user, RFQs awaiting response, etc.). Defer full task management to future phase.

2. **"Estimating Pipeline Value" widget**
   - What we know: DASH-10 requires this widget, but Estimating is Phase 17-18 (not yet built)
   - What's unclear: Should we show placeholder or omit entirely?
   - Recommendation: Show widget with $0 and "No estimates yet" - maintains consistent layout for when Estimating launches

3. **"Bid Opportunities" definition**
   - What we know: DASH-07 requires "Bid Opportunities" widget
   - What's unclear: Does this mean RFQs issued to others (GC view) or RFQs user can bid on (Sub view)?
   - Recommendation: Make bidirectional: For GC users, show count of issued RFQs awaiting bids. For Sub users, show count of RFQs they can bid on (invitations in 'issued' status)

4. **Dashboard refresh strategy**
   - What we know: React Query caches data with 5min staleTime (project standard)
   - What's unclear: Should dashboard auto-refresh or rely on cache invalidation after mutations?
   - Recommendation: Rely on cache invalidation (mutation-driven updates) + manual refresh button. Auto-refresh creates unnecessary load and can disrupt user reading dashboard.

5. **Mobile layout for widgets**
   - What we know: Phase 1 requires mobile support (RWEB-01), Phase 13 navigation is responsive
   - What's unclear: Should widgets stack vertically on mobile or have different layout?
   - Recommendation: Use responsive grid: 1 column mobile, 2 columns tablet, 3-4 columns desktop. Maintain Phase 13's compact spacing philosophy.

## Sources

### Primary (HIGH confidence)
- Existing codebase patterns:
  - `apps/web/components/budget/budget-summary-cards.tsx` - KPI card structure
  - `apps/web/components/budget/budget-variance-chart.tsx` - Recharts usage
  - `apps/api/src/trpc/routers/audit.ts` - Dashboard aggregation pattern
  - `apps/api/src/trpc/routers/project.ts` - User scoping pattern
  - `apps/web/package.json` - Confirmed Recharts 3.7.0 installed
  - `.planning/ROADMAP.md` - Phase 15 requirements and dependencies
  - Phase 13 verification report - Design system, theme, navigation foundation

### Secondary (MEDIUM confidence)
- [shadcn/ui Chart Documentation](https://ui.shadcn.com/docs/components/radix/chart) - Official chart component patterns (verified 2026)
- [Tremor Documentation](https://www.tremor.so/) - Alternative KPI library reference (verified 2026)
- [Recharts Official Docs](https://recharts.org/) - Chart library documentation
- [tRPC React Query Integration](https://trpc.io/docs/client/react) - Data fetching patterns (verified 2026)
- [20 Best Free React Admin Dashboard Templates 2026 - AdminLTE.IO](https://adminlte.io/blog/react-admin-dashboard-templates/) - Dashboard design patterns
- [Next.js + Shadcn UI: Build a Stunning Admin Dashboard in 2024 | Medium](https://medium.com/@annasaaddev/next-js-shadcn-ui-build-a-stunning-admin-dashboard-in-2024-78d8837f44df) - shadcn/ui dashboard architecture
- [Construction Dashboard Software with KPIs & Insights](https://anterratech.com/modules/dashboards/) - Construction industry KPI patterns
- [Construction KPIs | Construction Dashboards | Bold BI](https://www.boldbi.com/dashboard-examples/construction/) - Construction-specific metrics

### Tertiary (LOW confidence)
- WebSearch results on dashboard personalization patterns - general best practices, not project-specific
- WebSearch on tRPC aggregation patterns - generic patterns, needs adaptation to schema

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and used in existing components
- Architecture patterns: HIGH - Based on verified existing code patterns (BudgetSummaryCards, audit.summary)
- Pitfalls: MEDIUM - Based on common React dashboard issues and existing code review, but not exhaustive
- Widget specifications: MEDIUM - Requirements clear from ROADMAP.md, but data source details need confirmation

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (30 days - stable domain, React/Next.js best practices evolve slowly)

**Key dependencies:**
- Phase 13: Provides navigation, theme, design system foundation (VERIFIED complete)
- Recharts 3.7.0: Already installed, working in budget charts
- tRPC routers: project, bid, paymentApp exist and provide data sources
- Database schema: tenant.ts includes projects, bids, paymentApps, budgets, commitments

**Missing/Future dependencies:**
- Task management system: Not built yet, "My To-Do" widget will use proxy data
- Estimating system: Phase 17-18, "Estimating Pipeline" widget will show $0 placeholder
- User preferences for widget layout: Could be added in Phase 19 (Architecture)
