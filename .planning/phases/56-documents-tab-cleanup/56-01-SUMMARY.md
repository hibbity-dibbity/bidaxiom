---
phase: 56-documents-tab-cleanup
plan: 01
subsystem: api, ui
tags: [trpc, drizzle, document, casl, react]

# Dependency graph
requires:
  - phase: 56-documents-tab-cleanup
    provides: Phase context and design spec for Documents tab cleanup
provides:
  - document.update tRPC mutation (name + category, duplicate check, CASL enforcement)
  - DocumentFilters component without Status field or chip
affects: [56-02, unified-document-table, documents-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "document.update preserves file extension by extracting from existing doc name, appending to user-supplied display name"
    - "CASL abilities.can() checked before explicit permission fallback for update"
    - "ilike + sql template literal used for case-insensitive duplicate name exclusion"

key-files:
  created: []
  modified:
    - apps/api/src/trpc/routers/document.ts
    - apps/web/components/project/documents/document-filters.tsx

key-decisions:
  - "File extension preserved from existing doc name (not input) so user always edits display name only"
  - "No audit log on document.update (keeping simple per Phase 55 notes router precedent)"
  - "status field removed from DocumentFilters interface; page.tsx update deferred to Plan 02 as planned"

patterns-established:
  - "Extension-preserving rename: extract ext from existing name, reconstruct newFullName = input.name + ext"

requirements-completed: [DOCS-01, DOCS-02]

# Metrics
duration: 8min
completed: 2026-02-25
---

# Phase 56 Plan 01: Document Update API + Status Filter Removal Summary

**document.update tRPC mutation with extension-preserving rename + case-insensitive duplicate check; Status filter stripped from DocumentFilters interface, chip, and panel**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-25T16:25:00Z
- **Completed:** 2026-02-25T16:33:13Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `document.update` protected procedure to documentRouter — accepts documentId, display name (trimmed 1-255 chars), optional category enum; preserves original file extension when renaming; case-insensitive duplicate check within same project; CASL + explicit permission enforcement; returns `{ id, name, category }`
- Removed `status` field from `DocumentFilters` interface, removed `STATUS_OPTIONS` constant, removed status chip from activeFilters logic, removed Status Select from expanded filter panel — 4 controls remain (Type, From, To, Author) in unchanged `sm:grid-cols-4` grid

## Task Commits

Each task was committed atomically:

1. **Task 1: Add document.update mutation to document router** - `bcc3c64` (feat)
2. **Task 2: Remove Status filter from DocumentFilters** - `c685b46` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `apps/api/src/trpc/routers/document.ts` - Added `update` protectedProcedure (116 lines inserted after `listUnified`)
- `apps/web/components/project/documents/document-filters.tsx` - Removed status field, STATUS_OPTIONS, status chip, Status Select block (35 lines deleted)

## Decisions Made
- File extension is extracted from `existingDoc.name` (not the user's input) so the user always provides a clean display name — the mutation reconstructs the full filename transparently
- No audit log added to `update` (consistent with Phase 55 notes router precedent — keep simple)
- `status` removal from `DocumentFilters` causes one expected TypeScript error in `documents/page.tsx` (line 89) — plan explicitly deferred that fix to Plan 02

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `documents/page.tsx` now has one new TypeScript error (`status` does not exist in `DocumentFilters`) — this is expected per the plan spec ("that update is handled in Plan 02"). Pre-existing unrelated TS errors in `customers/page.tsx` also present but out of scope.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 can now import `trpc.document.update.useMutation` from the API
- Plan 02 must also clean up `documents/page.tsx` to remove `status` references (the one remaining TS error)
- DocumentFilters is ready — callers just need to drop `status` from their filter state initialization

---
*Phase: 56-documents-tab-cleanup*
*Completed: 2026-02-25*
