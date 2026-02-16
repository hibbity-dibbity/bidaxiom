---
phase: 17-estimating-workflow-setup-core
plan: 09
subsystem: estimating
tags: [gap-closure, workflow, ux]
dependencies:
  requires: [17-05-SUMMARY.md, 17-07-SUMMARY.md]
  provides: [template-skip-functionality]
  affects: [workflow-step-2, workflow-state]
tech-stack:
  added: []
  patterns: [skip-button-pattern, dual-state-ui]
key-files:
  created: []
  modified:
    - apps/web/components/estimates/workflow/steps/02-TemplateSelection.tsx
decisions:
  - Dual skip button pattern (prominent in empty state, subtle when templates exist)
  - Auto-navigation to Step 3 after skip (better UX than manual navigation)
  - Toast notification provides user feedback for skip action
metrics:
  duration: 137 seconds (2.3 min)
  tasks: 1
  files: 1
  completed: 2026-02-16
---

# Phase 17 Plan 09: Template Selection Skip Option Summary

**One-liner:** Skip button enables workflow progression past Step 2 when no templates available, fixing UAT Gap #2

## Objective Achieved

Added skip/continue functionality to template selection step allowing users to bypass template application and proceed directly to manual line item entry in Step 3.

**Gap Closure:** Fixes UAT Gap #2 (Major) - Users can now progress past Step 2 when no templates exist

## Implementation Summary

### 1. Skip Handler Function

Added `handleSkipTemplates` function in `02-TemplateSelection.tsx` (line 55-61):
- Calls `unlockStep(3)` to enable Step 3 in workflow
- Calls `goToStep(3)` for automatic navigation
- Shows toast notification with success message and helpful description

### 2. Empty State Skip Button

Updated empty state UI (lines 80-94):
- Changed from simple text message to structured card with centered content
- Added `space-y-4` flexbox layout for proper spacing
- Prominent "Skip Template Selection" button with `outline` variant
- Clear explanation: "You can skip this step and manually add line items in the next step"

### 3. Optional Skip Button

Added skip option after template cards (lines 133-143):
- Conditional rendering: `{costCodeTemplates && costCodeTemplates.length > 0 && ...}`
- Subtle `ghost` variant button with `sm` size
- Text: "Skip and add line items manually"
- Centered alignment with `mt-4` spacing

## Technical Details

### Dual Skip Button Pattern

**Empty State (No Templates):**
- **Variant:** `outline` (prominent, primary action)
- **Message:** Clear explanation that templates are unavailable
- **Use Case:** Guides users forward when no templates exist

**After Templates (Templates Exist):**
- **Variant:** `ghost` (subtle, secondary action)
- **Size:** `sm` (smaller, less prominent)
- **Use Case:** Allows users who prefer manual entry to skip templates

### Workflow State Integration

Both skip buttons trigger the same handler:
```typescript
const handleSkipTemplates = () => {
  unlockStep(3);   // Enable Step 3 in sidebar
  goToStep(3);     // Navigate to Step 3 automatically
  toast.success("Skipped template selection", {
    description: "You can manually add line items in the next step",
  });
};
```

This matches the existing pattern from `handleApplyTemplate` (line 39) which also calls `unlockStep(3)`.

### Import Changes

Added `goToStep` to destructuring from `useWorkflowState` (line 17):
```typescript
const { unlockStep, goToStep } = useWorkflowState();
```

## Files Modified

**apps/web/components/estimates/workflow/steps/02-TemplateSelection.tsx**
- Added `handleSkipTemplates` function
- Updated empty state Card to include skip button and explanation
- Added optional skip button after template cards section
- Imported `goToStep` from `useWorkflowState`

## Verification Steps

1. **Scenario A - No Templates:**
   - Create new estimate
   - Complete Step 1 (name + project type)
   - Navigate to Step 2
   - Verify empty state shows "No cost code templates available"
   - Verify "Skip Template Selection" button is visible and prominent
   - Click button → Step 3 unlocks and auto-navigates
   - Toast notification confirms skip

2. **Scenario B - Templates Exist:**
   - Same initial steps
   - Templates display as cards
   - Scroll to bottom of template section
   - Verify "Skip and add line items manually" button (subtle, smaller)
   - Click button → same behavior as Scenario A

3. **Edge Cases:**
   - User can return to Step 2 and apply template after skipping
   - Skipping doesn't break workflow state
   - Step 3 unlocks whether user applies template OR skips

## Success Criteria

- [x] Skip button appears when no templates available (prominent in empty state)
- [x] Optional skip button appears when templates exist (subtle at bottom)
- [x] Clicking skip unlocks Step 3
- [x] User can navigate to Step 3 after skipping
- [x] Toast notification provides feedback
- [x] No breaking of existing template application flow

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add skip template selection button | ece533b | apps/web/components/estimates/workflow/steps/02-TemplateSelection.tsx |

## Related Context

**UAT Gap #2 (Major):** Users cannot progress past Step 2 when no templates are available
- **Severity:** Major - blocks workflow completion
- **User Impact:** High - prevents estimate creation without templates
- **Resolution:** This plan provides the skip functionality to bypass template selection

**Pattern Consistency:** Follows Step 4 (Labor Rates) pattern from 17-06-SUMMARY.md which already has "Skip Labor Rates" button (line 126), maintaining consistent UX across workflow steps.

## Self-Check: PASSED

Created files verification:
- FOUND: C:/Users/erict/OneDrive - Thomson Enterprises/Documents/Claude Projects/Construction-Mgmt-Software/apps/web/components/estimates/workflow/steps/02-TemplateSelection.tsx (modified, not created)

Commit verification:
- FOUND: ece533b

Modified files verification:
- handleSkipTemplates function exists at line 55
- unlockStep(3) called at line 56
- Skip button count: 6 occurrences in file (includes button text, descriptions, and onClick handlers)
- goToStep imported and used correctly
