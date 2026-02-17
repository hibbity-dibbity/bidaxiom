---
phase: 22-validation-and-duplicate-prevention
plan: "03"
subsystem: ui
tags: [react-hook-form, trpc, zod, job-numbers, blur-validation, edit-form, next-js]

# Dependency graph
requires:
  - phase: 22-validation-and-duplicate-prevention
    plan: "01"
    provides: checkJobNumberAvailability with excludeProjectId and validateJobNumberFormat from shared package
provides:
  - Edit project page at /projects/[slug]/edit with pre-filled form
  - handleJobNumberBlur with excludeProjectId to prevent self-match on edit
  - Blur validation pattern (format check + duplicate check) mirrored from create form
  - project.update mutation call with navigation to updated slug
affects: [project-header, project-overview, any user clicking "Edit Project" button]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useEffect + form.reset() for pre-filling server data into react-hook-form
    - excludeProjectId passed to checkJobNumberAvailability to avoid false-positive duplicate errors on edit
    - Cast DB-inferred string types to enum union types for form compatibility

key-files:
  created:
    - apps/web/app/(dashboard)/projects/[projectSlug]/edit/page.tsx
  modified: []

key-decisions:
  - "Navigate to updated slug on save — project.update regenerates slug when name/jobNumber changes; onSuccess uses updated.slug from mutation response instead of stale projectSlug param"
  - "Type assertions for status/projectType — DB returns string, form schema expects enum union; cast at form.reset() call site to satisfy TypeScript without runtime overhead"
  - "editFormSchema omits id and costCodes — id passed separately to mutation, costCodes not in scope for edit form per plan requirements"

patterns-established:
  - "Edit form pre-fill pattern: useEffect watching project data calls form.reset() with mapped values once data arrives"
  - "Async submit safety net: re-run handleJobNumberBlur on submit before calling mutation to catch fast typers who submit without blurring"

requirements-completed: [JOBVAL-01, JOBVAL-02, JOBVAL-03]

# Metrics
duration: 8min
completed: 2026-02-17
---

# Phase 22 Plan 03: Edit Project Page with Blur Validation Summary

**Edit project page at /projects/[slug]/edit pre-fills form via getBySlug, runs excludeProjectId blur validation so own job number never self-flags as duplicate, and saves via project.update**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-17T04:17:34Z
- **Completed:** 2026-02-17T04:25:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `/projects/[slug]/edit` page — the "Edit Project" button in project-header.tsx no longer 404s
- Form pre-fills all fields (name, customerId, description, status, projectType, startDate, endDate, location) via `trpc.project.getBySlug` on load using `useEffect` + `form.reset()`
- Implemented `handleJobNumberBlur` with `excludeProjectId: project.id` — user can save their own existing job number without triggering duplicate error
- Format validation runs first (when auto-gen enabled), duplicate check second; same two-step pattern as create form
- Submit re-runs blur validation as async safety net before calling mutation
- Navigates to `updated.slug` from mutation response (not stale URL param), handling cases where name/jobNumber changes regenerate the slug

## Task Commits

Each task was committed atomically:

1. **Task 1: Create edit project page with pre-filled form and blur validation** - `9ae8feb` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `apps/web/app/(dashboard)/projects/[projectSlug]/edit/page.tsx` - New "use client" page: loads project via getBySlug, pre-fills form, blur-validates job number with excludeProjectId, saves via project.update, navigates to updated slug

## Decisions Made
- Navigate to `updated.slug` from mutation response instead of stale `projectSlug` URL param — `project.update` regenerates slug when name or jobNumber changes; using the response slug ensures navigation lands on the correct URL after changes
- Type assertions for `status` and `projectType` at `form.reset()` call site — Drizzle ORM infers these as `string` from the DB schema; react-hook-form's Zod resolver expects the enum union type; casting avoids both a TypeScript error and an unnecessary runtime transformation
- `editFormSchema` omits `id` and `costCodes` — `id` is passed separately in the mutation payload (not a user-editable field), `costCodes` are out of scope for the edit form per plan specification

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type mismatch on status/projectType form reset**
- **Found during:** Task 1 (TypeScript check after page creation)
- **Issue:** `project.status` and `project.projectType` inferred as `string` by Drizzle, but `editFormSchema` expects `"active" | "on_hold" | "completed" | "archived"` and `"commercial" | "residential" | "infrastructure" | "industrial"` respectively
- **Fix:** Added type assertions at the `form.reset()` call: `project.status as "active" | "on_hold" | ..."` and `project.projectType as "commercial" | ...`
- **Files modified:** apps/web/app/(dashboard)/projects/[projectSlug]/edit/page.tsx
- **Verification:** `npx tsc --noEmit -p apps/web/tsconfig.json` shows no errors in the edit page
- **Committed in:** `9ae8feb` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 type error bug)
**Impact on plan:** Type assertion is the correct fix here — Drizzle's string inference vs Zod enum expectation is a known TypeScript friction point in this codebase; no scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in apps/api files (bid.ts, bidGeneration.ts, estimateLifecycle.ts, quickbooks oauth.ts) are out of scope — confirmed pre-existing from 22-01 SUMMARY. No new errors introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Edit page is live and functional: /projects/[slug]/edit resolves and pre-fills all project data
- The job number duplicate prevention pattern is now consistent across create and edit flows (both use excludeProjectId on edit, both use blur validation with the same two-step check)
- Phase 22 requirements JOBVAL-01, JOBVAL-02, JOBVAL-03 are fulfilled across plans 01, 02, and 03

## Self-Check: PASSED

- FOUND: apps/web/app/(dashboard)/projects/[projectSlug]/edit/page.tsx
- FOUND: .planning/phases/22-validation-and-duplicate-prevention/22-03-SUMMARY.md
- Commit 9ae8feb verified: feat(22-03): create edit project page with blur validation and excludeProjectId
- grep excludeProjectId: line 150 — `excludeProjectId: project?.id`
- grep validateJobNumberFormat: line 8 (import), line 135 (usage)
- grep handleJobNumberBlur: lines 126, 175, 431

---
*Phase: 22-validation-and-duplicate-prevention*
*Completed: 2026-02-17*
