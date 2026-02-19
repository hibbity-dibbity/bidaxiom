---
phase: 36-project-lifecycle-state-machine-simple-gc-mode
plan: 03
subsystem: api
tags: [trpc, lifecycle, state-machine, rbac, drizzle, postgres]

# Dependency graph
requires:
  - phase: 36-01
    provides: lifecycle_phase and project_mode columns on projects table; project_lifecycle_transitions table
  - phase: 36-02
    provides: isValidTransition() and tryAutoAdvance() in lifecycle-state-machine.ts

provides:
  - project.transitionLifecyclePhase tRPC mutation with RBAC + guard + audit log
  - project.setMode tRPC mutation (no lifecycle phase lock)
  - project.getTransitionHistory tRPC query (ordered desc)
  - project.list includes lifecyclePhase + projectMode fields + lifecyclePhase filter
  - project.getBySlug returns lifecyclePhase + projectMode (via select *)
  - project.create resolves projectMode from input or user profile defaultProjectMode
  - estimates.create auto-advance hook (opportunity -> estimating on estimate_created)

affects:
  - frontend project list, project detail, estimating workflow
  - any future auto-advance hooks in payment-app.ts and other routers

# Tech tracking
tech-stack:
  added: []
  patterns:
    - lifecycle-state-machine imports consumed via isValidTransition + tryAutoAdvance
    - RBAC pattern for lifecycle mutations: org:admin OR project-level estimator/project_administrator
    - tryAutoAdvance silently no-ops if project not in preceding phase (safe to call anywhere)

key-files:
  created: []
  modified:
    - apps/api/src/trpc/routers/project.ts
    - apps/api/src/trpc/routers/estimates.ts
    - packages/shared/src/types/project.ts

key-decisions:
  - "setMode has no lifecyclePhase guard — mode changes are explicitly allowed at any phase per user decision"
  - "transitionLifecyclePhase RBAC: org:admin OR project-level estimator/project_administrator (not project_manager)"
  - "Auto-advance hook placed after audit log in create mutation, uses updatedEstimate.projectId"
  - "listProjectsSchema extended with optional lifecyclePhase filter in @construction/shared for backward compat"
  - "projectMode resolved in create: input > user defaultProjectMode profile > gc_advanced fallback"

patterns-established:
  - "Pattern: lifecycle mutations query projectTeamMembers directly for RBAC, not loadProjectAbilities/CASL"
  - "Pattern: tryAutoAdvance called after create audit log — all persistence complete before auto-advance fires"

requirements-completed:
  - LIFE-02
  - LIFE-03
  - LIFE-04
  - LIFE-05
  - MODE-01
  - MODE-02

# Metrics
duration: ~8min
completed: 2026-02-18
---

# Phase 36 Plan 03: Lifecycle Phase and Mode API Mutations Summary

**tRPC mutations for lifecycle phase transitions, project mode selection, transition history query, and auto-advance hook on estimate creation wired into the project and estimates routers**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-18T23:29:26Z
- **Completed:** 2026-02-18T23:37:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `project.transitionLifecyclePhase` mutation: validates forward/backward rules via `isValidTransition()`, enforces RBAC (org:admin or estimator/project_administrator), writes to `project_lifecycle_transitions`, audit logs the change
- Added `project.setMode` mutation: updates `projectMode` column, deliberately has no lifecycle phase guard per design intent
- Added `project.getTransitionHistory` query: returns all transitions for a project ordered by `createdAt` desc
- Updated `project.list`: now includes `lifecyclePhase` and `projectMode` in SELECT; accepts optional `lifecyclePhase` filter
- Updated `project.create`: resolves `projectMode` from input, falls back to `userProfiles.defaultProjectMode`, then to `gc_advanced`
- Wired `tryAutoAdvance('estimating', 'estimate_created')` in `estimates.create` — automatically advances opportunity-phase projects to estimating on first estimate

## Task Commits

Each task was committed atomically:

1. **Task 1: Add lifecycle phase and mode mutations to project router** - `ed4fba4` (feat)
2. **Task 2: Wire auto-advance hook in estimates router** - `31c635e` (feat)

**Plan metadata:** (committed with SUMMARY/STATE)

## Files Created/Modified

- `apps/api/src/trpc/routers/project.ts` - Added transitionLifecyclePhase, setMode, getTransitionHistory; updated list/create
- `apps/api/src/trpc/routers/estimates.ts` - Added tryAutoAdvance import and hook after estimate create audit log
- `packages/shared/src/types/project.ts` - Added `lifecyclePhase` optional filter to `listProjectsSchema`

## Decisions Made

- `setMode` deliberately omits any lifecyclePhase guard. Mode changes (Simple vs GC/Advanced) are a data model choice the user can make at any project phase — locking mode by phase would be unexpected.
- RBAC for lifecycle mutations queries `projectTeamMembers` directly rather than using CASL `loadProjectAbilities`, because the CASL model doesn't have a fine-grained `transitionLifecycle` action. The role check (estimator or project_administrator) is explicit and inline.
- `tryAutoAdvance` is placed after the estimate create audit log so all DB writes are flushed before the auto-advance fires. The function silently no-ops if the project is already past `opportunity`, making it safe to call even on subsequent estimates.
- `listProjectsSchema` extended with `lifecyclePhase.optional()` in shared package to preserve backward compat — existing callers that omit the field see unchanged behavior.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript error in `estimates.ts` at `convertEstimateToProject` call (`userId: ctx.userId` where `ctx.userId` is `string | null`). This is unrelated to Phase 36 changes and was present before this plan. Not fixed per scope boundary rules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full lifecycle API layer is now in place: transitions, mode setting, history, and auto-advance
- Frontend can now read `lifecyclePhase` and `projectMode` from `project.list` and `project.getBySlug`
- Frontend phase badge, mode toggle, and transition controls can be implemented against these endpoints
- Remaining LIFE-03 auto-advance hooks (estimate submitted, award recorded, final pay app approved, archive) are deferred — `tryAutoAdvance()` is ready to accept them additively in future phases

---
*Phase: 36-project-lifecycle-state-machine-simple-gc-mode*
*Completed: 2026-02-18*
