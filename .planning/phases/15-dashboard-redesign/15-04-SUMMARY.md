---
phase: 15-dashboard-redesign
plan: 04
subsystem: dashboard
tags: [frontend, react, dashboard, kpi, widgets, company-metrics]
dependency_graph:
  requires: [15-03]
  provides: [company-widgets]
  affects: []
tech_stack:
  added: []
  patterns: [KpiCard composition, currency formatting, tRPC React Query]
key_files:
  created:
    - apps/web/components/dashboard/company-widgets.tsx
  modified: []
decisions:
  - Module-level currencyFormatter for consistent formatting across financial widgets
  - EstimatingPipeline shows $0 with "No estimates yet" until Phase 17-18 built
  - Backlog success status when positive (indicates healthy committed work)
  - PendingPayApps warning status when count > 0 (requires attention)
metrics:
  duration: 2.5
  completed_date: 2026-02-15
  tasks_completed: 2
  files_created: 1
  commits: [4c5cea4, ccdf522]
---

# Phase 15 Plan 04: Company-Level Dashboard Widgets Summary

**One-liner:** Seven company-wide KPI widgets (projects, bids, payments, financials) using KpiCard component with tRPC queries and currency formatting.

## What Was Built

Created `apps/web/components/dashboard/company-widgets.tsx` with 7 exported widget components providing company-wide dashboard metrics:

**Count-based widgets (DASH-04 through DASH-07):**
- **TotalActiveProjects**: Company-wide active project count with Building2 icon
- **CompanyOpenBids**: Open bid count with evaluation status (Gavel icon)
- **PendingPayApps**: Pending payment application count with total dollar amount, warning/success status (Receipt icon)
- **BidOpportunities**: Open RFQ count (Target icon)

**Financial widgets (DASH-08 through DASH-10):**
- **RevenueInProgress**: Total budget across active projects formatted as currency (DollarSign icon)
- **Backlog**: Committed-minus-earned total, success status when positive (Layers icon)
- **EstimatingPipeline**: $0 placeholder with "No estimates yet" for future Phase 17-18 (Calculator icon)

## Technical Implementation

**Pattern consistency:**
- All widgets follow KpiCard composition pattern from Plan 15-03
- Loading state returns `<KpiCardSkeleton />`
- Error state returns `<KpiCard>` with value="--" and description="Unable to load"
- All tRPC queries use `{ retry: false }` option

**Currency formatting:**
- Module-level `currencyFormatter` using `Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })`
- Follows BudgetSummaryCards pattern for consistency
- Financial widgets display formatted currency strings as values (not numbers)

**Status indicators:**
- PendingPayApps: warning when count > 0 (requires attention), success when 0
- Backlog: success when positive (healthy committed work), neutral when 0
- All other widgets: neutral status

## Task Breakdown

| Task | Name                              | Commit  | Files                                       |
| ---- | --------------------------------- | ------- | ------------------------------------------- |
| 1    | Create company-level count widgets | 4c5cea4 | apps/web/components/dashboard/company-widgets.tsx |
| 2    | Create company-level financial widgets | ccdf522 | apps/web/components/dashboard/company-widgets.tsx |

## Deviations from Plan

None - plan executed exactly as written.

## Dependencies & Integration

**Requires:**
- Plan 15-03: KpiCard and KpiCardSkeleton components
- Plan 15-01: Dashboard tRPC endpoints (totalActiveProjects, openBids, pendingPayApps, bidOpportunities, revenueInProgress, backlog, estimatingPipeline)

**Provides:**
- 7 company-scoped dashboard widgets ready for dashboard layout integration

**Next steps:**
- Plan 15-05 will integrate these widgets into dashboard layout alongside user-scoped widgets from Plan 15-03

## Verification Results

- TypeScript compilation: PASSED (no errors in company-widgets.tsx)
- All 7 widgets exported: CONFIRMED
- Currency formatting pattern: VERIFIED (matches BudgetSummaryCards)
- Loading/error states: VERIFIED (all widgets follow KpiCard pattern)

## Self-Check: PASSED

**Created files verified:**
- apps/web/components/dashboard/company-widgets.tsx: FOUND

**Commits verified:**
- 4c5cea4 (Task 1 - count widgets): FOUND
- ccdf522 (Task 2 - financial widgets): FOUND

All exported widgets verified:
- TotalActiveProjects ✓
- CompanyOpenBids ✓
- PendingPayApps ✓
- BidOpportunities ✓
- RevenueInProgress ✓
- Backlog ✓
- EstimatingPipeline ✓

## Notes

- EstimatingPipeline gracefully handles missing estimating module by showing "No estimates yet" instead of "Coming in Phase X" messaging
- Backlog calculation follows Plan 15-01 formula: sum of approved/executed commitments minus completed work from payment applications
- All widgets are company-scoped (tenant isolation) and visible to all users in the organization
