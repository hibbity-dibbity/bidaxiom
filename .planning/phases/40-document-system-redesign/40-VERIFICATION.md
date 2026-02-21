---
phase: 40-document-system-redesign
verified: 2026-02-21T00:00:00Z
status: passed
score: 4/4 success criteria verified
re_verification: false
human_verification:
  - test: "Navigate to any project Documents tab and confirm no tabs or folder tree are visible"
    expected: "Single flat table, no sidebar, no tab bar within the documents section"
    why_human: "Tab/sidebar removal is a visual layout question; grep cannot confirm absence of rendered UI elements (only absence of imports, which is confirmed)"
  - test: "Apply a type filter (e.g. RFI) and confirm URL updates to ?type=rfi and table shows only RFIs"
    expected: "URL updates live; rows in table match only the filtered type"
    why_human: "nuqs URL sync and table reactivity require a running browser"
  - test: "Click an RFI row and confirm navigation to /projects/[slug]/workflows/[id] renders the full workflow detail"
    expected: "Approval chain, revisions, and comments visible — no 404"
    why_human: "Navigation and component rendering require a live browser session"
---

# Phase 40: Document System Redesign — Verification Report

**Phase Goal:** The project Documents section is a unified flat table where every document — generated PDFs, uploaded files, RFIs, submittals, transmittals — is discoverable by type, status, date, or author without navigating folder trees.
**Verified:** 2026-02-21
**Status:** PASSED
**Re-verification:** No — initial verification
**Human UAT:** Approved — all 7 test scenarios confirmed per 40-04-SUMMARY.md

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The documents page presents all documents in a single flat table — folder tree and tab navigation are gone | VERIFIED | `documents/page.tsx` imports no FolderTree, Tabs, WorkflowList, or DocumentSearch; renders `UnifiedDocumentTable` directly inside a plain `<div className="space-y-4">` |
| 2 | Each row displays name, type badge, status badge, related entity, created by, date, and a download/navigation action | VERIFIED | `unified-document-table.tsx` defines 8 columns: checkbox, name (button with handleRowClick), type (Badge with TYPE_LABELS), status (Badge with STATUS_BADGE_VARIANTS, dash for non-workflow), relatedEntity, createdByName, createdAt, actions (DocumentRowMenu) |
| 3 | Table supports URL-state filters (nuqs) for type, status, date range, and author; type filter reproduces previous tab experience | VERIFIED | `documents/page.tsx` uses `useQueryStates` with `parseAsString` for type/status/dateFrom/dateTo/author; passes all to `trpc.document.listUnified.useQuery`; `document-filters.tsx` uses `useDebounce` for search and emits `onChange` with filter keys; API-side post-query type filter in `listUnified` covers all 8 document types |
| 4 | Clicking an RFI/Submittal/Transmittal row opens the full workflow detail view | VERIFIED | `unified-document-table.tsx` `handleRowClick` checks `row.workflowId !== null && ['rfi','submittal','transmittal'].includes(row.documentType)` then calls `router.push('/projects/${projectSlug}/workflows/${row.workflowId}')`; the target route exists at `workflows/[workflowId]/page.tsx` and renders `WorkflowDetail` with workflowId + projectId |

**Score:** 4/4 truths verified

---

## Required Artifacts

### Plan 01 (Backend API)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/trpc/routers/document.ts` | `listUnified` query + `sendByEmail` mutation | VERIFIED | `listUnified` at line 506: LEFT JOINs documentWorkflows and userProfiles, post-query type/status filter, returns `documentType` and `relatedEntity` derived fields. `sendByEmail` at line 678: fetches version storageKey, generates 7-day presigned URL, calls `sendDocumentEmail`. Both wired into `documentRouter` export. |
| `apps/api/src/services/email.ts` | `sendDocumentEmail` helper | VERIFIED | Exported at line 129: accepts recipientEmail/documentName/downloadUrl, sends styled HTML email via Resend with dev-mode console fallback. |
| `apps/api/src/server.ts` | `bulk-download` route registered | VERIFIED | `POST /api/documents/bulk-download` found at line 185: inline JWT auth, builds tenant from orgId, fetches documents + S3 keys, streams zip archive via archiver. |

### Plan 02 (Workflow Route)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/app/(dashboard)/projects/[projectSlug]/workflows/[workflowId]/page.tsx` | Workflow detail route page | VERIFIED | Exists. Uses `useParams` for projectSlug + workflowId, resolves projectId via `trpc.project.getBySlug.useQuery`, renders `<WorkflowDetail workflowId={workflowId} projectId={project.id} projectSlug={projectSlug} />`, Skeleton loading state when project not yet resolved. |

### Plan 03 (UI Layer)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/components/project/documents/unified-document-table.tsx` | TanStack table with checkbox selection, skeleton, empty state | VERIFIED | Contains `RowSelectionState`, `useReactTable`, 8 column definitions, 5-row skeleton, empty state text "No documents in this project yet.", `handleRowClick` for workflow navigation vs. download. |
| `apps/web/components/project/documents/document-filters.tsx` | Search + filter toggle + filter chips with `useQueryStates` | VERIFIED | Uses `useDebounce` for 300ms search debounce with `useEffect` sync. Filter panel with Type/Status/DateFrom/DateTo/Author selects. Active filter chips with dismiss X buttons. Note: `useQueryStates` is called in the parent `documents/page.tsx` — filters receives state as props and calls `onChange`. |
| `apps/web/components/project/documents/document-row-menu.tsx` | Overflow menu: Download, Copy link, Send, Delete | VERIFIED | `DropdownMenu` with all 4 items. Download uses `utils.document.getDownloadUrl.fetch`. Copy link builds workflow or documents path. Send opens `SendDocumentDialog`. Delete opens `DeleteConfirmDialog`. |
| `apps/web/components/project/documents/bulk-action-bar.tsx` | Bulk download zip + bulk delete | VERIFIED | `handleBulkDownload` POSTs to `/api/documents/bulk-download` (Next.js proxy), receives blob, triggers download. Bulk delete uses `deleteMutation.mutateAsync` in parallel. `DeleteConfirmDialog` with workflow cascade warning. |
| `apps/web/components/project/documents/send-document-dialog.tsx` | Email send dialog wired to `sendByEmail` mutation | VERIFIED | `trpc.document.sendByEmail.useMutation` called with `{ documentId, recipientEmail }`. Success toast + dialog close. Error toast on failure. |
| `apps/web/components/project/documents/delete-confirm-dialog.tsx` | Delete confirm with workflow cascade warning | VERIFIED | `hasWorkflow` prop controls destructive warning callout. Shows up to 3 document names + "and N more". Destructive Delete button + Cancel button. |
| `apps/web/app/(dashboard)/projects/[projectSlug]/documents/page.tsx` | Replaced flat-table page — no tabs, no folder tree | VERIFIED | Imports `UnifiedDocumentTable`, `DocumentFilters`, `BulkActionBar`, `DocumentUploader`. No FolderTree, Tabs, WorkflowList, or DocumentSearch. Calls `trpc.document.listUnified.useQuery` with all filter params. |

### Plan 04 (Prefetch + UAT)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx` | `prefetchDocuments` uses `listUnified` | VERIFIED | Line 58-61: `prefetchDocuments` calls `utils.document.listUnified.prefetch({ projectId })`. Old `document.list.prefetch` with `folderId: null` is gone. |

### Proxy Route (UAT fix)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/app/api/documents/bulk-download/route.ts` | Next.js proxy route for bulk download (CORS fix) | VERIFIED | `POST` handler: gets accessToken, forwards to Fastify `POST /api/documents/bulk-download` with Bearer header, streams zip response back to client. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `document.listUnified` | `document_workflows` table | LEFT JOIN on `documentWorkflows.documentId = documents.id` | VERIFIED | Lines 594-597 in document.ts |
| `document.listUnified` | `user_profiles` table | LEFT JOIN on `documents.createdBy = userProfiles.clerkUserId` | VERIFIED | Lines 598-601 in document.ts |
| `document.sendByEmail` | `email.ts sendDocumentEmail` | import + call at line 753 | VERIFIED | `sendDocumentEmail` imported at line 28, called at line 753 |
| `bulk-download route (Fastify)` | S3 `GetObjectCommand` | `s3Client.send(new GetObjectCommand(...))` in loop | VERIFIED | Found in server.ts bulk-download route body |
| `documents/page.tsx` | `document.listUnified` | `trpc.document.listUnified.useQuery` | VERIFIED | Line 49 in page.tsx |
| `unified-document-table.tsx` | workflow detail route | `router.push('/projects/${projectSlug}/workflows/${workflowId}')` | VERIFIED | Lines 80 in unified-document-table.tsx |
| `document-row-menu.tsx` | `document.sendByEmail` | `SendDocumentDialog` → `trpc.document.sendByEmail.useMutation` | VERIFIED | send-document-dialog.tsx line 30 |
| `bulk-action-bar.tsx` | `/api/documents/bulk-download` | `fetch('/api/documents/bulk-download', { method: 'POST' })` | VERIFIED | Lines 38-44 in bulk-action-bar.tsx |
| `project-tabs.tsx prefetchDocuments` | `document.listUnified` | `utils.document.listUnified.prefetch({ projectId })` | VERIFIED | Lines 58-61 in project-tabs.tsx |
| `documentRouter` | tRPC app router | imported and mounted as `document:` key in `router.ts` | VERIFIED | router.ts lines 11 and 53 |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DOC-01 | 40-03 | Flat table view — no folder/tab structure; all document types in one table | VERIFIED | `documents/page.tsx` has no Tabs/FolderTree imports; renders single `UnifiedDocumentTable`; `listUnified` returns all documents regardless of folder |
| DOC-02 | 40-01, 40-03 | Filters by type, status, date range, author; URL-state managed (nuqs) | VERIFIED | `useQueryStates` in page.tsx for 5 params; all passed to `listUnified`; `document-filters.tsx` UI for all 4 filter categories |
| DOC-03 | 40-03 | Row shows: name, type badge, status badge, related entity, created by, date, download link | VERIFIED | 8 columns in `unified-document-table.tsx` cover all required fields; download via `handleRowClick` or `DocumentRowMenu` |
| DOC-04 | 40-02, 40-03 | Workflow functionality preserved; click row to view workflow details | VERIFIED | `workflows/[workflowId]/page.tsx` renders `WorkflowDetail`; `handleRowClick` navigates there for rfi/submittal/transmittal rows |
| DOC-05 | 40-01, 40-03 | Type filter reproduces previous tab experience | VERIFIED | `listUnified` post-query type filter covers all 8 types; UI type select in `document-filters.tsx` with values matching API enum |

**Orphaned requirements:** None. All 5 DOC requirements appear in plan frontmatter and are implemented.

Note: REQUIREMENTS.md traceability table still shows "Pending" for DOC-01 through DOC-05 — this is the tracking document status, not a code gap. The implementations are present and verified.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `unified-document-table.tsx` | 29-31 | `type UnifiedDocument = any` with TODO comment | Info | Type safety deferred — acknowledged in SUMMARY as intentional pending tRPC AppRouter inference setup; does not affect runtime behavior |
| `document-row-menu.tsx` | 17-19 | `type UnifiedDocument = any` with TODO comment | Info | Same as above |
| `bulk-action-bar.tsx` | 10-12 | `type UnifiedDocument = any` with TODO comment | Info | Same as above |
| `bulk-action-bar.tsx` | 33 | `if (selectedCount === 0) return null` | Info | Intentional — component hides itself when no selection; this is correct behavior, not a stub |

No blocker anti-patterns. The `any` type TODO comments are a known deferred type safety improvement, not a functional gap.

---

## Human Verification Required

The following items were verified by human UAT during Plan 04 (approved per 40-04-SUMMARY.md). They are listed here for completeness since they cannot be re-verified programmatically:

### 1. Flat table layout (DOC-01)

**Test:** Navigate to any project Documents tab
**Expected:** No tabs within the documents section, no folder tree sidebar; single flat table
**Why human:** Visual layout cannot be confirmed by static analysis — imports are verified absent but rendered output requires a browser

### 2. URL filter state round-trip (DOC-02)

**Test:** Apply type filter "RFI", refresh page, confirm filter is restored from URL
**Expected:** URL shows `?type=rfi`, table shows only RFIs after refresh
**Why human:** nuqs URL persistence requires a live browser with navigation

### 3. Workflow row click (DOC-04)

**Test:** Click an RFI row; confirm /projects/[slug]/workflows/[id] loads the full WorkflowDetail
**Expected:** Approval chain, revisions, comments visible — no 404
**Why human:** Actual HTTP routing and component data fetching require a running app

---

## Gaps Summary

No gaps. All 4 observable truths verified. All 10 required artifacts exist, are substantive, and are wired. All 5 DOC requirements covered by implemented plans. Human UAT was completed and approved (7/7 test scenarios) per the 40-04-SUMMARY.md record.

The three `type UnifiedDocument = any` TODOs across the components are noted as informational — they are an acknowledged deferred type-safety improvement that does not affect runtime behavior or goal achievement.

---

_Verified: 2026-02-21_
_Verifier: Claude (gsd-verifier)_
