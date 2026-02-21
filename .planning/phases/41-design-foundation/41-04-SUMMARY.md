---
phase: 41-design-foundation
plan: 04
subsystem: ui
tags: [design-tokens, tailwind, css-variables, financial-tokens, budget, dark-mode]

# Dependency graph
requires:
  - phase: 41-01
    provides: Financial CSS tokens (text-financial-positive/negative/pending) defined in tailwind.config.ts

provides:
  - 6 budget components fully migrated to CSS variable tokens
  - budget-summary-cards: EAC/budget amounts use text-primary, committed uses text-financial-pending, variances use text-financial-positive/negative
  - forecast-metrics: CPI card backgrounds use bg-muted (not bg-green-50/amber-50/red-50), CPI numbers use text-financial-positive/negative/pending
  - budget-variance-chart: tooltip financial values use text-primary/text-financial-pending/positive/negative
  - commitment-form: all validation errors use text-destructive
  - commitment-list: status badges replaced with StatusBadge component
  - budget-line-item-table: lock/unlock icons use text-financial-negative/positive

affects:
  - Phase 43 (Budget Domain Redesign) — token patterns established here should be preserved
  - Any future budget-related components

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Financial token migration: text-blue-600 → text-primary for primary metric values, text-amber-600 → text-financial-pending for committed/in-progress amounts"
    - "CPI card pattern: getCpiColor returns mixed string (text-color + border-border + bg-muted) — keeps concerns together while staying token-compliant"
    - "StatusBadge with statusVariants Record maps domain enums (CommitmentStatus) to StatusBadge variant strings"
    - "Recharts fill props left as hex strings — only className-based colors are Tailwind and need migration"

key-files:
  created: []
  modified:
    - apps/web/components/budget/budget-summary-cards.tsx
    - apps/web/components/budget/budget-line-item-table.tsx
    - apps/web/components/budget/forecast-metrics.tsx
    - apps/web/components/budget/budget-variance-chart.tsx
    - apps/web/components/budget/commitment-form.tsx
    - apps/web/components/budget/commitment-list.tsx

key-decisions:
  - "EAC, Total Budget, ETC values use text-primary (not text-financial-*) because they are primary metric values (brand teal as semantic primary metric token), not directional financial indicators"
  - "Recharts Bar fill props (#2563eb, #d97706) left as hex strings — these are chart library configuration values, not Tailwind classes, so no token equivalent applies"
  - "commitment-list Badge replaced with StatusBadge; type label badge uses variant=draft (neutral/gray) since commitment type is not a status"
  - "CPI getCpiColor returns mixed string: bg-muted (not bg-green-50/amber-50/red-50) per FOUND-02 locked decision — financial tokens on number text only, bg-muted for card/callout backgrounds"

patterns-established:
  - "statusVariants Record: maps domain status strings to StatusBadge variant type; executed → active, closed → cancelled"
  - "Validation errors: text-destructive (not text-red-600) for all form validation error messages"

requirements-completed:
  - FOUND-01
  - FOUND-02

# Metrics
duration: 3min
completed: 2026-02-21
---

# Phase 41 Plan 04: Budget Group Token Migration Summary

**All 6 budget components migrated from hardcoded palette classes to CSS variable tokens, with financial tokens on number text and bg-muted on card backgrounds**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-21T21:46:37Z
- **Completed:** 2026-02-21T21:49:41Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Migrated all 6 budget components — zero hardcoded palette color classes remain in the budget/ directory
- `forecast-metrics.tsx` getCpiColor function now returns `bg-muted` (not bg-green-50/amber-50/red-50) with `text-financial-positive/pending/negative` for CPI number text
- `commitment-list.tsx` replaces raw `Badge className={statusColors[...]}` with typed `StatusBadge` using a `statusVariants` mapping Record
- `commitment-form.tsx` all 4 validation error messages migrated from `text-red-600` to `text-destructive`
- `budget-variance-chart.tsx` tooltip className colors migrated; Recharts `fill` hex props preserved (library values, not Tailwind)

## Task Commits

1. **Task 1: Migrate budget-summary-cards.tsx and budget-line-item-table.tsx** - `410c612` (feat)
2. **Task 2: Migrate forecast-metrics.tsx, budget-variance-chart.tsx, commitment-form.tsx, commitment-list.tsx** - `d6b1146` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/web/components/budget/budget-summary-cards.tsx` - text-blue-600→text-primary, text-amber-600→text-financial-pending, variance icon conditional→text-financial-positive/negative, text-slate-600→text-muted-foreground
- `apps/web/components/budget/budget-line-item-table.tsx` - Lock icon text-red-600→text-financial-negative, Unlock icon text-green-600→text-financial-positive
- `apps/web/components/budget/forecast-metrics.tsx` - getCpiColor bg migration; getVacColor financial tokens; text-blue-606/purple-606→text-primary; text-slate-606→text-muted-foreground; inline trend icons text-green-606/red-606→financial tokens
- `apps/web/components/budget/budget-variance-chart.tsx` - tooltip text-blue-606/amber-606→text-primary/text-financial-pending; variance conditional→text-financial-positive/negative; bg-white→bg-card
- `apps/web/components/budget/commitment-form.tsx` - 4x text-red-606 validation errors→text-destructive
- `apps/web/components/budget/commitment-list.tsx` - statusColors Record removed; Badge→StatusBadge with statusVariants mapping; Badge import removed

## Decisions Made

- EAC, ETC, and Total Budget amounts use `text-primary` (not `text-financial-*`) — these are the app's primary metric values, not directional financial indicators. The brand teal semantic token is appropriate for "primary number shown on card."
- Recharts `fill` props left as hex values (`#2563eb`, `#d97706`) — these are chart library configuration strings (not className Tailwind classes), so no CSS variable token equivalent applies. Only `className`-based colors are in scope.
- `commitment-list.tsx` type label badge uses `variant="draft"` (neutral gray) — commitment type (Subcontract/Purchase Order) is not a status state, so a neutral appearance is semantically correct.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 6 budget components are fully token-compliant; ready for Phase 43 (Budget Domain Redesign) which will rebuild these components with TanStack Table
- The financial token patterns established here (text-financial-positive/negative/pending, bg-muted for callout backgrounds, text-primary for primary metric values) should be preserved in Phase 43 replacements

---
*Phase: 41-design-foundation*
*Completed: 2026-02-21*

## Self-Check: PASSED

- All 6 modified files confirmed present on disk
- SUMMARY.md confirmed present at .planning/phases/41-design-foundation/41-04-SUMMARY.md
- Task 1 commit 410c612 confirmed in git log
- Task 2 commit d6b1146 confirmed in git log
