---
phase: 32-flat-design-system
plan: 02
subsystem: ui
tags: [tailwind, css, flat-design, card, design-system]

# Dependency graph
requires:
  - phase: 32-01
    provides: Card primitive flattened — all 59 Card usages flat; hover:bg-muted/50 on interactive cards
provides:
  - Five Tier A custom div panels patched — loading.tsx, settings/page.tsx, settings/activity/page.tsx, custom-trades-list.tsx, calendar-project-sync.tsx
  - Settings landing page Link panels use hover:bg-muted/50 interactive affordance (not hover:shadow)
  - Complete app-wide flat design system — no rounded card/panel, no panel border, no panel shadow anywhere
  - Human-verified: dashboard, project, estimate, settings pages all flat; buttons/inputs/badges unaffected
affects: [all dashboard pages, settings pages, company settings, integrations, estimates]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Flat div panels: remove rounded-lg + border from container divs; keep bg-card, padding, layout"
    - "Interactive link panels: hover:bg-muted/50 transition-colors (not hover:shadow-sm) for flat affordance"
    - "Floating overlays (dropdowns, tooltips, popovers): intentionally kept slightly rounded — they are not card panels"

key-files:
  created: []
  modified:
    - apps/web/app/(dashboard)/loading.tsx
    - apps/web/app/(dashboard)/settings/page.tsx
    - apps/web/app/(dashboard)/settings/activity/page.tsx
    - apps/web/components/company/custom-trades-list.tsx
    - apps/web/components/integrations/calendar-project-sync.tsx

key-decisions:
  - "Tier B table wrappers deferred — not part of DESIGN-01 scope; table rows have their own visual language"
  - "Chart tooltips and floating overlays (dropdowns, popovers) intentionally keep slight rounding — they are floating UI elements, not card panels"
  - "Settings landing page Link panels swap hover:shadow-sm/transition-shadow for hover:bg-muted/50/transition-colors — preserves click affordance in a flat design system"

patterns-established:
  - "Flat panel rule: container divs/Links acting as card sections must not carry rounded-lg, border (outline), or shadow. Padding, background, and layout classes are preserved."
  - "Hover affordance rule: interactive flat panels use hover:bg-muted/50 transition-colors, not shadow lift"

requirements-completed:
  - DESIGN-01

# Metrics
duration: ~15min (including human verification)
completed: 2026-02-18
---

# Phase 32 Plan 02: Flat Design System — Custom Panels Patched Summary

**Five Tier A custom div/Link panels patched flat (rounded-lg + border removed); settings nav panels get hover:bg-muted/50; human verification confirmed full app flat with zero regressions on buttons/inputs/badges**

## Performance

- **Duration:** ~15 min (including human visual verification checkpoint)
- **Started:** 2026-02-18
- **Completed:** 2026-02-18
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 5

## Accomplishments
- Patched all five Tier A custom div panels that bypass the Card primitive — they now match the flat Card appearance established in Plan 01
- Settings landing page Link navigation panels retain click affordance via hover:bg-muted/50 background tint instead of the removed hover:shadow-sm
- Human verification confirmed: dashboard, settings, project, estimate, and company settings pages all show flat cards with no rounded corners, no visible panel borders, no drop shadows — and buttons, inputs, and badges remain visually unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove rounding and border from Tier A custom div panels** - `a23b007` (feat)
2. **Task 2: Human verification checkpoint** - approved by user (no commit — verification outcome)

**Plan metadata:** _(docs commit created at end of this summary)_

## Files Created/Modified

- `apps/web/app/(dashboard)/loading.tsx` - Removed `rounded-lg border` from 2 skeleton panel divs (stats grid items + activity section)
- `apps/web/app/(dashboard)/settings/page.tsx` - Removed `rounded-lg border` from 5 Link navigation panels; replaced `hover:shadow-sm transition-shadow` with `hover:bg-muted/50 transition-colors`
- `apps/web/app/(dashboard)/settings/activity/page.tsx` - Removed `rounded-lg border` from activity feed container div
- `apps/web/components/company/custom-trades-list.tsx` - Removed `rounded-lg border` from individual trade row div (line 163); preserved `flex items-center justify-between` layout classes
- `apps/web/components/integrations/calendar-project-sync.tsx` - Removed `rounded-lg border` from sync panel container div; no bg-card on this element — simply borderless flat section

## Class Changes Applied

| File | Before | After |
|------|--------|-------|
| loading.tsx (×2) | `rounded-lg border bg-card p-6` | `bg-card p-6` |
| settings/page.tsx (×5 Links) | `rounded-lg border bg-card p-6 hover:shadow-sm transition-shadow` | `bg-card p-6 hover:bg-muted/50 transition-colors` |
| settings/activity/page.tsx | `rounded-lg border bg-card p-6` | `bg-card p-6` |
| custom-trades-list.tsx | `flex items-center justify-between rounded-lg border bg-card p-3` | `flex items-center justify-between bg-card p-3` |
| calendar-project-sync.tsx | `rounded-lg border p-4 space-y-4` | `p-4 space-y-4` |

## Decisions Made

- **Tier B table wrappers deferred:** Table row wrappers and data table containers were identified in research but are not part of DESIGN-01 scope. They have their own visual language and were intentionally left unchanged.
- **Chart tooltips and floating overlays kept rounded:** Dropdown menus, popover panels, combobox dropdowns, and chart tooltips are floating UI elements — not card sections. Their slight rounding is intentional and was not modified.
- **hover:bg-muted/50 for Link panels:** The settings page Link panels are clickable navigation cards. Removing hover:shadow-sm while switching to hover:bg-muted/50 transition-colors preserves the click affordance in a fully flat design system.

## Deviations from Plan

None — plan executed exactly as written. All class changes matched the specified before/after pairs. TypeScript introduced no new errors.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Human Verification Outcome

User verified all six checklist items and typed "approved":

1. Dashboard KPI cards: sharp corners, no border, no shadow; hover shows background tint (not shadow lift)
2. Settings landing page: five navigation panels flat, no border; hover shows bg-muted/50 tint
3. Project page: all budget/summary/RFQ cards flat
4. Estimate page: WorkflowStepContainer, MarkupConfig, SOV cards flat
5. Settings > Company Profile: custom trade rows flat, no border box per row
6. Regressions check: buttons retain ~4px rounding + shadow-sm; inputs retain rounding; badges retain rounding; dropdowns/popovers still slightly rounded

## Next Phase Readiness

- Phase 32 is complete. The flat design system is fully applied app-wide — Card primitive (Plan 01) + all five Tier A custom panels (Plan 02).
- v1.4 Rebranding & UX Upgrades: flat design system milestone done. Next v1.4 work can proceed to other roadmap items.
- No blockers introduced by this phase.

## Self-Check: PASSED

- FOUND: `.planning/phases/32-flat-design-system/32-02-SUMMARY.md`
- FOUND: commit `a23b007` (feat(32-02): remove rounding/border from five Tier A custom div panels)

---
*Phase: 32-flat-design-system*
*Completed: 2026-02-18*
