---
phase: 35-subcontractors-in-global-search
plan: "01"
subsystem: search
tags: [search, subcontractors, command-palette, trpc, zod]
dependency_graph:
  requires: []
  provides: [subcontractor-global-search]
  affects: [command-palette, search-router, shared-types]
tech_stack:
  added: []
  patterns: [ilike-search, drizzle-select, zod-enum-extension, command-group-conditional]
key_files:
  created: []
  modified:
    - packages/shared/src/types/search.ts
    - apps/api/src/trpc/routers/search.ts
    - apps/web/components/search/command-palette.tsx
decisions:
  - "subcontractor type registered in shared Zod enum first so both API and web derive correct types"
  - "isNotNull(slug) filter used on subcontractorDirectory to prevent null URL construction, consistent with estimates pattern"
  - "Building2 lucide icon chosen for Subcontractors group per plan specification"
metrics:
  duration: "~2 min"
  completed: "2026-02-18"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 35 Plan 01: Subcontractors in Global Search Summary

**One-liner:** Added subcontractor records to the global command palette search by extending the shared Zod enum, querying `subcontractor_directory` in the API router, and rendering a "Subcontractors" CommandGroup with Building2 icon in the UI.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add subcontractor query to global search API router | 03d5582 | packages/shared/src/types/search.ts, apps/api/src/trpc/routers/search.ts |
| 2 | Add Subcontractors CommandGroup to command palette UI | dfff26b | apps/web/components/search/command-palette.tsx |

## What Was Built

### Shared Schema Update (packages/shared/src/types/search.ts)
Extended `searchResultSchema` type enum from `["project", "customer", "estimate"]` to `["project", "customer", "estimate", "subcontractor"]`. This registration is required first so both the API and web client packages derive correct TypeScript types.

### API Router Update (apps/api/src/trpc/routers/search.ts)
- Destructured `subcontractorDirectory` from `ctx.tenant.schema`
- Added subcontractor query using `ilike` on `companyName` with `isNotNull(slug)` filter (consistent with estimates pattern)
- Mapped results to `{ type: 'subcontractor', id, title: companyName, subtitle: null, url: '/subcontractors/{slug}' }`

### UI Update (apps/web/components/search/command-palette.tsx)
- Added `Building2` to lucide-react import
- Added conditional `<CommandGroup heading="Subcontractors">` after Estimates group
- Each item navigates to `/subcontractors/{slug}` on select
- Updated CommandInput placeholder to "Search projects, customers, subcontractors..."

## Decisions Made

1. **Shared enum first:** The Zod enum in `packages/shared` was updated before the API and web changes. TypeScript would refuse `type: "subcontractor" as const` in the router without this registration.
2. **isNotNull(slug) filter:** `subcontractorDirectory.slug` is nullable in the schema. Filter applied to prevent null URL construction, following the same pattern established for estimates.
3. **No subtitle for subcontractors:** `subtitle: null` in all results since subcontractors have no natural secondary identifier relevant at search time.

## Deviations from Plan

None - plan executed exactly as written.

## Pre-existing Issues Noted (Out of Scope)

The following pre-existing TypeScript errors were observed in unrelated files during compilation checks. These were NOT introduced by this plan and are out of scope:
- `apps/api/src/trpc/routers/subcontractor.ts` — `Property 'address' does not exist` errors (address field refactored to street1/street2/city/state/zip but form and router not fully updated)
- `apps/api/src/check-search-data.ts` — Cannot find module './db/pool.js' (orphaned debug script)
- `apps/web/components/bidding/subcontractor-form.tsx` — Related to above address field issue
- `apps/web/app/(dashboard)/subcontractors/[subcontractorSlug]/page.tsx` — Related TS errors

These are logged here for awareness. Deferred to a future plan.

## Verification Results

- packages/shared TypeScript: PASS (exit 0)
- apps/api search.ts: PASS (no errors in search files)
- apps/web command-palette.tsx: PASS (no errors in command-palette files)
- Artifact checks: All 3 files contain required strings per plan spec

## Self-Check: PASSED
