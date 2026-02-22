---
phase: 43-budget-domain-redesign
plan: "04"
subsystem: ui
tags: [filter-chips, empty-state, react, next.js, nuqs]

# Dependency graph
requires:
  - phase: 43-01
    provides: FilterChips component, EmptyState component (shared primitives used here)
provides:
  - Projects list page: filter chips for status/customer/assignedUser/date filters below the search bar
  - Projects list page: isFiltered prop wired from page.tsx into ProjectsTable for contextual empty states
  - Customers page: inline search above table (not Card-wrapped); EmptyState for empty/no-match variants
  - Subcontractors page: filter chips for status and trade filters; EmptyState for empty/no-match variants
affects:
  - 43-02 (ProjectsTable already has isFiltered prop after Plan 04; consistent empty state pattern)
  - future list pages (established chip + EmptyState pattern for global list views)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FilterChips below search bar — derive chips array from active secondary filter state, not search"
    - "EmptyState with SearchX icon for filtered-empty variant; domain icon (FolderOpen, Building2, HardHat) for genuinely-empty variant"
    - "isFiltered computed at page level from all filter dimensions; passed as prop into table component"
    - "clearAllFilters function resets all local state (search, statusFilter, tradeFilter) in one call"

key-files:
  created: []
  modified:
    - apps/web/app/(dashboard)/projects/components/projects-filters.tsx
    - apps/web/app/(dashboard)/projects/page.tsx
    - apps/web/app/(dashboard)/projects/components/projects-table.tsx
    - apps/web/app/(dashboard)/customers/page.tsx
    - apps/web/app/(dashboard)/subcontractors/page.tsx

key-decisions:
  - "Search input is not chipped — the search box itself is the search representation; only secondary filter dimensions (status, customer, assignedUser, dates) become chips"
  - "ProjectsTable isFiltered prop added as optional initially to avoid TS error, then confirmed required by Plan 02 state (Plan 02 had already run and made it required)"
  - "Building2 removed from subcontractors imports — HardHat replaces it as the domain icon for the EmptyState"
  - "Customers page: no FilterChips slot added — page has only a search filter, no secondary filter dimensions to chip"

patterns-established:
  - "Global list view pattern: inline search → secondary filter controls → FilterChips row → table with EmptyState"
  - "EmptyState variant selection: isFiltered (or search/filter active) → SearchX icon + no CTA; otherwise → domain icon + CTA"

requirements-completed:
  - LIST-01
  - LIST-02
  - LIST-03

# Metrics
duration: 8min
completed: 2026-02-22
---

# Phase 43 Plan 04: Filter Chips and Empty States for Global List Views Summary

**FilterChips added to Projects and Subcontractors list pages; Customers search moved inline; all three pages use shared EmptyState with contextual icon/heading/CTA variants**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-22T16:57:43Z
- **Completed:** 2026-02-22T17:05:38Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Projects page now shows removable filter chips below the search bar for status, customer, assignedUser, and date filters; Clear all link in chips row replaces the old Clear Filters button
- projects/page.tsx computes `isFiltered` and passes it to ProjectsTable, enabling contextual empty state ("No projects match your filters" vs "No projects yet")
- Customers page search is now inline above the table with a Search icon (removed Card wrapper); empty state uses shared EmptyState with Building2 or SearchX depending on whether search is active
- Subcontractors page shows filter chips for status and trade filters below the Tabs; EmptyState uses HardHat for genuinely-empty, SearchX for filtered-empty

## Task Commits

Each task was committed atomically:

1. **Task 1: Add filter chips to ProjectsFilters; wire isFiltered into projects/page.tsx** - `c01ee6f` (feat)
2. **Task 2: Update Customers and Subcontractors pages — search placement, filter chips, empty states** - `7753c21` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `apps/web/app/(dashboard)/projects/components/projects-filters.tsx` - Replaced Clear Filters button with FilterChips; derive activeChips from secondary filter state
- `apps/web/app/(dashboard)/projects/page.tsx` - Compute isFiltered from all filter dimensions; pass to ProjectsTable
- `apps/web/app/(dashboard)/projects/components/projects-table.tsx` - Add isFiltered prop to interface (Plan 02 had already implemented full EmptyState rendering)
- `apps/web/app/(dashboard)/customers/page.tsx` - Inline search with Search icon; EmptyState replaces ad-hoc Card empty state
- `apps/web/app/(dashboard)/subcontractors/page.tsx` - FilterChips below Tabs; EmptyState with HardHat/SearchX; clearAllFilters function

## Decisions Made
- Search input not chipped — the search box itself is the UI representation of the active search; secondary filter dimensions (status, customer, assignedUser, dates) become chips
- Customers page has no FilterChips — it only has a search filter, no secondary filter dimensions to chip
- HardHat replaces Building2 as the domain icon for subcontractors EmptyState (Building2 was the generic fallback in the old ad-hoc state; HardHat is more specific to the domain)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added isFiltered prop to ProjectsTableProps to prevent TS error**
- **Found during:** Task 1 (wire isFiltered into projects/page.tsx)
- **Issue:** Plan 02 was supposed to add isFiltered prop to ProjectsTable, but Plan 04 passes the prop from page.tsx — without the prop defined, TypeScript would error on the call site
- **Fix:** Added `isFiltered?: boolean` to ProjectsTableProps interface; confirmed Plan 02 had already run and upgraded the prop to required with full EmptyState implementation
- **Files modified:** apps/web/app/(dashboard)/projects/components/projects-table.tsx
- **Verification:** No new TS errors in projects/ files
- **Committed in:** c01ee6f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was necessary to prevent a TS compilation error at the prop call site. Plan 02 had already added the full isFiltered implementation so the fix was minimal — just confirming the prop signature was already there.

## Issues Encountered
- Plan 02 had already been executed (projects-table.tsx already had isFiltered as required prop with EmptyState). My edit to add it as optional was superseded by the existing state. The existing interface was compatible with this plan's output, so no conflict.

## Next Phase Readiness
- LIST-01, LIST-02, LIST-03 requirements completed for Projects, Customers, and Subcontractors global list views
- FilterChips + EmptyState pattern established for remaining list views
- No blockers for subsequent plans in Phase 43

---
*Phase: 43-budget-domain-redesign*
*Completed: 2026-02-22*
