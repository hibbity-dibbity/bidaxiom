---
phase: 16-projects-interface-redesign
plan: "07"
subsystem: projects/navigation
tags:
  - routing
  - navigation
  - slug-migration
  - uat-fix
dependency_graph:
  requires:
    - 16-05-section-page-routing-migration
  provides:
    - component-slug-navigation
    - uuid-free-urls
  affects:
    - change-orders
    - rfqs
    - bidding
    - payment-apps
    - workflows
tech_stack:
  added: []
  patterns:
    - dual-prop-pattern
    - slug-for-nav-uuid-for-queries
key_files:
  created: []
  modified:
    - apps/web/components/change-order/change-order-list.tsx
    - apps/web/components/change-order/change-order-form.tsx
    - apps/web/components/change-order/change-order-detail.tsx
    - apps/web/components/bidding/rfq-form.tsx
    - apps/web/components/bidding/bid-comparison-table.tsx
    - apps/web/components/payment-app/payment-app-list.tsx
    - apps/web/components/workflow/workflow-list.tsx
    - apps/web/components/workflow/create-workflow-dialog.tsx
    - apps/web/components/workflow/workflow-detail.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/change-orders/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/change-orders/new/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/change-orders/[changeOrderId]/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/rfqs/new/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/rfqs/[rfqId]/compare/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/documents/page.tsx
decisions:
  - Dual-prop pattern: Components accept both projectId (for tRPC queries) and projectSlug (for navigation) to maintain API compatibility while enabling slug-based URLs
  - Keep projectId for tRPC queries: Backend requires UUID for database lookups; slug translation happens at page level only
  - Update components before pages: Ensures TypeScript compilation guides complete migration
key_metrics:
  duration: 5.2 min
  tasks_completed: 2
  files_modified: 16
  commits: 2
completed_date: 2026-02-15
---

# Phase 16 Plan 07: Component Navigation URL Migration Summary

**One-liner:** Fixed component navigation to use projectSlug instead of UUID, completing slug-based routing migration and resolving UAT Test 24 URL format regression.

## What Was Built

Fixed all component navigation URLs to use slug-based routing instead of UUID-based routing:

1. **Component Interface Updates (9 components):**
   - Added `projectSlug` prop alongside existing `projectId` prop
   - Updated all `router.push()` calls to use `projectSlug` instead of `projectId`
   - Updated all `<Link href>` attributes to use `projectSlug` instead of `projectId`
   - Kept `projectId` for tRPC queries (UUID required for DB lookups)

2. **Parent Page Updates (7 pages):**
   - Updated all parent pages to pass both `projectId` and `projectSlug` to components
   - Extracted `project.slug` from resolved project data
   - Maintained backward compatibility with existing tRPC queries

## Deviations from Plan

None - plan executed exactly as written. All components and pages updated systematically following the dual-prop pattern.

## Technical Details

### Dual-Prop Pattern

Components now accept two props for different purposes:

```typescript
interface ComponentProps {
  projectId: string;        // For tRPC queries (UUID)
  projectSlug: string;      // For navigation URLs (slug)
}
```

**Navigation (uses slug):**
```typescript
router.push(`/projects/${projectSlug}/change-orders/new`)
<Link href={`/projects/${projectSlug}/payment-apps/${id}`}>
```

**Data fetching (uses UUID):**
```typescript
trpc.changeOrder.list.useQuery({ projectId })
```

### Migration Flow

**Before (Phase 16-05):**
- Pages: Migrated to `[projectSlug]` routes ✅
- Components: Still using `projectId` (UUID) for navigation ❌
- Result: URLs reverted to UUID format when navigating

**After (Phase 16-07):**
- Pages: Using `[projectSlug]` routes ✅
- Components: Using `projectSlug` for navigation ✅
- Result: URLs maintain slug format throughout app ✅

### Components Updated

**Change Orders:**
- `change-order-list.tsx` - List view navigation
- `change-order-form.tsx` - Success/cancel navigation
- `change-order-detail.tsx` - Back button navigation

**Bidding:**
- `rfq-form.tsx` - Success navigation
- `bid-comparison-table.tsx` - Award success navigation

**Payment Apps:**
- `payment-app-list.tsx` - Link hrefs to detail pages

**Workflows:**
- `workflow-list.tsx` - Row click navigation
- `create-workflow-dialog.tsx` - Success navigation
- `workflow-detail.tsx` - Document link navigation

### Pages Updated

**Change Orders:**
- `change-orders/page.tsx` - List page
- `change-orders/new/page.tsx` - Create page
- `change-orders/[changeOrderId]/page.tsx` - Detail page

**RFQs:**
- `rfqs/new/page.tsx` - Create page
- `rfqs/[rfqId]/compare/page.tsx` - Comparison page

**Other:**
- `payment-apps/page.tsx` - Payment apps list
- `documents/page.tsx` - WorkflowList component

## Verification Results

### Navigation URL Tests

All navigation URLs now use slug format:

```bash
# Before
/projects/550e8400-e29b-41d4-a716-446655440000/change-orders/new

# After
/projects/construction-plaza/change-orders/new
```

**Grep Verification:**
- `router.push.*projectId`: 0 matches ✅
- `href=.*projectId`: 0 matches ✅
- `projectId:` in tRPC queries: Still present ✅

### TypeScript Compilation

```bash
npm run build
```

Result: Success with no type errors ✅

### UAT Test 24 Resolution

**Test:** Navigate to project → Change Orders → New Change Order

**Expected URL:** `/projects/{slug}/change-orders/new`

**Result:** PASS ✅ - URL maintains slug format

## Commits

1. **42ede98** - `feat(16-07): update component interfaces to accept projectSlug for navigation`
   - Updated 9 component files
   - Added projectSlug prop to interfaces
   - Changed all router.push and Link href to use projectSlug

2. **cec8439** - `feat(16-07): update parent pages to pass projectSlug to components`
   - Updated 7 parent page files
   - Pass both projectId and projectSlug to components
   - Extract project.slug from resolved project data

## Impact

**User-Facing:**
- URLs now readable and shareable (slug instead of UUID)
- Browser history shows meaningful project names
- Deep links work correctly with slug format

**Developer-Facing:**
- Clear separation: slug for navigation, UUID for queries
- Type-safe dual-prop pattern
- No breaking changes to tRPC API

**Performance:**
- No impact (slug already resolved at page level)
- No additional queries (project data already cached)

## Follow-up Work

None required - migration complete. All components and pages now use slug-based navigation consistently.

## Self-Check: PASSED

**Files verified:**
- ✅ All 16 modified files exist
- ✅ No `router.push` with `projectId` in components
- ✅ No `href` with `projectId` in components
- ✅ `projectId` still used for tRPC queries

**Commits verified:**
- ✅ Commit 42ede98 exists (Task 1)
- ✅ Commit cec8439 exists (Task 2)
- ✅ Both commits have descriptive messages
- ✅ Commits include all expected file changes

**Functionality verified:**
- ✅ TypeScript compilation succeeds
- ✅ UAT Test 24 passes (URLs use slug format)
- ✅ Navigation URLs maintain slug throughout app
- ✅ tRPC queries still use UUID (no API changes)
