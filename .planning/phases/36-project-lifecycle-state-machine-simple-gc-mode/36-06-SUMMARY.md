---
phase: 36-project-lifecycle-state-machine-simple-gc-mode
plan: 06
subsystem: ui
tags: [react, nextjs, trpc, mode-gating, estimates, payment-apps]

# Dependency graph
requires:
  - phase: 36-project-lifecycle-state-machine-simple-gc-mode
    plan: 03
    provides: projectMode field on getBySlug response + setMode mutation
  - phase: 36-project-lifecycle-state-machine-simple-gc-mode
    plan: 04
    provides: canTransition flag in project layout

provides:
  - ProjectTabs filters SOV and RFQs tabs when projectMode is simple (8 tabs visible)
  - ProjectTabs shows all 10 tabs when projectMode is gc_advanced
  - ProjectHeader shows mode switch button for authorized users (canTransition)
  - EstimateLineItemsTable shows Billing Category dropdown in Simple mode instead of CSI Code column
  - Payment app detail page hides Lien Waivers tab in Simple mode

affects:
  - estimates
  - payment-apps
  - project-navigation

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mode-gating via projectMode prop: passed from layout, consumed by child components"
    - "useParams() in EstimateLineItemsTable to self-resolve projectSlug for cached getBySlug query"
    - "Conditional column rendering in TanStack Table by swapping column definition array"

key-files:
  created: []
  modified:
    - apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx
    - apps/web/components/estimates/line-items/EstimateLineItemsTable.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/[paymentAppId]/page.tsx

key-decisions:
  - "EstimateLineItemsTable uses useParams() to self-resolve projectSlug rather than threading projectMode through WorkflowStepContainer and LineItemsStep — avoids cascading prop changes through 3 layers"
  - "Billing Category dropdown is display-only (no persistence) in Phase 36 — billingCategory DB column deferred to Phase 37+"
  - "Mode switch button placed in ProjectHeader (next to mode badge) rather than layout.tsx — keeps the mutation co-located with the badge it modifies"
  - "billingCategoryColumn defined as columnHelper.display (not accessor) since no DB field exists yet"

patterns-established:
  - "Mode-aware component pattern: pass projectMode as prop from layout, filter/swap UI elements based on value"
  - "gcOnly flag on tab definition objects enables declarative filtering without if/else chains"

requirements-completed:
  - MODE-02
  - MODE-03

# Metrics
duration: 4min
completed: 2026-02-19
---

# Phase 36 Plan 06: Simple Mode UI Gating Summary

**Mode-based UI gating: GC-only tabs hidden in Simple mode, Billing Category dropdown replaces CSI columns in estimates, Lien Waivers tab hidden in payment apps**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-19T05:45:49Z
- **Completed:** 2026-02-19T05:49:47Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- ProjectTabs now accepts `projectMode` prop and filters the SOV and RFQs tabs when mode is `simple`, showing 8 tabs instead of 10
- ProjectHeader gains an inline "Switch to Simple / Switch to GC/Advanced" text button for authorized users (uses `setMode` mutation with cache invalidation)
- EstimateLineItemsTable swaps the CSI Code column for a Billing Category dropdown (Labor, Materials, Subcontractors, Equipment, Other) when project is in Simple mode
- Payment app detail page conditionally renders the Lien Waivers tab trigger and content only when `projectMode !== 'simple'`

## Task Commits

Each task was committed atomically:

1. **Task 1: Make ProjectTabs mode-aware and add mode switch button** - `f7f90ec` (feat)
2. **Task 2: Billing category column in estimates + hide lien waivers** - `102239c` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx` - Added `projectMode` prop; ALL_SECTIONS array with `gcOnly` flag; filter function to hide GC-only tabs in Simple mode
- `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx` - Added `setMode` mutation and inline mode switch button visible to authorized users
- `apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx` - Passes `projectMode` to `<ProjectTabs>` component
- `apps/web/components/estimates/line-items/EstimateLineItemsTable.tsx` - Added optional `projectMode` prop; uses `useParams()` + cached `getBySlug` query as fallback; swaps CSI Code column for Billing Category dropdown in Simple mode
- `apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/[paymentAppId]/page.tsx` - Hides Lien Waivers TabsTrigger and TabsContent when `project.projectMode === 'simple'`

## Decisions Made
- EstimateLineItemsTable self-resolves `projectMode` via `useParams()` + cached `getBySlug` query instead of threading prop through WorkflowStepContainer/LineItemsStep. Avoids cascading prop changes through 3 layers; `getBySlug` is already in React Query cache from the project layout.
- Billing Category dropdown in Phase 36 is display-only (no persistence). The `billing_category` DB column is deferred to Phase 37+ as noted in the plan.
- Mode switch button in `ProjectHeader` next to the mode badge keeps the mutation co-located with the UI element it affects.

## Deviations from Plan

None — plan executed exactly as written. The plan explicitly noted that billing_category persistence is Phase 37+.

## Issues Encountered
- Pre-existing TypeScript errors in `project-tabs.tsx` (lines 84-85): `utils.invoice` doesn't exist in the tRPC router (the router is named `invoiceTracking`). This existed before Plan 06 and is out of scope per deviation rules. Logged to deferred items.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Mode-based UI gating is fully operational for Simple vs GC/Advanced split
- All three gating surfaces implemented: navigation tabs, estimates line items column, payment app lien waivers tab
- Phase 36 visual/functional work is complete — all plans 01-06 done
- Billing Category persistence (DB column + update mutation) is ready to plan for Phase 37+

---
*Phase: 36-project-lifecycle-state-machine-simple-gc-mode*
*Completed: 2026-02-19*
