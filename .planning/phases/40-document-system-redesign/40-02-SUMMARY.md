---
phase: 40-document-system-redesign
plan: 02
subsystem: ui
tags: [next.js, trpc, routing, workflow]

# Dependency graph
requires:
  - phase: 40-document-system-redesign-01
    provides: WorkflowDetail component with workflowId/projectId/projectSlug props
provides:
  - Next.js route at /projects/[projectSlug]/workflows/[workflowId] rendering WorkflowDetail
affects: [40-document-system-redesign-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [useParams to extract both projectSlug and workflowId from URL; trpc.project.getBySlug cached by parent layout so no duplicate fetch]

key-files:
  created:
    - apps/web/app/(dashboard)/projects/[projectSlug]/workflows/[workflowId]/page.tsx
  modified: []

key-decisions:
  - "Page uses trpc.project.getBySlug (same query as layout) — React Query deduplicates the in-flight request; no projectId prop threading needed"
  - "Skeleton loading state shown for the entire page until project resolves — matches layout loading pattern"

patterns-established:
  - "Workflow detail route: useParams<{projectSlug, workflowId}> + getBySlug cache hit → WorkflowDetail render"

requirements-completed: [DOC-04]

# Metrics
duration: 1min
completed: 2026-02-21
---

# Phase 40 Plan 02: Workflow Detail Route Summary

**Next.js route page at /projects/[projectSlug]/workflows/[workflowId] connecting URL params to the existing WorkflowDetail component via cached tRPC project query**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-21T03:39:16Z
- **Completed:** 2026-02-21T03:40:15Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created missing Next.js dynamic route for workflow detail views
- Route accepts both projectSlug (for layout context) and workflowId (for workflow data) as URL params
- Project ID resolved from slug via tRPC query cached by the project layout — no redundant fetch
- Skeleton loading state displayed while project data is pending

## Task Commits

Each task was committed atomically:

1. **Task 1: Create workflow detail page route** - `4ee08e9` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `apps/web/app/(dashboard)/projects/[projectSlug]/workflows/[workflowId]/page.tsx` - Route page resolving projectId from slug and rendering WorkflowDetail

## Decisions Made
- Page uses `trpc.project.getBySlug` — same query as the parent layout so React Query serves a cache hit with no duplicate network request; no need to thread projectId as a prop
- Skeleton shown for full page when project data not yet available, matching the layout's existing skeleton pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Workflow detail route is live; Plan 03 can now build the unified document table with row-click navigation pointing to /projects/[slug]/workflows/[id]
- No blockers

---
*Phase: 40-document-system-redesign*
*Completed: 2026-02-21*
