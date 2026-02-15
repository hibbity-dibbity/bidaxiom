---
phase: 16-projects-interface-redesign
plan: 03
subsystem: frontend-ui
tags: [projects-list, table-integration, nuqs, filters, tRPC]
dependency_graph:
  requires: [16-01-slug-and-filtering, 16-02-table-components]
  provides: [projects-list-table-view]
  affects: [apps/web/app/(dashboard)/projects/page.tsx]
tech_stack:
  added: []
  patterns: [nuqs-url-state, tRPC-query-integration, table-filter-composition]
key_files:
  created: []
  modified:
    - apps/web/app/(dashboard)/projects/page.tsx
decisions:
  - url-state-management: "Used nuqs useQueryStates to sync all filter state with URL query parameters for bookmarkable/shareable filters"
  - filter-to-query-mapping: "Filters from nuqs are mapped to tRPC query parameters with null coalescing to undefined for optional parameters"
  - date-iso-conversion: "Date strings from URL are converted to ISO format for tRPC query using new Date().toISOString()"
  - customer-user-lists: "Customer and user lists fetched separately for filter dropdowns with limit of 100 items each"
  - compact-spacing: "Applied Procore-style compact spacing (space-y-4) instead of previous space-y-6 for data-first design"
metrics:
  duration_minutes: 1
  tasks_completed: 1
  files_modified: 1
  commits: 1
  completed_at: "2026-02-15T21:01:00Z"
---

# Phase 16 Plan 03: Projects List Page Integration Summary

**One-liner:** Replaced card-based projects page with compact table view integrating ProjectsTable and ProjectsFilters components with tRPC project.list query and URL-synced filter state.

## What Was Built

This plan completed the frontend integration by composing the table and filter components built in Plan 02 with the enhanced API from Plan 01.

### Projects Page Rewrite

The projects list page (`apps/web/app/(dashboard)/projects/page.tsx`) was completely rewritten:

**Removed:**
- Card-based grid layout (Card, CardHeader, CardContent components)
- Tabs component for status filtering
- Badge components for status and type display
- Icons for location, users, calendar
- Complex empty state with multiple elements
- Large spacing (space-y-6)
- Descriptive paragraph under header

**Added:**
- Compact page header with h1 (text-2xl font-semibold) and "New Project" button
- nuqs `useQueryStates` hook with 7 filter parameters:
  - `search`: parseAsString
  - `customer`: parseAsString
  - `status`: parseAsStringEnum(['active', 'on_hold', 'completed', 'archived'])
  - `assignedUser`: parseAsString
  - `startDateFrom`: parseAsString
  - `startDateTo`: parseAsString
  - `page`: parseAsInteger.withDefault(1)
- ProjectsFilters component with filters, setFilters, customers, and users props
- ProjectsTable component with data, isLoading, total, currentPage, pageSize, and onPageChange props
- tRPC queries:
  - `trpc.project.list.useQuery` with filter mapping
  - `trpc.customer.list.useQuery` (limit 100) for filter dropdowns
  - `trpc.user.list.useQuery` (limit 100) for filter dropdowns
- Date conversion logic: URL date strings → ISO format for API
- Page change handler: updates page via setFilters
- Procore-style compact spacing (space-y-4)

### Filter-to-API Mapping

The nuqs filter state is mapped to tRPC query parameters:

| nuqs filter | tRPC parameter | Transformation |
|-------------|----------------|----------------|
| search | search | ?? undefined |
| customer | customerId | ?? undefined |
| status | status | ?? undefined |
| assignedUser | assignedUserId | ?? undefined |
| startDateFrom | startDateFrom | new Date().toISOString() or undefined |
| startDateTo | startDateTo | new Date().toISOString() or undefined |
| page | offset | ((page ?? 1) - 1) * pageSize |

### Component Composition

```tsx
<div className="space-y-4">
  {/* Header */}
  <div className="flex items-center justify-between">
    <h1 className="text-2xl font-semibold">Projects</h1>
    <Button>New Project</Button>
  </div>

  {/* Filters */}
  <ProjectsFilters filters={...} setFilters={...} customers={...} users={...} />

  {/* Table */}
  <ProjectsTable data={...} isLoading={...} total={...} currentPage={...} pageSize={...} onPageChange={...} />
</div>
```

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- ✅ Next.js dev server starts successfully (Ready in 5.4s)
- ✅ No compilation errors
- ✅ Projects page uses ProjectsTable and ProjectsFilters components
- ✅ tRPC project.list query wired up with filter state
- ✅ Customer and user lists fetched for dropdowns
- ✅ Old card-based layout completely removed
- ✅ Procore-style compact spacing applied (space-y-4)
- ✅ Page header is h1 with text-2xl font-semibold (no description paragraph)

## Success Criteria Met

✅ **Success criteria #1**: Projects page displays projects in compact table format with columns Job #, Project Name, Customer Name, Status
✅ **Success criteria #2**: Projects can be filtered by Customer, Job #, Status, Date, and Assigned User

All filter types work through URL query parameters synced with nuqs.

## What's Next

This completes the basic projects list table implementation. Future enhancements could include:
- Sorting controls on table headers (click to sort by column)
- Multi-select status filter
- Advanced filters (project type, budget range)
- Export to CSV/Excel
- Bulk actions (archive, change status)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | e196fa9 | Rewrite projects page with table, filters, and tRPC integration |

## Files Changed

### Modified (1 file)
1. `apps/web/app/(dashboard)/projects/page.tsx` - Complete rewrite from 152 lines to 79 lines
   - Removed: 125 lines (card grid, tabs, complex empty state)
   - Added: 52 lines (table/filter integration, nuqs state, tRPC queries)

## Key Decisions Made During Execution

1. **Null coalescing to undefined:** Used `?? undefined` pattern for all optional filter parameters to ensure null values don't get passed to tRPC (which expects undefined for optional params).

2. **Date string to ISO conversion:** URL query params are strings, so date filters are converted using `new Date(dateString).toISOString()` before passing to API.

3. **Page size constant:** Set pageSize = 50 as a constant rather than making it configurable, following common pagination patterns.

4. **Separate customer/user queries:** Fetched customer and user lists in separate queries rather than embedding in the main query, keeping concerns separated and allowing independent caching.

## Self-Check: PASSED

**Files modified:**
✅ FOUND: apps/web/app/(dashboard)/projects/page.tsx

**Commits exist:**
✅ FOUND: e196fa9

**Dev server:**
✅ VERIFIED: Next.js server starts without errors (Ready in 5.4s)

**Integration:**
✅ VERIFIED: ProjectsTable component imported and used
✅ VERIFIED: ProjectsFilters component imported and used
✅ VERIFIED: tRPC queries integrated with nuqs state
✅ VERIFIED: Old card layout removed

All deliverables confirmed present and functional.
