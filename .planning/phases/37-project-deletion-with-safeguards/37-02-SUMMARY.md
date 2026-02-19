---
phase: 37-project-deletion-with-safeguards
plan: 02
subsystem: web
tags: [react, trpc, next.js, soft-delete, admin-ui, compound-component]

# Dependency graph
requires:
  - phase: 37-01
    provides: checkDeletable, softDelete, restore, listDeleted, acknowledgeRestore tRPC procedures; 4 soft-delete columns on projects table
provides:
  - DeleteProjectButton compound component (pre-flight + blocking dialog + confirmation dialog)
  - Admin-only delete column on projects table (hover-reveal trash icon)
  - Admin-only Delete Project kebab in project header
  - Deleted Projects settings page (/settings/deleted-projects)
  - Amber restored banner on project header with dismiss action
affects:
  - columns.tsx converted to createColumns factory (any future column additions must use the factory pattern)
  - project-header.tsx now accepts canDelete and restoredAt props

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Compound state machine component: idle → checking → blocked|confirming, manages 3 dialog states in one component"
    - "Columns factory: createColumns(isAdmin, onDelete) appends admin-only column rather than static export"
    - "Hover-reveal pattern: className='group' on TableRow + opacity-0 group-hover:opacity-100 on button"
    - "Pre-flight via utils.project.checkDeletable.fetch() — tRPC query fetch (not useMutation) for on-demand check"
    - "window.location.href redirect after delete from header (avoids stale project route)"

key-files:
  created:
    - apps/web/app/(dashboard)/projects/components/delete-project-button.tsx
    - apps/web/app/(dashboard)/settings/deleted-projects/page.tsx
  modified:
    - apps/web/app/(dashboard)/projects/components/columns.tsx
    - apps/web/app/(dashboard)/projects/components/projects-table.tsx
    - apps/web/app/(dashboard)/projects/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx
    - apps/web/app/(dashboard)/settings/page.tsx
    - apps/api/src/trpc/routers/project.ts

key-decisions:
  - "DeleteProjectButton uses utils.project.checkDeletable.fetch() (direct query fetch) rather than useMutation for pre-flight — semantically a read, not a write"
  - "Confirmation dialog Delete button disabled until reason.trim().length > 0 — enforces non-empty reason at UI level"
  - "Delete from project header redirects to /projects via window.location.href — avoids navigating to a now-deleted project route"
  - "columns.tsx converted from static export to createColumns factory — admin delete column only appended when isAdmin=true"
  - "Fix commit 962a701: listDeleted API returns jobNumber, deleted-projects page displays 'Reason: ...' prefix"

requirements-completed:
  - DEL-01
  - DEL-03

# Metrics
duration: ~45min (including human verification checkpoint)
completed: 2026-02-19
---

# Phase 37 Plan 02: Frontend Deletion UX — DeleteProjectButton, Table Integration, Deleted Projects Settings Summary

**Admin-only project deletion UX: compound DeleteProjectButton with 3-state machine (pre-flight check → blocking modal OR reason-required confirmation), hover-reveal delete on table rows, kebab action in project header, Deleted Projects recovery page at /settings/deleted-projects, and dismissible amber restored banner.**

## Performance

- **Duration:** ~45 min (including human verification checkpoint)
- **Started:** 2026-02-19T~15:20Z
- **Completed:** 2026-02-19T~16:15Z (post-verification fixes included)
- **Tasks:** 2 auto + 1 human-verify checkpoint
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments

- Created `delete-project-button.tsx`: compound component managing idle/checking/blocked/confirming states. Pre-flight calls `checkDeletable.fetch()` and shows blocking modal listing all reasons simultaneously if undeletable. Confirmation dialog has required Reason textarea with Delete disabled until non-empty.
- Converted `columns.tsx` static export to `createColumns(isAdmin, onDelete)` factory — admin-only delete column (hover-reveal trash icon via `className="group"`) appended only when `isAdmin=true`.
- Updated `projects-table.tsx` to accept `isAdmin` and `onDelete` props and pass them to `createColumns`.
- Updated `projects/page.tsx` to derive `isAdmin` from `orgRole`, wire `onDelete` to invalidate `project.list`, and pass both to `ProjectsTable`.
- Updated `project-header.tsx` with `canDelete` prop: MoreVertical kebab dropdown containing `DeleteProjectButton` (menu-item variant) that redirects to `/projects` after deletion. Added amber restored banner driven by `project.restoredAt` with `acknowledgeRestore` mutation on Dismiss.
- Updated `layout.tsx` to pass `canDelete={isAdmin}` and `restoredAt` to `ProjectHeader`.
- Created `settings/deleted-projects/page.tsx`: lists soft-deleted projects with name, deleted date, deleter name, reason, and days remaining. Restore button calls `restore` mutation and invalidates `listDeleted`.
- Added Deleted Projects card (Trash2 icon) to `settings/page.tsx` linking to `/settings/deleted-projects`.
- Fix (962a701): added `jobNumber` to `listDeleted` API select and `"Reason: "` prefix on deleted-projects page.

## Task Commits

Each task was committed atomically:

1. **Task 1: DeleteProjectButton + columns factory + table integration** - `965c40e` (feat)
2. **Task 2: Project header Delete action + restored banner + Deleted Projects settings page** - `92b9046` (feat)
3. **Post-verification fix: job number and Reason prefix** - `962a701` (fix)

## Files Created/Modified

- `apps/web/app/(dashboard)/projects/components/delete-project-button.tsx` — New: compound component, 3-state machine (checking/blocked/confirming), pre-flight via checkDeletable.fetch(), softDelete on confirm
- `apps/web/app/(dashboard)/settings/deleted-projects/page.tsx` — New: trash bin page listing soft-deleted projects with restore action; also patched in 962a701 (job number + Reason prefix)
- `apps/web/app/(dashboard)/projects/components/columns.tsx` — Converted static `columns` export to `createColumns(isAdmin, onDelete)` factory with admin-only delete column
- `apps/web/app/(dashboard)/projects/components/projects-table.tsx` — Added `isAdmin` and `onDelete` props; uses `createColumns`; added `className="group"` to TableRow
- `apps/web/app/(dashboard)/projects/page.tsx` — Derives `isAdmin` from `orgRole`; wires `onDelete` invalidation; passes both to `ProjectsTable`
- `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx` — Added `canDelete` prop, MoreVertical kebab with DeleteProjectButton (menu-item), amber restored banner with acknowledgeRestore
- `apps/web/app/(dashboard)/projects/[projectSlug]/layout.tsx` — Passes `canDelete={isAdmin}` and `restoredAt` to ProjectHeader
- `apps/web/app/(dashboard)/settings/page.tsx` — Added Deleted Projects card with Trash2 icon
- `apps/api/src/trpc/routers/project.ts` — listDeleted patched to include jobNumber in select

## Decisions Made

- `DeleteProjectButton` calls `utils.project.checkDeletable.fetch()` (direct query fetch) rather than a separate useMutation for pre-flight — semantically it is a read-only check
- Confirmation dialog Delete button is disabled until `reason.trim().length > 0` — enforces non-empty reason at the UI layer, complementing API-level validation
- Deletion from project header redirects via `window.location.href = "/projects"` — avoids the client navigating to a now-soft-deleted project route that would return a 404
- `createColumns` factory pattern: static column list remains unchanged; admin delete column is conditionally appended based on `isAdmin` — no column rendering logic bleeds into the table component

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] listDeleted missing jobNumber field**
- **Found during:** Human verification (UAT step 6)
- **Issue:** Deleted Projects page could not display the job number because `listDeleted` did not select `jobNumber` from the projects table
- **Fix:** Added `jobNumber` to the select clause in `listDeleted` procedure
- **Files modified:** `apps/api/src/trpc/routers/project.ts`, `apps/web/app/(dashboard)/settings/deleted-projects/page.tsx`
- **Commit:** 962a701

**2. [Rule 1 - Bug] Deletion reason displayed without label prefix**
- **Found during:** Human verification (UAT step 6)
- **Issue:** `deletionReason` displayed as bare quoted text with no "Reason:" label — hard to scan visually
- **Fix:** Added `"Reason: "` prefix to the deletion reason display in deleted-projects page
- **Files modified:** `apps/web/app/(dashboard)/settings/deleted-projects/page.tsx`
- **Commit:** 962a701

## Issues Encountered

None beyond the two minor post-verification fixes above. All 11 human verification steps passed after fixes.

## User Setup Required

None — no new configuration, environment variables, or external services required.

## Next Phase Readiness

- Phase 37 is now complete (both plans done). All requirements DEL-01 through DEL-05 are satisfied.
- The deletion/restore flow is fully operational end-to-end: pre-flight → blocking modal OR reason confirmation → soft delete → trash bin → restore → restored banner → dismiss.
- No cleanup or follow-up work required for this phase.

---

## Self-Check

**Created files exist:**
- `apps/web/app/(dashboard)/projects/components/delete-project-button.tsx` — FOUND (committed in 965c40e)
- `apps/web/app/(dashboard)/settings/deleted-projects/page.tsx` — FOUND (committed in 92b9046, patched in 962a701)

**Commits exist:**
- 965c40e — FOUND (feat(37-02): DeleteProjectButton component + columns factory + table integration)
- 92b9046 — FOUND (feat(37-02): project header Delete action + restored banner + Deleted Projects settings page)
- 962a701 — FOUND (fix(37): add job number and 'Reason:' prefix to deleted projects page)

## Self-Check: PASSED

---
*Phase: 37-project-deletion-with-safeguards*
*Completed: 2026-02-19*
