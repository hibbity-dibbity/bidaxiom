# Plan 54-02 Summary — UI: Date Pickers + Stat Bar

**Phase:** 54-project-header-updates
**Plan:** 02
**Status:** Complete
**Completed:** 2026-02-24

## What Was Done

### Task 1: Date pickers in header Row 2
- Added `DatePickerField` local component (not exported) using Popover + CalendarComponent alias
- Calendar icon shown (with title tooltip fallback) when no date set; formatted date text shown when date is set
- "–" separator between start and end date pickers only renders when at least one date is set
- Clicking a date calls `updateProjectMutation.mutate({ id, startDate|endDate })` + invalidates `getBySlug` cache
- Removed `formatDateRange` helper (no longer used)
- Fixed: mutation name corrected from `updateProject` to `update` (the actual procedure name on the project router)

### Task 2: Stat bar rewrite
- Removed Team Members KPI entirely
- Replaced `.map()` array pattern with explicit KPI card JSX
- Added Profit KPI (two-row: Projected top, "Actual: —" muted bottom row)
- Added Margin KPI (two-row: X.X% top, "Actual: —" muted bottom row)
- Added Customer Budget KPI (two-row: amount top, "$X over/under" delta bottom row when calculable)
- `formatCurrencyDisplay` helper: produces accounting parentheses format `($1,200)` for negative profit values in red
- `formatDelta` helper: produces plain-English "over/under" label for customer budget delta
- Updated `headerStats` type to include: `projectedProfit`, `projectedMargin`, `customerBudgetAmount`, `customerBudgetDelta`
- Added `customerBudget?: string | null` to the `project` prop type

### layout.tsx
- Added `customerBudget: project.customerBudget ?? null` to the project prop passed to ProjectHeader

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected mutation procedure name**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** Plan specified `trpc.project.updateProject.useMutation` but the actual procedure name on the router is `update` (exposed as `trpc.project.update`)
- **Fix:** Changed to `trpc.project.update.useMutation`
- **Files modified:** `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx`
- **Commit:** 572129c

## Requirements Covered
HEADER-01, HEADER-02, HEADER-03, HEADER-04, HEADER-05

## Self-Check: PASSED

- `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx` — exists, modified
- `apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx` — exists, modified
- Commit 572129c — verified present
- "Team Members" — confirmed absent from project-header.tsx
- `projectedProfit`, `projectedMargin`, `customerBudgetAmount` — confirmed present
- `DatePickerField`, `onSelect` — confirmed present
- TypeScript: no errors in modified files
