---
phase: 44-change-order-and-payment-app-redesign
plan: "02"
subsystem: web
tags:
  - change-orders
  - csv-export
  - approval-workflow
  - inline-actions
dependency_graph:
  requires:
    - "44-01 (canCurrentUserApprove on CO list endpoint)"
  provides:
    - "CSV export of filtered/sorted CO list"
    - "Inline Approve/Reject buttons on pending CO rows"
    - "Shared confirmation dialog with optional/required comments"
  affects:
    - "44-03-PLAN.md (parallel pattern: same inline action approach for pay apps)"
tech_stack:
  added: []
  patterns:
    - "exportCsv iterates table.getRowModel().rows — respects current filter+sort state"
    - "Shared Dialog pattern keyed by pendingActionId — single dialog instance, not per-row"
    - "e.stopPropagation() on action TableCell and each Button — prevents row-click navigation"
    - "isRejecting gate on canConfirm — reject requires non-empty comment, approve does not"
key_files:
  created: []
  modified:
    - apps/web/components/change-order/change-order-list.tsx
decisions:
  - "Export CSV button placed LEFT of New Change Order button — logical toolbar order: bulk action before create action"
  - "actions column added to TanStack columns definition (enableSorting: false, header empty) — keeps column model consistent with visible cells"
  - "TableFooter gets extra empty TableCell for actions column — maintains colSpan correctness"
  - "canCurrentUserApprove read as `co.canCurrentUserApprove` via `row.original as any` — field comes from API (44-01) but not in local TS types"
  - "isMutating derived from approveMutation.isPending || rejectMutation.isPending — disables both Cancel and Confirm during in-flight request"
metrics:
  duration: "~3 minutes"
  completed: "2026-02-23"
  tasks_completed: 2
  files_modified: 1
---

# Phase 44 Plan 02: CSV Export + Inline Approve/Reject on CO List — Summary

CSV export button and inline Approve/Reject actions added to ChangeOrderList, eliminating navigation to the detail page for routine approvals.

## What Was Built

`change-order-list.tsx` gains two new capabilities:

**CSV Export (LIST-04):** An `exportCsv` function iterates `table.getRowModel().rows` — the currently filtered and sorted rows — and downloads a file named `change-orders-{projectSlug}-{YYYY-MM-DD}.csv`. Headers are: CO #, Title, Type, Status, Amount, Date. The Export CSV button lives in the filter toolbar, to the left of New Change Order, and is disabled when the table has zero visible rows.

**Inline Approve/Reject (LIST-05):** A new `actions` column renders Approve and Reject buttons on rows where `canCurrentUserApprove === true` and `status` is `pco_submitted` or `pending_approval`. Clicking either button opens a single shared Dialog (not per-row dialogs). Approve has an optional comments field; Reject requires a non-empty comment before confirming. Confirming fires the existing `trpc.changeOrder.approve` or `trpc.changeOrder.reject` mutation, which on success invalidates `changeOrder.list` and resets dialog state. All button onClick handlers call `e.stopPropagation()` to prevent accidental row navigation.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Add CSV export to ChangeOrderList | 0407099 | apps/web/components/change-order/change-order-list.tsx |
| 2 | Add inline Approve/Reject with confirmation dialog | e3b01bb | apps/web/components/change-order/change-order-list.tsx |

## Success Criteria Verification

- TypeScript clean compile for change-order-list.tsx — PASSED (zero errors in this file)
- Export CSV button: disabled when rows=0, enabled when rows>0 — PASSED
- Downloaded CSV has correct headers and filename format — PASSED (code verified)
- Inline buttons visible only when canCurrentUserApprove===true and status in [pco_submitted, pending_approval] — PASSED
- Dialog opens on button click; approve/reject mutations fire on confirm; list query invalidated on success — PASSED
- e.stopPropagation() on all action button onClick handlers prevents row navigation — PASSED

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `apps/web/components/change-order/change-order-list.tsx` — FOUND, contains `exportCsv` and `pendingActionId`
- Commit `0407099` — FOUND (feat(44-02): add CSV export to ChangeOrderList toolbar)
- Commit `e3b01bb` — FOUND (feat(44-02): add inline Approve/Reject with confirmation dialog to CO list)
