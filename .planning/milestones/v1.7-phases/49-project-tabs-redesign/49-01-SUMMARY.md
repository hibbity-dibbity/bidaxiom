---
phase: 49-project-tabs-redesign
plan: 01
subsystem: ui
tags: [next.js, react, navigation, tabs, breadcrumbs]

# Dependency graph
requires:
  - phase: 48-project-mode-removal
    provides: Trimmed ALL_SECTIONS array (Budget, SOV, Commitments, PaymentApps, RFQs removed)
provides:
  - Six-tab project bar in correct order: Overview, Documents, Proposals, Change Orders, Invoices, Expenses
  - Expenses placeholder page at /projects/[slug]/expenses
  - Breadcrumb label mappings for estimates (Proposals) and expenses (Expenses)
affects: [future-project-tabs, phase-50, phase-51, phase-52]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Placeholder page pattern: Receipt icon + heading + description + back link (no toast, no lock)"
    - "Tab href stays as route segment; display name decoupled from href (Proposals tab -> /estimates)"

key-files:
  created:
    - apps/web/app/(dashboard)/projects/[projectSlug]/expenses/page.tsx
  modified:
    - apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx
    - apps/web/components/layout/breadcrumbs.tsx

key-decisions:
  - "Proposals tab uses href /estimates to preserve existing routes — only display name changes"
  - "Expenses placeholder uses Receipt icon (not Lock) — future feature, not phase-gated"
  - "Added /expenses no-op prefetch handler to sectionPrefetchMap to avoid undefined lookup"

patterns-established:
  - "Future-feature placeholder: Receipt/relevant icon + heading + coming-soon copy + Back link, no toast"

requirements-completed: [TABS-01, TABS-03]

# Metrics
duration: 2min
completed: 2026-02-24
---

# Phase 49 Plan 01: Project Tabs Redesign Summary

**Six-tab project bar with correct left-to-right order, Proposals rename, and Expenses coming-soon placeholder page with breadcrumb label support**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-24T04:05:48Z
- **Completed:** 2026-02-24T04:07:57Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Reordered and extended ALL_SECTIONS to six tabs: Overview, Documents, Proposals, Change Orders, Invoices, Expenses
- Created `expenses/page.tsx` placeholder with Receipt icon, contextual copy, and Back to Overview link
- Added `estimates: "Proposals"` and `expenses: "Expenses"` to breadcrumbs segmentLabels

## Task Commits

Each task was committed atomically:

1. **Task 1: Reorder ALL_SECTIONS and add Expenses entry** - `c2603c4` (feat)
2. **Task 2: Create Expenses placeholder page** - `e3088a5` (feat)
3. **Task 3: Add segment label mappings to breadcrumbs.tsx** - `b144cd0` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx` - Tab order rewritten: 5 tabs -> 6 tabs, "Estimates" renamed to "Proposals", Expenses added; no-op prefetch entry added
- `apps/web/app/(dashboard)/projects/[projectSlug]/expenses/page.tsx` - New placeholder page; Receipt icon, Expense Tracking heading, coming-soon message, Back to Overview button
- `apps/web/components/layout/breadcrumbs.tsx` - Two new segmentLabels entries: estimates -> "Proposals", expenses -> "Expenses"

## Decisions Made
- Proposals tab `href` stays `/estimates` to preserve existing routes — only the visible `name` changes from "Estimates" to "Proposals"
- Expenses placeholder uses `Receipt` icon (not `Lock`) — this is a future feature, not a phase-gated or removed feature, matching the plan spec
- Added no-op `"/expenses": () => {}` to `sectionPrefetchMap` so the map lookup never returns `undefined` for the new tab

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Pre-existing TypeScript errors in `apps/api/` files are unrelated to this plan's changes and were present before execution.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 49 Plan 01 complete: tab bar now has 6 tabs in the correct order per TABS-01
- Expenses placeholder route is live per TABS-03
- Breadcrumbs correctly label both the /estimates and /expenses URL segments
- Ready for Phase 49 Plan 02 (if applicable) or next phase

---
*Phase: 49-project-tabs-redesign*
*Completed: 2026-02-24*

## Self-Check: PASSED

- FOUND: apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx
- FOUND: apps/web/app/(dashboard)/projects/[projectSlug]/expenses/page.tsx
- FOUND: apps/web/components/layout/breadcrumbs.tsx
- FOUND: .planning/phases/49-project-tabs-redesign/49-01-SUMMARY.md
- FOUND commit: c2603c4 (Task 1)
- FOUND commit: e3088a5 (Task 2)
- FOUND commit: b144cd0 (Task 3)
