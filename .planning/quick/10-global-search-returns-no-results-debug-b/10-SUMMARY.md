---
phase: quick-10
plan: 01
subsystem: search
tags: [bug-fix, ui, search, command-palette]
dependency-graph:
  requires: []
  provides:
    - "Working global search with server-side ILIKE filtering"
  affects:
    - "apps/web/components/ui/command.tsx"
    - "apps/web/components/search/command-palette.tsx"
tech-stack:
  added: []
  patterns:
    - "Disabled cmdk client-side filtering for server-searched results"
    - "CommandItem value uses searchable text (title) instead of UUID"
key-files:
  created: []
  modified:
    - "apps/web/components/ui/command.tsx"
    - "apps/web/components/search/command-palette.tsx"
decisions:
  - summary: "Disable cmdk client-side filtering via shouldFilter={false}"
    rationale: "Server-side ILIKE query handles search; client-side fuzzy matching against UUIDs hides valid results"
    alternatives: "Could have modified search to return metadata for cmdk filtering, but that duplicates filtering logic"
  - summary: "Use result.title instead of result.id for CommandItem value prop"
    rationale: "Even if filtering were re-enabled, items should match by name not UUID; improves selection tracking"
metrics:
  duration: 117
  completed_date: "2026-02-15"
---

# Quick Task 10: Global Search Returns No Results Debug

**One-liner:** Fixed cmdk client-side fuzzy filter hiding server-fetched search results by disabling filtering and using searchable text for CommandItem values.

## Overview

Global search was returning "No results" despite the backend correctly fetching matching projects and customers via ILIKE queries. The issue was that the `cmdk` library's built-in fuzzy filter runs on the `value` prop of `CommandItem`, which was set to UUID values. When users typed search text like "test project", cmdk tried to match that against UUIDs and found nothing, hiding all items.

## Changes Made

### Task 1: Disable cmdk Client-Side Filtering

**Modified files:**
- `apps/web/components/ui/command.tsx`
- `apps/web/components/search/command-palette.tsx`

**Changes:**

1. **Enhanced CommandDialog component** (`command.tsx`):
   - Added `CommandDialogProps` interface extending `DialogProps` with optional `shouldFilter?: boolean`
   - Modified `CommandDialog` to accept and forward `shouldFilter` prop to inner `<Command>` component
   - Defaults to `undefined` (cmdk defaults to `true`) to preserve existing behavior

2. **Fixed CommandPalette** (`command-palette.tsx`):
   - Pass `shouldFilter={false}` to `<CommandDialog>` to disable client-side filtering
   - Changed `CommandItem` value from `value={result.id}` to `value={result.title}` for both projects and customers
   - Removed deprecated `keepPreviousData` option from tRPC query (React Query v5 compatibility)

**Commit:** `4ff6f8e`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed deprecated keepPreviousData option**
- **Found during:** Task 1
- **Issue:** TypeScript compilation error - `keepPreviousData` doesn't exist in React Query v5's tRPC options
- **Fix:** Removed the option; not critical for search functionality (was used to prevent result flashing during typing)
- **Files modified:** `apps/web/components/search/command-palette.tsx`
- **Commit:** `4ff6f8e`

## Verification

- TypeScript compilation passes with no errors for modified files
- Command palette now shows results when searching for existing project/customer names
- Results are grouped under "Projects" and "Customers" headings
- Clicking a result navigates to the correct URL

## Impact

**User-facing:**
- Global search (Ctrl+K / Cmd+K) now works correctly
- Users can search for projects by name or job number
- Users can search for customers by company name or contact name
- Results appear immediately after backend query completes

**Technical:**
- Server-side ILIKE filtering is now the only filtering mechanism
- Client-side cmdk fuzzy matching disabled to prevent interference
- CommandItem selection/highlight tracking uses meaningful text values instead of UUIDs

## Self-Check: PASSED

**Created files:**
- ✓ `.planning/quick/10-global-search-returns-no-results-debug-b/10-SUMMARY.md` (this file)

**Modified files:**
- ✓ `apps/web/components/ui/command.tsx` exists
- ✓ `apps/web/components/search/command-palette.tsx` exists

**Commits:**
- ✓ `4ff6f8e` exists: "fix(quick-10): disable cmdk client-side filtering for server-searched results"

All files verified, all commits exist.
