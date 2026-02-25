# Phase 54 Plan 01: API — getHeaderStats + updateProject Summary

---
phase: 54-project-header-updates
plan: 01
subsystem: api
tags: [trpc, project, estimates, kpi, budget]
dependency_graph:
  requires: []
  provides: [getHeaderStats.projectedProfit, getHeaderStats.projectedMargin, getHeaderStats.customerBudgetAmount, getHeaderStats.customerBudgetDelta, updateProject.customerBudget]
  affects: [apps/web (plan 54-02)]
tech_stack:
  added: []
  patterns: [post-query computation from Promise.all results]
key_files:
  modified:
    - apps/api/src/trpc/routers/project.ts
decisions:
  - "Profit computed only from accepted estimate (estimateTotal minus directCosts minus overheadAmount); CO revenue excluded from cost side to avoid inflation"
  - "Margin returned as decimal (e.g. 0.185), not percentage — UI layer converts for display"
  - "customerBudgetDelta: positive = contract over budget, negative = contract under budget"
metrics:
  duration: ~8 minutes
  completed: 2026-02-24
  tasks_completed: 2
  files_modified: 1
---

**One-liner:** Extended `getHeaderStats` to return `projectedProfit`, `projectedMargin`, `customerBudgetAmount`, and `customerBudgetDelta` from accepted-estimate cost fields, and added `customerBudget` write to `updateProject`.

## What Was Done

### Task 1: Extend getHeaderStats
- Extended the accepted estimate sub-query (previously only selecting `totalCost`) to also select `directCosts` and `overheadAmount`
- Extended the project budget sub-query (previously only selecting `budget`) to also select `customerBudget`
- Added post-query computation block after the existing `contractValue` derivation:
  - `estimateDirectCosts` and `estimateOverheadAmount` from the accepted estimate (null when no accepted estimate or zero value)
  - `customerBudgetAmount` from the project row (null when unset or invalid)
  - `projectedProfit = estimateTotal - (directCosts + overheadAmount)` — null if any input is null
  - `projectedMargin = projectedProfit / contractValue` — null if contractValue is 0 or profit is null
  - `customerBudgetDelta = contractValue - customerBudget` — null if no customer budget set
- Added all 4 new fields to the `return` object alongside existing fields

### Task 2: Add customerBudget to updateProject
- Added `customerBudget` write in the `updateProject` mutation's `updateValues` construction block (after the `costCodes` line)
- Converts number input to string for DB storage (numeric column), passes `null` through as-is

## Formulas
- `projectedProfit = estimateTotal - (directCosts + overheadAmount)` — equals the markup amount from the accepted estimate alone
- `projectedMargin = projectedProfit / contractValue` (decimal, e.g. 0.185 for 18.5%)
- `customerBudgetDelta = contractValue - customerBudget` (positive = over budget, negative = under/within budget)

## Requirements Covered
- HEADER-01 (partial — `startDate`/`endDate` already handled in `updateProject`; `customerBudget` write now added)
- HEADER-03: `projectedProfit` in header stats
- HEADER-04: `projectedMargin` in header stats
- HEADER-05: `customerBudgetAmount` and `customerBudgetDelta` in header stats

## Deviations from Plan
None — plan executed exactly as written.

## Self-Check: PASSED
- `apps/api/src/trpc/routers/project.ts` modified and committed (hash: 1bc4a27)
- `projectedProfit`, `projectedMargin`, `customerBudgetAmount`, `customerBudgetDelta` confirmed in return object (lines 1589–1592)
- `updateValues.customerBudget` write confirmed at line 680
- TypeScript compilation: zero errors in `project.ts`; pre-existing errors in other unrelated files unchanged
