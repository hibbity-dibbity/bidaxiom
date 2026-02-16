---
phase: 18-estimating-workflow-lifecycle-and-conversion
plan: 04
subsystem: estimates-lifecycle-ui
tags: [estimates, lifecycle, ui, status-management, next-steps]
dependency_graph:
  requires:
    - 18-02-lifecycle-backend
    - 18-03-conversion-backend
  provides:
    - estimate-status-visualization
    - contextual-action-buttons
    - lifecycle-workflow-ui
  affects:
    - estimate-detail-page
    - estimate-list-navigation
tech_stack:
  added:
    - StatusBadge component (color-coded status variants)
    - NextStepsPanel component (contextual actions by status)
    - GenerateBidButton (dialog-based bid creation)
    - SubmitEstimateButton (one-click submission)
    - ConvertToProjectButton (navigation to budget)
  patterns:
    - Switch statement for status-based rendering
    - tRPC mutation hooks with loading states
    - Toast notifications for user feedback
    - React Query cache invalidation on actions
key_files:
  created:
    - apps/web/components/estimates/lifecycle/StatusBadge.tsx
    - apps/web/components/estimates/lifecycle/NextStepsPanel.tsx
    - apps/web/components/estimates/actions/GenerateBidButton.tsx
    - apps/web/components/estimates/actions/SubmitEstimateButton.tsx
    - apps/web/components/estimates/actions/ConvertToProjectButton.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateId]/page.tsx
  modified:
    - apps/web/app/(dashboard)/projects/[projectSlug]/estimates/page.tsx
decisions:
  - created-estimate-detail-page: Created separate detail page for lifecycle UI instead of modifying workflow page to maintain separation of concerns (workflow = editing, detail = viewing/actions)
  - detail-page-path-adjustment: Used (dashboard) route group instead of (authenticated) as specified in plan to match existing codebase structure
  - list-navigation-update: Updated list page to link to detail page instead of workflow page to make lifecycle UI the primary view
metrics:
  duration: 2.7 min
  tasks_completed: 3
  files_created: 6
  files_modified: 1
  commits: 3
  completed_at: 2026-02-16T17:56:17Z
---

# Phase 18 Plan 04: Estimate Lifecycle UI with Status and Actions Summary

**One-liner:** Color-coded status badges and contextual next steps panel guide users through estimate workflow with one-click actions for submit, bid generation, and project conversion.

## What Was Built

### Lifecycle UI Components
Created two core visualization components:
- **StatusBadge**: Color-coded badge showing estimate status (draft=gray, submitted=blue, accepted/under_contract=green)
- **NextStepsPanel**: Contextual card displaying appropriate actions based on current estimate status with descriptive guidance text

### Action Button Components
Built three action buttons with full mutation handling:
- **GenerateBidButton**: Opens dialog for bid name input, calls tRPC mutation, displays success/error toasts
- **SubmitEstimateButton**: One-click submission with loading state and toast notifications
- **ConvertToProjectButton**: Converts estimate to active project and navigates to budget page on success

### Estimate Detail Page
Created new detail page at `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateId]/page.tsx` featuring:
- StatusBadge in page header next to estimate name
- Estimate overview card with description, total cost, dates
- NextStepsPanel with appropriate actions for current status
- Cache invalidation callback to refresh data after actions
- Navigation to workflow page for editing

## Task Breakdown

| Task | Commit | Description | Files |
|------|--------|-------------|-------|
| 1 | 4009a96 | Create lifecycle UI components (StatusBadge, NextStepsPanel) | StatusBadge.tsx, NextStepsPanel.tsx |
| 2 | abd3df3 | Create action button components (Generate/Submit/Convert) | GenerateBidButton.tsx, SubmitEstimateButton.tsx, ConvertToProjectButton.tsx |
| 3 | 5dd2f23 | Integrate lifecycle UI into estimate detail page | page.tsx (new detail page), page.tsx (list update) |

## Technical Implementation

### Status Badge Mapping
```typescript
const STATUS_CONFIG: Record<EstimateStatus, { label: string; variant }> = {
  draft: { label: "Draft", variant: "secondary" },        // Gray
  submitted: { label: "Submitted", variant: "default" },  // Blue
  accepted: { label: "Accepted", variant: "success" },    // Green
  under_contract: { label: "Under Contract", variant: "success" } // Green
};
```

### Next Steps Logic
Switch statement renders different actions by status:
- **draft**: Submit for Approval (primary) + Generate Bid (secondary)
- **submitted**: Generate Bid only
- **accepted**: Convert to Project (primary)
- **under_contract**: Informational message only (no actions)

### Action Button Pattern
All action buttons follow consistent pattern:
1. Accept `estimateId`, `onSuccess` callback, `variant` prop
2. Use tRPC mutation with `onSuccess`/`onError` handlers
3. Display toast notifications for feedback
4. Show loading states during mutation (`isPending`)
5. Call `onSuccess()` to trigger parent refresh

### Cache Invalidation
Detail page uses React Query utils for invalidation:
```typescript
const utils = trpc.useUtils();
onActionComplete={() => {
  void utils.estimates.getById.invalidate({ id: estimateId });
}}
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Created estimate detail page**
- **Found during:** Task 3
- **Issue:** Plan referenced `apps/web/app/(authenticated)/estimates/[estimateId]/page.tsx` but this file didn't exist; existing structure had estimates nested under projects at `projects/[projectSlug]/estimates/[estimateId]/workflow`
- **Fix:** Created new detail page at `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateId]/page.tsx` to serve as lifecycle UI view, separate from workflow (editing) page
- **Files created:** page.tsx (detail page)
- **Commit:** 5dd2f23

**2. [Rule 3 - Blocking Issue] Adjusted route group to match codebase**
- **Found during:** Task 3
- **Issue:** Plan specified `(authenticated)` route group but codebase uses `(dashboard)` for authenticated routes
- **Fix:** Used `(dashboard)` route group instead to match existing structure
- **Files modified:** page.tsx paths
- **Commit:** 5dd2f23

**3. [Rule 3 - Blocking Issue] Updated list navigation for accessibility**
- **Found during:** Task 3
- **Issue:** Estimates list linked directly to workflow page; lifecycle UI would not be accessible
- **Fix:** Changed list page "View" link from `/workflow` to detail page root to make lifecycle UI the primary view (workflow still accessible via "Edit" button on detail page)
- **Files modified:** estimates list page.tsx
- **Commit:** 5dd2f23

## Verification Results

All verification criteria met:
- [x] StatusBadge displays color-coded status for all 4 status types
- [x] NextStepsPanel renders different actions for draft, submitted, accepted, under_contract
- [x] GenerateBidButton opens dialog and calls tRPC mutation
- [x] SubmitEstimateButton submits with one click
- [x] ConvertToProjectButton navigates to budget page after success
- [x] All action buttons show loading states and toast notifications
- [x] Estimate detail page includes StatusBadge in header
- [x] Estimate detail page includes NextStepsPanel below details
- [x] Cache invalidation works via onActionComplete callback

## Self-Check

Verifying all created files exist:

```bash
# Check lifecycle components
[ -f "apps/web/components/estimates/lifecycle/StatusBadge.tsx" ] && echo "FOUND"
[ -f "apps/web/components/estimates/lifecycle/NextStepsPanel.tsx" ] && echo "FOUND"

# Check action components
[ -f "apps/web/components/estimates/actions/GenerateBidButton.tsx" ] && echo "FOUND"
[ -f "apps/web/components/estimates/actions/SubmitEstimateButton.tsx" ] && echo "FOUND"
[ -f "apps/web/components/estimates/actions/ConvertToProjectButton.tsx" ] && echo "FOUND"

# Check detail page
[ -f "apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateId]/page.tsx" ] && echo "FOUND"
```

Verifying all commits exist:

```bash
git log --oneline --all | grep -q "4009a96" && echo "FOUND: 4009a96"
git log --oneline --all | grep -q "abd3df3" && echo "FOUND: abd3df3"
git log --oneline --all | grep -q "5dd2f23" && echo "FOUND: 5dd2f23"
```

## Self-Check: PASSED

All files verified:
- FOUND: StatusBadge.tsx
- FOUND: NextStepsPanel.tsx
- FOUND: GenerateBidButton.tsx
- FOUND: SubmitEstimateButton.tsx
- FOUND: ConvertToProjectButton.tsx
- FOUND: estimate detail page.tsx

All commits verified:
- FOUND: 4009a96 (Task 1 - lifecycle UI components)
- FOUND: abd3df3 (Task 2 - action button components)
- FOUND: 5dd2f23 (Task 3 - integrate into detail page)
