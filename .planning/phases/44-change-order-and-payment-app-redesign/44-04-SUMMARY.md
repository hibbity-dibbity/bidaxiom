---
phase: 44-change-order-and-payment-app-redesign
plan: "04"
subsystem: web-ui
tags: [csv-export, projects, subcontractors, tanstack-table]
dependency_graph:
  requires: []
  provides: [projects-csv-export, subcontractors-csv-export]
  affects: [apps/web/app/(dashboard)/projects/components/projects-table.tsx, apps/web/app/(dashboard)/subcontractors/page.tsx]
tech_stack:
  added: []
  patterns: [native-blob-url, tanstack-table-getrowmodel]
key_files:
  modified:
    - apps/web/app/(dashboard)/projects/components/projects-table.tsx
    - apps/web/app/(dashboard)/subcontractors/page.tsx
decisions:
  - "Used table.getRowModel().rows (not raw data array) so export reflects current sort/filter state"
  - "formatTrades in subcontractors uses CSI_DIVISIONS lookup with +N more suffix, consistent with badge display"
  - "No new packages — native Blob + URL.createObjectURL matches pattern from 44-02/44-03"
metrics:
  duration: "~2 minutes"
  completed: "2026-02-23"
  tasks_completed: 2
  files_modified: 2
---

# Phase 44 Plan 04: CSV Export for Projects and Subcontractors — Summary

**One-liner:** Export CSV buttons added to Projects and Subcontractors lists, exporting `table.getRowModel().rows` via native Blob to `projects-{date}.csv` / `subcontractors-{date}.csv`.

## What Was Built

Added `exportCsv` functions and Export CSV buttons to the two remaining global list views that lacked CSV export, closing the LIST-04 gap.

### Task 1: ProjectsTable (`projects-table.tsx`)

- Added `Download` to lucide-react import
- Added `exportCsv` function using `table.getRowModel().rows` (respects current sort order)
- CSV filename: `projects-{YYYY-MM-DD}.csv`
- CSV headers: Job #, Name, Customer, Phase, Start Date
- Row data: `jobNumber ?? ""`, `name`, `customerName ?? ""`, `lifecyclePhase ?? ""`, `startDate` formatted via `toLocaleDateString()`
- Export CSV button placed LEFT of ColumnPicker in `<div className="flex justify-end items-center gap-2">`
- Button: `variant="outline" size="sm"`, disabled when `table.getRowModel().rows.length === 0`

**Commit:** `ea45eaa` — `feat(44-04): add Export CSV button to ProjectsTable`

### Task 2: SubcontractorsPage (`subcontractors/page.tsx`)

- Added `Download` to lucide-react import
- Added `exportCsv` function using `table.getRowModel().rows`
- CSV filename: `subcontractors-{YYYY-MM-DD}.csv`
- CSV headers: Company, Contact, Email, Trade, Status
- `formatTrades`: first 3 CSI division names (via `CSI_DIVISIONS.find`), pipe-separated, with `+N more` suffix
- `getStatusLabel(s.status)` used for Status column
- Export CSV button placed LEFT of "Add Subcontractor" button in page header, wrapped in `<div className="flex items-center gap-2">`
- Button: `variant="outline" size="sm"`, disabled when `table.getRowModel().rows.length === 0`

**Commit:** `ddfb455` — `feat(44-04): add Export CSV button to SubcontractorsPage`

## Verification

- TypeScript compilation confirmed zero errors in both modified files (`npx tsc --noEmit` from `apps/web/`)
- Both files import `Download` from lucide-react
- Both `exportCsv` functions iterate `table.getRowModel().rows` (not raw data arrays)
- Both buttons disabled when row count is zero
- Filename patterns: `projects-{YYYY-MM-DD}.csv`, `subcontractors-{YYYY-MM-DD}.csv`
- No new npm packages added

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `apps/web/app/(dashboard)/projects/components/projects-table.tsx` — FOUND, modified
- `apps/web/app/(dashboard)/subcontractors/page.tsx` — FOUND, modified
- Commit `ea45eaa` — FOUND (Task 1)
- Commit `ddfb455` — FOUND (Task 2)
- TypeScript errors in target files — NONE
