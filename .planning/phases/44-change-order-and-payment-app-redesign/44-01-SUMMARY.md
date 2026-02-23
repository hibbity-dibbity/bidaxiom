---
phase: 44-change-order-and-payment-app-redesign
plan: "01"
subsystem: api
tags:
  - change-orders
  - payment-apps
  - approval-workflow
  - performance
dependency_graph:
  requires: []
  provides:
    - "CO list endpoint with canCurrentUserApprove: boolean per row"
    - "Pay app list endpoint with canCurrentUserApprove: boolean per row"
  affects:
    - "44-02-PLAN.md (inline Approve/Reject buttons read this field)"
    - "44-03-PLAN.md (inline Mark Paid button reads this field)"
tech_stack:
  added: []
  patterns:
    - "Bulk inArray query pattern for per-row permission flags (no N+1)"
    - "First-pending-step-wins Map keyed by entity ID"
key_files:
  modified:
    - apps/api/src/trpc/routers/change-order.ts
    - apps/api/src/trpc/routers/payment-app.ts
decisions:
  - "normalizedRole computed once before the .map() call in both endpoints — not recalculated per row"
  - "Empty list guard (length === 0) skips the inArray DB call entirely — prevents inArray([]) edge case"
  - "First pending step wins in pendingStepMap — consistent with approve/reject mutation behavior (which also uses find(s => s.status === 'pending'))"
metrics:
  duration: "~2 minutes"
  completed: "2026-02-23"
  tasks_completed: 2
  files_modified: 2
---

# Phase 44 Plan 01: canCurrentUserApprove on List Endpoints — Summary

Adds `canCurrentUserApprove: boolean` to both the CO list and pay app list API endpoints using a single bulk inArray query per endpoint — no per-row N+1 queries.

## What Was Built

Both `changeOrder.list` and `paymentApp.list` tRPC procedures now return `canCurrentUserApprove` on every record. The flag tells the UI whether the currently authenticated user is the designated approver for a given item's current pending approval step.

The implementation uses a single `inArray` bulk fetch of all pending steps for the returned page of results, then builds a Map keyed by entity ID. The role check replicates the same logic used in the `approve` and `reject` mutations: userId match OR role match OR open step (no approver constraint).

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Add canCurrentUserApprove to CO list endpoint | ea5e617 | apps/api/src/trpc/routers/change-order.ts |
| 2 | Add canCurrentUserApprove to pay app list endpoint | 3b2cbfa | apps/api/src/trpc/routers/payment-app.ts |

## Success Criteria Verification

- Both list endpoints compile cleanly under TypeScript strict mode — PASSED (zero errors in both files)
- Each list item in both endpoints includes `canCurrentUserApprove: boolean` — PASSED
- The pendingSteps query uses `inArray` (single bulk query, not per-row) — PASSED
- Empty list guard present in both endpoints — PASSED

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `apps/api/src/trpc/routers/change-order.ts` — FOUND, contains `canCurrentUserApprove`
- `apps/api/src/trpc/routers/payment-app.ts` — FOUND, contains `canCurrentUserApprove`
- Commit `ea5e617` — FOUND
- Commit `3b2cbfa` — FOUND
