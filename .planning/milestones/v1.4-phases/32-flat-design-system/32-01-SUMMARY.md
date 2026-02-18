---
phase: 32-flat-design-system
plan: 01
subsystem: ui
tags: [tailwind, card, shadcn, flat-design, hover-states]

# Dependency graph
requires:
  - phase: 31-color-palette-favicon
    provides: Brand colors (--primary cyan-teal) already wired; hover:bg-muted/50 uses muted CSS var from globals.css
provides:
  - Flat Card primitive — rounded-xl, border, shadow removed; all 59 consumers inherit automatically
  - hover:bg-muted/50 transition-colors affordance on all interactive clickable cards
affects: [33-flat-design-system, any phase adding new Card usage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Flat card: Card base class = bg-card text-card-foreground (no rounding, border, shadow)"
    - "Interactive card affordance: hover:bg-muted/50 transition-colors (not shadow-based)"

key-files:
  created: []
  modified:
    - apps/web/components/ui/card.tsx
    - apps/web/components/dashboard/kpi-card.tsx
    - apps/web/components/reports/report-list.tsx
    - apps/web/components/bidding/bid-card.tsx
    - apps/web/app/(dashboard)/reports/templates/page.tsx
    - apps/web/app/(dashboard)/customers/[customerSlug]/page.tsx

key-decisions:
  - "Card base class: remove rounded-xl, border, shadow entirely — do NOT add rounded-none/shadow-none/border-none (removing classes avoids specificity problems)"
  - "Interactive hover affordance: hover:bg-muted/50 transition-colors replaces hover:shadow-sm/hover:shadow-md transition-shadow on all clickable cards"
  - "--radius variable in globals.css left untouched at 0.25rem so buttons, inputs, badges retain their rounded-md/rounded-lg styling"

patterns-established:
  - "Flat card pattern: bg-card text-card-foreground (no elevation tokens)"
  - "Clickable card pattern: hover:bg-muted/50 transition-colors cursor-pointer"

requirements-completed: [DESIGN-01]

# Metrics
duration: 5min
completed: 2026-02-18
---

# Phase 32 Plan 01: Flat Card Primitive Summary

**Card primitive flattened from "rounded-xl border bg-card text-card-foreground shadow" to "bg-card text-card-foreground", with hover:bg-muted/50 background-tint affordance replacing shadow-based hover on all five interactive card call sites**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-18T15:24:39Z
- **Completed:** 2026-02-18T15:30:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- card.tsx base class stripped of rounded-xl, border, and shadow — all 59 Card consumers automatically inherit flat styling with zero per-file changes
- Five interactive card call sites patched: hover:shadow-sm/hover:shadow-md → hover:bg-muted/50 and transition-shadow → transition-colors
- button.tsx, input.tsx, badge.tsx, select.tsx confirmed untouched; --radius remains at 0.25rem

## Task Commits

Each task was committed atomically:

1. **Task 1: Flatten the Card primitive in card.tsx** - `a9471de` (feat)
2. **Task 2: Replace hover shadows with background affordance on interactive cards** - `0172bce` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `apps/web/components/ui/card.tsx` - Base class changed from "rounded-xl border bg-card text-card-foreground shadow" to "bg-card text-card-foreground"
- `apps/web/components/dashboard/kpi-card.tsx` - hover:shadow-sm → hover:bg-muted/50, transition-shadow → transition-colors
- `apps/web/components/reports/report-list.tsx` - hover:shadow-md → hover:bg-muted/50, transition-shadow → transition-colors
- `apps/web/components/bidding/bid-card.tsx` - hover:shadow-md → hover:bg-muted/50, transition-shadow → transition-colors (hover:border-primary conditional preserved)
- `apps/web/app/(dashboard)/reports/templates/page.tsx` - hover:shadow-md → hover:bg-muted/50, transition-shadow → transition-colors
- `apps/web/app/(dashboard)/customers/[customerSlug]/page.tsx` - hover:shadow-md → hover:bg-muted/50, transition-shadow → transition-colors

## Decisions Made
- Removed shadow/border/rounded-xl tokens entirely from card.tsx rather than adding overrides (rounded-none etc.) to avoid CSS specificity problems
- hover:bg-muted/50 chosen as interactive affordance over shadow — consistent with flat design system goal; uses existing muted CSS variable from v1.4 palette

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in workflow-detail.tsx and lib/session.ts noted during verification; confirmed out of scope (no connection to card.tsx changes, existed before this plan)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Flat card primitive live across all 59 consumers; any new Card added to codebase is automatically flat
- Interactive pattern established: hover:bg-muted/50 transition-colors for clickable cards
- Phase 32 Plan 02 can proceed immediately

---
*Phase: 32-flat-design-system*
*Completed: 2026-02-18*

## Self-Check: PASSED

- FOUND: apps/web/components/ui/card.tsx
- FOUND: apps/web/components/dashboard/kpi-card.tsx
- FOUND: .planning/phases/32-flat-design-system/32-01-SUMMARY.md
- FOUND: commit a9471de (feat: flatten Card primitive)
- FOUND: commit 0172bce (feat: replace hover:shadow-* on interactive cards)
