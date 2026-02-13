---
phase: 04-budget-and-cost-tracking
plan: 02
subsystem: budget-api
tags: [budget, trpc, variance, forecast, evm, calculations]
dependency_graph:
  requires:
    - 04-01 (budget schema tables)
    - 03-03 (project team membership for CASL scoping)
  provides:
    - Budget CRUD tRPC procedures with lock enforcement
    - Variance calculation and alert generation
    - EVM forecast metrics calculation
  affects:
    - Phase 06 (payment application creation will call lockLineItem)
tech_stack:
  added:
    - variance calculation module
    - forecast calculation module
    - budget tRPC router with 8 procedures
  patterns:
    - Manual ability loading for project-level permissions
    - Lock enforcement with idempotent locking
    - NUMERIC string conversion via Number() for PostgreSQL
    - Aggregation queries using sql template literals
key_files:
  created:
    - apps/api/src/calculations/variance.ts
    - apps/api/src/calculations/forecast.ts
    - apps/api/src/trpc/routers/budget.ts
  modified:
    - apps/api/src/trpc/router.ts (registered budgetRouter)
    - apps/api/src/trpc/routers/document.ts (fixed contentType null handling)
decisions:
  - decision: "Variance thresholds default to 10% warning, 20% critical"
    rationale: "Industry-standard cost variance alert levels; configurable per company in future"
    location: "variance.ts checkBudgetVariances function"
  - decision: "Simplified EV calculation for Phase 4"
    rationale: "EV = committedCost as proxy until Phase 6 payment applications provide actual progress data"
    location: "forecast.ts calculateForecast function"
  - decision: "Lock enforcement throws FORBIDDEN error"
    rationale: "Clear error message directs users to use change orders for locked line items"
    location: "budget.ts updateLineItem and deleteLineItem"
  - decision: "Delete prevention when commitments exist"
    rationale: "Referential integrity check prevents orphaned commitment line items"
    location: "budget.ts deleteLineItem"
  - decision: "CSI divisions validated against CSI_DIVISIONS array"
    rationale: "Cost codes 0-49 must be valid CSI divisions; 50+ are custom codes (validated in future)"
    location: "budget.ts createLineItem"
metrics:
  duration: 3
  tasks_completed: 2
  files_created: 3
  files_modified: 2
  commits: 2
  completed_date: 2026-02-13
---

# Phase 4 Plan 2: Budget tRPC Router and Calculations Summary

**One-liner:** Budget CRUD API with lock enforcement, variance alerts (10%/20% thresholds), and EVM forecast metrics (CPI, EAC, ETC, VAC)

## What Was Built

Created the budget tRPC router with full CRUD operations, business rule enforcement, and calculation helpers for variance monitoring and earned value management forecasting.

**Core Functionality:**

1. **Calculation Modules** (standalone business logic):
   - `variance.ts`: Budget variance calculation with configurable thresholds (default: 10% warning, 20% critical)
   - `forecast.ts`: Earned Value Management metrics (BAC, EV, AC, CPI, EAC, ETC, VAC)

2. **Budget Router** (8 tRPC procedures):
   - `createLineItem`: CSI cost code validation, CASL enforcement, audit logging
   - `listLineItems`: Ordered by cost code and creation date
   - `updateLineItem`: Lock enforcement prevents modifications to locked items
   - `deleteLineItem`: Lock enforcement + commitment dependency check
   - `getProjectSummary`: Aggregates budgeted, committed, actual costs and variance
   - `getVarianceAlerts`: Filters to warning/critical severity alerts only
   - `getForecast`: Returns EVM metrics for project cost performance
   - `lockLineItem`: Idempotent locking for Phase 6 payment application workflow

3. **Business Rules Enforced:**
   - Cost code validation: CSI divisions (0-49) validated against CSI_DIVISIONS array
   - Lock enforcement: Locked budget line items reject updates/deletes with FORBIDDEN error
   - Referential integrity: Cannot delete budget line items with associated commitments
   - Permission checks: All operations enforce CASL abilities with project team membership context
   - Audit logging: All mutations create audit log entries with before/after values

**Technical Implementation:**

- Manual ability loading pattern (copied from project.ts) for project-level permission scoping
- PostgreSQL NUMERIC conversion: All aggregation results converted via Number() since NUMERIC returns strings
- SQL template literals for SUM/COUNT aggregations with COALESCE for null safety
- LEFT JOIN pattern for variance calculation: budget line items → commitment line items → commitments (filtered to executed status)
- Idempotent locking: lockLineItem returns existing lock if already locked (no error)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed document.ts contentType null handling**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** `document.contentType` can be `null` (DB schema), but `generateDownloadUrl` expects `string | undefined`
- **Fix:** Added null coalescing operator: `document.contentType ?? undefined`
- **Files modified:** apps/api/src/trpc/routers/document.ts
- **Commit:** 9fecdff

## Implementation Notes

**Variance Calculation:**
- Only executed commitments counted (status = 'executed')
- Variance = budgeted - committed
- Variance percent = |variance| / budgeted (handles budgeted = 0)
- Severity: critical if committed > budgeted AND variancePercent >= 0.20, warning if >= 0.10, else ok

**Forecast Calculation (Phase 4 Simplified EVM):**
- Budget at Completion (BAC): SUM(budgetedAmount)
- Committed Cost: SUM(totalAmount) WHERE status IN ('approved', 'executed')
- Actual Cost: committedCost (Phase 6 will use payment applications)
- Earned Value: committedCost (simplified — Phase 6 will refine with actual progress)
- CPI: earnedValue / actualCost (guarded: if actualCost = 0, CPI = 1.0)
- EAC: budgetAtCompletion / CPI
- ETC: EAC - actualCost
- VAC: budgetAtCompletion - EAC

**Lock Enforcement:**
- isLocked flag checked before update/delete operations
- Error message directs users to change order workflow
- lockLineItem procedure will be called from Phase 6 payment application creation
- Idempotent: calling lockLineItem on already-locked item returns existing item

**Cost Code Validation:**
- Codes 0-49: validated against CSI_DIVISIONS array (23 standard divisions)
- Codes 50+: accepted as custom codes (company-specific cost code config validation deferred to future)
- Negative codes: rejected with BAD_REQUEST

## Testing Approach

Manual testing verification criteria (from plan):

1. TypeScript compilation passes (verified via npx tsc --noEmit)
2. Budget router accessible via trpc.budget.* with all 8 procedures (verified via grep)
3. Creating a line item validates cost code ID is non-negative (implemented)
4. Updating a locked line item throws FORBIDDEN error (implemented)
5. Deleting a line item with commitments throws BAD_REQUEST error (implemented)
6. Project summary aggregates budget and commitment totals (implemented)
7. Variance alerts return only warning/critical items (implemented)
8. Forecast returns EVM metrics with proper edge case handling (implemented)

Runtime testing will be performed when UI is built (Phase 4 Plan 3).

## Files Changed

**Created:**
- `apps/api/src/calculations/variance.ts` (86 lines) — Variance calculation with severity levels
- `apps/api/src/calculations/forecast.ts` (102 lines) — EVM forecast metrics calculation
- `apps/api/src/trpc/routers/budget.ts` (518 lines) — Budget router with 8 procedures

**Modified:**
- `apps/api/src/trpc/router.ts` — Imported and registered budgetRouter
- `apps/api/src/trpc/routers/document.ts` — Fixed contentType null handling (bug fix)

## Next Steps

**Phase 4 Plan 3:** Build budget UI components (line item list, create/edit forms, variance alerts, forecast dashboard)

**Phase 4 Plan 4:** Build commitment management (subcontracts and purchase orders)

**Phase 6 Integration:** Payment application creation will call `budget.lockLineItem` to enforce change order workflow

## Self-Check: PASSED

Verifying all created files and commits exist:

**Files:**
- FOUND: apps/api/src/calculations/variance.ts
- FOUND: apps/api/src/calculations/forecast.ts
- FOUND: apps/api/src/trpc/routers/budget.ts

**Commits:**
- FOUND: 9fecdff (Task 1 - calculation modules)
- FOUND: 54a37fd (Task 2 - budget router)

All files created and commits recorded successfully.
