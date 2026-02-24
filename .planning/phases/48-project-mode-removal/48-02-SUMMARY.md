---
phase: 48-project-mode-removal
plan: 02
subsystem: ui
tags: [react, nextjs, trpc, project-mode, forms]

# Dependency graph
requires:
  - phase: 48-01
    provides: Schema and API mode field preserved; UI removal plan finalized
provides:
  - project-header.tsx with no mode badge or mode-switch menu
  - project-form.tsx with no Project Mode selector; defaultValues.projectMode set to simple
  - Overview page.tsx with no Budget, SOV, Payment Apps, Retainage, or RFQs cards
  - payment-apps/[paymentAppId]/page.tsx with no lien waiver conditional tabs
  - EstimateLineItemsTable.tsx with simple-mode fallback instead of gc_advanced
affects: [phase-49, phase-50, estimates-workflow, payment-apps-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx
    - apps/web/components/project/project-form.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/[paymentAppId]/page.tsx
    - apps/web/components/estimates/line-items/EstimateLineItemsTable.tsx

key-decisions:
  - "setModeMutation, handleModeSwitch function, and projectMode prop retained as dead code in project-header.tsx per Phase 48 contract (no deleting underlying code)"
  - "DollarSign and Edit Lucide icons removed from Overview page imports — only used by removed cards"
  - "LienWaiverTracker import preserved in payment-apps detail page even though render is removed — per keep-underlying-code contract"

patterns-established: []

requirements-completed:
  - MODE-01
  - MODE-02

# Metrics
duration: 3min
completed: 2026-02-24
---

# Phase 48 Plan 02: Project Mode Removal (UI) Summary

**Mode badge, mode-switch menu, Project Mode form field, 5 GC CTA overview cards, lien waiver tabs, and gc_advanced estimate fallback removed from 5 web files — new projects default to simple mode**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-24T01:03:53Z
- **Completed:** 2026-02-24T01:07:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Project header no longer displays a mode badge (Simple/GC Advanced label gone)
- Project header 3-dot ellipsis menu now contains only "Delete project" (mode-switch item removed)
- Project creation form no longer shows a "Project Mode" selector; all new projects submit `projectMode: "simple"`
- Overview page no longer shows Budget, SOV, Payment Apps, Retainage, or RFQs cards — and their 5 tRPC query hooks are removed
- Payment app detail page has no lien waiver tab trigger or content
- EstimateLineItemsTable resolvedProjectMode fallback changed from `gc_advanced` to `simple`

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove mode badge and mode-switch menu item from project-header.tsx** - `83c9888` (feat)
2. **Task 2: Hide Project Mode field and fix default in project-form.tsx** - `4333c58` (feat)
3. **Task 3: Remove GC CTA cards from Overview page and clean in-tab mode conditionals** - `b06fa47` (feat)

**Plan metadata:** (docs commit — see state update)

## Files Created/Modified
- `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx` - Removed Badge mode label (lines 124-126) and DropdownMenuItem for mode switching (lines 136-145)
- `apps/web/components/project/project-form.tsx` - Changed defaultValues.projectMode to "simple"; removed 25-line Project Mode FormField block
- `apps/web/app/(dashboard)/projects/[projectSlug]/page.tsx` - Removed 5 tRPC query hooks and 5 GC CTA Card elements; removed unused DollarSign and Edit imports
- `apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/[paymentAppId]/page.tsx` - Removed isSimpleMode variable, TabsTrigger lien-waivers conditional, TabsContent lien-waivers conditional
- `apps/web/components/estimates/line-items/EstimateLineItemsTable.tsx` - Changed resolvedProjectMode fallback from "gc_advanced" to "simple"

## Decisions Made
- setModeMutation, handleModeSwitch, and projectMode prop kept as dead code in project-header.tsx per the Phase 48 contract (GC/Advanced data and code preserved; only UI access points removed)
- LienWaiverTracker import retained in payment-apps detail page for the same reason
- DollarSign and Edit Lucide imports removed from Overview page.tsx since they had no remaining usages after card removal (clean-up within task scope)

## Deviations from Plan

None - plan executed exactly as written. The DollarSign/Edit import removal was within scope of Task 3's cleanup instruction ("check for now-unused imports").

## Issues Encountered
- Pre-existing TypeScript error in project-form.tsx line 191 (`address` field not in customer form type) was confirmed pre-existing via git stash check and is not caused by this plan's changes. No new errors introduced.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 mode-related UI surfaces removed from the web app
- Underlying API endpoints, DB columns, and TypeScript types for projectMode remain intact
- Phase 49 can proceed with confidence that no user-visible mode controls remain
- No blockers

---
*Phase: 48-project-mode-removal*
*Completed: 2026-02-24*

## Self-Check: PASSED

- All 5 modified files: FOUND
- SUMMARY.md: FOUND
- Commit 83c9888 (Task 1): FOUND
- Commit 4333c58 (Task 2): FOUND
- Commit b06fa47 (Task 3): FOUND
