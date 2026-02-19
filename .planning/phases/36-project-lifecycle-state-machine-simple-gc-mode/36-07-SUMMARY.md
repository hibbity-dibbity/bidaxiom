---
phase: 36-project-lifecycle-state-machine-simple-gc-mode
plan: 07
subsystem: api
tags: [trpc, react, nextjs, phase-gating, lifecycle, feature-flags]

# Dependency graph
requires:
  - phase: 36-project-lifecycle-state-machine-simple-gc-mode
    plan: 03
    provides: lifecyclePhase field on getBySlug response; setMode mutation
  - phase: 36-project-lifecycle-state-machine-simple-gc-mode
    plan: 06
    provides: ProjectTabs with projectMode prop; layout passes projectMode from project data

provides:
  - PHASE_FEATURE_GATES constant defining allowed phases per feature
  - isFeatureAvailableInPhase(feature, phase) exported from @construction/shared
  - changeOrder.create tRPC mutation rejects BAD_REQUEST if lifecyclePhase is pre-Awarded
  - estimates.update tRPC mutation rejects BAD_REQUEST if lifecyclePhase is post-Estimating
  - estimates.updateLineItem tRPC mutation rejects BAD_REQUEST if lifecyclePhase is post-Estimating
  - ProjectTabs hides Change Orders tab when lifecyclePhase is opportunity/estimating/submitted

affects:
  - change-orders
  - estimates
  - project-navigation
  - future phase-gated features (use isFeatureAvailableInPhase for new gates)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-source-of-truth phase gating via PHASE_FEATURE_GATES in @construction/shared"
    - "isFeatureAvailableInPhase() used in both server (tRPC guard) and client (tab visibility) — same logic, no duplication"
    - "phaseGated flag on tab definition objects enables declarative filtering parallel to gcOnly flag"

key-files:
  created: []
  modified:
    - packages/shared/src/types/project.ts
    - packages/shared/src/index.ts
    - apps/api/src/trpc/routers/change-order.ts
    - apps/api/src/trpc/routers/estimates.ts
    - apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx

key-decisions:
  - "PHASE_FEATURE_GATES uses inclusive lists (allowed phases) rather than exclusive (blocked phases) — easier to add new allowed phases as project advances"
  - "Unknown feature keys are permissive by default — prevents new feature additions from accidentally breaking if gate definition is missing"
  - "estimates.create is intentionally NOT guarded — creating an estimate auto-advances phase to estimating, so blocking create would break the first-estimate auto-advance flow"
  - "estimates.update and estimates.updateLineItem both guarded individually — both are write mutations that would corrupt estimates in Active/later phases"
  - "Phase gate check in change-order.create reuses the existing project query result — no extra DB round-trip"

patterns-established:
  - "Phase-gated feature pattern: add feature key to PHASE_FEATURE_GATES, call isFeatureAvailableInPhase in server guard + UI visibility"
  - "Tab phaseGated flag: parallel to gcOnly, enables both mode-gating and phase-gating in the same filter function"

requirements-completed:
  - LIFE-06

# Metrics
duration: 5min
completed: 2026-02-19
---

# Phase 36 Plan 07: Phase-Conditional Feature Gating Summary

**LIFE-06 phase gates implemented: Change Orders blocked pre-Awarded (server + UI), Estimate editing blocked post-Estimating (server), via shared `isFeatureAvailableInPhase()` helper**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-19T06:00:00Z
- **Completed:** 2026-02-19T06:05:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added `PHASE_FEATURE_GATES` constant and `isFeatureAvailableInPhase()` function to `@construction/shared` — single source of truth for all phase-gated feature logic
- Backend guard on `changeOrder.create`: returns 400 BAD_REQUEST with descriptive message if project is in opportunity/estimating/submitted phase
- Backend guards on `estimates.update` and `estimates.updateLineItem`: return 400 BAD_REQUEST if project is in awarded/active/substantial_completion/closed/warranty/archived phase
- `estimates.create` intentionally unguarded — creating an estimate auto-advances the project to estimating phase
- `ProjectTabs` extended with `lifecyclePhase` prop; Change Orders tab hidden for opportunity/estimating/submitted projects; visible for awarded/active and later

## Task Commits

Each task was committed atomically:

1. **Task 1: Add isFeatureAvailableInPhase helper and backend phase gates** - `af97cd3` (feat)
2. **Task 2: Hide Change Orders tab in pre-Active lifecycle phases** - `3f972b4` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `packages/shared/src/types/project.ts` - Added `PHASE_FEATURE_GATES` constant and `isFeatureAvailableInPhase()` function after existing lifecycle constants
- `packages/shared/src/index.ts` - Exported `PHASE_FEATURE_GATES` and `isFeatureAvailableInPhase` from barrel
- `apps/api/src/trpc/routers/change-order.ts` - Added `isFeatureAvailableInPhase` and `LifecyclePhase` imports; phase gate check after project existence check in `create` mutation
- `apps/api/src/trpc/routers/estimates.ts` - Added `isFeatureAvailableInPhase` and `LifecyclePhase` imports; phase gate checks after ability checks in `update` and `updateLineItem` mutations
- `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx` - Added `lifecyclePhase` prop, imported `isFeatureAvailableInPhase`, added `phaseGated: 'change_orders'` to Change Orders tab definition, updated filter logic
- `apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx` - Passes `lifecyclePhase={project.lifecyclePhase ?? 'opportunity'}` to `<ProjectTabs>`

## Decisions Made
- `PHASE_FEATURE_GATES` uses inclusive lists (which phases the feature IS available in) rather than blocked lists. This makes it easy to extend: as a project lifecycle expands, just add the new phase to the allowed list.
- Unknown feature keys default to `true` (permissive) — adding a new tab or feature won't accidentally block it if no gate is registered yet.
- `estimates.create` is not guarded: the first estimate creation is the trigger for the opportunity→estimating auto-advance. Blocking it would break the auto-advance flow.
- The phase gate check in `changeOrder.create` reuses the project row already fetched for project-existence validation — no additional DB round-trip needed.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors exist in `apps/api/src/trpc/routers/change-order.ts` context (unrelated files: `bid.ts`, `subcontractor.ts`, `estimateLifecycle.ts`, `bidGeneration.ts`). None are caused by Plan 07 changes. Logged to deferred items per deviation scope boundary rules.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 36 plans (01-07) complete. Phase 36 implements the full lifecycle state machine + Simple/GC mode separation for construction project management.
- LIFE-06 completes the last unimplemented lifecycle requirement in Phase 36.
- The `isFeatureAvailableInPhase` helper is available for any future phase-gated feature additions across the codebase.
- Phase 37+ can add new entries to `PHASE_FEATURE_GATES` to gate additional features without writing new guard logic.

---
*Phase: 36-project-lifecycle-state-machine-simple-gc-mode*
*Completed: 2026-02-19*
