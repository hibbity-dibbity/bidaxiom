---
phase: 05-change-order-management
plan: 02
subsystem: api, business-logic
tags: [trpc, sequential-numbering, approval-workflow, budget-updates, transactions]

# Dependency graph
requires:
  - phase: 05-change-order-management
    plan: 01
    provides: Change order schema, types, and permissions
  - phase: 04-budget-and-cost-tracking
    plan: 02
    provides: Budget line items table for CO budget impacts
provides:
  - Sequential numbering utility with SELECT FOR UPDATE locking
  - Change order tRPC router with 12 procedures covering full CO lifecycle
  - Transactional budget updates atomically tied to CO approval
  - Field-level history tracking for complete audit trail
affects: [05-03-change-order-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SELECT FOR UPDATE for sequential number generation without race conditions
    - Discriminated union handling with conditional field assignment
    - Multi-step approval workflow with role and user-based authorization
    - Transactional budget updates using SQL expressions for atomic increment/decrement
    - Field-level history tracking with revision numbers

key-files:
  created:
    - apps/api/src/utils/sequential-number.ts
    - apps/api/src/trpc/routers/change-order.ts
  modified:
    - apps/api/src/trpc/router.ts

key-decisions:
  - "Sequential numbering uses SELECT FOR UPDATE to prevent race conditions under concurrent requests"
  - "Budget updates use SQL expressions (budgeted_amount + amountChange) for atomic operations"
  - "Final approval step atomically: generates CO number, updates status, applies budget impacts in single transaction"
  - "Voiding an approved CO reverses budget impacts (subtracts amountChange from budget line items)"
  - "History inserts use 'as any' type assertion to handle Drizzle's strict nullable field inference"

patterns-established:
  - "Pattern 1: Sequential numbering with SELECT FOR UPDATE prevents duplicate numbers under concurrency"
  - "Pattern 2: Multi-step approval with canCurrentUserApprove computed field for UI authorization"
  - "Pattern 3: Transactional budget updates ensure financial consistency between COs and budget"

# Metrics
duration: 9 min
completed: 2026-02-13
---

# Phase 5 Plan 2: Change Order tRPC Router with Sequential Numbering and Approval Workflow Summary

**12-procedure change order router with PCO/CO sequential numbering, multi-party approval workflow, transactional budget updates on approval, and field-level history tracking**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-13T15:14:17Z
- **Completed:** 2026-02-13T15:23:22Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Sequential numbering utility generates scoped PCO/CO numbers (e.g., PCO-2026-001, CO-2026-015) with SELECT FOR UPDATE locking
- Change order router with 12 procedures: create, list, getById, update, updateLineItems, submit, delete, approve, reject, void, getHistory, getApprovalStatus
- Discriminated union validation for owner/internal/subcontractor CO types with type-specific field requirements
- Multi-step approval workflow with role-based, user-specific, or any-with-role authorization
- Atomic transaction on final approval: generate CO number, update status, apply budget impacts (budgeted_amount += amountChange)
- Void procedure reverses budget impacts for approved COs
- Field-level history tracking records every field change, status change, and approval action with revision numbers
- All CASL permissions enforced on every procedure

## Task Commits

Each task was committed atomically:

1. **Task 1: Create sequential numbering utility and change order CRUD procedures** - `be93d79` (feat)
2. **Task 2: Add approval workflow procedures with transactional budget updates** - `3f52900` (feat)

## Files Created/Modified

- `apps/api/src/utils/sequential-number.ts` - Sequential numbering with SELECT FOR UPDATE, generates PCO/CO numbers scoped by project/year
- `apps/api/src/trpc/routers/change-order.ts` - 12-procedure router: CRUD (7), approval workflow (5)
- `apps/api/src/trpc/router.ts` - Registered changeOrder router in appRouter

## Decisions Made

- **SELECT FOR UPDATE locking:** Sequential numbering uses SELECT FOR UPDATE on counter row to prevent duplicate numbers under concurrent requests, avoiding need for unique constraint on composite key.
- **SQL expressions for budget updates:** Budget impacts use `sql\`budgeted_amount + ${amountChange}\`` for atomic increment/decrement operations, ensuring consistency without race conditions.
- **Single transaction for final approval:** CO number generation, status update, and budget impacts happen in one transaction - if any part fails, entire operation rolls back.
- **Budget reversal on void:** Voiding an approved CO subtracts amountChange from budget line items, maintaining financial accuracy.
- **Type assertions for history inserts:** Drizzle's strict nullable field inference requires 'as any' for history inserts with optional fields.

## Deviations from Plan

None - plan executed exactly as written. All 12 procedures implemented per spec with no blocking issues.

## Issues Encountered

**TypeScript nullable field handling:** Drizzle's type inference expected `undefined` instead of `null` for nullable fields. Fixed by:
1. Using `undefined` instead of `null` in insert statements
2. Applying `as any` type assertion to history inserts with optional fields

This is a known Drizzle pattern and doesn't affect runtime behavior.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Change order API complete. All procedures tested via TypeScript compilation. Ready for Phase 5 Plan 3 (Change Order UI) which will consume these 12 tRPC procedures.

## Self-Check: PASSED

Verified:
- Created file exists: apps/api/src/utils/sequential-number.ts
- Created file exists: apps/api/src/trpc/routers/change-order.ts
- Commit be93d79 exists in git history
- Commit 3f52900 exists in git history
- All 12 procedures present in change-order.ts: create, list, getById, update, updateLineItems, submit, delete, approve, reject, void, getHistory, getApprovalStatus
- Budget update logic exists: budgeted_amount += amountChange (line 1024) and budgeted_amount -= amountChange (line 1335)
- CO number generation exists: getNextChangeOrderNumber with "co" type in approve procedure
- Router registered in appRouter as changeOrder

---
*Phase: 05-change-order-management*
*Completed: 2026-02-13*
