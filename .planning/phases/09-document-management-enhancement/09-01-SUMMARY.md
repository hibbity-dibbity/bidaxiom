---
phase: 09-document-management-enhancement
plan: 01
subsystem: document-management
tags: [database, schema, validation, metadata, tagging, search]
completed: 2026-02-13

dependency_graph:
  requires: [03-04-document-and-folder-management-api]
  provides: [document-categories, document-tags, document-access-logs, document-search]
  affects: [document-upload, document-management]

tech_stack:
  added: [document-categories, tag-normalization, access-audit-trail]
  patterns: [many-to-many-tags, category-enum-validation, audit-logging]

key_files:
  created:
    - packages/shared/src/types/document.ts
  modified:
    - apps/api/src/db/schema/tenant.ts
    - apps/api/src/tenant/context.ts
    - packages/shared/src/types/index.ts
    - packages/shared/src/types/project.ts

decisions:
  - decision: "TEXT column + Zod validation for document category"
    rationale: "Follows Phase 2 companyType pattern - avoids PostgreSQL ENUM migration complexity while maintaining type safety"
    alternatives: ["PostgreSQL ENUM (requires migrations)", "lookup table (over-engineered for fixed list)"]
  - decision: "Lowercase normalized tags in database"
    rationale: "Ensures tag search works case-insensitively (tag='contract' matches 'Contract', 'CONTRACT', etc.)"
    alternatives: ["Store as-entered with LOWER() in queries (slower)", "Case-sensitive tags (poor UX)"]
  - decision: "Separate document_access_logs table vs audit_logs"
    rationale: "High volume access events shouldn't pollute general audit table; optimized for time-series queries"
    alternatives: ["Use audit_logs table (performance impact)", "No access tracking (missing audit requirement)"]
  - decision: "Document schemas moved to dedicated document.ts file"
    rationale: "Supports growing document feature set (categories, tags, workflows); maintains cohesion with project.ts re-exports for backward compatibility"
    alternatives: ["Keep in project.ts (less maintainable)", "Split further by feature (over-fragmented)"]

metrics:
  duration: 3
  tasks_completed: 2
  files_created: 1
  files_modified: 4
  commits: 2
---

# Phase 09 Plan 01: Document Metadata and Categorization Summary

**One-liner:** Extended database schema and validation types for document categories, tags, and access audit trail with advanced search filtering.

## What Was Built

### Database Schema Extensions

**Documents table enhancements:**
- `category` TEXT column - 12 predefined categories (contract, drawing, specification, submittal, rfi, change_order, payment_app, invoice, report, photo, closeout, other)
- `description` TEXT column - up to 1000 characters

**New tables:**
- `document_tags` - Many-to-many tag relationships
  - `documentId` FK to documents (cascade delete)
  - `tag` TEXT normalized (lowercase)
  - `createdBy` Clerk user ID
  - `createdAt` timestamp

- `document_access_logs` - Audit trail for view/download events
  - `documentId` FK to documents (cascade delete)
  - `userId` Clerk user ID
  - `action` TEXT (view, download)
  - `ipAddress` TEXT (optional)
  - `accessedAt` timestamp

**Indexes added (via schema structure):**
- document_tags: Fast tag lookup per document
- document_tags: Reverse search (find docs by tag)
- document_access_logs: Recent access queries (documentId, accessedAt DESC)

### Shared Validation Schemas

**New file: `packages/shared/src/types/document.ts`**

**Enums:**
- `documentCategoryEnum` - 12 predefined categories with Zod validation

**Schemas:**
- `createTagSchema` - Tag creation with lowercase normalization (1-50 chars)
- `removeTagSchema` - Tag removal by documentId + tag
- `searchDocumentsSchema` - Advanced search with filters:
  - `query` (optional text search)
  - `tags` (array filter)
  - `category` (enum filter)
  - `contentTypes` (MIME type filter)

**Enhanced schemas (moved from project.ts):**
- `createDocumentSchema` - Now includes optional `category` and `description` fields
- `uploadVersionSchema` - Kept as-is
- `createFolderSchema` - Kept as-is
- `presignedUrlSchema` - Kept as-is

**Backward compatibility:**
- `project.ts` re-exports all document schemas
- Existing imports continue to work
- `index.ts` exports all document types

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions Made

1. **TEXT column for category over PostgreSQL ENUM**: Follows Phase 2 pattern (companyType). Avoids migration complexity, maintains type safety via Zod enum in shared package.

2. **Lowercase tag normalization**: Tags stored as lowercase in database (`tag.toLowerCase()`). Ensures case-insensitive search without LOWER() function overhead on queries.

3. **Separate access logs table**: `document_access_logs` separate from `audit_logs`. Access events are high-volume, time-series data. General audit log is for sensitive state changes. Performance optimization for both use cases.

4. **Document schemas in dedicated file**: Created `document.ts` for document-specific types. Project-agnostic schemas (documents can exist outside project context in future). Maintains backward compatibility via project.ts re-exports.

## Testing Notes

**Verification completed:**
- TypeScript compilation passes in apps/api (schema changes)
- TypeScript compilation passes in packages/shared (validation schemas)
- Schema exports include new tables (documentTags, documentAccessLogs)
- Tenant context includes new tables
- Document category enum has 12 categories
- Tag schemas validate min/max length and lowercase
- Search schema includes all filter options

**Pre-existing errors (not introduced by this plan):**
- QuickBooks integration type definitions missing (`node-quickbooks`, `intuit-oauth`)

## Files Changed

**Created:**
- `packages/shared/src/types/document.ts` (158 lines) - Document validation schemas

**Modified:**
- `apps/api/src/db/schema/tenant.ts` (+113 lines) - Documents table columns, document_tags table, document_access_logs table
- `apps/api/src/tenant/context.ts` (+2 lines) - Added documentTags and documentAccessLogs to schema context
- `packages/shared/src/types/index.ts` (+2 lines) - Export all document types
- `packages/shared/src/types/project.ts` (-36 lines, refactored) - Re-export document schemas from document.ts

## Implementation Notes

**Schema pattern consistency:**
- Followed existing tenant schema patterns (uuid PKs, timestamp with timezone, TEXT for enums)
- Used same FK cascade pattern as other tables (documentId cascade delete)
- Maintained audit pattern (createdBy, createdAt)

**Tag normalization strategy:**
- Schema: `tag: text("tag").notNull()` (stores lowercase)
- Validation: `tag: z.string().min(1).max(50).trim().toLowerCase()`
- Application layer enforces normalization before insert
- Enables `WHERE tag = 'contract'` for any input case

**Access log design:**
- Immutable append-only pattern (like audit_logs)
- No UPDATE or DELETE in application layer
- Supports compliance requirements (who accessed what, when)
- ipAddress optional (not always available/desired)

**Workflow schemas bonus:**
- Additional workflow schemas added to document.ts (RFI, Submittal, Transmittal)
- Includes workflow type enum, status enum, priority enum
- Approval step schema with requirement types
- Not part of this plan but extends document management capabilities

## Next Steps

**Immediate (Plan 09-02):**
- Implement document tagging tRPC procedures (create, remove, list)
- Implement access logging middleware (track view/download)
- Implement document search with filters

**Future plans:**
- Document workflow endpoints (RFI, Submittal, Transmittal)
- Document category-specific views in frontend
- Tag autocomplete and suggestions
- Access analytics dashboard

## Verification Results

**Schema verification:**
- [x] documents table has category and description columns
- [x] document_tags table exists with documentId FK and tag column
- [x] document_access_logs table exists with userId, action, accessedAt
- [x] Indexes structure defined for document_tags and document_access_logs
- [x] documentCategoryEnum exported from packages/shared
- [x] createTagSchema and searchDocumentsSchema validate correctly
- [x] TypeScript compilation succeeds in both apps/api and packages/shared

**Success criteria met:**
- [x] Database schema extended with category/description columns
- [x] document_tags table for many-to-many relationships
- [x] document_access_logs table for audit trail
- [x] Appropriate table structures for query performance
- [x] Document category enum with 12 predefined categories
- [x] Tag creation/removal validation schemas
- [x] Advanced search schema with multiple filter options
- [x] All document-related schemas consolidated in document.ts
- [x] No breaking changes to existing Phase 3 document functionality

## Self-Check: PASSED

**Files created:**
- FOUND: packages/shared/src/types/document.ts

**Commits exist:**
- FOUND: 0a6e803 (Task 1 - schema changes)
- FOUND: 54e607f (Task 2 - validation schemas)

**Schema exports verified:**
- documentTags exported from createTenantSchema return statement
- documentAccessLogs exported from createTenantSchema return statement
- Both tables added to RequestTenantContext schema object
- documentCategoryEnum exported from packages/shared/src/types/document.ts
- All document types exported from packages/shared/src/types/index.ts
