---
phase: 49-project-tabs-redesign
plan: 02
subsystem: ui
tags: [next.js, react, string-rename, proposals, estimates]

# Dependency graph
requires:
  - phase: 49-01
    provides: Proposals tab added to project tab bar; estimates route retained as URL path
provides:
  - All user-visible "Estimate"/"Estimates" display strings in estimates route tree renamed to "Proposal"/"Proposals"
  - Toast messages, breadcrumbs, headings, empty state, form labels, not-found fallbacks all use Proposal terminology
affects: [49-project-tabs-redesign]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - apps/web/app/(dashboard)/projects/[projectSlug]/estimates/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/estimates/new/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/workflow/page.tsx
    - apps/web/components/estimates/lifecycle/NextStepsPanel.tsx
    - apps/web/components/estimates/actions/SubmitEstimateButton.tsx

key-decisions:
  - "Only display strings renamed; URL paths (/estimates/...), variable names, tRPC procedure names, component names, TypeScript types, and the CSV filename are intentionally unchanged"
  - "WorkflowSidebar.tsx skipped — confirmed dead UI (commented out in workflow/page.tsx, not rendered anywhere)"
  - "Pre-existing TypeScript errors in unrelated files (workflow steps, workflow-detail) are out of scope and not introduced by this plan"

patterns-established:
  - "String rename pattern: edit user-visible text strings only; never rename identifiers, hrefs, or filenames"

requirements-completed: [TABS-02]

# Metrics
duration: 10min
completed: 2026-02-24
---

# Phase 49 Plan 02: Proposals String Rename Summary

**All user-visible "Estimate"/"Estimates" labels in the project estimates route tree renamed to "Proposal"/"Proposals" across 6 files — headings, breadcrumbs, toasts, empty states, form labels, and not-found fallbacks**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-02-24T03:58:00Z
- **Completed:** 2026-02-24T04:08:11Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- estimates/page.tsx: h1 heading, "New Proposal" button, search placeholder, empty state (2 strings), EmptyState action label — 6 strings updated
- estimates/new/page.tsx: toast.success, breadcrumb "Proposals" link, breadcrumb "New Proposal" current, h1, description text, FormLabel — 6 strings updated
- [estimateSlug]/page.tsx: not-found h2/description/back-link, h1 "Proposal Details", "Edit Proposal" button — 5 strings updated
- [estimateSlug]/workflow/page.tsx: not-found h2 and description — 2 strings updated
- NextStepsPanel.tsx: all 4 status description strings (draft, submitted, accepted, under_contract)
- SubmitEstimateButton.tsx: success toast and error toast — 2 strings updated
- Grep verification confirmed zero remaining `"Estimates"` display string matches in the estimates route tree

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename strings in estimates/page.tsx and estimates/new/page.tsx** - `6a888e5` (feat)
2. **Task 2: Rename strings in detail, workflow pages, and shared components** - `6db647d` (feat)

## Files Created/Modified
- `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/page.tsx` - Renamed 6 display strings to Proposal/Proposals
- `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/new/page.tsx` - Renamed 6 display strings to Proposal/Proposals
- `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/page.tsx` - Renamed 5 display strings to Proposal/Proposals
- `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/workflow/page.tsx` - Renamed 2 not-found display strings
- `apps/web/components/estimates/lifecycle/NextStepsPanel.tsx` - Renamed 4 status description strings
- `apps/web/components/estimates/actions/SubmitEstimateButton.tsx` - Renamed 2 toast message strings

## Decisions Made
- URL paths (`/estimates/...`), variable names (`estimates`, `displayedEstimates`), component names, tRPC procedure names, TypeScript types (`EstimateStatus`), and the CSV filename (`estimates-${projectSlug}-...`) were intentionally left unchanged — only display strings visible to users were renamed.
- WorkflowSidebar.tsx excluded from rename scope — confirmed commented out in workflow/page.tsx and not rendered anywhere.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors exist in unrelated files (`components/workflow/workflow-detail.tsx`, `components/estimates/workflow/steps/*`, `lib/session.ts`, `lib/trpc-server.ts`). Confirmed pre-existing via `git stash` check. None introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- TABS-02 complete: Proposals tab uses "Proposal" terminology consistently throughout the route tree
- No remaining user-visible "Estimate"/"Estimates" strings in project tab context (grep confirmed)
- Phase 49 additional plans (if any) can proceed; the rename foundation is in place

---
*Phase: 49-project-tabs-redesign*
*Completed: 2026-02-24*
