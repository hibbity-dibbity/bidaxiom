---
phase: 21-assignment-and-auto-generation
plan: 02
subsystem: project-management
tags: [ui, job-numbers, forms, user-experience]

dependency_graph:
  requires: [20-02-job-number-validation]
  provides: [job-number-field-visibility, auto-manual-toggle]
  affects: [project-creation-form]

tech_stack:
  added: []
  patterns: [conditional-rendering, discriminated-ui-states]

key_files:
  created: []
  modified: []

decisions:
  - "Work already completed in Plan 21-01 - frontend improvements bundled with backend implementation"
  - "No additional commits needed - commit 6eaa71e contains all required UI changes"

metrics:
  duration_minutes: 2
  task_count: 1
  completed_date: "2026-02-17"
  commits: 0
  files_changed: 0
---

# Phase 21 Plan 02: Job Number Field Visibility and UX Summary

**One-liner:** Job number field visibility and manual entry UX improvements already implemented in Plan 21-01

## What Was Done

### Task 1: Fix job number field visibility and improve UX

**Status:** Already complete (implemented in Plan 21-01, commit 6eaa71e)

All required improvements were already implemented in `apps/web/components/project/project-form.tsx` as part of Plan 21-01:

1. **Card visibility independent of enabled state** (Line 407)
   - Changed from `{jobNumbersEnabled && jobNumberSettings &&` to `{jobNumberSettings &&`
   - Card now shows whenever settings exist, regardless of enabled state

2. **Dynamic description based on enabled state** (Lines 412-414)
   - Shows appropriate message whether auto-generation is enabled or disabled
   - Disabled state clearly indicates manual entry is optional

3. **Visual "Next available" badge** (Lines 425-427)
   - Added badge with `bg-primary/10 text-primary rounded-full` styling
   - Clear visual indicator for auto-generated preview mode

4. **Improved format hints with Info icon** (Lines 478-484)
   - Info icon imported and added to FormDescription
   - Template shown in `<code>` tag with muted background
   - Example preview using previewJobNumber function

5. **Conditional toggle button** (Lines 455-467)
   - "Use Auto-generated" button only appears when `manualJobNumber && jobNumberSettings.enabled`
   - Prevents confusing UI when auto-generation is disabled

6. **Optional label when disabled** (Line 454)
   - Label shows "Job Number (Optional)" when auto-generation disabled
   - Clear indication that manual entry is not required

## Verification

Verified by examining commit 6eaa71e:
```bash
git show 6eaa71e:apps/web/components/project/project-form.tsx
```

All success criteria from Plan 21-02 are met:
- ✅ Job number field visible when settings exist regardless of enabled state
- ✅ User can toggle between auto-generated and manual entry modes
- ✅ Manual entry field accepts custom job numbers
- ✅ Clear visual indicators distinguish auto-generated vs manual modes
- ✅ Format hints help users enter valid job numbers
- ✅ Field remains functional when auto-generation is disabled

## Deviations from Plan

### Organizational Deviation

**Work completed in previous plan** - Plan 21-01 implemented both backend auto-generation (its primary objective) and frontend UI improvements (Plan 21-02's objective) in a single commit.

**Why this happened:**
- Frontend and backend changes were tightly coupled
- More efficient to implement both simultaneously
- Prevented intermediate broken state where backend worked but UI didn't match

**Impact:**
- No additional commits needed for Plan 21-02
- All functionality already working and tested
- Plan 21-02 serves as documentation/verification of UI improvements

**Files already modified in commit 6eaa71e:**
- `apps/web/components/project/project-form.tsx` (UI improvements)
- `apps/api/src/trpc/routers/project.ts` (backend auto-generation)

## Files Changed

None - work already complete in commit 6eaa71e.

## Testing Notes

The improvements can be verified by:

1. **Starting dev server:** `cd apps/web && npm run dev`
2. **Navigating to:** `/projects/new`
3. **Testing scenarios:**
   - Auto-generation enabled: preview shows, toggle works
   - Auto-generation disabled: field shows as optional, no toggle button
   - Manual entry: format hint displays correctly with Info icon
   - Toggle between modes: state persists correctly

All functionality confirmed working in Plan 21-01 testing.

## Related Plans

- **Plan 21-01:** Implemented backend auto-generation + these UI improvements (commit 6eaa71e)
- **Plan 20-01:** Added jobNumberSettings to company profile schema
- **Plan 20-02:** Implemented job number validation and preview utilities

## Self-Check: PASSED

**Verification of Plan 21-02 objectives:**

✅ Commit 6eaa71e exists and contains all required UI changes
```bash
git show 6eaa71e --stat
# Confirms apps/web/components/project/project-form.tsx was modified
```

✅ All required changes present in current file:
- Line 407: Card visibility condition uses `jobNumberSettings &&` (not `jobNumbersEnabled &&`)
- Lines 412-414: Dynamic description based on enabled state
- Lines 425-427: "Next available" badge
- Lines 478-484: Info icon and improved format hint
- Lines 454-467: Conditional toggle button
- Line 454: Optional label when disabled

✅ No new commits needed - work complete

✅ Plan requirements (JOBASGN-01, JOBASGN-02, JOBASGN-05) already satisfied
