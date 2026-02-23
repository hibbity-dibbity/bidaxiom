---
phase: 44-change-order-and-payment-app-redesign
plan: "03"
subsystem: web
tags:
  - payment-apps
  - csv-export
  - approval-workflow
  - inline-actions
dependency_graph:
  requires:
    - "44-01 (canCurrentUserApprove on paymentApp.list endpoint)"
  provides:
    - "CSV export of filtered/sorted pay app list"
    - "Inline Approve button for submitted/under_review pay apps when canCurrentUserApprove"
    - "Inline Mark Paid button for approved pay apps (any authorized user)"
    - "Shared confirmation dialog for approve/mark-paid actions"
  affects: []
tech_stack:
  added: []
  patterns:
    - "exportCsv via table.getRowModel().rows — respects current filter + sort state"
    - "Blob + URL.createObjectURL for client-side CSV download"
    - "pendingActionId/pendingAction state pattern for shared action dialog"
    - "isMutating = approveMutation.isPending || markPaidMutation.isPending"
key_files:
  created: []
  modified:
    - apps/web/components/payment-app/payment-app-list.tsx
decisions:
  - "Export CSV button placed in left side of filter toolbar (alongside status Select) — consistent with standard toolbar layout patterns across the app"
  - "canCurrentUserApprove cast via (row.original as any) — field is present at runtime from 44-01 API change but not yet in the static ColumnDef type; avoids a separate type augmentation"
  - "Mark Paid shows for status===approved with no canCurrentUserApprove check — per plan spec; any user with project access can mark as paid"
  - "e.stopPropagation() on action cell onClick and each button onClick — pay app rows have no row-level navigation, but included defensively"
metrics:
  duration: "~2 minutes"
  completed: "2026-02-23"
  tasks_completed: 2
  files_modified: 1
---

# Phase 44 Plan 03: CSV Export and Inline Approve/Mark Paid on PaymentAppList — Summary

CSV export of the filtered/sorted pay app list plus Dialog-driven inline Approve and Mark Paid actions directly from the payment applications table.

## What Was Built

`PaymentAppList` now has three new capabilities:

1. **CSV Export** — An "Export CSV" button in the filter toolbar exports the currently filtered and sorted set via `table.getRowModel().rows`. The file is named `payment-apps-{projectSlug}-{YYYY-MM-DD}.csv` with headers: App #, Status, Period Start, Period End, Amount Due. The button is disabled when no rows are visible.

2. **Inline Approve** — Pay app rows in "submitted" or "under_review" status show an Approve button when `canCurrentUserApprove` is true (from the 44-01 API field). Clicking opens a shared confirmation dialog with an optional comments Textarea.

3. **Inline Mark Paid** — Pay app rows in "approved" status show a Mark Paid button (no `canCurrentUserApprove` check — any authorized user). Clicking opens the same shared dialog.

Both action buttons fire the existing `trpc.paymentApp.approve` and `trpc.paymentApp.markPaid` mutations, invalidate `paymentApp.list` on success, and close the dialog — no page navigation.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Add CSV export to PaymentAppList | 408ba64 | apps/web/components/payment-app/payment-app-list.tsx |
| 2 | Add inline Approve/Mark Paid with confirmation dialog | 771fcfc | apps/web/components/payment-app/payment-app-list.tsx |

## Success Criteria Verification

- TypeScript compiles cleanly for payment-app-list.tsx — PASSED (zero errors in file)
- Export CSV button: disabled when rows=0; filename format correct; correct headers — PASSED
- Approve button visible only when (status===submitted || under_review) AND canCurrentUserApprove===true — PASSED
- Mark Paid button visible only when status===approved (no canCurrentUserApprove check) — PASSED
- Dialog opens on button click; correct mutation fires on confirm; list query invalidated on success — PASSED
- e.stopPropagation() on all action button onClick handlers and cell onClick — PASSED

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `apps/web/components/payment-app/payment-app-list.tsx` — FOUND, contains `exportCsv`, `pendingActionId`, `approveMutation.mutate`, `markPaidMutation.mutate`, `getRowModel`
- Commit `408ba64` — FOUND
- Commit `771fcfc` — FOUND
