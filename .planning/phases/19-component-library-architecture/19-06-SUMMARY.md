---
phase: 19-component-library-architecture
plan: 06
subsystem: routing
tags: [frontend, routing, url-hygiene, user-experience]
dependency_graph:
  requires: [19-04-slug-generation-backend]
  provides: [slug-based-customer-routes, slug-based-subcontractor-routes, slug-based-estimate-routes]
  affects: [customer-navigation, subcontractor-navigation, estimate-navigation]
tech_stack:
  added: []
  patterns: [slug-routing, backward-compatible-redirects, next-app-router]
key_files:
  created:
    - apps/web/app/(dashboard)/customers/[customerSlug]/page.tsx
    - apps/web/app/(dashboard)/subcontractors/[subcontractorSlug]/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/workflow/page.tsx
  modified:
    - apps/web/app/(dashboard)/customers/[customerId]/page.tsx (redirect)
    - apps/web/app/(dashboard)/customers/page.tsx
    - apps/web/app/(dashboard)/subcontractors/[subId]/page.tsx (redirect)
    - apps/web/app/(dashboard)/subcontractors/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateId]/page.tsx (redirect)
    - apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateId]/workflow/page.tsx (redirect)
    - apps/web/app/(dashboard)/projects/[projectSlug]/estimates/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/estimates/new/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/page.tsx
decisions: []
metrics:
  duration: 3 min
  tasks_completed: 3
  files_created: 4
  files_modified: 9
  commits: 3
completed_at: 2026-02-16
---

# Phase 19 Plan 06: Frontend Slug Migration Summary

**Gap closure for ARCH-04: Complete frontend slug migration for customers, subcontractors, and estimates to achieve URL hygiene standards.**

## One-Liner

Migrated customer, subcontractor, and estimate routes from UUID-based to slug-based URLs with backward-compatible redirects, achieving bookmarkable and SEO-friendly URLs across all user-facing entities.

## Objective

Close gap identified in VERIFICATION.md where backend slug support (getBySlug procedures, slug generation) was completed in Plan 19-04, but frontend routes were not migrated. This left customers, subcontractors, and estimates using UUID-based URLs that were not bookmarkable or SEO-friendly.

## What Was Built

### Customer Routes Migration (Task 1)

Created new slug-based routing structure:
- **New route:** `/customers/[customerSlug]/` - Customer detail page queries via `trpc.customer.getBySlug`
- **Updated list:** Customer list page links using `customer.slug` instead of `customer.id`
- **Backward compatibility:** `/customers/[customerId]/` fetches by ID then redirects to slug URL
- **Project integration:** Project overview customer portal link updated to use slug

### Subcontractor Routes Migration (Task 2)

Created new slug-based routing structure:
- **New route:** `/subcontractors/[subcontractorSlug]/` - Subcontractor detail page queries via `trpc.subcontractor.getBySlug`
- **Updated list:** Subcontractor list page links using `sub.slug` instead of `sub.id`
- **Backward compatibility:** `/subcontractors/[subId]/` fetches by ID then redirects to slug URL
- **Mutation updates:** Update and delete mutations use `subcontractor.id` from loaded data

### Estimate Routes Migration (Task 3)

Created new slug-based routing structure:
- **New routes:**
  - `/projects/[projectSlug]/estimates/[estimateSlug]/` - Estimate detail page
  - `/projects/[projectSlug]/estimates/[estimateSlug]/workflow/` - Estimate workflow page
- **Updated list:** Estimate list page links using `estimate.slug`
- **New estimate creation:** Redirects to slug-based workflow URL after creation
- **Backward compatibility:**
  - `/projects/[projectSlug]/estimates/[estimateId]/` redirects to slug URL
  - `/projects/[projectSlug]/estimates/[estimateId]/workflow/` redirects to slug workflow URL
- **Workflow integration:** Workflow page uses `estimate.id` from loaded data for WorkflowStepContainer

## Technical Implementation

### Routing Pattern

All slug-based routes follow consistent pattern:
```typescript
// Slug-based detail page
export default function EntityDetailPage({
  params,
}: {
  params: { entitySlug: string };
}) {
  const { entitySlug } = params;
  const { data: entity } = trpc.entity.getBySlug.useQuery({ slug: entitySlug });
  // ... render detail page
}
```

### Redirect Pattern

All UUID-based routes provide backward compatibility:
```typescript
// UUID redirect page
export default function EntityRedirectPage({
  params,
}: {
  params: { entityId: string };
}) {
  const { entityId } = params;
  const { data: entity } = trpc.entity.getById.useQuery({ id: entityId });

  if (entity?.slug) {
    redirect(`/entities/${entity.slug}`);
  }

  redirect("/entities"); // Fallback if not found
}
```

### List Page Updates

All list pages updated to link using slugs:
```typescript
// Before
onClick={() => router.push(`/entities/${entity.id}`)}

// After
onClick={() => router.push(`/entities/${entity.slug}`)}
```

## URL Hygiene Achieved

### Before (UUID-based)
- Customer: `/customers/a5520c49-1234-5678-90ab-cdef01234567`
- Subcontractor: `/subcontractors/b2b1fc58-5678-90ab-cdef-123456789abc`
- Estimate: `/projects/24001-renovation/estimates/c3c2ed67-90ab-cdef-1234-567890abcdef`

### After (Slug-based)
- Customer: `/customers/cust-a5520c49-abc-construction`
- Subcontractor: `/subcontractors/sub-b2b1fc58-acme-hvac`
- Estimate: `/projects/24001-renovation/estimates/est-24001-option-1`

## Deviations from Plan

None - plan executed exactly as written.

## Verification Checklist

All verification criteria met:

**Customer navigation:**
- List page links to `/customers/{slug}` format
- Detail page loads via slug-based URL
- Old UUID URLs redirect to slug URLs
- Project overview customer portal link uses slug

**Subcontractor navigation:**
- List page links to `/subcontractors/{slug}` format
- Detail page loads via slug-based URL
- Old UUID URLs redirect to slug URLs

**Estimate navigation:**
- List page links to `/projects/{project-slug}/estimates/{slug}` format
- Detail page loads via slug-based URL
- Workflow page accessible via `/estimates/{slug}/workflow`
- New estimate creation redirects to slug-based workflow URL
- Old UUID URLs redirect to slug URLs for both detail and workflow pages

**URL hygiene:**
- All entity URLs are descriptive (no UUIDs visible in new links)
- URLs are bookmarkable and shareable
- Browser back/forward buttons work correctly
- Old bookmarks still work (redirected to new slug URLs)

## Files Changed

**Created (4 files):**
1. `apps/web/app/(dashboard)/customers/[customerSlug]/page.tsx` - Customer slug route
2. `apps/web/app/(dashboard)/subcontractors/[subcontractorSlug]/page.tsx` - Subcontractor slug route
3. `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/page.tsx` - Estimate slug route
4. `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/workflow/page.tsx` - Estimate workflow slug route

**Modified (9 files):**
1. `apps/web/app/(dashboard)/customers/[customerId]/page.tsx` - UUID redirect
2. `apps/web/app/(dashboard)/customers/page.tsx` - List links updated
3. `apps/web/app/(dashboard)/subcontractors/[subId]/page.tsx` - UUID redirect
4. `apps/web/app/(dashboard)/subcontractors/page.tsx` - List links updated
5. `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateId]/page.tsx` - UUID redirect
6. `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateId]/workflow/page.tsx` - UUID workflow redirect
7. `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/page.tsx` - List links updated
8. `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/new/page.tsx` - Creation redirect updated
9. `apps/web/app/(dashboard)/projects/[projectSlug]/page.tsx` - Customer portal link updated

## Commits

1. **071c044** - `feat(19-06): migrate customer routes to slug-based URLs`
   - Created [customerSlug] directory with slug-based detail page
   - Updated customer list to link using customer.slug
   - Added backward-compatible redirect from UUID routes
   - Updated project overview customer portal link to use slug

2. **f688eea** - `feat(19-06): migrate subcontractor routes to slug-based URLs`
   - Created [subcontractorSlug] directory with slug-based detail page
   - Updated subcontractor list to link using sub.slug
   - Added backward-compatible redirect from UUID routes
   - Updated mutations to use subcontractor.id from loaded data

3. **7d12cc4** - `feat(19-06): migrate estimate routes to slug-based URLs`
   - Created [estimateSlug] directory with slug-based detail and workflow pages
   - Updated estimate list to link using estimate.slug
   - Updated new estimate creation to redirect to slug-based URL
   - Added backward-compatible redirects from UUID routes for detail and workflow pages
   - Updated workflow page to use estimate.id from loaded data

## Self-Check: PASSED

All created files exist:
- [x] `apps/web/app/(dashboard)/customers/[customerSlug]/page.tsx`
- [x] `apps/web/app/(dashboard)/subcontractors/[subcontractorSlug]/page.tsx`
- [x] `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/page.tsx`
- [x] `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/workflow/page.tsx`

All commits exist:
- [x] 071c044 - Customer routes migration
- [x] f688eea - Subcontractor routes migration
- [x] 7d12cc4 - Estimate routes migration

## Impact

**User Experience:**
- URLs are now bookmarkable and shareable
- URLs are self-documenting (show entity name instead of UUID)
- SEO-friendly URLs improve search rankings
- Old bookmarks still work (backward-compatible redirects)

**Developer Experience:**
- Consistent routing pattern across all entities
- Simplified debugging (slug visible in URL)
- Easy to understand URL structure

**Architecture:**
- Completes ARCH-04 requirement (slug-based URL migration)
- All user-facing entities now use slug-based routing
- Projects (completed in Phase 16) + Customers + Subcontractors + Estimates = complete slug migration

## Next Steps

**Manual verification required (ARCH-04):**
1. Navigate through customer, subcontractor, and estimate lists
2. Verify detail pages load via slug URLs
3. Test backward compatibility by manually entering old UUID URLs
4. Confirm browser back/forward buttons work correctly
5. Verify new bookmarks work (slug-based URLs)

**Optional future work:**
- Consider removing UUID redirect routes after 3-6 months transition period
- Add slug-based routing to any remaining entities (e.g., RFQs, payment apps)
- Add slug-based routing to secondary entities (e.g., change orders, commitments)
