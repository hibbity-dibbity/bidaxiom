---
phase: 30-brand-identity-and-sidebar-cleanup
plan: "01"
title: Root layout brand + sidebar cleanup
subsystem: web/layout
tags: [branding, sidebar, metadata, cleanup]
dependency_graph:
  requires: []
  provides: [BIDAXIOM-title-template, clean-sidebar-footer]
  affects: [all-browser-tabs, sidebar-ux]
tech_stack:
  added: []
  patterns: [Next.js metadata title.template]
key_files:
  created: []
  modified:
    - apps/web/app/layout.tsx
    - apps/web/components/layout/sidebar.tsx
decisions:
  - "Used Next.js title.template object so child pages inherit brand suffix automatically without per-page changes"
  - "Removed SidebarFooter block entirely rather than hiding — avoids dead code"
metrics:
  duration: "~1 min"
  completed: "2026-02-18"
  tasks_completed: 2
  files_modified: 2
---

# Phase 30 Plan 01: Root layout brand + sidebar cleanup Summary

**One-liner:** Replaced "ConstructionSaaS" title string with Next.js title.template `%s | BIDAXIOM` and deleted the v0.0.1 version footer from the sidebar.

## What Was Built

- `apps/web/app/layout.tsx`: `metadata.title` changed from a plain string to an object with `template: "%s | BIDAXIOM"` and `default: "BIDAXIOM"`. Description copy updated to "Construction management software for general contractors and subcontractors".
- `apps/web/components/layout/sidebar.tsx`: `SidebarFooter` JSX block (with `v0.0.1` text and `border-t` divider) removed entirely. `SidebarFooter` also removed from the `@/components/ui/sidebar` import to avoid unused-import warnings.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Update root layout metadata to BIDAXIOM title template | 8f1e24f | apps/web/app/layout.tsx |
| 2 | Remove sidebar version number and divider | 1efb698 | apps/web/components/layout/sidebar.tsx |

## Verification Results

1. `grep -r "ConstructionSaaS" apps/web/app` — no matches (clean)
2. `grep "SidebarFooter" apps/web/components/layout/sidebar.tsx` — no matches (clean)
3. `grep "v0.0.1" apps/web/components/layout/sidebar.tsx` — no matches (clean)
4. `apps/web/app/layout.tsx` contains `template: "%s | BIDAXIOM"` — confirmed
5. TypeScript: no new errors introduced by plan changes (pre-existing errors in workflow-detail.tsx, lib/session.ts, lib/trpc-server.ts are out of scope)

## Deviations from Plan

None - plan executed exactly as written.

## Deferred Items

Pre-existing TypeScript errors in unrelated files observed during verification (out of scope for this plan):
- `apps/web/components/workflow/workflow-detail.tsx` — multiple `isLoading` / missing property errors
- `apps/web/lib/session.ts` — missing `@types/cookie` declaration
- `apps/web/lib/trpc-server.ts` — cannot find module `../../../api/src/trpc/router`

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| apps/web/app/layout.tsx exists | FOUND |
| apps/web/components/layout/sidebar.tsx exists | FOUND |
| 30-01-SUMMARY.md exists | FOUND |
| Commit 8f1e24f (Task 1) | FOUND |
| Commit 1efb698 (Task 2) | FOUND |
