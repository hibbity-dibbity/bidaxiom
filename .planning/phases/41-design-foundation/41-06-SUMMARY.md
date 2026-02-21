---
phase: 41-design-foundation
plan: 06
subsystem: ui
tags: [tailwind, css-variables, dark-mode, tokens, estimates, integrations, dashboard]

requires:
  - phase: 41-01
    provides: Financial CSS tokens (text-financial-positive/negative/pending), token system in globals.css

provides:
  - 15 Group G files fully token-compliant (zero hardcoded palette classes)
  - currency-display.tsx: colorize ternary uses text-financial-positive/negative/text-foreground
  - status-badge.tsx: CVA variants use bg-muted, text-muted-foreground, text-financial-*, text-primary
  - MarginCalculator.tsx: getMarginColorClass uses financial tokens by threshold
  - SOVBuilder.tsx: variance display and success alert use financial tokens
  - Workflow step files (01-05): unlocked status messages use text-financial-positive
  - Integration cards: connection status badges and sandbox callout use token classes
  - workflow-detail.tsx: step indicator circles use bg-financial-positive/negative/bg-primary
  - kpi-card.tsx: statusColorMap uses text-financial-positive/pending/negative

affects:
  - 41-07 (next wave plans referencing shared components)
  - Any plan touching estimates workflow, integration settings, or dashboard

tech-stack:
  added: []
  patterns:
    - "CSS variable financial tokens replace all text-green/red palette classes for financial values"
    - "bg-muted replaces all bg-{color}-50/100 tint backgrounds"
    - "border-border replaces border-{color}-300 colored borders"
    - "text-destructive for system errors (upload fail, sync fail); text-financial-negative for financial negatives"
    - "bg-primary/10 text-primary for active/in-progress states"

key-files:
  created: []
  modified:
    - apps/web/components/shared/currency-display.tsx
    - apps/web/components/shared/status-badge.tsx
    - apps/web/components/estimates/line-items/MarginCalculator.tsx
    - apps/web/components/estimates/sov/SOVBuilder.tsx
    - apps/web/components/estimates/workflow/steps/01-BasicInfo.tsx
    - apps/web/components/estimates/workflow/steps/02-TemplateSelection.tsx
    - apps/web/components/estimates/workflow/steps/03-LineItems.tsx
    - apps/web/components/estimates/workflow/steps/04-LaborRates.tsx
    - apps/web/components/estimates/workflow/steps/05-MarkupConfig.tsx
    - apps/web/components/integrations/calendar-connection-card.tsx
    - apps/web/components/integrations/qbo-connection-card.tsx
    - apps/web/components/integrations/qbo-sync-notifications.tsx
    - apps/web/components/project/document-uploader.tsx
    - apps/web/components/workflow/workflow-detail.tsx
    - apps/web/components/dashboard/kpi-card.tsx

key-decisions:
  - "System errors (upload failure, sync failure) use text-destructive not text-financial-negative — destructive is for actionable errors, financial-negative is for negative financial values"
  - "Calendar provider icon colors (blue/orange) replaced with text-primary/text-muted-foreground — provider-specific palette colors removed"
  - "Workflow approve/reject action buttons use text-financial-positive/negative with border-border — consistent with token system rather than colored borders"
  - "Reject dialog button uses bg-destructive pattern (same as other destructive actions) not raw bg-red-600"

patterns-established:
  - "Financial semantic tokens: text-financial-positive (green values), text-financial-negative (red values), text-financial-pending (yellow/amber values)"
  - "Neutral backgrounds: bg-muted replaces all bg-{color}-50/100 tints in dark-mode-safe code"
  - "Connector lines and dividers: bg-border replaces bg-gray-300"

requirements-completed:
  - FOUND-01
  - FOUND-02

duration: 3min
completed: 2026-02-21
---

# Phase 41 Plan 06: Group G Token Migration Summary

**15 files (shared components, estimates workflow, integration cards, dashboard) migrated from hardcoded palette classes to CSS variable tokens, eliminating all dark: companion classes**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-21T21:47:01Z
- **Completed:** 2026-02-21T21:49:53Z
- **Tasks:** 3 (Task 1, Task 2a, Task 2b)
- **Files modified:** 15

## Accomplishments
- currency-display.tsx and status-badge.tsx (highest-impact shared components) fully tokenized — changes propagate to 14+ and 6+ usage sites
- All 7 estimates workflow files (MarginCalculator, SOVBuilder, steps 01-05) cleaned of palette classes without touching any Controller mounting logic
- Integration cards (QBO, Calendar), qbo-sync-notifications, document-uploader, workflow-detail, and kpi-card tokenized
- Zero dark: companion classes remain across all 15 files — token system handles dark mode automatically

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate shared components — currency-display.tsx and status-badge.tsx** - `5b1f2ff` (feat)
2. **Task 2a: Migrate estimates workflow steps, MarginCalculator, SOVBuilder** - `0faacf1` (feat)
3. **Task 2b: Migrate integration cards, document-uploader, workflow-detail, kpi-card** - `ef8cd92` (feat)

**Plan metadata:** `(pending)` (docs: complete plan)

## Files Created/Modified
- `apps/web/components/shared/currency-display.tsx` - colorize ternary uses text-financial-positive/negative/text-foreground
- `apps/web/components/shared/status-badge.tsx` - CVA variants fully tokenized (bg-muted, text-financial-*, text-primary)
- `apps/web/components/estimates/line-items/MarginCalculator.tsx` - getMarginColorClass uses financial tokens
- `apps/web/components/estimates/sov/SOVBuilder.tsx` - variance color and success alert tokenized
- `apps/web/components/estimates/workflow/steps/01-BasicInfo.tsx` - unlock message uses text-financial-positive
- `apps/web/components/estimates/workflow/steps/02-TemplateSelection.tsx` - unlock message tokenized
- `apps/web/components/estimates/workflow/steps/03-LineItems.tsx` - unlock message tokenized
- `apps/web/components/estimates/workflow/steps/04-LaborRates.tsx` - unlock message tokenized
- `apps/web/components/estimates/workflow/steps/05-MarkupConfig.tsx` - margin summary uses text-financial-positive
- `apps/web/components/integrations/calendar-connection-card.tsx` - all status/sync badges tokenized; provider icon uses text-primary/text-muted-foreground
- `apps/web/components/integrations/qbo-connection-card.tsx` - connected/expired/sandbox badges and QBO icon tokenized
- `apps/web/components/integrations/qbo-sync-notifications.tsx` - warning alert uses bg-muted/text-financial-pending
- `apps/web/components/project/document-uploader.tsx` - upload success/error icons and text tokenized
- `apps/web/components/workflow/workflow-detail.tsx` - step indicator circles use bg-financial-positive/negative/bg-primary; action buttons tokenized
- `apps/web/components/dashboard/kpi-card.tsx` - statusColorMap uses text-financial-positive/pending/negative

## Decisions Made
- System errors (upload failure, sync failure) use `text-destructive` not `text-financial-negative` — destructive is for actionable system errors; financial-negative is for negative financial values only
- Calendar provider icon colors (blue for Google, orange for Microsoft) replaced with `text-primary`/`text-muted-foreground` — provider-specific palette colors have no token equivalent and are not financial semantics
- Workflow approve/reject buttons use `text-financial-positive`/`text-financial-negative` with `border-border` — removes colored borders while maintaining semantic meaning
- Reject dialog button uses `bg-destructive text-destructive-foreground hover:bg-destructive/90` pattern, consistent with other destructive action buttons in the codebase

## Deviations from Plan

None — plan executed exactly as written. All substitutions followed the mapping table in the plan spec.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Group G is fully token-compliant
- All 15 files have zero hardcoded palette color classes and zero dark: companion classes
- currency-display.tsx and status-badge.tsx now serve as reference implementations for financial token usage
- Ready for remaining Wave 2 plans (41-02 through 41-05) and Phase 42

---
*Phase: 41-design-foundation*
*Completed: 2026-02-21*
