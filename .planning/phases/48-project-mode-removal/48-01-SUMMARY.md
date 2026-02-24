---
phase: 48-project-mode-removal
plan: 01
subsystem: ui
tags: [next.js, react, sonner, lucide-react, project-tabs, placeholder-pages]

# Dependency graph
requires:
  - phase: 46-project-header-and-tabs
    provides: project-tabs.tsx with ALL_SECTIONS array and tab routing pattern
provides:
  - Tab bar with Budget, SOV, Commitments, Payment Apps, and RFQs removed (5 tabs remain)
  - Four placeholder pages for removed tab routes with toast + Lock icon + Back to Overview
affects: [49-project-tab-redesign, any phase touching project-tabs.tsx or removed tab routes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Placeholder page pattern: useClient + useEffect toast + Lock icon + centered layout + Back to Overview link"

key-files:
  created: []
  modified:
    - apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/budget/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/sov/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/commitments/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/page.tsx

key-decisions:
  - "Removed 5 tab entries from ALL_SECTIONS (Budget, SOV, Commitments, Payment Apps, RFQs); gcOnly filter logic and projectMode prop preserved as inert code"
  - "Four removed tab page.tsx files replaced with placeholder pages; original content preserved in git history"
  - "useParams hook used instead of props for projectSlug in placeholder pages (client component pattern)"

patterns-established:
  - "Placeholder page: useEffect toast on mount, centered Lock icon, tab-specific body text, Button+Link back to overview"

requirements-completed:
  - TABS-04
  - MODE-02

# Metrics
duration: 2min
completed: 2026-02-24
---

# Phase 48 Plan 01: Project Mode Removal — Tab Bar and Placeholder Pages Summary

**Five GC-only tabs removed from project tab bar; four replaced page routes show Lock icon placeholder with sonner toast on mount**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-24T01:03:39Z
- **Completed:** 2026-02-24T01:05:28Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- ALL_SECTIONS array in project-tabs.tsx trimmed from 10 entries to 5 (Overview, Documents, Change Orders, Invoices, Estimates)
- Budget, SOV, Commitments, and Payment Apps pages replaced with consistent placeholder UI — Lock icon, "This section isn't available" heading, tab-specific body text, and Back to Overview button
- Each placeholder fires `toast("That page isn't available")` on mount via useEffect
- gcOnly filter logic and projectMode prop preserved in project-tabs.tsx per plan contract
- TypeScript build passes with zero errors introduced by the changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove GC-only tabs from project-tabs.tsx** - `d7a9c4a` (feat)
2. **Task 2: Replace four tab page.tsx files with placeholder pages** - `c68ce2b` (feat)

**Plan metadata:** (docs commit — pending)

## Files Created/Modified
- `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx` - ALL_SECTIONS reduced to 5 entries; Budget, SOV, Commitments, Payment Apps, RFQs removed
- `apps/web/app/(dashboard)/projects/[projectSlug]/budget/page.tsx` - Replaced with BudgetPage placeholder
- `apps/web/app/(dashboard)/projects/[projectSlug]/sov/page.tsx` - Replaced with SovPage placeholder
- `apps/web/app/(dashboard)/projects/[projectSlug]/commitments/page.tsx` - Replaced with CommitmentsPage placeholder
- `apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/page.tsx` - Replaced with PaymentAppsPage placeholder

## Decisions Made
- gcOnly filter logic and projectMode prop preserved in project-tabs.tsx (inert but honors "keep underlying code" contract from Phase 48 planning)
- Used `useParams<{ projectSlug: string }>()` in placeholder pages instead of props pattern — cleaner for client components that don't need layout-level data
- Pre-existing TypeScript errors in unrelated workflow and payment-app components are out of scope and not addressed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - TypeScript build confirmed no new errors in modified files. Pre-existing errors in unrelated components (workflow, lien-waiver-tracker, retainage-summary) were already present before this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 48 plan 01 complete; tab bar cleanup done
- Phase 49 (project tab redesign) can proceed — tab bar now shows only the 5 intended tabs
- Prefetch handlers for removed tabs remain in project-tabs.tsx dead code — can be cleaned up in a future phase

---
*Phase: 48-project-mode-removal*
*Completed: 2026-02-24*
