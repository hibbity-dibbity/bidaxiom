---
phase: 36-project-lifecycle-state-machine-simple-gc-mode
plan: 05
subsystem: ui
tags: [react, tanstack-table, react-hook-form, shadcn, lifecycle, project-mode]

# Dependency graph
requires:
  - phase: 36-01
    provides: lifecyclePhaseEnum, LIFECYCLE_PHASE_LABELS, LIFECYCLE_ORDER, projectModeEnum exported from @construction/shared
  - phase: 36-03
    provides: project.create mutation stores projectMode; project.list returns lifecyclePhase field
  - phase: 36-04
    provides: LifecyclePhaseBadge component pattern established (phaseColors, LIFECYCLE_PHASE_LABELS usage)
provides:
  - Project list table shows lifecycle phase badge instead of old status column
  - Project creation form has Project Mode dropdown (Simple / GC Advanced) defaulting to gc_advanced
  - phaseColors inline mapping in columns.tsx for read-only badge rendering
affects: [36-future-plans, any plan touching project list table or project creation form]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-only phase badge in list tables uses inline phaseColors + LIFECYCLE_PHASE_LABELS, not the interactive LifecyclePhaseBadge client component"
    - "projectMode dropdown in creation form defaults to gc_advanced, submitted explicitly to project.create mutation"

key-files:
  created: []
  modified:
    - apps/web/app/(dashboard)/projects/components/columns.tsx
    - apps/web/app/(dashboard)/projects/components/projects-table.tsx
    - apps/web/components/project/project-form.tsx

key-decisions:
  - "Read-only phase badge in project list uses inline Badge + phaseColors (not full LifecyclePhaseBadge) — avoids unnecessary client component in list column cell"
  - "projectMode defaults to gc_advanced in form; server also defaults to gc_advanced (with user preference fallback) — explicit form value takes precedence"

patterns-established:
  - "Phase badge in list context: inline Badge with phaseColors record, no LifecyclePhaseBadge import needed"

requirements-completed:
  - LIFE-05
  - MODE-01

# Metrics
duration: 3min
completed: 2026-02-19
---

# Phase 36 Plan 05: Project List Phase Badge and Mode Dropdown Summary

**Lifecycle phase badge replaces status column in project list; Project Mode dropdown (Simple / GC Advanced) added to project creation form**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-19T05:40:38Z
- **Completed:** 2026-02-19T05:43:11Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Project list table now shows a color-coded "Phase" column with 9-phase badge set replacing the old "Status" column
- Project creation form has a "Project Mode" dropdown (GC / Advanced or Simple) with description text, defaulting to gc_advanced
- Both changes compile with zero new TypeScript errors in modified files

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace status column with lifecycle phase badge** - `dc6a031` (feat)
2. **Task 2: Add mode dropdown to project creation form** - `78ae6ad` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `apps/web/app/(dashboard)/projects/components/columns.tsx` - Replaced status column/colors with lifecyclePhase column using phaseColors and LIFECYCLE_PHASE_LABELS; updated Project interface
- `apps/web/app/(dashboard)/projects/components/projects-table.tsx` - Updated local Project interface: status -> lifecyclePhase, added slug field to match columns.tsx
- `apps/web/components/project/project-form.tsx` - Added projectMode defaultValue (gc_advanced) and Project Mode Select dropdown in Basic Information card

## Decisions Made
- Read-only phase badge in project list uses inline `Badge` with `phaseColors` record rather than importing the interactive `LifecyclePhaseBadge` client component — keeps the column cell render minimal and server-friendly
- `projectMode` defaults to `"gc_advanced"` in form defaultValues; the server's user-preference fallback is bypassed when the client sends an explicit value, which is the correct behavior since the user actively selected it

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated projects-table.tsx Project interface to match new columns.tsx**
- **Found during:** Task 1 (Replace status column)
- **Issue:** `projects-table.tsx` had its own local `Project` interface with `status: string` and no `lifecyclePhase` or `slug` — caused type mismatch when `columns as ColumnDef<Project>[]` was used
- **Fix:** Updated `projects-table.tsx` Project interface: replaced `status: string` with `lifecyclePhase: string | null`, added `slug: string`
- **Files modified:** `apps/web/app/(dashboard)/projects/components/projects-table.tsx`
- **Verification:** `npx tsc` produces zero errors in projects/ files
- **Committed in:** `dc6a031` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type interface alignment)
**Impact on plan:** Necessary type alignment fix. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in unrelated files (customers pages, API bid.ts, bidGeneration.ts) were out of scope and left untouched. The `project-form.tsx` customerForm defaultValues error (line 191, `address` field) was also pre-existing and unrelated to Task 2 changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 36 lifecycle UI rollout is now complete across all surfaces: project header, overview page, project list table, and creation form
- Ready for any remaining Phase 36 plans or v1.5 follow-on work

---
*Phase: 36-project-lifecycle-state-machine-simple-gc-mode*
*Completed: 2026-02-19*
