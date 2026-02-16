---
phase: 17-estimating-workflow-setup-core
plan: 11
subsystem: ui
tags: [react, zod, workflow, validation, estimates]

# Dependency graph
requires:
  - phase: 17-estimating-workflow-setup-core
    provides: Workflow steps, line items table, markup config component
provides:
  - Fixed CSI dropdown persistence via schema validation
  - Safe margin calculation preventing NaN
  - Step 6 unlock for workflow progression
affects: [17-estimating-workflow-setup-core, UAT]

# Tech tracking
tech-stack:
  added: []
  patterns: [Zero-check before division for financial calculations, Step unlocking on mount for optional workflow steps]

key-files:
  created: []
  modified:
    - packages/shared/src/schemas/estimates.ts
    - apps/web/components/estimates/workflow/steps/05-MarkupConfig.tsx

key-decisions:
  - "Zero-check prevents NaN in margin calculation instead of truthy string check"
  - "Step 6 unlocks on Step 5 mount because markup config is optional (user can skip)"

patterns-established:
  - "Optional fields in update schemas allow partial updates: costCodeId is optional in updateLineItemSchema"
  - "Zero-check pattern for division: value > 0 ? calculation : 0 prevents division by zero"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 17 Plan 11: UAT Gap Closure - Critical Fixes

**Fixed three UAT failures: CSI dropdown persistence, NaN margin calculation, and Step 6 navigation via schema validation and zero-check guards**

## Performance

- **Duration:** 3 minutes
- **Started:** 2026-02-16T06:44:05Z
- **Completed:** 2026-02-16T06:47:09Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- CSI dropdown selections now persist when cost code is changed
- Margin calculation returns 0 instead of NaN when costs are zero
- Step 6 unlocks when Step 5 loads, enabling workflow progression

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix CSI dropdown update (add costCodeId to schema)** - `5898096` (feat)
2. **Task 2: Fix NaN margin calculation and add Step 6 unlock** - `8a47b3c` (fix)

## Files Created/Modified
- `packages/shared/src/schemas/estimates.ts` - Added costCodeId field to updateLineItemSchema to allow CSI dropdown selection persistence
- `apps/web/components/estimates/workflow/steps/05-MarkupConfig.tsx` - Added zero-check for margin calculation and unlockStep(6) on mount

## Decisions Made

**1. Add costCodeId to schema instead of frontend fix**
- Frontend already sends costCodeId correctly in mutation payload
- Schema was stripping the field via Zod validation
- Adding optional field to updateLineItemSchema allows API handler to receive and persist cost code changes

**2. Zero-check before division instead of truthy guard**
- Current guard (`if (!estimate?.totalCost)`) doesn't catch numeric string "0" (truthy)
- Zero-check (`sellingPrice > 0 ? ... : 0`) prevents division by zero for all falsy/zero cases
- Returns 0 instead of NaN for better UX and no console errors

**3. Unlock Step 6 on Step 5 mount**
- Markup config is optional (user can use defaults and skip customization)
- Following pattern from Step 3 (LineItemsStep) which unlocks Step 4 on mount
- Enables workflow progression without requiring user action on Step 5

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Pre-existing build errors in API package**
- TypeScript errors for missing type declarations (intuit-oauth, node-quickbooks)
- Legacy address field errors in customer/subcontractor routers from Phase 14 migration
- Missing estimates property in sovGeneration service

These are unrelated to the changes in this plan. The shared package builds successfully and the web package compiled successfully before the type-checking phase.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for UAT retest:**
- Test 9 (CSI dropdown update) should pass - costCodeId now persists
- Test 11 (NaN margin) should pass - zero-check prevents division errors
- Test 12 (Step 6 navigation) should pass - Step 6 unlocks on Step 5 mount

**Note:** Pre-existing TypeScript build errors in API package should be addressed separately to enable full build validation.

## Self-Check: PASSED

All files and commits verified:
- ✓ packages/shared/src/schemas/estimates.ts exists
- ✓ apps/web/components/estimates/workflow/steps/05-MarkupConfig.tsx exists
- ✓ .planning/phases/17-estimating-workflow-setup-core/17-11-SUMMARY.md exists
- ✓ Commit 5898096 exists
- ✓ Commit 8a47b3c exists

---
*Phase: 17-estimating-workflow-setup-core*
*Completed: 2026-02-16*
