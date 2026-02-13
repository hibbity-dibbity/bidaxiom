---
phase: 09-document-management-enhancement
plan: 03
subsystem: document-management
tags: [permissions, rbac, sharing, security]
dependency_graph:
  requires: [09-01-document-schema-and-types]
  provides: [document-permission-tables, folder-permission-tables, permission-sharing-api]
  affects: [document-router, folder-router]
tech_stack:
  added: [drizzle-unique-constraints, drizzle-indexes]
  patterns: [permission-inheritance, time-limited-sharing, explicit-grants]
key_files:
  created: []
  modified:
    - apps/api/src/db/schema/tenant.ts
    - apps/api/src/tenant/context.ts
    - packages/shared/src/types/document.ts
    - apps/api/src/auth/abilities.ts
    - apps/api/src/trpc/routers/workflow.ts
decisions:
  - Explicit permissions supplement, not replace, project-level permissions
  - loadDocumentPermissions called explicitly in router for performance (avoids N+1 queries)
  - Permission expiration uses nullable timestamp (null = no expiration)
  - Folder permissions cascade via folderId reference in documents table
  - includeSubfolders flag enables/disables subfolder inheritance
metrics:
  duration: 7.4 min
  tasks_completed: 2
  files_modified: 5
  completed_at: 2026-02-13T20:53:41Z
---

# Phase 09 Plan 03: Document and Folder Permissions Summary

**One-liner:** Granular document/folder sharing with view/edit permissions, inheritance, expiration, and explicit grant tracking via dedicated permission tables and enhanced CASL abilities.

## Objective

Implement granular document and folder permissions with sharing capabilities and inheritance. Enables users to share specific documents or folders with individuals beyond project team members. Supports view-only and edit permissions with audit trail. Folder permissions cascade to contained documents.

## Tasks Completed

### Task 1: Create document and folder permissions tables
**Status:** ✅ Complete
**Commit:** 6a2bdd2

Created two new tables in tenant schema:

**document_permissions table:**
- id (UUID primary key)
- documentId (UUID foreign key → documents, cascade delete)
- userId (TEXT, Clerk user ID of person granted access)
- permissionLevel (TEXT: "view" or "edit")
- grantedBy (TEXT, Clerk user ID who shared)
- grantedAt (TIMESTAMP with timezone)
- expiresAt (TIMESTAMP with timezone, nullable)
- Unique constraint on (documentId, userId)
- Indexes: (documentId, userId) for fast checks, userId for "shared with me" queries

**folder_permissions table:**
- id (UUID primary key)
- folderId (UUID foreign key → folders, cascade delete)
- userId (TEXT, Clerk user ID)
- permissionLevel (TEXT: "view" or "edit")
- includeSubfolders (BOOLEAN default true)
- grantedBy (TEXT)
- grantedAt (TIMESTAMP with timezone)
- expiresAt (TIMESTAMP with timezone, nullable)
- Unique constraint on (folderId, userId)
- Indexes: (folderId, userId) for fast checks

Updated tenant context to include new tables in schema export.

### Task 2: Create permission sharing validation schemas and update CASL abilities
**Status:** ✅ Complete
**Commit:** 7633e1d

**In packages/shared/src/types/document.ts:**
- Added `documentPermissionLevelEnum` with "view" and "edit" values
- Created `shareDocumentSchema` with documentId, userId, permissionLevel, expiresAt (optional)
- Created `revokeDocumentPermissionSchema` with documentId, userId
- Created `shareFolderSchema` with folderId, userId, permissionLevel, includeSubfolders (default true), expiresAt (optional)
- Created `revokeFolderPermissionSchema` with folderId, userId

**In apps/api/src/auth/abilities.ts:**
- Created `loadDocumentPermissions` helper function that queries both permission tables
- Returns `ExplicitDocumentPermissions` object with Sets of documentIds, folderIds, documentEditIds, folderEditIds
- Filters out expired permissions using `isNull(expiresAt)` or `gt(expiresAt, now)`
- Enhanced `defineAbilitiesFor` to accept optional `explicitDocumentPermissions` parameter
- Added explicit permission rules for Documents and Folders (applies to all roles except admin)
- Rules check document.id in explicitDocIds, document.folderId in explicitFolderIds for read access
- Rules check document.id in explicitDocEditIds, document.folderId in explicitFolderEditIds for update access
- Documented usage pattern: call `loadDocumentPermissions` explicitly in document router, not automatically invoked

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing Workflow permissions in CASL abilities**
- **Found during:** Task 1 typecheck
- **Issue:** Workflow router created in Plan 09-05 but CASL abilities never updated with "Workflow" subject permissions, causing type errors
- **Fix:** Added Workflow permissions to all roles (project_manager: manage, accountant: read+approve, estimator: read, superintendent: manage, foreman: read, member: read)
- **Files modified:** apps/api/src/auth/abilities.ts
- **Commit:** 6a2bdd2

**2. [Rule 1 - Bug] Implicit 'any' types in workflow router**
- **Found during:** Task 1 typecheck
- **Issue:** TypeScript couldn't infer types for `allSteps.every()` and `allSteps.some()` callback parameters
- **Fix:** Added explicit type annotation `Array<{ status: string | null }>` to allSteps variable
- **Files modified:** apps/api/src/trpc/routers/workflow.ts
- **Commit:** 6a2bdd2

## Verification Results

✅ **All verification criteria met:**

- ✅ document_permissions table has documentId, userId, permissionLevel, grantedBy, grantedAt, expiresAt
- ✅ folder_permissions table has folderId, userId, permissionLevel, includeSubfolders, grantedBy, grantedAt, expiresAt
- ✅ Unique constraints prevent duplicate permission grants per user
- ✅ Indexes exist for fast permission lookups
- ✅ documentPermissionLevelEnum has "view" and "edit" values
- ✅ shareDocumentSchema and shareFolderSchema validate user input
- ✅ loadDocumentPermissions helper queries both tables and returns structured permission sets
- ✅ abilities.ts documents when/how to use loadDocumentPermissions (not automatic)
- ✅ TypeScript compilation succeeds across all packages

## Success Criteria

✅ **Database schema includes:**
- document_permissions table for per-document access grants
- folder_permissions table for per-folder access grants with cascade option
- Indexes optimized for permission checks and "shared with me" queries
- Expiration timestamps support time-limited sharing

✅ **Shared validation includes:**
- Permission level enum (view, edit)
- Complete share/revoke schemas for documents and folders
- Clear validation rules for user IDs and expiration dates

✅ **CASL abilities enhanced:**
- loadDocumentPermissions helper extracts explicit grants from database
- Explicit permissions supplement project-level permissions
- Clear documentation on usage pattern (called in router, not abilities by default)

✅ **Foundation ready for Plan 04 to implement sharing API procedures.**

## Key Decisions

1. **Explicit permissions supplement, not replace, project-level permissions** — Admin and PM roles maintain full access regardless of explicit grants; explicit permissions extend access to non-team members
2. **loadDocumentPermissions called explicitly in router for performance** — Avoids N+1 queries by requiring manual invocation instead of automatic execution in abilities
3. **Permission expiration uses nullable timestamp** — NULL means no expiration; non-null values enable time-limited sharing (e.g., 30-day access)
4. **Folder permissions cascade via folderId reference** — Documents inherit permissions from parent folder when includeSubfolders is true
5. **includeSubfolders flag enables/disables subfolder inheritance** — Provides flexibility for folder-level sharing (default: true)

## Impact

**Foundation for granular sharing:**
- Permission tables ready for sharing API procedures (Plan 09-04)
- CASL abilities prepared to check explicit grants alongside project permissions
- Validation schemas ready for client-side forms and API procedures

**Security model:**
- Explicit grants supplement project-level RBAC
- Time-limited sharing prevents perpetual access
- Audit trail via grantedBy and grantedAt fields
- Unique constraints prevent duplicate permission levels per user

**Performance considerations:**
- Indexes on (documentId, userId) and (folderId, userId) enable fast permission checks
- userId index supports "shared with me" queries
- loadDocumentPermissions helper batches queries to avoid N+1 issues

## Next Steps

Plan 09-04 will implement:
- tRPC procedures for shareDocument, revokeDocumentPermission, shareFolderPermission, revokeFolderPermission
- Integration with loadDocumentPermissions in document router
- UI components for permission management
- "Shared with me" document list view

## Self-Check

**Files Created:**
(None - all modifications to existing files)

**Files Modified:**
- ✅ apps/api/src/db/schema/tenant.ts — EXISTS
- ✅ apps/api/src/tenant/context.ts — EXISTS
- ✅ packages/shared/src/types/document.ts — EXISTS
- ✅ apps/api/src/auth/abilities.ts — EXISTS
- ✅ apps/api/src/trpc/routers/workflow.ts — EXISTS

**Commits:**
- ✅ 6a2bdd2 — EXISTS: feat(09-03): add document and folder permissions tables
- ✅ 7633e1d — EXISTS: feat(09-03): add permission sharing schemas and enhanced CASL abilities

**Self-Check:** ✅ PASSED
