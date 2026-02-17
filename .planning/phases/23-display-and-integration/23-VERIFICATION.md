---
phase: 23-display-and-integration
verified: 2026-02-16T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
human_verification:
  - test: "Confirm 'Job #' column visible in project list at /projects with real job number data and '--' fallback"
    expected: "Table shows 'Job #' as first column, projects with numbers display them (e.g. '2026-001'), projects without show '--'"
    why_human: "Visual column rendering and actual data presence cannot be confirmed programmatically"
  - test: "Confirm project detail header at /projects/{slug} shows '{jobNumber}-{name}' format"
    expected: "h1 heading reads e.g. '2026-001-Acme Office Renovation'; project without job number shows only the project name"
    why_human: "Visual heading rendering and conditional fallback require browser confirmation"
  - test: "Confirm job number is visible in the header above estimate detail and workflow pages"
    expected: "Navigating to /projects/{slug}/estimates/{estimateSlug} and /workflow shows the ProjectHeader (with job number) persisted above estimate content"
    why_human: "Next.js nested layout behavior requires browser verification to confirm the header actually renders above child routes"
---

# Phase 23: Display and Integration Verification Report

**Phase Goal:** Job numbers display prominently across all project touchpoints (list, detail, cards, estimates).
**Verified:** 2026-02-16
**Status:** human_needed — all automated checks passed; 3 visual items require human confirmation
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Job number is visible as a column in the project list table view | VERIFIED | `columns.tsx` line 29: `accessorKey: "jobNumber"`, header "Job #", `font-mono` cell, `{jobNumber \|\| "--"}` fallback. `project.list` API (router line 360) explicitly selects `jobNumber`. `projects-table.tsx` imports and passes `columns` to TanStack table. |
| 2 | Job number appears prominently in the project detail page header | VERIFIED | `project-header.tsx` line 88: `` {project.jobNumber ? `${project.jobNumber}-${project.name}` : project.name} `` inside `<h1>`. `layout.tsx` line 67 passes `jobNumber: project.jobNumber` to `<ProjectHeader>`. `getBySlug` uses `db.select()` spread (`...project`) returning all columns including `jobNumber`. |
| 3 | No card view exists — JOBDISP-03 is N/A per requirement gate "if card view exists" | VERIFIED | `find` search of the entire `projects/` directory returned zero files matching `card` or `grid` naming patterns. Projects page uses table-only view (`ProjectsTable`). |
| 4 | Job number is visible on estimate detail and workflow pages via project layout header | VERIFIED | `layout.tsx` renders `<ProjectHeader>` then `{children}` (line 64-89). Sub-routes `[projectSlug]/estimates/[estimateSlug]/page.tsx` and `[projectSlug]/estimates/[estimateSlug]/workflow/page.tsx` both exist under the project layout, meaning ProjectHeader (with job number) renders above all estimate content via Next.js nested layout. |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/app/(dashboard)/projects/components/columns.tsx` | jobNumber column definition (Job # header, font-mono cell, '--' fallback) | VERIFIED | Line 29: `accessorKey: "jobNumber"`, line 31: `size: 100`, line 35: `className="font-mono text-sm"`, line 36: `{jobNumber \|\| "--"}` |
| `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx` | Project detail header rendering jobNumber as '{jobNumber}-{name}' | VERIFIED | Line 88: `` {project.jobNumber ? `${project.jobNumber}-${project.name}` : project.name} `` in `<h1>`. Interface includes `jobNumber: string \| null` at line 20. |
| `apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx` | Layout that renders ProjectHeader above all sub-pages including estimate detail | VERIFIED | Line 8: imports `ProjectHeader`. Lines 64-83: `<ProjectHeader project={{ ..., jobNumber: project.jobNumber, ... }} .../>`. Line 89: `{children}` follows, making header persistent. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `columns.tsx` | `projects-table.tsx` | `ColumnDef[]` export consumed by TanStack table | WIRED | `projects-table.tsx` line 24: `import { columns } from "./columns"`. Line 59: `columns: columns as ColumnDef<Project>[]` passed to `useReactTable`. `Project` interface in `projects-table.tsx` includes `jobNumber: string \| null` at line 11. |
| `layout.tsx` | `project-header.tsx` | `project.jobNumber` prop passed to ProjectHeader | WIRED | `layout.tsx` line 8: `import { ProjectHeader }`. Line 67: `jobNumber: project.jobNumber` explicitly mapped in the project prop object. `project` comes from `trpc.project.getBySlug` which uses `db.select()` full spread returning all columns. |
| `layout.tsx` | estimate sub-routes | Next.js nested layout — ProjectHeader renders above estimate content | WIRED | Both `[estimateSlug]/page.tsx` and `[estimateSlug]/workflow/page.tsx` exist. No intervening `layout.tsx` in `estimates/` directory that would shadow the project layout. `{children}` at line 89 of project layout receives these pages. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| JOBDISP-01 | 23-01-PLAN.md | Job numbers display in project list/table view | SATISFIED | `accessorKey: "jobNumber"` column in `columns.tsx`; API `list` query explicitly selects `jobNumber`; column consumed by TanStack table |
| JOBDISP-02 | 23-01-PLAN.md | Job numbers display prominently in project detail page header | SATISFIED | `project-header.tsx` h1 renders `{jobNumber}-{name}` format; layout passes `jobNumber` from `getBySlug` to header |
| JOBDISP-03 | 23-01-PLAN.md | Job numbers display on project cards (if card view exists) | SATISFIED (N/A) | No card view files exist in `apps/web/app/(dashboard)/projects/`. Requirement gate "if card view exists" is not triggered. |
| JOBDISP-04 | 23-01-PLAN.md | Job numbers display and carry through from estimates to projects | SATISFIED | Project layout renders `<ProjectHeader>` (with jobNumber) above `{children}`; estimate detail and workflow pages are nested under this layout |

**No orphaned requirements.** REQUIREMENTS.md maps exactly JOBDISP-01 through JOBDISP-04 to Phase 23. All four are claimed by 23-01-PLAN.md.

**Note:** REQUIREMENTS.md checkbox status still shows `[ ]` (unchecked) and table column shows `Pending` for all four IDs. This is a documentation tracking gap only — the code satisfies all four requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none found) | — | — | — | — |

No TODO/FIXME/placeholder comments, empty implementations, or stub patterns found in any of the three key files (`columns.tsx`, `project-header.tsx`, `layout.tsx`).

---

### Human Verification Required

#### 1. Job # Column in Project List

**Test:** Navigate to `/projects` in the live app.
**Expected:** A "Job #" column appears (leftmost column), projects with job numbers show them (e.g. `2026-001`) in monospace font, projects without show `--`.
**Why human:** Visual column rendering and whether real project data in the tenant actually has job numbers assigned cannot be confirmed programmatically.

#### 2. Project Detail Header Format

**Test:** Click on a project that has a job number, then click on one that does not.
**Expected:** Project with job number shows heading `2026-001-Acme Office Renovation` (format `{jobNumber}-{name}`). Project without job number shows only `Acme Office Renovation` (no leading `--` or hyphen).
**Why human:** Visual heading rendering and the conditional fallback branch require browser confirmation against real data.

#### 3. Job Number Visible Above Estimate Pages

**Test:** Navigate to a project detail, then click to an estimate. Open the estimate detail page and the estimate workflow page.
**Expected:** The project header (showing the job number and project name) appears at the top of both the estimate detail page and the workflow page, above the estimate-specific content.
**Why human:** Next.js nested layout behavior — that no child `layout.tsx` shadows the project layout and that the header is visually present — requires browser confirmation.

---

### Commit Verification

| Commit | Description | Status |
|--------|-------------|--------|
| `415cfa5` | `docs(23-01): complete JOBDISP code audit — all 4 requirements confirmed intact` | VERIFIED — commit exists, authored 2026-02-16 |
| `872e12a` | `docs(phase-23): complete 23-01 JOBDISP audit and human verification` | VERIFIED — commit exists |

---

### Summary

Phase 23's goal — job numbers display prominently across all project touchpoints — is **fully implemented in code**. All four JOBDISP requirements have substantive, wired implementations:

- **JOBDISP-01:** The `jobNumber` column is defined with `accessorKey`, styled with `font-mono`, has a `--` fallback, included in the API's list query, and consumed by the TanStack table.
- **JOBDISP-02:** The project header component renders `{jobNumber}-{name}` in the h1, with a graceful fallback to name-only. The layout fetches and passes `jobNumber` from the database.
- **JOBDISP-03:** Confirmed N/A — no card view exists in this application. The requirement gate condition ("if card view exists") is not met, so the requirement is satisfied by absence.
- **JOBDISP-04:** The project layout persists `<ProjectHeader>` above all children. Both `[estimateSlug]/page.tsx` and `[estimateSlug]/workflow/page.tsx` are nested under this layout, meaning the header with job number is always present above estimate content.

Three human visual confirmations are needed to close the phase: confirming the column renders in the live table, confirming the header format in the browser, and confirming the layout persists above estimate pages. No code gaps were found.

---

_Verified: 2026-02-16_
_Verifier: Claude (gsd-verifier)_
