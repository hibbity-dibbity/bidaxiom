---
phase: 42-shared-ui-primitives
plan: 01
subsystem: ui
tags: [status-badge, cva, design-tokens, financial-tokens, tailwind]

# Dependency graph
requires:
  - phase: 41-design-token-foundation
    provides: financial tokens (text-financial-positive, text-financial-pending, text-financial-negative) established in tailwind.config.ts
provides:
  - 4-tier semantic StatusBadge with active=green (text-financial-positive) enforced
  - Deleted lifecycle/StatusBadge.tsx wrapper — estimate detail page uses shared badge directly
affects:
  - 43-budget-domain-redesign
  - 44-payment-applications-domain
  - 45-commitments-domain
  - 46-rfq-bidding-domain

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "4-tier StatusBadge: GRAY (draft/cancelled), AMBER (pending/warning), GREEN (active/approved/completed), RED (rejected/error)"
    - "Domain variant maps: local estimateVariantMap/estimateLabelMap constants at call site instead of domain wrapper components"

key-files:
  created: []
  modified:
    - apps/web/components/shared/status-badge.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/page.tsx
    - apps/web/COMPONENT-ORGANIZATION.md
  deleted:
    - apps/web/components/estimates/lifecycle/StatusBadge.tsx

key-decisions:
  - "active variant maps to GREEN tier (text-financial-positive), same tier as approved/completed — not brand-blue (text-primary)"
  - "Lifecycle domain wrapper components (StatusBadge.tsx) deleted; call sites hold local variant/label maps instead"

patterns-established:
  - "StatusBadge 4-tier model: select variant by semantic meaning (active=green), not domain name — label is explicit children, not derived from status string"
  - "Domain variant maps as module-level constants before component definition, not inline in JSX"

requirements-completed:
  - VISUAL-01
  - VISUAL-02

# Metrics
duration: 4min
completed: 2026-02-22
---

# Phase 42 Plan 01: Shared UI Primitives — Status Badge Consolidation Summary

**StatusBadge `active` variant fixed to green (text-financial-positive), lifecycle wrapper deleted, estimate detail page migrated to shared badge with local variant map**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T05:10:11Z
- **Completed:** 2026-02-22T05:14:00Z
- **Tasks:** 2
- **Files modified:** 3 (+ 1 deleted)

## Accomplishments
- Fixed `active` CVA variant from `bg-primary/10 text-primary` (brand blue) to `bg-muted text-financial-positive` (green) — enforcing the 4-tier semantic model
- Updated JSDoc to document GRAY/AMBER/GREEN/RED 4-tier model replacing per-variant prose descriptions
- Deleted `apps/web/components/estimates/lifecycle/StatusBadge.tsx` — a thin wrapper with no value
- Migrated estimate detail page to use shared StatusBadge directly with local `estimateVariantMap` and `estimateLabelMap` constants

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix active variant and update 4-tier semantics in status-badge.tsx** - `6b453e6` (fix)
2. **Task 2: Delete lifecycle StatusBadge and update its call site in estimate detail page** - `aee11a9` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `apps/web/components/shared/status-badge.tsx` - active variant: bg-muted text-financial-positive; JSDoc updated with 4-tier model
- `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/page.tsx` - imports from shared/status-badge, variant+label maps added, StatusBadge uses variant+children pattern
- `apps/web/COMPONENT-ORGANIZATION.md` - stale reference to deleted file marked as deleted
- `apps/web/components/estimates/lifecycle/StatusBadge.tsx` - DELETED

## Decisions Made
- `active` variant maps to GREEN tier same as `approved` and `completed` — aligns with the design intent that active/operational states signal positive progress, not brand identity
- Domain wrapper components like `lifecycle/StatusBadge.tsx` are eliminated; call sites own their own variant and label maps as module-level constants — this is lighter and more explicit than wrapper components

## Deviations from Plan

None - plan executed exactly as written.

(Minor: `rm` on Windows bash did not delete the file; required PowerShell `Remove-Item` — tool-level issue, not a plan deviation.)

## Issues Encountered
- Windows bash `rm` command silently failed to delete the file; resolved by using `powershell Remove-Item -Force` instead. File confirmed deleted on second verification pass.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All `variant="active"` usages now render green across the app — payment app paid status, commitment executed, project active/substantial_completion, RFQ issued all inherit correct semantics
- Domain phases 43-46 will audit and correct their own variant mappings; the shared badge now enforces the correct color for each tier
- No blockers introduced

## Self-Check: PASSED

- status-badge.tsx: FOUND
- Estimate detail page: FOUND
- lifecycle/StatusBadge.tsx: DELETED (correct)
- Commit 6b453e6: FOUND
- Commit aee11a9: FOUND
- 42-01-SUMMARY.md: FOUND

---
*Phase: 42-shared-ui-primitives*
*Completed: 2026-02-22*
