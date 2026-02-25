---
phase: 56-documents-tab-cleanup
plan: 02
subsystem: ui
tags: [react, trpc, tanstack-table, inline-edit, documents]

# Dependency graph
requires:
  - phase: 56-documents-tab-cleanup
    plan: 01
    provides: document.update tRPC mutation + DocumentFilters without status
provides:
  - UnifiedDocumentTable with 7 columns (select, Name, Category, Type, Created By, Date, Actions)
  - Inline edit row (Name Input + Category Select, Save/Cancel, Enter/Escape, duplicate name error)
  - DocumentRowMenu with Edit/View Preview/Download/Delete (no Copy link, no Send Email)
  - documents/page.tsx with status removed from URL state and API query
affects: [documents-tab-ux, document-row-menu, unified-document-table]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline edit pattern: editingId state gates row render between display and edit UI; single-row constraint enforced at state level"
    - "File format badge: extension extracted from filename, color-coded via FILE_FORMAT_COLORS lookup"
    - "stripExtension helper strips display name from stored filename (extension preserved server-side)"
    - "useMemo dependency array includes all edit state to keep cell renders reactive to inline edits"

key-files:
  created: []
  modified:
    - apps/web/components/project/documents/unified-document-table.tsx
    - apps/web/components/project/documents/document-row-menu.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/documents/page.tsx

key-decisions:
  - "Inline edit Save/Cancel buttons replace DocumentRowMenu in Actions cell when row is in edit mode"
  - "Category Select in edit mode uses CATEGORY_OPTIONS (same values as TYPE_LABELS) for consistency"
  - "View/Preview and Download both open download URL in new tab — separate items for discoverability"
  - "projectSlug renamed to _projectSlug in DocumentRowMenu (unused after removing handleCopyLink)"

patterns-established:
  - "Inline edit row: editingId state + separate editName/editCategory/editNameError per-field"

requirements-completed: [DOCS-01, DOCS-02]

# Metrics
duration: 6min
completed: 2026-02-25
---

# Phase 56 Plan 02: Document Table Rewrite + Inline Edit Summary

**UnifiedDocumentTable rewritten to 7-column layout with inline name/category editing; DocumentRowMenu simplified to Edit/View/Download/Delete; status stripped from page URL state and API query**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-02-25T16:35:47Z
- **Completed:** 2026-02-25T16:41:39Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Rewrote `unified-document-table.tsx`: removed Status and Related columns, added file format Type badge (color-coded by extension: PDF=red, Excel=green, Word=blue, images=purple), renamed old Type column to Category, stripped extension from Name display, added 4 new state variables (editingId/editName/editCategory/editNameError), added `document.update` mutation with inline duplicate-name error, added `startEdit`/`cancelEdit`/`saveEdit` helpers, updated Actions cell to show Save/Cancel when editing, set COLUMN_COUNT to 7
- Rewrote `document-row-menu.tsx`: added `onEdit` prop, replaced Download/Copy link/Send/Delete menu with Edit/View Preview/Download/Delete order; removed SendDocumentDialog, handleCopyLink, sendDialogOpen state; added Pencil and Eye icons
- Updated `documents/page.tsx`: removed `status` from `useQueryStates`, from `listUnified` query input, and from `currentFilters` object — resolves the intentional TS error left by Plan 01

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite UnifiedDocumentTable with new columns and inline edit** - `608f5ee` (feat)
2. **Task 2: Update DocumentRowMenu + page status cleanup** - `761079f` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/web/components/project/documents/unified-document-table.tsx` - Full rewrite: 7 columns, inline edit state, file format badge, stripExtension helper, update mutation
- `apps/web/components/project/documents/document-row-menu.tsx` - Replaced 4 menu items; added onEdit prop; removed SendDocumentDialog and copy-link logic
- `apps/web/app/(dashboard)/projects/[projectSlug]/documents/page.tsx` - Removed 3 status references from URL state, query, and currentFilters

## Decisions Made

- Inline edit buttons (Save/Cancel) replace the 3-dot menu in the Actions cell while that row is being edited — prevents conflicting UI states
- View/Preview and Download are kept as separate menu items even though they both open the URL in a new tab — semantic clarity for the user
- `projectSlug` prop kept in DocumentRowMenu signature (renamed to `_projectSlug`) for API stability even though it's no longer used after removing handleCopyLink

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The single TS error from Plan 01 (`status` not in `DocumentFilters`) was resolved by Task 2 as expected.

## User Setup Required

None.

## Next Phase Readiness

- Documents tab is feature-complete for DOCS-01 and DOCS-02
- Phase 56 Plans 01 and 02 both complete — phase is ready for human verification

---
*Phase: 56-documents-tab-cleanup*
*Completed: 2026-02-25*

## Self-Check: PASSED

- FOUND: apps/web/components/project/documents/unified-document-table.tsx
- FOUND: apps/web/components/project/documents/document-row-menu.tsx
- FOUND: apps/web/app/(dashboard)/projects/[projectSlug]/documents/page.tsx
- FOUND: .planning/phases/56-documents-tab-cleanup/56-02-SUMMARY.md
- FOUND commit: 608f5ee (Task 1)
- FOUND commit: 761079f (Task 2)
