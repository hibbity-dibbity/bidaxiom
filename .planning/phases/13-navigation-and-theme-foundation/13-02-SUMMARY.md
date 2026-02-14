---
phase: 13-navigation-and-theme-foundation
plan: 02
subsystem: company-branding
tags: [storage, s3, company-config, branding]
dependency-graph:
  requires: [phase-03-document-storage]
  provides: [company-logo-backend]
  affects: []
tech-stack:
  added: []
  patterns: [s3-presigned-urls, tenant-isolation]
key-files:
  created: []
  modified:
    - apps/api/src/db/schema/tenant.ts
    - packages/shared/src/types/company.ts
    - apps/api/src/storage/presigned.ts
    - apps/api/src/trpc/routers/company.ts
decisions: []
metrics:
  duration: 3 min
  completed: 2026-02-14T23:56:00Z
---

# Phase 13 Plan 02: Company Logo Backend Summary

**One-liner:** Company logo storage backend with S3 upload/download and admin-controlled management

## What Was Built

Added backend support for company logo storage using existing S3 infrastructure from Phase 3 document management. Companies can now upload logos stored in tenant-isolated S3 buckets with pre-signed URL access patterns.

### Database Schema

**apps/api/src/db/schema/tenant.ts**:
- Added `logoStorageKey` column to `company_profiles` table (nullable text)
- Storage key format: `tenants/{tenantId}/branding/logo.{ext}`
- Follows Phase 3 tenant isolation pattern

**packages/shared/src/types/company.ts**:
- Added `logoStorageKey` field to `CompanyConfig` schema (optional, nullable)
- Backward compatible with existing profiles without logos

### Storage Service

**apps/api/src/storage/presigned.ts**:
Added three logo-specific functions:
- `generateLogoUploadUrl(tenantId, fileExtension)` - Pre-signed PUT URL (15 min expiry)
- `generateLogoDownloadUrl(storageKey)` - Pre-signed GET URL (1 hour expiry)
- `deleteLogoFromStorage(storageKey)` - S3 object deletion

### tRPC Procedures

**apps/api/src/trpc/routers/company.ts**:
Added three new procedures to company router:

1. **uploadLogo** (mutation)
   - Input: `{ fileExtension: "png" | "jpg" | "jpeg" | "svg" | "webp" }`
   - Returns: `{ uploadUrl, storageKey }`
   - Permission: `manage CompanySettings` (admin-only)
   - Updates `logoStorageKey` in database before upload

2. **getLogo** (query)
   - Returns: `{ logoUrl: string | null }`
   - Permission: All organization members
   - Generates fresh download URL on each call

3. **deleteLogo** (mutation)
   - Returns: `{ success: true }`
   - Permission: `manage CompanySettings` (admin-only)
   - Removes S3 object and clears database reference

## Deviations from Plan

None - plan executed exactly as written.

## Technical Decisions

1. **Storage key updated before upload**: Database receives storage key immediately when admin requests upload URL, preventing race conditions if user uploads logo slowly.

2. **Supported image formats**: Limited to `png`, `jpg`, `jpeg`, `svg`, `webp` to prevent upload of non-image files.

3. **ContentType auto-detection**: SVG files get `image/svg+xml` MIME type, others get `image/{extension}`.

4. **Safe delete operation**: `deleteLogo` procedure is idempotent - safe to call even if no logo exists.

## Files Modified

### Created
None (all existing files modified)

### Modified
- `apps/api/src/db/schema/tenant.ts` - Added logoStorageKey column
- `packages/shared/src/types/company.ts` - Added logoStorageKey to schema
- `apps/api/src/storage/presigned.ts` - Added logo upload/download/delete functions
- `apps/api/src/trpc/routers/company.ts` - Added uploadLogo, getLogo, deleteLogo procedures

## Verification

### Server Startup
✅ API server starts without compilation errors
✅ tRPC router includes new procedures
✅ Storage service functions compile correctly

### Type Safety
✅ Drizzle schema infers logoStorageKey column
✅ CompanyConfig type includes logoStorageKey field
✅ TypeScript compilation passes in shared package

### Database Schema
- Schema change ready for migration (column added to Drizzle definition)
- Migration script will be created separately when schema is deployed

## Next Steps

1. **Database migration**: Create migration script to add `logoStorageKey` column to existing `company_profiles` tables
2. **Frontend integration**: Build UI for logo upload in company settings (Plan 13-03 or later)
3. **Logo display**: Add logo to navigation bar and other UI locations (THEME-09 full implementation)

## Commits

| Hash    | Message                                                      |
| ------- | ------------------------------------------------------------ |
| 85c42cd | feat(13-02): add logoStorageKey to company_profiles schema   |
| 0427ef5 | feat(13-02): implement logo upload/download/delete procedures |

## Self-Check: PASSED

**Files created:** N/A (all modifications)

**Files modified:**
- FOUND: apps/api/src/db/schema/tenant.ts
- FOUND: packages/shared/src/types/company.ts
- FOUND: apps/api/src/storage/presigned.ts
- FOUND: apps/api/src/trpc/routers/company.ts

**Commits:**
- FOUND: 85c42cd
- FOUND: 0427ef5

All artifacts verified successfully.
