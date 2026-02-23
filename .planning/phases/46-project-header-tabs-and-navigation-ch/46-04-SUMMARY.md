---
phase: 46-project-header-tabs-and-navigation-ch
plan: 04
subsystem: ui
tags: [react, nextjs, tailwind, sticky-header, gap-closure]

# Dependency graph
requires:
  - phase: 46-02
    provides: Compact 2-row sticky header (had regressions fixed here)
provides:
  - 3-row sticky header: title | info (customer/address/dates) | financial stat bar
  - Functional ellipsis dropdown: mode switch always visible (canTransition gate removed)
affects: [project detail page header]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "formatAddress() and formatDateRange() as module-level helpers (not inside component)"
    - "Info row: flex items-center gap-2 text-sm text-muted-foreground with conditional segments"
    - "Mode switch DropdownMenuItem renders unconditionally — not gated on canTransition"

key-files:
  created: []
  modified:
    - apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx

key-decisions:
  - "startDate/endDate come back as strings from tRPC (not Date objects) — no .toISOString() needed"
  - "Mode switch removed from canTransition gate — it's a project config toggle, not a lifecycle transition"
  - "Info row renders conditionally only when at least one of customerName/address/dates is non-null"

patterns-established:
  - "Customer name links to /customers/[customerSlug] when customerSlug is present; plain text when absent"
  - "Divider dots (·) only inserted between non-null segments"

requirements-completed:
  - CHROME-01 (gap closure)
  - CHROME-02 (gap closure)

# Metrics
duration: 5min
completed: 2026-02-23
---

# Phase 46 Plan 04: Gap Closure — Customer Info Row + Dropdown Fix Summary

**Restored customer info row (Row 2) removed in plan 02, and fixed ellipsis dropdown showing empty by removing the canTransition gate from the mode switch menu item**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-02-23
- **Tasks:** 2 of 2
- **Files modified:** 2

## Accomplishments

- `project-header.tsx`: Added `formatAddress()` and `formatDateRange()` helpers; added 7 new props to `ProjectHeaderProps.project`; added Row 2 info flex line between title row and stat bar; removed `{canTransition && ...}` gate from mode switch `DropdownMenuItem`
- `layout.tsx`: Pass `customerName` (companyName ?? contactName), `street1`, `city`, `state`, `zip`, `startDate`, `endDate` to `ProjectHeader`
- TypeScript compiles cleanly in both files (0 new errors)

## Task Commits

1. **Task 1 + 2 combined: Restore info row and fix dropdown** - `7adac83` (fix)

## Files Modified

- `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx` — restored info row, fixed dropdown, added helpers
- `apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx` — passes 7 customer/date props to ProjectHeader

## Decisions Made

- `startDate`/`endDate` arrive as strings from tRPC serialization — `.toISOString()` not needed, use `?? null` directly
- Mode switch DropdownMenuItem should render for all projects — removed canTransition gate (lifecycle badge interactivity is a separate concern from project mode configuration)
- Combined Tasks 1 and 2 into single atomic commit — both files were interdependent (prop shape change requires both sides simultaneously)

## Deviations from Plan

- Dates: Plan spec called for `.toISOString()` conversion, but TypeScript revealed the fields are already strings from tRPC. Fixed by using `?? null` directly.

## User Setup Required

None.

## Next Phase Readiness

- UAT issues 1 and 2 are closed — header now shows 3 rows (title | info | stat bar) and dropdown has mode switch
- Plan 46-03 (tab count badges) still pending
- Phase 46 complete after 46-03 executes

---
*Phase: 46-project-header-tabs-and-navigation-ch*
*Completed: 2026-02-23*
