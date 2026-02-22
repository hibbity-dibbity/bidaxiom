---
phase: 43-budget-domain-redesign
plan: "01"
subsystem: web/shared-primitives
tags: [shared-components, hooks, tanstack-table, localStorage, column-visibility]
dependency_graph:
  requires: []
  provides:
    - useColumnVisibility hook (localStorage-backed, SSR-safe)
    - ColumnPicker component (gear icon popover, TanStack Table integration)
    - EmptyState component (icon + heading + description + optional CTA)
    - FilterChips component (removable badge chips + Clear all)
  affects:
    - "43-02 through 43-05: all consume these shared primitives"
tech_stack:
  added: []
  patterns:
    - "Lazy useState initializer with typeof window === 'undefined' SSR guard"
    - "useCallback with stable [storageKey] dep prevents infinite re-render loops"
    - "TanStack Table getCanHide() filter prevents showing pinned columns in picker"
    - "FilterChips returns null for empty array — safe always-render pattern"
key_files:
  created:
    - apps/web/hooks/use-column-visibility.ts
    - apps/web/components/shared/column-picker.tsx
    - apps/web/components/shared/empty-state.tsx
    - apps/web/components/shared/filter-chips.tsx
  modified: []
decisions:
  - "FilterChip interface exported from filter-chips.tsx so caller components can import the type without re-declaring it"
  - "ColumnPicker returns null when no hideable columns — safe to render in any context"
  - "storageKey uses col-picker:{tableKey} prefix to prevent cross-table localStorage key collision"
metrics:
  duration: "~2 min"
  completed: "2026-02-22"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 43 Plan 01: Shared Primitives Summary

**One-liner:** localStorage-backed column visibility hook + gear icon column picker popover + empty state + filter chips — 4 shared primitives consumed by all Phase 43 table views.

## What Was Built

Four shared primitives that every table and list view in Phase 43 will consume:

1. **`useColumnVisibility` hook** (`apps/web/hooks/use-column-visibility.ts`) — localStorage-backed column visibility state with SSR hydration safety. Reads stored visibility on mount (lazy initializer), writes on every change via functional `setColumnVisibility` form. `useCallback` with `[storageKey]` dep provides stable callback reference, preventing infinite re-render loops.

2. **`ColumnPicker` component** (`apps/web/components/shared/column-picker.tsx`) — Gear icon (`Settings2`) button that opens a Radix Popover listing only hideable columns (filtered via `col.getCanHide()`). Each column renders as a labeled Checkbox. `align="end"` positions the popover to the left of the icon for top-right toolbar placement. Returns null when no hideable columns exist.

3. **`EmptyState` component** (`apps/web/components/shared/empty-state.tsx`) — Centered layout with icon in muted rounded container, heading, description, and optional CTA button. CTA supports both `href` (renders as Next.js `<Link>`) and `onClick` (renders as plain `<Button>`).

4. **`FilterChips` component** (`apps/web/components/shared/filter-chips.tsx`) — Flex-wrapped row of removable badge chips plus a "Clear all" text link. Exports both `FilterChips` (component) and `FilterChip` (interface). Returns null when `chips.length === 0` — callers can always render it unconditionally.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create useColumnVisibility hook | 3840b73 | apps/web/hooks/use-column-visibility.ts |
| 2 | Create ColumnPicker, EmptyState, FilterChips | 8101710 | apps/web/components/shared/column-picker.tsx, empty-state.tsx, filter-chips.tsx |

## Verification

- All 4 files exist and export their required symbols
- `npx tsc --noEmit -p apps/web/tsconfig.json` reports zero errors for all new files
- No existing files were modified

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: apps/web/hooks/use-column-visibility.ts
- FOUND: apps/web/components/shared/column-picker.tsx
- FOUND: apps/web/components/shared/empty-state.tsx
- FOUND: apps/web/components/shared/filter-chips.tsx
- FOUND commit: 3840b73 (Task 1)
- FOUND commit: 8101710 (Task 2)
