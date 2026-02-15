---
phase: 16-projects-interface-redesign
plan: 02
subsystem: frontend-ui
tags: [tanstack-table, nuqs, url-state, filters, data-table]
dependency_graph:
  requires: [nuqs, @tanstack/react-table, slug]
  provides: [NuqsAdapter, ProjectsTable, ProjectsFilters, columns]
  affects: [apps/web/app/providers.tsx, projects/components/*]
tech_stack:
  added: [nuqs@2.8.8, @tanstack/react-table@8.21.3, slug@11.0.1]
  patterns: [URL state management, TanStack Table, debounced search]
key_files:
  created:
    - apps/web/app/(dashboard)/projects/components/columns.tsx
    - apps/web/app/(dashboard)/projects/components/projects-table.tsx
    - apps/web/app/(dashboard)/projects/components/projects-filters.tsx
  modified:
    - apps/web/app/providers.tsx
    - apps/web/package.json
decisions: []
metrics:
  duration: 6 min
  tasks_completed: 2
  files_created: 3
  files_modified: 2
  commits: 2
  completed_at: 2026-02-15T20:29:21Z
---

# Phase 16 Plan 02: Table Components and Filters Summary

**One-liner:** Built reusable TanStack Table components with URL-synced nuqs filters for the projects list interface.

## What Was Built

This plan created the foundational building blocks for the compact projects table view:

1. **Installed Dependencies**: Added @tanstack/react-table, nuqs, and slug packages to the web workspace
2. **NuqsAdapter Integration**: Wrapped the provider tree with NuqsAdapter to enable URL state management throughout the app
3. **Column Definitions**: Created TanStack Table column definitions for Job #, Project Name, Customer, Status, and Start Date with Procore-style compact styling
4. **ProjectsTable Component**: Built a sortable, paginated data table with loading skeleton states and empty state messaging
5. **ProjectsFilters Component**: Implemented a comprehensive filter bar with URL-synced state for search, status, customer, assigned user, and date range

## Key Implementation Details

### NuqsAdapter Placement
- Added to provider tree between ThemeProvider and AuthProvider
- Ensures nuqs can access Next.js router context for all pages
- Positioned to wrap AuthProvider and downstream providers

### Column Definitions (columns.tsx)
- **Job #**: Monospace font, sortable, shows "--" for null values
- **Project Name**: Bold text, rendered as clickable link to `/projects/{slug}` (slug generated client-side using slug package)
- **Customer**: Plain text display with "--" fallback
- **Status**: Badge component with color mapping (green/yellow/blue/gray for active/on_hold/completed/archived)
- **Start Date**: Formatted as locale date string with "--" fallback
- All columns use `text-sm` for compact density

### ProjectsTable Component (projects-table.tsx)
- Uses `useReactTable` with `getCoreRowModel()` and `getSortedRowModel()`
- Data wrapped in `React.useMemo` to prevent infinite re-renders (per Phase 16 research)
- Client-side sorting with chevron indicators on column headers
- Compact row styling: `py-2` padding, `text-sm` font, `hover:bg-muted/50` hover state
- Loading state: 5 skeleton rows matching column structure
- Empty state: Centered message with "Create Project" button, context-aware messaging (no projects vs. no results)
- Pagination: Shows "X-Y of Z projects" with Previous/Next buttons, page/total props from parent

### ProjectsFilters Component (projects-filters.tsx)
- Uses `useQueryStates` from nuqs with type-safe parsers:
  - `search`: parseAsString (debounced 300ms via useDebounce hook)
  - `customer`: parseAsString (customer ID)
  - `status`: parseAsStringEnum (active/on_hold/completed/archived)
  - `assignedUser`: parseAsString (user ID)
  - `startDateFrom`: parseAsString (ISO date)
  - `startDateTo`: parseAsString (ISO date)
  - `page`: parseAsInteger.withDefault(1)
- Filter changes reset page to 1 automatically
- Search input with magnifying glass icon, debounced to reduce backend load
- Dropdown selects for status, customer, and assigned user with "All" defaults
- Date range inputs for start date filtering
- Clear Filters button (only visible when filters active) resets all to null and page to 1
- Compact Procore-style layout: `gap-3`, `items-center`, `flex-wrap`

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- ✅ `apps/web/app/providers.tsx` contains NuqsAdapter import and wrapper
- ✅ `apps/web/app/(dashboard)/projects/components/columns.tsx` exports column definitions
- ✅ `apps/web/app/(dashboard)/projects/components/projects-table.tsx` exports ProjectsTable
- ✅ `apps/web/app/(dashboard)/projects/components/projects-filters.tsx` exports ProjectsFilters with nuqs state
- ✅ TypeScript compiles without errors (no errors found in new files with --skipLibCheck)
- ✅ @tanstack/react-table, nuqs, slug in apps/web/package.json dependencies

## What's Next

Plan 03 will compose these components into the projects list page, connecting the filters to tRPC queries and handling the data flow from URL state to API calls.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 19f05d7 | Install dependencies and add NuqsAdapter to providers |
| 2 | 08f8cbd | Create table and filter components for projects interface |

## Self-Check

Verifying all created files and commits exist:

- ✅ apps/web/app/(dashboard)/projects/components/columns.tsx exists
- ✅ apps/web/app/(dashboard)/projects/components/projects-table.tsx exists
- ✅ apps/web/app/(dashboard)/projects/components/projects-filters.tsx exists
- ✅ apps/web/app/providers.tsx modified
- ✅ apps/web/package.json modified
- ✅ Commit 19f05d7 exists
- ✅ Commit 08f8cbd exists

## Self-Check: PASSED

All files created and all commits verified.
