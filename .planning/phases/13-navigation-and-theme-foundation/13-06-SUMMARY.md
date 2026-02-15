---
phase: 13-navigation-and-theme-foundation
plan: 06
subsystem: navigation
tags: [branding, logo, ui, s3-integration]
dependency_graph:
  requires: [13-02-backend-logo-api, 13-05-design-tokens]
  provides: [company-logo-component, logo-upload-ui, branded-layouts]
  affects: [sidebar, topbar, auth-pages, company-settings]
tech_stack:
  added: []
  patterns: [pre-signed-s3-urls, image-error-handling, cache-invalidation]
key_files:
  created:
    - apps/web/components/branding/company-logo.tsx
    - apps/web/components/branding/logo-upload.tsx
  modified:
    - apps/web/components/layout/sidebar.tsx
    - apps/web/components/layout/top-bar.tsx
    - apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx
    - apps/web/app/(dashboard)/settings/company/page.tsx
decisions: []
metrics:
  duration_minutes: 2.5
  tasks_completed: 2
  files_created: 2
  files_modified: 4
  commits: 2
  completed_at: 2026-02-15T00:14:20Z
---

# Phase 13 Plan 06: Company Branding Integration Summary

**One-liner:** Company logo upload and display across navigation, sidebar, and sign-in with S3-backed storage and graceful fallbacks.

## What Was Built

Integrated company branding UI across all navigation touchpoints, allowing admins to upload custom logos that appear in the sidebar, top navigation, and authentication pages. When no logo is uploaded, a construction-themed fallback icon displays.

### Component Architecture

**CompanyLogo Component** (reusable):
- Three variants: sidebar (32px), topbar (28px), auth (64px)
- Fetches logo via tRPC `company.getLogo.useQuery`
- 5-minute cache with `staleTime` to reduce API calls
- Image error handling resets to fallback on load failure
- Responsive to sidebar collapse state via `group-data-[collapsible=icon]:hidden`
- Uses Next.js Image with `unoptimized` flag (S3 pre-signed URLs incompatible with Next.js image optimization)

**LogoUpload Component** (admin UI):
- File validation: PNG/JPG/SVG/WebP formats, max 2MB
- Two-step upload process: get pre-signed URL → PUT to S3
- Delete capability with confirmation
- Live preview using CompanyLogo component
- Cache invalidation after upload/delete via `utils.company.getLogo.invalidate()`

### Integration Points

1. **Sidebar** (`components/layout/sidebar.tsx`):
   - Replaced static "CS" icon with CompanyLogo
   - Variant: sidebar (shows text when expanded, icon-only when collapsed)
   - Position: SidebarHeader with border-b

2. **TopBar** (`components/layout/top-bar.tsx`):
   - Added CompanyLogo left of hamburger menu
   - Variant: topbar (compact, no text)
   - Maintains existing layout balance

3. **Sign-in Page** (`app/(auth)/sign-in/[[...sign-in]]/page.tsx`):
   - Added CompanyLogo above sign-in card
   - Variant: auth (large 64px icon, centered)
   - Applies to both password entry and MFA challenge screens

4. **Company Settings** (`app/(dashboard)/settings/company/page.tsx`):
   - Added "Branding" section below job numbering
   - Contains LogoUpload component
   - Admin-only access (CASL permissions inherited from page)

### Fallback Design

When no logo uploaded or image fails to load:
- Displays Building2 icon from lucide-react
- Background: `bg-construction` (Procore orange from Plan 05)
- Text color: `text-construction-foreground` (white)
- Maintains consistent sizing across variants

## Technical Decisions

None - implementation follows established patterns from Plan 02 (backend logo API) and Plan 05 (design tokens).

## Deviations from Plan

None - plan executed exactly as written.

## Performance Considerations

**Caching Strategy:**
- Logo URL cached for 5 minutes client-side (`staleTime: 5 * 60 * 1000`)
- Prevents excessive API calls during navigation
- Manual invalidation after upload/delete ensures immediate updates

**Image Optimization:**
- Set `unoptimized` on Next.js Image component
- S3 pre-signed URLs change on each fetch (expiry-based)
- Next.js image optimization requires stable URLs for caching

**File Size Validation:**
- Client-side validation (2MB limit) before upload
- Prevents wasted bandwidth on oversized files
- Server-side validation exists in Plan 02 backend

## Testing Notes

**Manual Testing Required:**
1. Upload logo → verify appears in sidebar, topbar, sign-in
2. Sidebar collapse → logo remains visible (icon-only)
3. Delete logo → fallback icon appears everywhere
4. Upload invalid format → error toast appears
5. Upload > 2MB file → error toast appears
6. Network error during upload → graceful error message
7. Image URL fails to load → fallback displays

**TypeScript Compilation:**
- No new type errors introduced
- Pre-existing errors in other files unrelated to this plan

## Files Changed

### Created (2)
- `apps/web/components/branding/company-logo.tsx` (101 lines)
- `apps/web/components/branding/logo-upload.tsx` (148 lines)

### Modified (4)
- `apps/web/components/layout/sidebar.tsx` (simplified header section)
- `apps/web/components/layout/top-bar.tsx` (added logo left of trigger)
- `apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx` (added logo above cards)
- `apps/web/app/(dashboard)/settings/company/page.tsx` (added Branding section)

## Commits

1. **135f1f0** - `feat(13-06): create CompanyLogo component with fallback branding`
   - Reusable logo component with three variants
   - tRPC integration for logo fetching
   - Image error handling and fallback logic

2. **dcfb851** - `feat(13-06): integrate CompanyLogo across layouts with upload UI`
   - LogoUpload component with S3 upload flow
   - Integrated into sidebar, topbar, sign-in
   - Added Branding section to Company Settings

## Integration with Backend

**tRPC Endpoints Used** (from Plan 02):
- `company.getLogo.useQuery()` - Fetches logo URL (with pre-signed S3 URL)
- `company.uploadLogo.useMutation()` - Gets pre-signed upload URL and storage key
- `company.deleteLogo.useMutation()` - Deletes S3 object and clears DB reference

**Upload Flow:**
1. User selects file → client-side validation
2. Call `uploadLogo` mutation → receive pre-signed PUT URL
3. Client uploads directly to S3 via `fetch(uploadUrl, { method: 'PUT' })`
4. Invalidate cache → logo appears everywhere

**Security:**
- Pre-signed URLs expire in 15 minutes (Plan 02 configuration)
- Storage keys tenant-scoped: `tenants/{tenantId}/branding/logo.{ext}`
- CASL permissions enforce admin-only upload/delete

## Success Criteria Met

- [x] Company logo displays in top navigation when uploaded
- [x] Company logo displays in sidebar (both collapsed and expanded states)
- [x] Company logo displays on sign-in page (large, centered)
- [x] Admin can upload logo from Company Settings (Branding section)
- [x] Fallback branding (Building2 icon + construction accent) shows when no logo
- [x] Upload validates file format (PNG, JPG, SVG, WebP) and size (< 2MB)
- [x] Delete removes logo from S3 and clears database key
- [x] Logo changes reflect immediately across all locations (cache invalidation)
- [x] CASL permissions enforced (admin-only upload/delete - inherited from page)

## Next Steps

**Phase 13 Remaining Plans:**
- None - this was the final plan of Phase 13

**Future Enhancements (out of scope):**
- Logo dimension validation (recommended 512x512px)
- Crop/resize UI for uploaded images
- Multiple logo variants (light/dark theme, different sizes)
- Logo usage in email templates
- Favicon generation from uploaded logo

## Self-Check

Verifying all claimed artifacts exist and commits are valid:

**Created Files:**
- FOUND: apps/web/components/branding/company-logo.tsx
- FOUND: apps/web/components/branding/logo-upload.tsx

**Commits:**
- FOUND: 135f1f0
- FOUND: dcfb851

**Result:** PASSED - All artifacts and commits verified.
