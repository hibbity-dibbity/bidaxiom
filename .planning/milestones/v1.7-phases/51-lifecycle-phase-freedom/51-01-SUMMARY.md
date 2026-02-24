---
phase: 51-lifecycle-phase-freedom
plan: "01"
subsystem: project-lifecycle
tags: [lifecycle, phase-transition, trpc, react, ux]
dependency_graph:
  requires: []
  provides: [unconstrained-lifecycle-transitions]
  affects: [project.ts, lifecycle-phase-badge.tsx]
tech_stack:
  added: []
  patterns: [optimistic-update, pending-spinner, direct-mutation]
key_files:
  created: []
  modified:
    - apps/api/src/trpc/routers/project.ts
    - apps/web/app/(dashboard)/projects/[projectSlug]/components/lifecycle-phase-badge.tsx
decisions:
  - "No success toast on phase transition — badge update is the confirmation"
  - "Optimistic update pattern: badge shows target phase immediately, reverts on error"
  - "reason field kept on input schema — optional, harmless, passed as undefined"
metrics:
  duration: "~3 min"
  completed: "2026-02-24"
  tasks_completed: 2
  files_modified: 2
---

# Phase 51 Plan 01: Lifecycle Phase Freedom Summary

**One-liner:** Removed isValidTransition guard and AlertDialog backward-transition interception — all phase changes now fire immediately with optimistic update and Loader2 pending spinner.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Remove isValidTransition guard from tRPC router | d130484 | apps/api/src/trpc/routers/project.ts |
| 2 | Remove AlertDialog + add optimistic update + pending spinner | 567d3da | apps/web/app/(dashboard)/projects/[projectSlug]/components/lifecycle-phase-badge.tsx |

## What Was Built

**Task 1 — API router change:**
- Removed the `isValidTransition(...)` call from `transitionLifecyclePhase` mutation body
- Updated the import from `{ isValidTransition, tryAutoAdvance }` to `{ tryAutoAdvance }` only
- The `isBackward` computation (fromIdx/toIdx) was preserved — it is used in the audit log metadata
- The mutation now flows: RBAC check → DB transaction → audit log, with no phase validation gate

**Task 2 — Badge component rewrite:**
- Removed: `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle` imports
- Removed: `Textarea` import
- Removed: `pendingPhase`, `isBackward`, `reason` state variables
- Removed: `handleConfirm` function
- Removed: backward-transition branching logic in `handlePhaseClick`
- Added: `Loader2` import from lucide-react
- Added: `onMutate` optimistic update — badge shows target phase instantly, stores snapshot for rollback
- Added: `onError` — restores previous data from context snapshot, shows error toast
- Added: `onSettled` — invalidates getBySlug, list, getTransitionHistory queries
- `handlePhaseClick` now calls `transitionMutation.mutate` directly for all phases without branching
- Badge renders `Loader2` spinner + `opacity-60` while `transitionMutation.isPending`
- No `onSuccess` handler — no success toast

## Decisions Made

1. **No success toast** — badge update is the confirmation; visual feedback is immediate via optimistic update
2. **reason field preserved on schema** — optional, passed as `undefined` from badge, harmless to leave
3. **isBackward variable kept in router** — still needed for audit log metadata, costs nothing to keep

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- `apps/api/src/trpc/routers/project.ts` — FOUND, `isValidTransition` zero matches confirmed
- `apps/web/app/(dashboard)/projects/[projectSlug]/components/lifecycle-phase-badge.tsx` — FOUND, AlertDialog/pendingPhase/handleConfirm/toast.success zero matches confirmed

Commits verified:
- d130484 — FOUND
- 567d3da — FOUND
