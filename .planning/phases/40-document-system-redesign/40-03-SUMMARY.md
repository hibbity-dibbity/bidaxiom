---
phase: 40-document-system-redesign
plan: 03
subsystem: ui
tags: [next.js, tanstack-table, trpc, nuqs, document-management, bulk-actions]

# Dependency graph
requires:
  - phase: 40-document-system-redesign-01
    provides: document.listUnified tRPC query, document.sendByEmail mutation, bulk-download REST endpoint
  - phase: 40-document-system-redesign-02
    provides: /projects/[slug]/workflows/[workflowId] route for row-click navigation

provides:
  - "Unified documents page at /projects/[slug]/documents — flat table replacing tabs and folder tree"
  - "DocumentFilters component: search + debounce + collapsible filter panel + active filter chips"
  - "UnifiedDocumentTable: TanStack table with checkbox selection, type/status badges, row navigation"
  - "DocumentRowMenu: overflow menu with download, copy link, send email, delete"
  - "SendDocumentDialog: email send dialog wired to document.sendByEmail mutation"
  - "DeleteConfirmDialog: single + bulk delete with workflow cascade warning"
  - "BulkActionBar: sticky bar with bulk zip download + bulk delete"

affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useQueryStates (nuqs) for URL filter state — 5 filter params synced to URL"
    - "useDebounce hook for 300ms search input debounce before API query"
    - "TanStack table with RowSelectionState for checkbox selection"
    - "fetch('/api/auth/token') pattern for Bearer token in bulk-download REST call"
    - "useEffect for React Query v5 error handling (onError option removed in v5)"

key-files:
  created:
    - apps/web/components/project/documents/document-filters.tsx
    - apps/web/components/project/documents/document-row-menu.tsx
    - apps/web/components/project/documents/send-document-dialog.tsx
    - apps/web/components/project/documents/delete-confirm-dialog.tsx
    - apps/web/components/project/documents/bulk-action-bar.tsx
    - apps/web/components/project/documents/unified-document-table.tsx
  modified:
    - apps/web/app/(dashboard)/projects/[projectSlug]/documents/page.tsx

key-decisions:
  - "author options sourced from project.getBySlug teamMembers field (already in React Query cache from layout) — no separate user.list call needed"
  - "React Query v5 has no onError on useQuery — switched to useEffect(documentsError) pattern for error toast"
  - "document-filters uses useEffect to sync debouncedSearch to parent onChange — avoids render-time side effect"
  - "bulk-download fetches Bearer token via fetch('/api/auth/token') same as providers.tsx — maintains consistent auth pattern"
  - "RowSelectionState index-based mapping: selected rows filtered by index from memoizedData array"

patterns-established:
  - "Filter components receive filters + onChange from parent and manage local search state independently"
  - "UnifiedDocument type is any with TODO — to be narrowed when tRPC AppRouter inference is set up"

requirements-completed: [DOC-01, DOC-02, DOC-03, DOC-04, DOC-05]

# Metrics
duration: 5min
completed: 2026-02-21
---

# Phase 40 Plan 03: Document System UI Layer Summary

**Complete UI layer for unified document system: flat table with nuqs URL filters, TanStack checkbox selection, row navigation to workflows or file download, and bulk actions**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-21T03:47:36Z
- **Completed:** 2026-02-21T03:52:34Z
- **Tasks:** 2
- **Files created/modified:** 7

## Accomplishments

- Created `apps/web/components/project/documents/` directory with 6 new components
- `document-filters.tsx`: search input (300ms debounce via useDebounce), filter toggle button, collapsible panel with Type/Status/DateFrom/DateTo/Author selects, dismissable active filter chips
- `document-row-menu.tsx`: overflow `DropdownMenu` with Download (presigned URL), Copy Link, Send (Email dialog), Delete (confirm dialog)
- `send-document-dialog.tsx`: dialog with email input wired to `trpc.document.sendByEmail.useMutation`
- `delete-confirm-dialog.tsx`: single and bulk delete confirmation with workflow cascade warning callout; truncates to 3 names with "and N more"
- `bulk-action-bar.tsx`: sticky bar shown when selectedCount > 0; bulk zip download via `POST /api/documents/bulk-download` with Bearer token; bulk delete via parallel `document.delete` mutations
- `unified-document-table.tsx`: TanStack table with checkbox column (select-all header), Name (navigates workflow or downloads file), Type badge, Status badge (dash for non-workflow), Related entity, Created by, Date, Actions menu; 5-skeleton-row loading state; empty state text; RowSelectionState tracked and propagated to parent
- Replaced `documents/page.tsx` entirely: removed all FolderTree/Tabs/WorkflowList/DocumentSearch imports; wired `useQueryStates` for 5 filter params, local search + debounce, `listUnified` query with all filter params, team members from project cache as author options, `BulkActionBar` shown conditionally

## Task Commits

1. **Task 1: 5 document sub-components** - `2c74716` (feat)
2. **Task 2: unified-document-table + documents page replacement** - `84c352b` (feat)

## Files Created/Modified

- `apps/web/components/project/documents/document-filters.tsx` - Search + debounce + filter panel + chips
- `apps/web/components/project/documents/document-row-menu.tsx` - Overflow menu: download/copy/send/delete
- `apps/web/components/project/documents/send-document-dialog.tsx` - Email send dialog
- `apps/web/components/project/documents/delete-confirm-dialog.tsx` - Delete confirm with workflow warning
- `apps/web/components/project/documents/bulk-action-bar.tsx` - Bulk download ZIP + bulk delete
- `apps/web/components/project/documents/unified-document-table.tsx` - TanStack table with checkbox selection
- `apps/web/app/(dashboard)/projects/[projectSlug]/documents/page.tsx` - Replaced with flat-table implementation

## Decisions Made

- Author options derived from `project.getBySlug.teamMembers` (cached by the project layout); no separate `user.list` call needed since the project data is already in React Query cache
- React Query v5 dropped `onError` from `useQuery` options — error toast handled via `useEffect(() => { if(error) toast.error(...) }, [error])`
- `document-filters.tsx` debounce sync uses `useEffect` to call `onChange({ search })` when `debouncedSearch` changes — avoids illegal render-time side effect
- `bulk-action-bar.tsx` uses `fetch('/api/auth/token')` + `Bearer` header for the bulk-download REST call — same pattern as `providers.tsx` tRPC auth header setup
- `RowSelectionState` uses numeric index keys from TanStack table; selected documents mapped back with `memoizedData.filter((_, idx) => newSelection[idx])`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed render-time side effect for debounce sync**
- **Found during:** Task 1 (document-filters.tsx implementation)
- **Issue:** Initial implementation used a `useState` tuple reference comparison in render to sync debounced search to parent — this is a React anti-pattern (side effect in render body)
- **Fix:** Replaced with `useEffect(() => { onChange({ search: debouncedSearch || null }) }, [debouncedSearch])`
- **Files modified:** `document-filters.tsx`
- **Commit:** `2c74716`

**2. [Rule 1 - Bug] Fixed onError API incompatibility with React Query v5**
- **Found during:** Task 2 (documents page TypeScript check)
- **Issue:** `onError` option in `useQuery` was removed in React Query v5/tRPC v11 — TypeScript error: "does not exist in type UseTRPCQueryOptions"
- **Fix:** Destructured `error` from the query and added `useEffect(() => { if(error) toast.error(...) }, [error])`
- **Files modified:** `apps/web/app/(dashboard)/projects/[projectSlug]/documents/page.tsx`
- **Commit:** `84c352b`

---

**Total deviations:** 2 auto-fixed (Rule 1 - Bug: render side effect, Rule 1 - Bug: React Query v5 API change)
**Impact on plan:** Both necessary for correctness — no scope creep.

## Issues Encountered

None beyond the two auto-fixed deviations above. Pre-existing TypeScript errors in unrelated files (quickbooks, customers, estimates, bidGeneration, sov) are out of scope.

## User Setup Required

None.

## Next Phase Readiness

- All 5 DOC requirements are now implemented: DOC-01 (flat table), DOC-02 (send email), DOC-03 (bulk download), DOC-04 (workflow row click), DOC-05 (search/filter)
- Phase 40 Plan 03 is the final implementation plan — Phase 40 is complete
- The unified documents page is ready for UAT

## Self-Check: PASSED

- All 7 files verified to exist on disk
- Commits `2c74716` and `84c352b` verified in git log
- TypeScript compiles with zero errors in documents/ scope
