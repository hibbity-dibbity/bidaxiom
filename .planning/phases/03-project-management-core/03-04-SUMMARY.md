---
phase: 03-project-management-core
plan: 04
subsystem: api
tags: [trpc, document-management, s3, versioning, folders, casl, presigned-urls]

# Dependency graph
requires:
  - phase: 03-01
    provides: Project management schema with documents, document_versions, and folders tables
  - phase: 03-02
    provides: S3 storage client and pre-signed URL generation
provides:
  - Complete document lifecycle API (upload, versioning, download, deletion)
  - Folder organization API (create, list, rename)
  - Pre-signed URL generation for client-side uploads
  - Project-level document access control via CASL
affects: [05-document-ui, 06-project-workflow, web-document-upload]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pre-signed URLs for direct client-to-S3 uploads (no proxy)
    - Document versioning with incremental version numbers
    - Denormalized current version metadata for list performance
    - Storage key validation to prevent cross-tenant injection
    - Folder hierarchy with orderIndex for user-defined sorting

key-files:
  created:
    - apps/api/src/trpc/routers/document.ts
  modified:
    - apps/api/src/trpc/router.ts

key-decisions:
  - "Pre-signed URL expiry: 15 minutes for uploads (short-lived security), 1 hour for downloads (user convenience)"
  - "Version numbers are incremental integers (1, 2, 3...) for simple chronological ordering"
  - "Soft delete on documents table - S3 objects remain (orphaned storage cleanup via S3 lifecycle policies)"
  - "Storage key validation enforces tenant prefix to prevent cross-tenant key injection"
  - "Folder orderIndex managed server-side by querying max value - prevents client-side race conditions"

patterns-established:
  - "loadProjectAbilities helper reused from project router for consistent CASL enforcement"
  - "Transaction pattern: create document + first version + update currentVersionId atomically"
  - "Upload flow: client calls getUploadUrl → uploads to S3 via PUT → calls create with storageKey"
  - "All document/folder mutations audit logged with AuditAction enum values"

# Metrics
duration: 4min
completed: 2026-02-12
---

# Phase 03 Plan 04: Document and Folder Management API Summary

**Complete document lifecycle API with pre-signed uploads, version control, folder organization, and project-level CASL permissions**

## Performance

- **Duration:** 4 minutes
- **Started:** 2026-02-12T18:08:58Z
- **Completed:** 2026-02-12T18:13:40Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Implemented 10 tRPC procedures for comprehensive document and folder management
- Pre-signed URL generation for secure client-side uploads (15min expiry) and downloads (1hr expiry)
- Document versioning with automatic version number increment and currentVersionId tracking
- Folder CRUD operations with hierarchical support and automatic orderIndex management
- CASL permission checks on all operations using project team membership scoping
- Complete audit logging for all mutations with proper AuditAction enum values

## Task Commits

Each task was committed atomically:

1. **Task 1: Create document tRPC router with upload, versioning, and folder management** - `a776b2e` (feat)
   - Added 10 procedures: getUploadUrl, create, uploadVersion, list, getDownloadUrl, getVersionHistory, delete, createFolder, listFolders, renameFolder
   - Integrated pre-signed URL generation for direct S3 uploads
   - CASL permission checks via loadProjectAbilities helper
   - Storage key validation to prevent cross-tenant injection

2. **Task 2: Register document router in app router** - `403b05b` (feat)
   - Imported documentRouter from ./routers/document.js
   - Registered in appRouter at document key
   - Router accessible via trpc.document.* from frontend

## Files Created/Modified

- `apps/api/src/trpc/routers/document.ts` - Document and folder management tRPC router with 10 procedures
- `apps/api/src/trpc/router.ts` - Registered documentRouter in appRouter

## Decisions Made

1. **Pre-signed URL expiry times**: Uploads expire in 15 minutes (short-lived for security - user uploads immediately after request), downloads expire in 1 hour (longer for user convenience - viewing PDFs, downloading files).

2. **Incremental version numbers**: Used simple integer sequence (1, 2, 3...) rather than semantic versioning or timestamps. Simpler to implement, sufficient for chronological ordering, and easier for users to understand.

3. **Soft delete strategy**: Deleting a document removes the database record but does NOT delete S3 objects. Orphaned storage cleanup will be handled via S3 lifecycle policies (future work). Prevents accidental data loss and supports potential undelete features.

4. **Storage key validation**: Every uploaded storageKey is validated to start with `tenants/{tenantId}/` to prevent cross-tenant key injection attacks. Critical security measure for tenant isolation.

5. **Server-managed folder orderIndex**: OrderIndex is calculated server-side by querying max value for siblings, then incrementing. Prevents race conditions from concurrent client requests trying to set the same orderIndex.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**TypeScript compilation errors (resolved):**
- Initial implementation passed objects with `projectId` conditions to `throwUnlessCan`, but CASL's ForbiddenError.throwUnlessCan signature is `(action, subject)` without inline conditions
- Fixed by removing condition objects - CASL abilities already configured with `$in` conditions on project IDs from team memberships
- Also fixed AuditAction enum usage - replaced custom strings "upload_version" and "rename" with AuditAction.UPDATE

All issues resolved with clean TypeScript compilation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 03 Plan 05 (Document UI):**
- Complete document API with all CRUD operations
- Pre-signed URLs ready for client-side upload implementation
- Folder structure API ready for tree navigation UI
- CASL permissions enforce project-level access control
- Audit logs capture all document/folder mutations

**Blockers:**
None

**Notes:**
- Frontend will need to implement multi-part upload flow: call getUploadUrl → PUT file to S3 → call create with storageKey
- Version history UI can show all versions via getVersionHistory procedure
- Folder tree UI can use listFolders with recursive calls for nested structure
- Download URLs expire in 1 hour - UI should regenerate if user returns after expiry

## Self-Check: PASSED

All claimed files and commits verified:

**Created files:**
- FOUND: apps/api/src/trpc/routers/document.ts

**Modified files:**
- FOUND: apps/api/src/trpc/router.ts

**Commits:**
- FOUND: a776b2e (Task 1: create document tRPC router)
- FOUND: 403b05b (Task 2: register document router in app router)

---
*Phase: 03-project-management-core*
*Completed: 2026-02-12*
