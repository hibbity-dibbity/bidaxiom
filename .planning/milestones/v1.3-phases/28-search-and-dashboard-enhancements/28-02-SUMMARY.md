---
phase: 28-search-and-dashboard-enhancements
plan: "02"
subsystem: dashboard
tags: [dashboard, navigation, ux, kpi-widgets]
dependency_graph:
  requires: []
  provides: [clickable-dashboard-kpi-widgets]
  affects: [company-widgets, user-widgets]
tech_stack:
  added: []
  patterns: [useRouter-navigation, useAuth-userId-filter]
key_files:
  created: []
  modified:
    - apps/web/components/dashboard/company-widgets.tsx
    - apps/web/components/dashboard/user-widgets.tsx
decisions:
  - "EstimatingPipeline widget omitted from onClick — placeholder data (always 0), no top-level estimates list page exists"
  - "MyTodo widget omitted from onClick — spans 3 sub-resource types (change orders, pay apps, workflows) with no unified inbox page"
  - "MyOpenBids navigates to /projects without userId filter — bids filtering by user via URL params is not supported on projects page"
metrics:
  duration: "~2 min"
  completed: "2026-02-18"
  tasks_completed: 2
  files_modified: 2
---

# Phase 28 Plan 02: Dashboard KPI Widget Navigation Summary

**One-liner:** Dashboard KPI widgets gain router.push onClick handlers linking to pre-filtered project list pages, with MyActiveProjects using useAuth userId for user-scoped filtering.

## What Was Built

Added onClick navigation to all actionable dashboard KPI widgets. Clicking a widget now takes the user directly to the relevant filtered list page, closing the UX gap between "seeing a metric" and "acting on it."

### Company Widgets (company-widgets.tsx)

Added `useRouter` import and per-widget `router.push` onClick handlers:

| Widget | onClick Target |
|--------|---------------|
| TotalActiveProjects | `/projects?status=active` |
| CompanyOpenBids | `/projects` |
| PendingPayApps | `/projects` |
| BidOpportunities | `/projects` |
| RevenueInProgress | `/projects?status=active` |
| Backlog | `/projects?status=active` |
| EstimatingPipeline | (no onClick) |

### User Widgets (user-widgets.tsx)

- **MyActiveProjects**: Fixed onClick to use `useAuth().userId` and navigate to `/projects?status=active&assignedUser={userId}` — previously navigated to `/projects` without any filters.
- **MyOpenBids**: Added onClick navigating to `/projects` — previously had no onClick.
- **MyTodo**: Remains without onClick — spans change orders, pay apps, and workflows with no single unified inbox destination.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add onClick to 6 company KPI widgets | `0c3cfcf` | `company-widgets.tsx` |
| 2 | Fix MyActiveProjects userId filter, add MyOpenBids onClick | `7331649` | `user-widgets.tsx` |

## Verification

- TypeScript check: No errors in either modified file
- `company-widgets.tsx`: exactly 6 `router.push` calls confirmed by grep
- `user-widgets.tsx`: `assignedUser` param set via `useAuth().userId` confirmed by grep
- EstimatingPipeline and MyTodo correctly have no onClick

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files confirmed present:
- `apps/web/components/dashboard/company-widgets.tsx` — FOUND
- `apps/web/components/dashboard/user-widgets.tsx` — FOUND

Commits confirmed:
- `0c3cfcf` — FOUND (feat(28-02): add onClick navigation handlers to 6 company KPI widgets)
- `7331649` — FOUND (feat(28-02): fix MyActiveProjects onClick with userId filter, add MyOpenBids onClick)
