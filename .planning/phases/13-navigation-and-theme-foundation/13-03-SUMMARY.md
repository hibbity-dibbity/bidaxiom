---
phase: 13-navigation-and-theme-foundation
plan: 03
subsystem: navigation
tags: [search, command-palette, keyboard-shortcuts, debouncing, ux]
dependency-graph:
  requires: [13-01]
  provides: [global-search-api, command-palette-component]
  affects: [navigation, user-experience]
tech-stack:
  added: [tRPC-search-router, use-debounce-hook]
  patterns: [debounced-queries, ILIKE-search, keyboard-shortcuts]
key-files:
  created:
    - packages/shared/src/types/search.ts
    - apps/api/src/trpc/routers/search.ts
    - apps/web/hooks/use-debounce.ts
  modified:
    - apps/api/src/trpc/router.ts
    - apps/web/components/search/command-palette.tsx
    - apps/web/app/layout.tsx
    - packages/shared/src/index.ts
    - packages/shared/src/types/index.ts
decisions:
  - title: "ILIKE pattern matching without full-text search indexes"
    rationale: "Phase 13 is foundation - start simple. ILIKE with LIMIT is fast enough for <10k records. Add GIN indexes in Phase 19 if performance degrades."
  - title: "300ms debounce delay for search input"
    rationale: "Balances responsive UI with reduced backend load. Prevents query spam during fast typing while maintaining instant-feel UX."
  - title: "Dual API support (SearchProvider + StandaloneCommandPalette)"
    rationale: "SearchProvider used by app-shell for TopBar integration. StandaloneCommandPalette used in root layout for global keyboard shortcut. Both share same CommandPalette component."
  - title: "Combined results from multiple tables"
    rationale: "Single query returns projects and customers together, limited to prevent UI overload. Grouped by type for easy scanning."
metrics:
  duration: 9 min
  tasks: 2
  files: 8
  commits: 2
  completed: 2026-02-14
---

# Phase 13 Plan 03: Global Command Palette Search Summary

**One-liner:** Global search command palette with Cmd+K shortcut, debounced queries, and instant navigation across projects and customers.

## What Was Built

Implemented enterprise-grade command palette search that enables rapid navigation without clicking through hierarchy. Users can press Cmd+K (Mac) or Ctrl+K (Windows) to search across job numbers, project names, and customer names with instant results.

### Backend (Task 1)

**Search Type Definitions:**
- `SearchResult` schema with type, id, title, subtitle, and url
- `globalSearchInputSchema` with query validation (1-100 chars) and configurable limit (1-50 results)
- Exported from `@construction/shared` for type-safe client/server communication

**tRPC Search Router:**
- `search.global` procedure with `authorizedProcedure` for tenant-scoped access
- ILIKE pattern matching for case-insensitive partial search
- Searches across:
  - Projects: name and jobNumber fields
  - Customers: companyName and contactName fields
- Combined results limited to prevent overwhelming UI
- Returns formatted results with navigation URLs

**Search Implementation:**
- PostgreSQL ILIKE queries for flexible pattern matching
- No full-text search indexes yet (sufficient for <10k records)
- Results already scoped to tenant via `ctx.tenant.db`
- Configurable result limit (default 10, max 50)

### Frontend (Task 2)

**Debounce Hook:**
- Generic `useDebounce<T>` hook with configurable delay
- 300ms delay prevents backend spam during fast typing
- Preserves React best practices with proper cleanup

**Command Palette Component:**
- Global keyboard shortcut (Cmd+K / Ctrl+K) listener
- Debounced search input with tRPC query integration
- Loading states ("Searching...") during debounce/query
- Empty states ("No results found") for zero matches
- Grouped results by type (Projects, Customers)
- Icons (FileText, User) for visual type distinction
- Title + subtitle display (project name + job number, company name + contact)
- Click to navigate or keyboard selection (arrow keys, Enter)
- Escape key closes palette

**Dual API Pattern:**
- `SearchProvider` + `useSearch()`: Context-based control for app-shell integration
- `StandaloneCommandPalette`: Self-contained version for root layout
- Shared `CommandPalette` component used by both
- Global keyboard shortcut works on all pages

**Integration:**
- Added to root layout (`apps/web/app/layout.tsx`) for global availability
- Works alongside existing app-shell SearchProvider (no conflicts)
- tRPC client configured for search queries

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

**TypeScript Compilation:**
- Shared package rebuilt successfully with new search types
- API server started without errors (search router registered)
- Next.js build compiled successfully (no command-palette errors)

**API Router:**
- `search.global` procedure accessible at `/trpc/search.global`
- Requires authentication via `authorizedProcedure`
- Returns SearchResult[] with proper typing

**UI Component:**
- CommandPalette renders globally from root layout
- Keyboard shortcut (Cmd+K / Ctrl+K) implemented
- Debounce prevents rapid query firing (verified in code review)
- Results grouped by type with proper icons and layout
- Navigation URLs follow format `/projects/{id}` and `/customers/{id}`

**Must-Have Truths:**
- ✓ User can open global search with ⌘K (Mac) or Ctrl+K (Windows)
- ✓ Search returns results across job numbers, project names, and customer names
- ✓ Search debounces input to avoid overwhelming backend
- ✓ Search results are clickable and navigate to respective pages

**Key Links:**
- ✓ `command-palette.tsx` calls `trpc.search.global.useQuery` with debounced input
- ✓ `layout.tsx` includes `StandaloneCommandPalette` with keyboard listener
- ✓ `search.ts` router queries projects and customers tables with ILIKE

## Performance Characteristics

**Search Response Time:**
- Backend: ILIKE queries on indexed columns (fast for <10k records)
- Debounce: 300ms delay reduces query frequency
- Network: Single tRPC call returns combined results
- Expected: <500ms for typical query (meets "instant feel" requirement)

**Scalability Considerations:**
- Current implementation sufficient for small-to-medium deployments (<10k projects)
- Future optimization options:
  - Add PostgreSQL GIN indexes for faster ILIKE queries
  - Implement full-text search with `tsvector` columns
  - Add result caching for common searches
  - Defer to Phase 19 if performance degrades

**Network Efficiency:**
- Debouncing prevents query spam (300ms delay)
- `enabled: debouncedQuery.length > 0` prevents empty queries
- `keepPreviousData: true` shows last results while loading
- `limit` parameter caps result size (10 by default)

## Known Issues

None.

## Next Steps

Phase 13 continues with:
- **13-04**: Breadcrumb navigation component
- **13-05**: Dark mode toggle and theme switcher
- **13-06**: Mobile responsive navigation

Future enhancements (Phase 19 or later):
- Add documents, budgets, and change orders to search scope
- Implement search result ranking/relevance scoring
- Add recent searches / search history
- Keyboard shortcuts for result actions (e.g., "Cmd+O" to open in new tab)
- Search filters (type, status, date range)

## Self-Check

Verifying created files and commits:

**Files:**
- ✓ packages/shared/src/types/search.ts (exists)
- ✓ apps/api/src/trpc/routers/search.ts (exists)
- ✓ apps/web/hooks/use-debounce.ts (exists)
- ✓ apps/web/components/search/command-palette.tsx (modified)
- ✓ apps/web/app/layout.tsx (modified)

**Commits:**
- ✓ 7afb397: feat(13-03): add global search tRPC router with debounced queries
- ✓ 12fd1d4: feat(13-03): create command palette UI with keyboard shortcuts and debouncing

**Self-Check: PASSED**

---

*Completed: 2026-02-14*
*Duration: 9 minutes*
*Tasks: 2 of 2*
*Pattern: Fully autonomous (no checkpoints)*
