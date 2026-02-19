---
phase: 36-project-lifecycle-state-machine-simple-gc-mode
plan: "04"
subsystem: web-frontend
tags: [lifecycle, state-machine, react, trpc, shadcn, badge, popover, alert-dialog]

dependency_graph:
  requires:
    - phase: 36-01
      provides: LifecyclePhase, LIFECYCLE_ORDER, LIFECYCLE_PHASE_LABELS from @construction/shared
    - phase: 36-03
      provides: transitionLifecyclePhase, getTransitionHistory tRPC procedures
  provides:
    - LifecyclePhaseBadge component with Popover phase list + AlertDialog confirm/reason UX
    - TransitionHistory component querying getTransitionHistory feed
    - Updated ProjectHeader with lifecycle phase badge and mode badge; no more statusColors/ProjectStatus
    - Updated layout.tsx passing lifecyclePhase, projectMode, canTransition to ProjectHeader
    - Lifecycle History card on project overview page
  affects:
    - apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/page.tsx

tech_stack:
  added: []
  patterns:
    - Popover + AlertDialog composition for multi-step interactive badge (click badge -> phase list -> confirm dialog)
    - canTransition client-side guard: orgRole===org:admin OR project team role is estimator/project_administrator
    - Separate AlertDialog from Popover; Popover closes before AlertDialog opens to avoid nesting issues
    - formatDistanceToNow from date-fns for human-readable transition timestamps

key_files:
  created:
    - apps/web/app/(dashboard)/projects/[projectSlug]/components/lifecycle-phase-badge.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/components/transition-history.tsx
  modified:
    - apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/page.tsx

decisions:
  - "canTransition check in layout.tsx uses orgRole===org:admin OR project team estimator/project_administrator; API still enforces full RBAC regardless"
  - "AlertDialog is rendered outside Popover (as sibling) to prevent React portal nesting conflicts"
  - "Popover closes (setOpen(false)) before setting pendingPhase so AlertDialog opens cleanly"
  - "TransitionHistory placed as standalone Lifecycle History card at bottom of project overview, not a separate tab"
  - "ProjectHeader status prop removed entirely; replaced with lifecyclePhase + projectMode; statusColors const removed"

metrics:
  duration: "4 minutes"
  completed: "2026-02-19"
  tasks_completed: 2
  files_modified: 5
---

# Phase 36 Plan 04: Lifecycle Phase Badge and Transition History UI Summary

**One-liner:** Color-coded interactive LifecyclePhaseBadge with 9-phase Popover selector and AlertDialog confirmation, plus TransitionHistory feed, wired into the project header and overview page.

## What Was Built

### lifecycle-phase-badge.tsx

- `"use client"` component with `phaseColors` record mapping all 9 `LifecyclePhase` values to distinct Tailwind color classes (purple, blue, cyan, emerald, green, teal, gray, orange, slate)
- Props: `projectId`, `projectSlug`, `currentPhase: LifecyclePhase`, `canTransition: boolean`
- When `canTransition=true`: Badge wrapped in `<Popover>` trigger showing all 9 phases as buttons; current phase is disabled
- Clicking a forward phase: opens `<AlertDialog>` with simple "Advance to X?" confirmation
- Clicking a backward phase: opens `<AlertDialog>` with required `<Textarea>` reason input; Confirm button disabled until `reason.trim() !== ""`
- On mutation success: invalidates `getBySlug`, `list`, and `getTransitionHistory`; shows `sonner` toast
- When `canTransition=false`: renders static Badge with no Popover trigger

### transition-history.tsx

- `"use client"` component querying `trpc.project.getTransitionHistory`
- Displays timeline-style list with phase-from → phase-to labels from `LIFECYCLE_PHASE_LABELS`
- Shows `(auto: eventSource)` label for system-triggered transitions
- Shows reason text for backward transitions
- Uses `formatDistanceToNow` from `date-fns` for human-readable timestamps

### project-header.tsx

- Removed `statusColors` const and `ProjectStatus` import
- `ProjectHeaderProps.project` now has `lifecyclePhase: string` and `projectMode: string` (not `status: ProjectStatus`)
- Added `canTransition: boolean` prop
- Renders `<LifecyclePhaseBadge>` in place of old status badge
- Renders a small read-only mode badge: "Simple" or "GC/Advanced"

### layout.tsx

- Imports `useAuth` to read `orgRole` and `userId`
- Computes `canTransition`: `org:admin` → true; otherwise checks `project.teamMembers` for `estimator` or `project_administrator` role match by `userId`
- Passes `lifecyclePhase`, `projectMode`, and `canTransition` to `ProjectHeader`

### page.tsx (project overview)

- Removed `ProjectStatus` import; added `TransitionHistory` import
- Added "Lifecycle History" `<Card>` section at the bottom of the overview page
- `<TransitionHistory projectId={projectId} />` renders inside the card

## Task Commits

1. **Task 1: Create LifecyclePhaseBadge and TransitionHistory components** - `762fce6`
2. **Task 2: Update ProjectHeader and project overview page to use lifecycle components** - `40a96cf`

## Deviations from Plan

None - plan executed exactly as written.

The one implementation choice worth noting: the plan mentioned placing `ProjectHeader` updates in both `project-header.tsx` AND `page.tsx`. The actual project structure uses `layout.tsx` as the shell that renders `ProjectHeader` — not `page.tsx`. The layout was updated to pass the new props. This is architecturally correct (layout provides persistent header across all sub-pages) and was recognized from code inspection before writing.

## Self-Check: PASSED

Files verified:
- FOUND: apps/web/app/(dashboard)/projects/[projectSlug]/components/lifecycle-phase-badge.tsx
- FOUND: apps/web/app/(dashboard)/projects/[projectSlug]/components/transition-history.tsx
- FOUND: apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx (modified)
- FOUND: apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx (modified)
- FOUND: apps/web/app/(dashboard)/projects/[projectSlug]/page.tsx (modified)

Commits verified:
- FOUND: 762fce6 (Task 1 - lifecycle-phase-badge + transition-history)
- FOUND: 40a96cf (Task 2 - project-header + layout + page)

TypeScript: Zero errors in all modified files. Pre-existing errors in unrelated files are unchanged.
