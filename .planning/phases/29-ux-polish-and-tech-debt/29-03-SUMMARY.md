---
phase: 29-ux-polish-and-tech-debt
plan: "03"
subsystem: ui
tags: [react, lucide-react, skeleton, empty-states, ux]

# Dependency graph
requires:
  - phase: 19-component-library-architecture
    provides: established empty state pattern (icon + heading + description + CTA)
provides:
  - Polished empty states in change-order-list, commitment-list, payment-app-list
  - Skeleton loading rows in members page (members and invitations sections)
  - Upgraded members/invitations empty states with icon + heading + description
affects: [29-ux-polish-and-tech-debt, any future list components]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Empty state pattern: rounded icon container (bg-muted p-3 rounded-full) + h3 heading + sm muted description + optional CTA"
    - "Filter-active empty state: simpler text-only message, no icon"
    - "Skeleton rows for loading: Array.from({ length: N }).map() with Skeleton h-14 w-full"

key-files:
  created: []
  modified:
    - apps/web/components/change-order/change-order-list.tsx
    - apps/web/components/budget/commitment-list.tsx
    - apps/web/components/payment-app/payment-app-list.tsx
    - apps/web/app/(dashboard)/settings/members/page.tsx

key-decisions:
  - "commitment-list empty state omits CTA button (no create button exists in the current UI — consistent with existing flow)"
  - "payment-app-list empty state CTA is conditional on hasSovItems — when no SOV, description explains prerequisite instead"
  - "members empty state invite CTA focuses the email input field via document.getElementById rather than duplicating invite form"
  - "filter-active empty states retain text-only fallback — no icon needed when list is non-empty but filtered to zero"

patterns-established:
  - "Empty state pattern: <div className='text-center py-12 border rounded-lg border-dashed'> wrapping flex-col items-center gap-3 with icon container, heading div, optional Button"
  - "Skeleton loading rows: Array.from({ length: N }).map((_, i) => <Skeleton key={i} className='h-14 w-full' />)"

requirements-completed:
  - UX-01
  - UX-02

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 29 Plan 03: UX Polish — Empty States and Skeleton Loading Summary

**Four components upgraded with icon+heading+description empty states and Skeleton loading rows replacing bare text placeholders**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-17T00:16:31Z
- **Completed:** 2026-02-17T00:20:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- change-order-list: FilePlus icon + heading + description + New Change Order CTA button in unfiltered empty state; filter-active keeps simple text
- commitment-list: FileText icon + heading + description (no CTA — no create button in existing UI)
- payment-app-list: Receipt icon + heading + conditional description + conditional New Payment Application CTA (only when hasSovItems)
- members/page: 3 Skeleton rows replace "Loading members..." text; 2 Skeleton rows replace "Loading invitations..." text
- members/page: Users icon + heading + description + conditional Invite Member CTA (admin only) for empty members state
- members/page: UserPlus icon + heading + description for empty invitations state

## Task Commits

1. **Task 1: Upgrade empty states in change-order-list, commitment-list, payment-app-list** - `819c1e3` (feat)
2. **Task 2: Add skeleton loading and upgraded empty states to settings/members page** - `65848e8` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/web/components/change-order/change-order-list.tsx` - Added FilePlus import; upgraded empty state with icon + heading + description + CTA; split filter-active and no-filter paths
- `apps/web/components/budget/commitment-list.tsx` - Added FileText import; upgraded empty state with icon + heading + description (no CTA)
- `apps/web/components/payment-app/payment-app-list.tsx` - Added Receipt import; replaced bare Card empty state with icon + heading + conditional description + conditional CTA
- `apps/web/app/(dashboard)/settings/members/page.tsx` - Added Skeleton import and Users icon; replaced text loading states with Skeleton rows; upgraded both empty states

## Decisions Made

- commitment-list omits CTA button: no "create commitment" flow exists in current UI, adding one would be out of scope
- payment-app-list empty state CTA is gated on hasSovItems: when SOV is not set up, the description explains the prerequisite and no button is shown (matches existing disabled-button behavior at top of page)
- Members invite CTA scrolls/focuses the email input (`document.getElementById("email")?.focus()`) rather than duplicating the invite form
- Filter-active empty states stay text-only — icon pattern is for true empty states, not filtered-to-zero states

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Pre-existing TypeScript errors in apps/api (quickbooks oauth, bid router, customer router) are unrelated to this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four components now follow the established empty state pattern from Phase 19
- Pattern is ready for extraction to a shared `<EmptyState>` component if usage grows further (Phase 19 decision: extract at 3+ uses)
- Phase 29 remaining plans can proceed

---
*Phase: 29-ux-polish-and-tech-debt*
*Completed: 2026-02-17*
