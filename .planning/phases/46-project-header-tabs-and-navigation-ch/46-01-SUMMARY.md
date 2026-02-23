---
phase: 46-project-header-tabs-and-navigation-ch
plan: 01
subsystem: api
tags: [trpc, drizzle-orm, postgresql, project-header, financial-stats, badges]

# Dependency graph
requires:
  - phase: 05-change-order-management
    provides: change_orders table with status field
  - phase: 06-payment-applications
    provides: payment_apps and retainage_held tables
  - phase: 09-document-management-enhancement
    provides: documents table with projectId
  - phase: 21-assignment-and-auto-generation
    provides: estimates table with totalCost and status fields
provides:
  - project.getHeaderStats tRPC procedure returning 5 financial metrics + 4 badge counts
  - contractValue computed with accepted-estimate -> budget -> 0 priority chain
  - CO pending count using pco_submitted/pending_approval status values
  - Payment apps pending badge using isNull(paidAt) filter
  - Parallel Promise.all for all 9 DB sub-queries
affects: [46-02-project-header-ui, 46-03-tab-badges]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Promise.all for parallel sub-query aggregation in tRPC procedures
    - COALESCE(SUM(...), 0) SQL pattern for zero-safe aggregate results
    - NaN guard for text budget field: parseFloat -> isNaN -> null fallback

key-files:
  created: []
  modified:
    - apps/api/src/trpc/routers/project.ts

key-decisions:
  - "getHeaderStats runs all 9 sub-queries in a single Promise.all — no sequential awaits"
  - "contractValue priority: accepted estimate + approved COs > project.budget (NaN-guarded) > 0"
  - "paidToDate = 0 placeholder — no payments table exists yet; balanceToComplete uses this"
  - "billedToDate sums currentPaymentDue from ALL payment apps regardless of status"
  - "CO pending badge uses pco_submitted and pending_approval (not 'pending' or 'submitted')"
  - "Payment apps pending badge: status IN (submitted, approved) AND paidAt IS NULL"
  - "invoicesCount uses payment app count as AR proxy (no separate invoices table)"

patterns-established:
  - "9-query parallel pattern: accepted estimate -> approved CO sum -> budget -> billed -> retainage -> CO badges -> PA badges -> docs -> invoices"

requirements-completed:
  - CHROME-02
  - CHROME-03

# Metrics
duration: 2min
completed: 2026-02-23
---

# Phase 46 Plan 01: getHeaderStats API Procedure Summary

**`project.getHeaderStats` tRPC procedure added to projectRouter — 9 parallel DB queries return 5 financial metrics (contractValue, billedToDate, paidToDate, balanceToComplete, retainageHeld) and 4 badge counts (COs pending, payment apps pending, documents, invoices) in one round-trip**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T03:53:45Z
- **Completed:** 2026-02-23T03:55:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `getHeaderStats` procedure to the end of `projectRouter` in `project.ts`
- All 9 sub-queries run in `Promise.all` — no sequential awaits, minimal latency
- `contractValue` computed with correct priority: accepted estimate + approved COs, then budget (NaN-guarded text parse), then 0
- CO pending badge uses `["pco_submitted", "pending_approval"]` — matches actual status enum values
- Payment apps pending uses `inArray(status, ["submitted", "approved"]) AND isNull(paidAt)` — unpaid invoice detection
- `billedToDate` sums `currentPaymentDue` across ALL payment apps (no status filter per spec)
- `retainageHeld` uses `SUM(amount_held - COALESCE(released_amount, 0))` for net retainage

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getHeaderStats procedure to projectRouter** - `a6ab889` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/api/src/trpc/routers/project.ts` - Added `getHeaderStats` query procedure (149 lines) as last entry in `projectRouter`

## Decisions Made

- All 9 sub-queries in single `Promise.all` — plan-specified pattern, no sequential awaits
- `invoicesCount` uses `paymentApps` count as AR proxy since no separate invoices table exists
- `paidToDate = 0` hardcoded placeholder — no payments table yet; `balanceToComplete = contractValue - 0`
- CO status values `pco_submitted`/`pending_approval` verified against actual enum values in schema (not 'pending' or 'submitted')

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. All imports (`count`, `sql`, `inArray`, `isNull`, `and`, `eq`, `desc`) were already present at line 29. All schema tables (`retainageHeld`, `documents`, `paymentApps`, `changeOrders`, `estimates`) confirmed with correct column names before implementation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `project.getHeaderStats` is registered and compiles cleanly — ready for plan 46-02 (header UI) and 46-03 (tab badges) to call it
- No blockers or concerns

## Self-Check: PASSED

- FOUND: `apps/api/src/trpc/routers/project.ts`
- FOUND: `.planning/phases/46-project-header-tabs-and-navigation-ch/46-01-SUMMARY.md`
- FOUND: commit `a6ab889` (feat(46-01): add getHeaderStats procedure to projectRouter)

---
*Phase: 46-project-header-tabs-and-navigation-ch*
*Completed: 2026-02-23*
