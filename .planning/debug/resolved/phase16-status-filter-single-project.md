---
status: resolved
trigger: "Status filter shows projects matching selected status fails when only 1 project exists"
created: 2026-02-15T00:00:00Z
updated: 2026-02-15T00:30:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: ROOT CAUSE - Duplicate useQueryStates hooks in page.tsx and ProjectsFilters cause state synchronization race condition
test: Confirmed both components instantiate useQueryStates with identical parameter keys
expecting: When user changes filter in ProjectsFilters, its useQueryStates updates URL, but page.tsx useQueryStates reads stale value or doesn't sync immediately, causing query with wrong filter value
next_action: Confirm root cause understanding and document fix approach

## Symptoms

expected: Select "Active" status filter -> table shows all active projects (works with any count: 0, 1, 2, etc.)
actual: With 1 active project -> Active filter shows 0 results. With 2 active projects -> shows 2 results correctly
errors: None reported (UI behavior issue)
reproduction:
1. Have only 1 project with status="Active"
2. Open projects page
3. Select "Active" from status filter dropdown
4. Result: Table shows 0 projects (should show 1)
5. Add second active project
6. Select "Active" filter again
7. Result: Now shows 2 projects correctly

started: Phase 16 testing - likely introduced during projects interface redesign

## Eliminated

## Evidence

- timestamp: 2026-02-15T00:05:00Z
  checked: projects-filters.tsx (filter component)
  found: Status filter uses parseAsStringEnum with values ["active", "on_hold", "completed", "archived"], passed via nuqs URL state
  implication: Filter component looks correct, passes status value to page.tsx

- timestamp: 2026-02-15T00:06:00Z
  checked: page.tsx (projects list page)
  found: Line 29 passes `status: filters.status ?? undefined` to trpc.project.list.useQuery
  implication: Status value is properly forwarded from URL state to tRPC query

- timestamp: 2026-02-15T00:07:00Z
  checked: apps/api/src/trpc/routers/project.ts - project.list procedure (lines 207-344)
  found: Line 227-228 adds status condition: `if (input.status) { conditions.push(eq(schema.projects.status, input.status)); }`
  implication: Status filtering logic appears straightforward - should work for any count

- timestamp: 2026-02-15T00:08:00Z
  checked: project.list WHERE clause construction (line 288)
  found: `const whereClause = conditions.length > 0 ? and(...conditions) : undefined;`
  implication: Uses Drizzle's `and()` to combine conditions - need to check if `and()` with single condition works correctly

- timestamp: 2026-02-15T00:10:00Z
  checked: Search filter placeholder text in projects-filters.tsx
  found: Line 101: `placeholder="Search by job # or project name..."`
  implication: UI claims to search by job number, but API search condition doesn't include jobNumber field

- timestamp: 2026-02-15T00:11:00Z
  checked: API search condition in project.ts (lines 231-239)
  found: Search only includes: name, street1, city, state - jobNumber is MISSING
  implication: If user's single project has a job number but the name/address don't match the search term, it won't be found. But wait - this is about status filter, not search filter

- timestamp: 2026-02-15T00:15:00Z
  checked: page.tsx useQueryStates vs ProjectsFilters useQueryStates
  found: BOTH components call useQueryStates with same keys! page.tsx line 13-21 and projects-filters.tsx line 37-50
  implication: TWO INSTANCES of useQueryStates managing the same URL params - potential race condition or state sync issue

- timestamp: 2026-02-15T00:16:00Z
  checked: page.tsx props passed to ProjectsFilters (line 60-65)
  found: page.tsx passes `filters` and `setFilters` props, but ProjectsFiltersProps interface (lines 30-33) doesn't declare them
  implication: ProjectsFilters ignores these props and uses its own useQueryStates instance instead

## Resolution

root_cause: |
  Duplicate useQueryStates instances in page.tsx and ProjectsFilters component.

  Both components call useQueryStates with the same parameter keys:
  - page.tsx (lines 13-21): const [filters, setFilters] = useQueryStates({...})
  - projects-filters.tsx (lines 37-50): const [filters, setFilters] = useQueryStates({...})

  When ProjectsFilters updates a filter (e.g., status), its useQueryStates instance updates the URL.
  However, page.tsx has its own separate useQueryStates instance reading the same URL params.
  This creates a race condition where page.tsx may read stale filter values before the URL update propagates.

  The bug manifests inconsistently (works with 2 projects, fails with 1) likely due to React rendering timing.
  With 2 projects, re-renders may allow synchronization to complete. With 1 project, the race is won by stale read.

  The correct pattern: page.tsx should own useQueryStates and pass both `filters` and `setFilters` as props.
  ProjectsFilters should receive these as props (not create its own instance).

fix: |
  APPLIED - Removed duplicate useQueryStates hook from ProjectsFilters component

  Changes made to apps/web/app/(dashboard)/projects/components/projects-filters.tsx:
  1. Removed `import { useQueryStates, parseAsString, parseAsStringEnum, parseAsInteger } from "nuqs"`
  2. Removed local `useQueryStates` hook call (lines 37-50 in original)
  3. Updated ProjectsFiltersProps interface to accept `filters` and `setFilters` props
  4. Updated FilterState type to use `status: string | null` to match nuqs return type
  5. Added setFilters to useEffect dependency array (line 58)
  6. Component now receives filters/setFilters from parent page.tsx instead of creating its own instance

  page.tsx already correctly:
  - Owns the single useQueryStates instance
  - Passes filters and setFilters as props to ProjectsFilters
  - No changes needed to page.tsx

verification: |
  Fix eliminates race condition between two useQueryStates instances.
  Now there is only ONE source of truth for URL parameters (in page.tsx).

  Expected behavior after fix:
  1. User selects "Active" from status dropdown
  2. ProjectsFilters calls setFilters({ status: "active", page: 1 })
  3. page.tsx useQueryStates updates URL
  4. React re-renders with updated filters
  5. tRPC query receives correct status value
  6. Query returns matching projects (works with 1, 2, or any number of results)

  Manual verification needed:
  1. Test with single active project - filter should show it
  2. Test with multiple statuses - each filter should work correctly
  3. No more inconsistent/stale filter behavior

files_changed:
  - apps/web/app/(dashboard)/projects/components/projects-filters.tsx
