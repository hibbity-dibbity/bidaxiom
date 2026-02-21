---
phase: 40-document-system-redesign
plan: 01
subsystem: api
tags: [trpc, drizzle-orm, s3, archiver, email, resend, document-management]

# Dependency graph
requires:
  - phase: 38-pdf-generation
    provides: document schema with document_workflows table
  - phase: 39-custom-template-import-field-mapping
    provides: documentTemplates table + storage patterns

provides:
  - "document.listUnified tRPC query: unified flat document list with workflow metadata, author join, and type/status/date/author/search filtering"
  - "document.sendByEmail tRPC mutation: 7-day presigned URL generation and Resend email delivery"
  - "POST /api/documents/bulk-download REST endpoint: zip stream of up to 50 documents via archiver"
  - "sendDocumentEmail helper in services/email.ts"

affects: [40-02, 40-03, 40-04]

# Tech tracking
tech-stack:
  added: [archiver@5.3.2, @types/archiver@7.0.0]
  patterns: [REST route with inline JWT auth (no tRPC), 7-day presigned URL for email sharing, post-query in-memory filtering for type/status derived from workflow JOIN]

key-files:
  created: []
  modified:
    - apps/api/src/trpc/routers/document.ts
    - apps/api/src/services/email.ts
    - apps/api/src/server.ts
    - apps/api/package.json

key-decisions:
  - "listUnified uses post-query type filter (not SQL WHERE) because workflow-type and category-type discrimination requires knowing whether workflowId is NULL — a single SQL WHERE clause would not cleanly express this"
  - "sendByEmail uses raw getSignedUrl with 7*24*3600 expiry rather than generateDownloadUrl (which is 1-hour) — email links need longer expiry"
  - "bulk-download route derives tenant from JWT orgId (not client-supplied tenantId) — same security posture as tRPC context; client never controls which tenant is accessed"
  - "Non-workflow documents always pass status filter (workflowId === null check) so status filtering only constrains workflow documents"
  - "archiver was already present in apps/api/package.json from a prior install; npm install updated lock file only"

patterns-established:
  - "REST route inline auth: extract Bearer token, call verifyAccessToken, call buildTenantContext from JWT orgId — no fastify.authenticate decorator needed"
  - "listUnified pattern: LEFT JOIN workflow table, post-query filter for type discrimination, derive documentType field from workflowType ?? category"

requirements-completed: [DOC-02, DOC-03, DOC-05]

# Metrics
duration: 4min
completed: 2026-02-21
---

# Phase 40 Plan 01: Document System Redesign - Backend API Layer Summary

**`document.listUnified` tRPC query with workflow JOIN + `document.sendByEmail` mutation + bulk-download REST endpoint streaming zips via archiver**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-21T03:39:37Z
- **Completed:** 2026-02-21T03:43:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `document.listUnified` query: returns all project documents with LEFT JOIN to `document_workflows` and `user_profiles`, supports filtering by search/type/status/dateFrom/dateTo/authorId/limit, adds derived `documentType` and `relatedEntity` fields to each row
- Added `document.sendByEmail` mutation: verifies read access, generates a 7-day presigned S3 URL, and calls `sendDocumentEmail` to deliver the download link via Resend
- Added `sendDocumentEmail` to `services/email.ts` following the existing email helper pattern with dev-mode console fallback
- Added `POST /api/documents/bulk-download` REST endpoint: authenticates via Bearer token, resolves tenant from JWT orgId, fetches up to 50 documents from DB, streams a zip archive using archiver piped to `reply.raw`

## Task Commits

Each task was committed atomically:

1. **Task 1: document.listUnified + document.sendByEmail** - `6411bb5` (feat)
2. **Task 2: Bulk zip download REST endpoint** - `6e348ef` (feat)

**Plan metadata:** committed with docs commit below

## Files Created/Modified

- `apps/api/src/trpc/routers/document.ts` - Added `listUnified` query and `sendByEmail` mutation; added ilike/gte/lte drizzle imports; added @aws-sdk/s3-request-presigner direct import for 7-day URL
- `apps/api/src/services/email.ts` - Added `sendDocumentEmail(recipientEmail, documentName, downloadUrl)` helper
- `apps/api/src/server.ts` - Registered `POST /api/documents/bulk-download` route with inline JWT auth + archiver streaming
- `apps/api/package.json` - archiver and @types/archiver confirmed present (already installed)

## Decisions Made

- `listUnified` uses post-query in-memory type filtering: workflow types (rfi/submittal/transmittal) filter by `workflowType`, category types (proposal/change_order/payment_app/rfq) filter by `category && workflowId === null`, and `file` keeps anything with no workflow and no category-type. This avoids complex SQL CASE expressions.
- `sendByEmail` uses `getSignedUrl` directly with `7 * 24 * 3600` expiry instead of `generateDownloadUrl` (1-hour) — email recipients need longer to act on a shared link.
- Bulk-download derives tenant from the JWT's `orgId` (never from a client-supplied `tenantId`) — maintains the same tenant security posture as all tRPC procedures.
- Non-workflow documents always pass the status filter — only `workflowStatus` is compared when filtering by status, so plain file uploads remain visible regardless of status filter value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used getSignedUrl directly instead of generateDownloadUrl for 7-day expiry**
- **Found during:** Task 1 (sendByEmail implementation)
- **Issue:** `generateDownloadUrl` helper hardcodes 1-hour expiry; plan spec requires 7 days for email sharing
- **Fix:** Imported `getSignedUrl`, `GetObjectCommand`, `getStorageClient`, `getBucketName` directly and called with `expiresIn: 7 * 24 * 3600`
- **Files modified:** `apps/api/src/trpc/routers/document.ts`
- **Verification:** TypeScript compiles with zero errors in document.ts
- **Committed in:** `6411bb5`

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug: wrong URL expiry)
**Impact on plan:** Necessary for correctness — 1-hour URLs would expire before recipients read their email. No scope creep.

## Issues Encountered

None — plan executed cleanly. All pre-existing TypeScript errors (bid.ts, customer.ts, subcontractor.ts, estimateTemplates.ts) are unrelated to this plan's scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `document.listUnified` is ready for the UI flat-table view (Phase 40 Plan 03)
- `document.sendByEmail` is ready for the share-by-email modal (Phase 40 Plan 04)
- `POST /api/documents/bulk-download` is ready for the bulk-select download button
- All three API surfaces compile to zero TypeScript errors

---
*Phase: 40-document-system-redesign*
*Completed: 2026-02-21*
