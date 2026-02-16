---
phase: 17-estimating-workflow-setup-core
plan: 08
subsystem: estimating
tags: [ui, navigation, gap-closure]
dependency-graph:
  requires: [17-05-estimates-list-page]
  provides: [estimates-tab-navigation]
  affects: [project-detail-navigation]
tech-stack:
  added: []
  patterns: [hover-prefetch, react-query-prefetch]
key-files:
  created: []
  modified:
    - apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx
decisions: []
metrics:
  duration: 2 min
  completed: 2026-02-16T05:29:50Z
---

# Phase 17 Plan 08: Add Estimates Tab to Project Navigation Summary

**One-liner:** Estimates tab added to project detail navigation bar with hover-based prefetching for instant perceived navigation

## What Was Done

### Task 1: Add Estimates tab to project navigation
**Status:** Complete
**Commit:** 93326ac

Added "Estimates" tab to ProjectTabs component following the existing pattern used for all other project sections (Budget, SOV, Payment Apps, etc.).

Three changes made to `project-tabs.tsx`:

1. **Added Estimates to sections array (line 22):**
   ```typescript
   { name: "Estimates", href: "/estimates" }
   ```

2. **Added prefetchEstimates handler (lines 87-90):**
   ```typescript
   const prefetchEstimates = () => {
     if (!projectId) return;
     utils.estimates.list.prefetch({ projectId });
   };
   ```

3. **Added to sectionPrefetchMap (line 103):**
   ```typescript
   "/estimates": prefetchEstimates
   ```

This enables:
- Estimates tab appears in project navigation bar alongside Budget, SOV, and other sections
- Clicking the tab navigates to `/projects/{slug}/estimates`
- Hovering over the tab prefetches estimate list data for instant perceived navigation
- Navigation highlights the tab when on the estimates route

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written.

### Authentication Gates

None.

### Architectural Decisions

None.

## Verification Status

**Automated verification completed:**
- ✓ Grep confirms Estimates tab in sections array (line 22)
- ✓ Grep confirms prefetchEstimates handler exists (lines 87, 103)
- ✓ Code follows exact pattern of existing tabs (Budget, SOV, etc.)

**Manual verification required:**
1. Navigate to any project detail page: `/projects/{slug}`
2. Verify "Estimates" tab appears in navigation bar
3. Click "Estimates" tab → should navigate to `/projects/{slug}/estimates`
4. Verify estimates list page from 17-05 loads
5. Hover over Estimates tab → should prefetch data (check Network tab)
6. Verify tab highlights when on `/projects/{slug}/estimates` route

**Note:** Full build test skipped due to pre-existing unrelated TypeScript error in `apps/api/src/integrations/quickbooks/oauth.ts` (missing type declarations for `intuit-oauth` module). This error exists on master branch and is not related to this plan's changes.

## Integration Points

**Upstream dependencies:**
- Plan 17-05 (Estimates List Page) - Provides the `/projects/{slug}/estimates` route and estimates.list tRPC query that this navigation prefetches

**Downstream impact:**
- Users can now navigate to Estimates from project detail page
- Closes UAT Gap #1: "Users cannot navigate to Estimates from project detail page"

## Files Modified

| File | Changes | Lines |
|------|---------|-------|
| apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx | Added Estimates tab, prefetch handler, and map entry | +7 |

## Self-Check

**Check created files exist:**
N/A - No new files created

**Check modified files exist:**
```bash
[ -f "apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx" ] && echo "FOUND"
```
Result: FOUND ✓

**Check commits exist:**
```bash
git log --oneline --all | grep -q "93326ac" && echo "FOUND: 93326ac"
```
Result: FOUND: 93326ac ✓

## Self-Check: PASSED

All files and commits verified successfully.
