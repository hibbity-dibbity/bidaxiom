---
phase: quick-16
plan: 1
type: summary
subsystem: routing
tags: [bug-fix, slug-routing, e2e-flow]
completed_at: 2026-02-16T23:39:58Z
duration: 2
tasks_completed: 3
files_modified: 4

dependencies:
  requires: [phase-19-slug-implementation]
  provides: [slug-based-navigation]
  affects: [global-search, estimate-conversion]

tech_stack:
  patterns: [slug-routing, mutation-response-navigation]

key_files:
  created: []
  modified:
    - apps/api/src/trpc/routers/search.ts
    - apps/api/src/services/projectConversion.ts
    - apps/web/components/estimates/actions/ConvertToProjectButton.tsx
    - apps/web/components/estimates/lifecycle/NextStepsPanel.tsx

decisions:
  - title: "Return projectSlug in mutation response for navigation"
    rationale: "Enables frontend to navigate using slug without additional query; follows dual-prop pattern from Phase 16"
    alternatives: ["Query project after conversion", "Pass projectId and lookup slug client-side"]
    selected: "Return projectSlug in mutation response"
---

# Quick Task 16: Slug Routing Hotfixes

**One-liner:** Fixed two critical E2E flow bugs by converting UUID-based navigation to slug-based routing in global search and estimate conversion flows

## Summary

Fixed milestone v1.1 audit bugs causing 404 errors in two key user flows:
1. Global search (⌘K) now returns slug-based URLs (`/projects/{slug}`) instead of UUID URLs
2. ConvertToProjectButton now navigates to slug-based route after successful conversion

Both fixes leverage existing slug infrastructure from Phase 19 without introducing new slug generation logic.

## Tasks Completed

### Task 1: Fix search router to return slug-based URLs
**Commit:** 9f8aadd
**Files:** apps/api/src/trpc/routers/search.ts

Added `slug` to project SELECT query and updated URL generation to use `/projects/${p.slug}` instead of `/projects/${p.id}`. This ensures global search results navigate correctly to slug-based routes.

### Task 2: Update convertToProject to return projectSlug
**Commit:** 6095b11
**Files:** apps/api/src/services/projectConversion.ts

Added project slug query before transaction and included `projectSlug` in return object alongside `projectId` and `budgetLineItemsCreated`. This provides the frontend with the slug needed for navigation without an additional query.

### Task 3: Update ConvertToProjectButton to use projectSlug
**Commit:** a6d8f19
**Files:**
- apps/web/components/estimates/actions/ConvertToProjectButton.tsx
- apps/web/components/estimates/lifecycle/NextStepsPanel.tsx

Removed `projectId` prop from ConvertToProjectButton interface and updated navigation to use `data.projectSlug` from mutation response. Also updated NextStepsPanel to remove the now-invalid projectId prop.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Updated NextStepsPanel to remove projectId prop**
- **Found during:** Task 3
- **Issue:** NextStepsPanel passed projectId prop to ConvertToProjectButton which no longer accepts it
- **Fix:** Removed projectId from ConvertToProjectButton usage in NextStepsPanel
- **Files modified:** apps/web/components/estimates/lifecycle/NextStepsPanel.tsx
- **Commit:** a6d8f19 (included in Task 3 commit)
- **Rationale:** TypeScript would error on invalid prop; blocking issue that prevented component from compiling

## Verification

Both E2E flows verified:

**E2E Flow #1 (Estimate Conversion):**
- ConvertToProjectButton navigates to `/projects/{slug}/budget` using mutation response
- No additional slug query needed
- Follows dual-prop pattern from Phase 16

**E2E Flow #2 (Global Search):**
- Search results include slug in SELECT query
- URLs generated as `/projects/{slug}` instead of `/projects/{id}`
- Navigation goes directly to correct slug-based route

## Self-Check

### Created Files
None - all fixes were modifications to existing files.

### Modified Files
```bash
[ -f "apps/api/src/trpc/routers/search.ts" ] && echo "FOUND: apps/api/src/trpc/routers/search.ts"
[ -f "apps/api/src/services/projectConversion.ts" ] && echo "FOUND: apps/api/src/services/projectConversion.ts"
[ -f "apps/web/components/estimates/actions/ConvertToProjectButton.tsx" ] && echo "FOUND: apps/web/components/estimates/actions/ConvertToProjectButton.tsx"
[ -f "apps/web/components/estimates/lifecycle/NextStepsPanel.tsx" ] && echo "FOUND: apps/web/components/estimates/lifecycle/NextStepsPanel.tsx"
```

### Commits
```bash
git log --oneline --all | grep -q "9f8aadd" && echo "FOUND: 9f8aadd (Task 1)"
git log --oneline --all | grep -q "6095b11" && echo "FOUND: 6095b11 (Task 2)"
git log --oneline --all | grep -q "a6d8f19" && echo "FOUND: a6d8f19 (Task 3)"
```

## Self-Check: PASSED

All modified files exist and all commits verified in git history.

## Impact

**Bug Severity:** Critical (404 errors in key user flows)
**User Impact:** High - both flows are primary workflows (search and estimate conversion)
**Risk:** Low - leverages existing slug infrastructure, no new slug generation logic

**Before:**
- Global search returned `/projects/{uuid}` → 404 error
- Convert to project navigated to `/projects/{uuid}/budget` → 404 error

**After:**
- Global search returns `/projects/{slug}` → successful navigation
- Convert to project navigates to `/projects/{slug}/budget` → successful navigation

## Metrics

- **Duration:** 2 minutes
- **Tasks completed:** 3
- **Files modified:** 4
- **Commits:** 3
- **Deviations:** 1 (auto-fixed)
- **Lines changed:** ~10 additions, ~3 deletions

## Related Work

- Phase 19 Plan 04: Slug generation utilities (establishes slug infrastructure)
- Phase 19 Plan 06: Frontend slug migration (migrates project routes to slug-based)
- Milestone v1.1 audit: Identified these two E2E flow bugs
