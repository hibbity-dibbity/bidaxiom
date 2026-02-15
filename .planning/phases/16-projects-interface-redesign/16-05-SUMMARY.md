---
phase: 16-projects-interface-redesign
plan: "05"
subsystem: routing
tags: [routing, migration, slug-urls, ui]
dependency-graph:
  requires: ["16-03", "16-04"]
  provides: ["slug-based-project-routes", "persistent-project-header"]
  affects: ["project-detail", "project-sections", "project-navigation"]
tech-stack:
  added: []
  patterns: ["slug-based-routing", "cached-query-resolution", "layout-driven-data"]
key-files:
  created: [
    "apps/web/app/(dashboard)/projects/[projectSlug]/documents/page.tsx",
    "apps/web/app/(dashboard)/projects/[projectSlug]/budget/page.tsx",
    "apps/web/app/(dashboard)/projects/[projectSlug]/budget/line-items/page.tsx",
    "apps/web/app/(dashboard)/projects/[projectSlug]/commitments/page.tsx",
    "apps/web/app/(dashboard)/projects/[projectSlug]/commitments/new/page.tsx",
    "apps/web/app/(dashboard)/projects/[projectSlug]/change-orders/page.tsx",
    "apps/web/app/(dashboard)/projects/[projectSlug]/change-orders/new/page.tsx",
    "apps/web/app/(dashboard)/projects/[projectSlug]/change-orders/[changeOrderId]/page.tsx",
    "apps/web/app/(dashboard)/projects/[projectSlug]/sov/page.tsx",
    "apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/page.tsx",
    "apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/new/page.tsx",
    "apps/web/app/(dashboard)/projects/[projectSlug]/payment-apps/[paymentAppId]/page.tsx",
    "apps/web/app/(dashboard)/projects/[projectSlug]/invoices/page.tsx",
    "apps/web/app/(dashboard)/projects/[projectSlug]/rfqs/page.tsx",
    "apps/web/app/(dashboard)/projects/[projectSlug]/rfqs/new/page.tsx",
    "apps/web/app/(dashboard)/projects/[projectSlug]/rfqs/[rfqId]/page.tsx",
    "apps/web/app/(dashboard)/projects/[projectSlug]/rfqs/[rfqId]/compare/page.tsx"
  ]
  modified: [
    "apps/web/components/project/project-form.tsx",
    "apps/web/app/(dashboard)/projects/components/columns.tsx"
  ]
  deleted: [
    "apps/web/app/(dashboard)/projects/[projectId]/**/*"
  ]
decisions:
  - title: "Slug-based routing for all project sections"
    rationale: "Using slug parameter instead of UUID makes URLs bookmarkable, shareable, and SEO-friendly"
    alternatives: ["Keep UUID-based routing", "Dual support for both slug and UUID"]
    chosen: "Slug-only routing"
    impact: "All existing project bookmarks will break, but new URLs are much more user-friendly"
  - title: "Cached query resolution pattern"
    rationale: "Layout fetches project by slug once, child pages reuse cached data via React Query"
    alternatives: ["Each page fetches independently", "Server components with prop drilling"]
    chosen: "Cached query resolution"
    impact: "Zero additional API calls for section navigation, instant page transitions"
  - title: "Removed duplicate headers and breadcrumbs"
    rationale: "Persistent header in layout already shows project name and job number"
    alternatives: ["Keep both layout and page headers", "Remove layout header"]
    chosen: "Remove page-level duplicate headers"
    impact: "Cleaner UI, no visual duplication, focus on content"
metrics:
  duration: 38
  tasks_completed: 2
  files_changed: 19
  lines_added: 324
  lines_removed: 1561
  commits: 2
completed_at: "2026-02-15"
---

# Phase 16 Plan 05: Migrate Project Section Pages to Slug-Based Routing Summary

Completed full routing migration from UUID-based ([projectId]) to slug-based ([projectSlug]) URLs for all 17 project section pages with persistent header preservation.

## Changes

### Task 1: Migrate All Section Pages (17 files)

**Pattern Applied:**
```typescript
// Old pattern - direct projectId usage
const { projectId } = params;
const { data: documents } = trpc.document.list.useQuery({ projectId });

// New pattern - slug resolution with cached query
const { projectSlug } = params;
const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
const projectId = project?.id;
const { data: documents } = trpc.document.list.useQuery(
  { projectId: projectId! },
  { enabled: !!projectId }
);
```

**Migrated Pages:**
1. `documents/page.tsx` - Document management
2. `budget/page.tsx` - Budget dashboard
3. `budget/line-items/page.tsx` - Line item management
4. `commitments/page.tsx` - Commitment list
5. `commitments/new/page.tsx` - New commitment form
6. `change-orders/page.tsx` - Change order list
7. `change-orders/new/page.tsx` - New change order form
8. `change-orders/[changeOrderId]/page.tsx` - Change order detail
9. `sov/page.tsx` - Schedule of Values editor
10. `payment-apps/page.tsx` - Payment app list
11. `payment-apps/new/page.tsx` - New payment app form
12. `payment-apps/[paymentAppId]/page.tsx` - Payment app detail
13. `invoices/page.tsx` - Invoice tracking
14. `rfqs/page.tsx` - RFQ list
15. `rfqs/new/page.tsx` - New RFQ form
16. `rfqs/[rfqId]/page.tsx` - RFQ detail
17. `rfqs/[rfqId]/compare/page.tsx` - Bid comparison

**Key Optimizations:**
- React Query caches `getBySlug` call from layout - section pages get instant data access
- All queries guarded with `{ enabled: !!projectId }` to prevent premature execution
- Removed duplicate page headers (layout provides project name/job number)
- Removed breadcrumbs that duplicate layout's persistent header
- Internal links updated from `/projects/${projectId}/` to `/projects/${projectSlug}/`

**Deleted:**
- Entire `apps/web/app/(dashboard)/projects/[projectId]` directory (18 files)

### Task 2: Update Project Creation and Links

**Project Form (`project-form.tsx`):**
```typescript
// Changed redirect after creation
- router.push(`/projects/${data.id}`);
+ router.push(`/projects/${data.slug}`);
```

**Projects List (`columns.tsx`):**
```typescript
// Changed from client-side slug generation to server-provided field
interface Project {
-  id: string;
-  jobNumber: string | null;
-  name: string;
+  id: string;
+  slug: string;  // Use server-provided slug
+  jobNumber: string | null;
+  name: string;
}

// Simplified link generation
- const projectSlug = getProjectSlug(project);  // Client-side calculation
- href={`/projects/${projectSlug}`}
+ href={`/projects/${project.slug}`}  // Server-provided slug
```

## URL Structure

### Before (Plan 16-04)
```
/projects/{uuid}                          # Overview (slug-based)
/projects/{uuid}/documents                # Section (UUID-based)
/projects/{uuid}/budget                   # Section (UUID-based)
... all other sections use UUID
```

### After (Plan 16-05)
```
/projects/{slug}                          # Overview
/projects/{slug}/documents                # Section
/projects/{slug}/budget                   # Section
/projects/{slug}/budget/line-items        # Nested section
/projects/{slug}/change-orders/{id}       # Detail with both params
/projects/{slug}/rfqs/{id}/compare        # Deep nested route
```

## Performance Impact

**Before (UUID-based):**
- Each section navigation: Full page reload
- No data caching between sections
- URL not user-friendly (UUID-based)

**After (Slug-based with layout):**
- Section navigation: Instant (cached query)
- Zero additional API calls for project data
- URL shareable and bookmarkable
- Header persists across all sections (no flash/reload)

## Testing Checklist

- [x] All 17 section pages render under `/projects/{slug}/` URLs
- [x] Layout's cached `getBySlug` query provides instant data to children
- [x] Tab navigation preserves persistent header (no flicker)
- [x] Deep links work: `/projects/{slug}/change-orders/{id}`
- [x] Project creation redirects to `/projects/{slug}`
- [x] Projects list links use slug URLs
- [x] Old `/projects/{uuid}` routes return 404
- [x] No TypeScript compilation errors
- [x] All queries properly guarded with `enabled` flags

## Deviations from Plan

None - plan executed exactly as written.

## Breaking Changes

**URL Migration:**
- All existing `/projects/{uuid}/...` bookmarks will break
- Users need to navigate from projects list to get new slug-based URLs
- Search engines will need to re-crawl project pages (if public)

**Mitigation:**
- Could add redirect logic: `[projectId]/page.tsx` → detect UUID → lookup slug → redirect to slug URL
- Not implemented in this phase (would add complexity)
- Better UX: Clear URLs from the start, users adapt quickly

## Related Work

- **Phase 16 Plan 01:** Added `slug` column to projects table
- **Phase 16 Plan 02:** Implemented `getBySlug` tRPC procedure
- **Phase 16 Plan 03:** Created projects list with slug links
- **Phase 16 Plan 04:** Built layout with persistent header
- **Phase 16 Plan 05:** This plan - migrated all section pages

## Self-Check: PASSED

**Created files exist:**
```bash
FOUND: apps/web/app/(dashboard)/projects/[projectSlug]/documents/page.tsx
FOUND: apps/web/app/(dashboard)/projects/[projectSlug]/budget/page.tsx
FOUND: apps/web/app/(dashboard)/projects/[projectSlug]/rfqs/[rfqId]/compare/page.tsx
... (all 17 files verified)
```

**Modified files exist:**
```bash
FOUND: apps/web/components/project/project-form.tsx (router.push change)
FOUND: apps/web/app/(dashboard)/projects/components/columns.tsx (slug field usage)
```

**Old directory removed:**
```bash
NOT FOUND: apps/web/app/(dashboard)/projects/[projectId]/ (correctly deleted)
```

**Commits exist:**
```bash
FOUND: 9bbfe68 (feat(16-05): migrate all section pages from [projectId] to [projectSlug])
FOUND: 962d5bb (feat: update project URLs to use slug field)
```

All files created, modified correctly, and old UUID-based routes removed. Migration complete.
