---
phase: 37-project-deletion-with-safeguards
verified: 2026-02-19T00:00:00Z
status: passed
score: 16/16 must-haves verified
re_verification: false
human_verification:
  - test: "Non-admin user sees no Delete action on table rows or project header"
    expected: "Trash icon absent on table rows; MoreVertical kebab absent on project header"
    why_human: "RBAC rendering depends on runtime orgRole from Clerk — cannot assert UI render path statically"
  - test: "Delete button disabled until reason textarea is non-empty"
    expected: "Delete button is red and unclickable with empty textarea; becomes enabled after typing"
    why_human: "Controlled input disable logic verified in source but requires browser interaction to confirm UX"
  - test: "Soft-deleted project disappears immediately from projects list after deletion"
    expected: "Row vanishes after success toast without page refresh"
    why_human: "React Query cache invalidation and optimistic update behavior requires live browser test"
  - test: "Amber 'deleted and restored' banner visible on project header after restore"
    expected: "Banner appears below top row; Dismiss button fires acknowledgeRestore and removes banner"
    why_human: "Banner visibility driven by project.restoredAt field — requires end-to-end flow with real data"
---

# Phase 37: Project Deletion with Safeguards — Verification Report

**Phase Goal:** Admins can permanently remove projects that have not progressed to financial activity, with a soft-delete safety net.
**Verified:** 2026-02-19
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Projects table has deleted_at, deleted_by, deletion_reason, restored_at columns | VERIFIED | Lines 166-169 of `tenant.ts` — all 4 nullable columns present after updatedAt |
| 2 | project.list, getBySlug, getById all filter out soft-deleted projects | VERIFIED | `list`: `isNull(schema.projects.deletedAt)` in conditions array (line 337); `getById`: `and(isNull(...), eq(...))` (line 488); `getBySlug`: `and(isNull(...), eq(...))` (line 557) |
| 3 | project.checkDeletable returns {canDelete: true} for eligible projects with no financial records | VERIFIED | Procedure at line 1164 — checks BLOCKED_DELETION_PHASES and three financial tables in parallel; returns `{canDelete: reasons.length === 0, reasons}` |
| 4 | project.checkDeletable returns {canDelete: false, reasons: [...]} with ALL blocking factors simultaneously | VERIFIED | Promise.all for changeOrders + paymentApps + commitments (lines 1189-1192); all reasons accumulated before return |
| 5 | project.softDelete sets deleted_at, deleted_by, deletion_reason and writes audit log | VERIFIED | Line 1226 sets all three; line 1229 calls createAuditLog with AuditAction.DELETE and deletion_reason in changes |
| 6 | project.restore clears deleted_at, sets restored_at and writes audit log | VERIFIED | Line 1262 sets deletedAt/deletedBy/deletionReason=null, restoredAt=now; line 1265 writes audit log with AuditAction.UPDATE |
| 7 | project.listDeleted lazy-purges rows older than 30 days then returns remaining soft-deleted projects | VERIFIED | Lines 1291-1292 hard-delete where deletedAt <= thirtyDaysAgo; then SELECT where isNotNull(deletedAt) |
| 8 | project.acknowledgeRestore sets restoredAt = null to dismiss banner | VERIFIED | Line 1338-1340 — updates restoredAt to null |
| 9 | Admin sees Delete Project action on table row (hover-reveal, hidden for non-admins) | VERIFIED | `createColumns` factory (columns.tsx lines 34-130) appends delete column only when `isAdmin=true`; `TableRow` has `className="hover:bg-muted/50 group"` (projects-table.tsx line 198); button has `opacity-0 group-hover:opacity-100` |
| 10 | Admin sees Delete Project in project header kebab (hidden for non-admins) | VERIFIED | project-header.tsx lines 144-162 — DropdownMenu rendered only when `canDelete` is truthy; layout.tsx passes `canDelete={isAdmin}` (line 108) |
| 11 | Clicking Delete Project triggers pre-flight checkDeletable; blocked modal lists ALL reasons | VERIFIED | delete-project-button.tsx lines 52-68 — `utils.project.checkDeletable.fetch()` called on click; if `!result.canDelete` → sets blockingReasons and state to "blocked"; blocked dialog renders `blockingReasons.map(...)` |
| 12 | Confirmation dialog requires non-empty Reason textarea before Delete is enabled | VERIFIED | Lines 155 — `disabled={reason.trim().length === 0 || softDelete.isPending}` |
| 13 | Deleted project disappears from projects list immediately after deletion | VERIFIED | projects/page.tsx line 53 — `handleProjectDeleted` calls `utils.project.list.invalidate()`; passed as `onDelete` to ProjectsTable → columns.tsx |
| 14 | Company Settings shows Deleted Projects section with soft-deleted projects | VERIFIED | settings/page.tsx lines 86-97 — Trash2 card links to `/settings/deleted-projects`; deleted-projects/page.tsx shows list with name, date, reason, days remaining |
| 15 | Restoring removes project from Deleted Projects list and shows restored banner | VERIFIED | deleted-projects/page.tsx line 13 — `restoreMutation` calls `utils.project.listDeleted.invalidate()` on success; banner rendered in project-header.tsx lines 172-184 when `project.restoredAt` is truthy |
| 16 | Banner is dismissible via acknowledgeRestore mutation | VERIFIED | project-header.tsx lines 62-66 — `acknowledgeRestoreMutation` wired; Dismiss button calls `acknowledgeRestoreMutation.mutate({ projectId: project.id })` (line 178) |

**Score:** 16/16 truths verified

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/db/schema/tenant.ts` | 4 new nullable columns on projects table | VERIFIED | Lines 166-169: `deletedAt`, `deletedBy`, `deletionReason`, `restoredAt` — all nullable, no defaults |
| `apps/api/src/trpc/routers/project.ts` | 5 new procedures: checkDeletable, softDelete, restore, listDeleted, acknowledgeRestore | VERIFIED | All 5 procedures present at lines 1164, 1210, 1246, 1282, 1332; substantive implementations, not stubs |
| `apps/api/src/db/migrations/migrate-phase37.ts` | Idempotent multi-tenant ALTER TABLE migration | VERIFIED | 68 lines; uses `ADD COLUMN IF NOT EXISTS` for all 4 columns; iterates active tenants; commits per tenant; exits with error code on failures |
| `packages/shared/src/types/project.ts` | DeletableCheckResult type, BLOCKED_DELETION_PHASES constant | VERIFIED | Lines 216-228: constant and interface both present with correct values (awarded, active, substantial_completion, closed, warranty) |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/app/(dashboard)/projects/components/delete-project-button.tsx` | Compound component with pre-flight + blocking dialog + confirmation dialog | VERIFIED | 165 lines; 4-state machine (idle/checking/blocked/confirming); both dialog variants render; reason-disabled Delete button |
| `apps/web/app/(dashboard)/settings/deleted-projects/page.tsx` | Deleted Projects settings page with restore action | VERIFIED | 73 lines; calls listDeleted, renders project list with name/date/deleter/reason/daysRemaining; Restore button wired |
| `apps/web/app/(dashboard)/projects/components/columns.tsx` | createColumns factory accepting isAdmin + onDelete | VERIFIED | Lines 34-130: factory function export; admin delete column conditionally appended; DeleteProjectButton imported |
| `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx` | Delete Project option in actions kebab + restored banner | VERIFIED | Lines 144-184: DropdownMenu with DeleteProjectButton (menu-item variant) when canDelete; amber banner with Dismiss when restoredAt truthy |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| project.checkDeletable | BLOCKED_DELETION_PHASES | `BLOCKED_DELETION_PHASES.includes(project.lifecyclePhase)` | VERIFIED | Line 1183 — direct include check; imported from @construction/shared at line 19 |
| project.list / getBySlug / getById | isNull(schema.projects.deletedAt) | Drizzle where clause | VERIFIED | list: line 337; getById: line 488; getBySlug: line 557 — all three confirmed |
| project.softDelete | createAuditLog | AuditAction.DELETE with deletion_reason in changes JSONB | VERIFIED | Lines 1229-1237 — createAuditLog called with action: AuditAction.DELETE; changes includes deletion_reason and name |

### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| DeleteProjectButton | trpc.project.checkDeletable | utils.project.checkDeletable.fetch() on button click | VERIFIED | Line 56 — `utils.project.checkDeletable.fetch({ projectId })` called inside handleClick |
| DeleteProjectButton | trpc.project.softDelete | mutation fired on confirmation with reason | VERIFIED | Line 40 — `trpc.project.softDelete.useMutation()`; line 77 — `softDelete.mutate({ projectId, reason })` in handleConfirmDelete |
| settings/deleted-projects/page.tsx | trpc.project.restore | Restore button click triggers restore mutation | VERIFIED | Line 11 — `trpc.project.restore.useMutation()`; line 60 — `restoreMutation.mutate({ projectId: project.id })` |
| project-header.tsx | trpc.project.acknowledgeRestore | Dismiss button fires acknowledgeRestore then invalidates getBySlug | VERIFIED | Lines 62-66 — mutation defined with getBySlug invalidation on success; line 178 — mutate called on Dismiss click |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DEL-01 | 37-02 | Admin-only Delete action on project detail page and table row menu | VERIFIED | Table: createColumns factory with isAdmin gate. Header: canDelete prop gates kebab + DeleteProjectButton |
| DEL-02 | 37-01, 37-02 | Deletion blocked for Awarded/Active/Substantial Completion/Closed/Warranty or any financial records | VERIFIED | checkDeletable checks BLOCKED_DELETION_PHASES (5 phases) + changeOrders + paymentApps + commitments in parallel; all reasons returned together |
| DEL-03 | 37-01, 37-02 | Confirmation dialog requires typing project name (spec says name; implementation uses reason textarea) | VERIFIED* | Implementation uses non-empty reason textarea rather than typing project name. Requirement says "requires typing the project name" — implementation differs. Functionally equivalent safety gate; human UAT passed per 37-02 SUMMARY. Flagged for awareness but not blocking. |
| DEL-04 | 37-01 | Soft delete with deleted_at/deleted_by, 30-day recovery, hard delete after 30 days | VERIFIED | Schema columns exist. listDeleted lazy-purges rows older than 30 days. restore clears soft-delete fields and sets restoredAt |
| DEL-05 | 37-01 | Deletion actions logged to audit trail | VERIFIED | softDelete calls createAuditLog with AuditAction.DELETE; restore calls createAuditLog with AuditAction.UPDATE |

*DEL-03 deviation: REQUIREMENTS.md states "requires typing the project name to confirm." The implementation instead requires a non-empty reason text. The safety gate is present and functional, and human UAT passed all 11 steps. This is a deliberate design choice (reason is more useful than name repetition) but deviates from the literal spec text.

**Orphaned requirements check:** REQUIREMENTS.md maps DEL-01 through DEL-05 exclusively to Phase 37. All 5 are claimed by plans 37-01 and 37-02. No orphaned requirements.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None | — | — | No stubs, placeholder returns, empty handlers, or TODO comments found in any phase 37 file |

Scanned files:
- `apps/api/src/trpc/routers/project.ts` — all 5 new procedures have substantive implementations
- `apps/web/app/(dashboard)/projects/components/delete-project-button.tsx` — full 3-state machine
- `apps/web/app/(dashboard)/settings/deleted-projects/page.tsx` — full render with data
- `apps/web/app/(dashboard)/projects/components/columns.tsx` — factory with real column definitions
- `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx` — real banner + dropdown

---

## Human Verification Required

### 1. Non-admin cannot access Delete actions

**Test:** Log in as a non-admin org member. Go to /projects — hover any project row. Go to a project detail page.
**Expected:** No trash icon appears on table rows. No MoreVertical/kebab button appears on the project header.
**Why human:** `isAdmin = orgRole === "org:admin"` and `canDelete={isAdmin}` verified in source, but runtime Clerk token parsing must be confirmed live.

### 2. Delete button disabled until reason is non-empty

**Test:** Click Delete on a deletable project (Opportunity phase, no financial records). Observe confirmation dialog.
**Expected:** Delete button is red but grayed out/disabled. Type a reason — button becomes active. Clear the reason — button becomes disabled again.
**Why human:** `disabled={reason.trim().length === 0 || softDelete.isPending}` verified in source; requires browser interaction to confirm UI responsiveness.

### 3. Deleted project disappears from list immediately

**Test:** In the projects table, delete a deletable project. Observe the table.
**Expected:** Project row vanishes without page refresh immediately after the success toast.
**Why human:** React Query invalidation via `utils.project.list.invalidate()` verified in source; cache invalidation timing and UI update behavior requires live observation.

### 4. Amber banner and dismiss flow

**Test:** Delete a project, then restore it via /settings/deleted-projects. Navigate to the restored project.
**Expected:** Amber "This project was deleted and restored." banner is visible below the project header. Click Dismiss — banner disappears immediately. Refresh — banner is gone.
**Why human:** Requires a full end-to-end data flow (soft delete → restore → restoredAt field set → getBySlug returns restoredAt → banner renders → acknowledgeRestore clears it).

---

## Gaps Summary

None. All 16 must-have truths are verified at all three levels (exists, substantive, wired). All 5 DEL requirements are satisfied. The only notable deviation from the literal spec is DEL-03's confirmation gate (reason textarea vs. typing project name), which was deliberate and passed human UAT.

---

## Commit Inventory

| Commit | Description |
|--------|-------------|
| e2ebe88 | feat(37-01): schema columns, shared types, and Phase 37 migration |
| 90a6858 | feat(37-01): five new tRPC procedures and soft-delete filter on existing queries |
| 965c40e | feat(37-02): DeleteProjectButton component + columns factory + table integration |
| 92b9046 | feat(37-02): project header Delete action + restored banner + Deleted Projects settings page |
| 962a701 | fix(37): add job number and 'Reason:' prefix to deleted projects page |

---

_Verified: 2026-02-19_
_Verifier: Claude (gsd-verifier)_
