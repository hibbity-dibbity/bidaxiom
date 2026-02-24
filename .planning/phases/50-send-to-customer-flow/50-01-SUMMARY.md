---
phase: 50-send-to-customer-flow
plan: "01"
subsystem: api
tags: [trpc, mutations, estimates, change-orders, status-transitions]
dependency_graph:
  requires: []
  provides:
    - estimates.sendToCustomer tRPC mutation
    - changeOrder.sendToCustomer tRPC mutation
  affects:
    - apps/api/src/trpc/routers/estimates.ts
    - apps/api/src/trpc/routers/change-order.ts
tech_stack:
  added: []
  patterns:
    - Idempotent status mutation (bypass state machine for UI-driven re-sendable actions)
    - PCO number reuse guard (assign once, never duplicate on resend)
key_files:
  created: []
  modified:
    - apps/api/src/trpc/routers/estimates.ts
    - apps/api/src/trpc/routers/change-order.ts
decisions:
  - "estimates.sendToCustomer uses 'manage' Estimate CASL action (not 'update') — consistent with plan spec and stronger than the existing submit mutation which uses 'update'"
  - "under_contract guard added to estimates.sendToCustomer — blocks resend of terminal status; all other statuses idempotently transition to 'submitted'"
  - "changeOrder.sendToCustomer void guard blocks send; all other statuses transition to 'pco_submitted' unconditionally"
  - "PCO number reuse: co.pcoNumber checked before calling getNextChangeOrderNumber — prevents duplicate sequential numbers on repeat sends"
metrics:
  duration_minutes: 2
  completed_date: 2026-02-24
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 50 Plan 01: Add sendToCustomer Mutations Summary

Two new idempotent tRPC mutations that mark a document as "sent to customer": `estimates.sendToCustomer` (status → "submitted", blocks under_contract) and `changeOrder.sendToCustomer` (status → "pco_submitted", blocks void, reuses existing PCO number).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add estimates.sendToCustomer mutation | 7339bf1 | apps/api/src/trpc/routers/estimates.ts |
| 2 | Add changeOrder.sendToCustomer mutation | 2b92d00 | apps/api/src/trpc/routers/change-order.ts |

## What Was Built

### estimates.sendToCustomer

Added after `submitEstimate` in the estimates router. The mutation:

- Input: `{ estimateId: z.string().uuid() }`
- Auth guard: throws INTERNAL_SERVER_ERROR if `ctx.tenant` or `ctx.userId` missing
- CASL guard: `throwUnlessCan("manage", "Estimate")` via `loadProjectAbilities`
- Fetches estimate; throws NOT_FOUND if missing
- Status guard: throws BAD_REQUEST if `status === "under_contract"` (terminal — cannot re-send)
- Update: sets `{ status: "submitted", submittedAt: new Date(), updatedAt: new Date() }` unconditionally for all other statuses
- Returns: updated estimate record

### changeOrder.sendToCustomer

Added after `submit` in the change-order router. The mutation:

- Input: `{ changeOrderId: z.string().uuid() }`
- Auth guard: throws INTERNAL_SERVER_ERROR if `ctx.tenant` or `ctx.userId` missing
- CASL guard: `throwUnlessCan("manage", "ChangeOrder")` via `loadProjectAbilities`
- Fetches change order; throws NOT_FOUND if missing
- Void guard: throws BAD_REQUEST if `status === "void"` (terminal — cannot re-send)
- PCO reuse: `if (!co.pcoNumber)` then generates next sequential PCO number; otherwise reuses existing
- Update: sets `{ status: "pco_submitted", pcoNumber, submittedAt: co.submittedAt ?? new Date(), submittedBy: co.submittedBy ?? ctx.userId, updatedAt: new Date() }` unconditionally
- Returns: updated change order record

## Decisions Made

1. **CASL "manage" vs "update" for estimates.sendToCustomer:** Plan spec says `manage` — this is stronger than `submitEstimate` (which uses `update`). Kept as specified; consistent with change order procedures that all use `manage`.

2. **under_contract guard:** Plan explicitly requires blocking resend when already under contract. This prevents reverting a signed contract back to submitted state. All other statuses (draft, submitted, accepted) transition to submitted idempotently.

3. **PCO number reuse pattern:** Critical correctness requirement. The `if (!pcoNumber)` guard ensures sequential PCO numbers are assigned exactly once per change order, regardless of how many times the document is re-sent to the customer.

4. **No state machine involvement:** Both mutations intentionally bypass `VALID_CO_STATUS_TRANSITIONS` and `canTransitionEstimate`. The business intent is "always re-sendable" — the state machine constraints are only relevant for the internal approval workflow, not the customer-send action.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files modified:
- FOUND: apps/api/src/trpc/routers/estimates.ts
- FOUND: apps/api/src/trpc/routers/change-order.ts

Commits:
- FOUND: 7339bf1 (feat(50-01): add estimates.sendToCustomer mutation)
- FOUND: 2b92d00 (feat(50-01): add changeOrder.sendToCustomer mutation)

TypeScript:
- estimates.ts: zero new errors (pre-existing error at line 1042 in convertToProject verified via git stash)
- change-order.ts: zero errors
