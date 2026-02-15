---
phase: 15-dashboard-redesign
plan: "01"
subsystem: backend-dashboard
tags: [trpc, aggregation, dashboard, kpi]
dependency-graph:
  requires: [phase-03-project-management, phase-05-change-orders, phase-06-payment-apps, phase-07-bidding]
  provides: [dashboard-backend-api]
  affects: []
tech-stack:
  added: []
  patterns: [server-side-aggregation, sql-count-sum, user-scoped-filters, company-scoped-metrics]
key-files:
  created:
    - apps/api/src/trpc/routers/dashboard.ts
  modified:
    - apps/api/src/trpc/router.ts
decisions:
  - Used protectedProcedure (not authorizedProcedure) since dashboard is read-only and scoped by tenant context without CASL
  - SQL aggregation at database level using COUNT/SUM instead of client-side counting for performance
  - User-scoped queries filter via projectTeamMembers join to show only projects user is assigned to
  - Company-scoped queries use tenant schema scope without user filter
  - myTodo endpoint aggregates across three approval sources (change orders, payment apps, workflows)
  - Backlog calculation: sum of approved/executed commitments minus completed work from payment apps
  - Revenue in progress: sum of budgeted amounts for active projects only
  - estimatingPipeline returns placeholder values (0, hasEstimatingModule: false) for future phase implementation
metrics:
  duration: 3 min
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  commits: 2
  completed_at: 2026-02-15T17:19:09Z
---

# Phase 15 Plan 01: Dashboard Backend API Summary

**One-liner:** Server-side KPI aggregation router with 10 endpoints (3 user-scoped, 7 company-scoped) using SQL COUNT/SUM for dashboard metrics

## What Was Built

Created a complete dashboard tRPC router (`apps/api/src/trpc/routers/dashboard.ts`) with 10 query endpoints that perform database-level aggregation for dashboard KPI metrics. The router is registered in the app router, making `trpc.dashboard.*` namespace available to the frontend.

### User-Scoped Endpoints (3)

1. **myActiveProjects** - Active project count and overdue count for projects where user is a team member
2. **myOpenBids** - Open bid count for RFQs on user's projects (submitted/under_review/shortlisted status)
3. **myTodo** - Pending approval count with breakdown across three sources:
   - Change order approvals
   - Payment app approvals
   - Workflow approvals (RFI, Submittal, Transmittal)

### Company-Scoped Endpoints (7)

4. **totalActiveProjects** - Total active projects across the company
5. **openBids** - Total open bids (submitted/under_review/shortlisted status)
6. **pendingPayApps** - Pending payment application count and total amount (submitted/under_review status)
7. **bidOpportunities** - Open RFQ count (issued status awaiting bids)
8. **revenueInProgress** - Sum of budgeted amounts for all active projects
9. **backlog** - Committed but unearned revenue (approved/executed commitments minus completed work)
10. **estimatingPipeline** - Placeholder returning 0 for future Phase 17-18 implementation

## Technical Implementation

### Architecture Patterns

- **Server-side aggregation:** All queries use SQL `COUNT()` and `SUM()` at the database level instead of fetching records and counting client-side
- **User-scoped filtering:** JOIN with `projectTeamMembers` table to filter results to only projects where user is assigned
- **Company-scoped metrics:** No user filter, just tenant schema isolation provides automatic scoping
- **Null-safe aggregations:** COALESCE(SUM(...), 0) pattern prevents null results
- **Type-safe SQL:** sql<number> and sql<string> for explicit type casting of aggregation results

### Query Optimization

- Used `COUNT(DISTINCT ${schema.projects.id})` to avoid counting duplicate rows from JOINs
- Used `inArray()` for multi-value status filtering
- Denormalized queries avoid N+1 patterns by performing JOINs and aggregations in single query
- myTodo endpoint runs 3 parallel queries (one per approval source) then combines results

### Data Integrity

- Runtime null checks for `ctx.tenant` and `ctx.userId` (where applicable) prevent TypeScript type errors
- Number() casting converts SQL COUNT results (may be string) to JavaScript numbers
- parseFloat() handles NUMERIC columns that return string values from PostgreSQL
- Math.max(0, ...) ensures backlog can't go negative

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

**Files created:**
```bash
[ -f "apps/api/src/trpc/routers/dashboard.ts" ] && echo "FOUND"
```
FOUND: apps/api/src/trpc/routers/dashboard.ts

**Commits exist:**
```bash
git log --oneline --all | grep -q "44b9bbc" && echo "FOUND: 44b9bbc"
git log --oneline --all | grep -q "5140c5c" && echo "FOUND: 5140c5c"
```
FOUND: 44b9bbc (Task 1 - Dashboard router creation)
FOUND: 5140c5c (Task 2 - Dashboard router registration)

**Dashboard router exports:**
- dashboardRouter exported from dashboard.ts
- Imported and registered in app router under `dashboard` key
- TypeScript compilation passes with no dashboard-related errors

## Next Steps

- Phase 15 Plan 02: Dashboard layout and widget components (frontend implementation)
- Frontend will call these endpoints using tRPC React Query hooks
- Consider adding caching strategy for expensive aggregations (Phase 16+)
- estimatingPipeline will be implemented in Phase 17-18 with full estimating module
