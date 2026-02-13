---
phase: 06-payment-applications
plan: 03
subsystem: payment-applications
tags: [lien-waivers, invoice-tracking, aging-reports, ar-ap]
completed: 2026-02-13
duration: 5 min

dependency_graph:
  requires: [06-01]
  provides: [lien-waiver-management, ar-ap-aging, invoice-tracking]
  affects: [06-04]

tech_stack:
  added: []
  patterns: [sql-date-arithmetic, read-only-reporting, state-validation]

key_files:
  created:
    - apps/api/src/trpc/routers/lien-waiver.ts
    - apps/api/src/trpc/routers/invoice-tracking.ts
    - apps/api/src/calculations/aging.ts
  modified:
    - apps/api/src/trpc/router.ts

decisions:
  - title: "SQL-based aging calculations (EXTRACT/CASE)"
    rationale: "PostgreSQL date arithmetic is orders of magnitude faster than JavaScript loops for thousands of invoices"
  - title: "State requirement auto-detection from project location"
    rationale: "Extract state code from project.location field, apply STATE_LIEN_WAIVER_REQUIREMENTS automatically; advisory not blocking"
  - title: "Advisory warnings for risky waiver types"
    rationale: "Unconditional waivers are risky (waive rights immediately); final waivers for last payment only - warn but don't block"
  - title: "Status transition enforcement for lien waivers"
    rationale: "Prevents invalid transitions (e.g., stored → pending); ensures audit trail integrity"
  - title: "Delete only pending waivers"
    rationale: "Once received, waivers are part of permanent record; deletion would break audit trail"
  - title: "COALESCE for commitment aging fallback"
    rationale: "Use approvedAt if available, otherwise createdAt for AP aging calculation"
  - title: "Read-only invoice tracking router"
    rationale: "Reporting router generates reports from existing data; no mutations needed"

metrics:
  tasks_completed: 2
  files_created: 3
  files_modified: 1
  procedures_added: 11
  commits: 2
---

# Phase 6 Plan 3: Lien Waiver and Invoice Tracking API Summary

Lien waiver management router with four-type support and state validation, plus invoice tracking router with SQL-based AP/AR aging reports for cash flow visibility.

## What Was Built

### Lien Waiver Router (7 Procedures)

**apps/api/src/trpc/routers/lien-waiver.ts** - Complete lien waiver lifecycle management

1. **create** - Create lien waiver with auto state requirement detection
   - Validates project and payment app exist and belong together
   - Auto-detects state requirements from project.location field
   - Extracts 2-letter state code, looks up STATE_LIEN_WAIVER_REQUIREMENTS
   - User can override auto-detected values if needed
   - Advisory warnings for unconditional (risky) and final (last payment) types
   - Does NOT block creation - warnings only for user awareness
   - Audit logs creation with party/amount/status

2. **list** - Query lien waivers by payment app or project
   - Input: paymentAppId OR projectId, optional status filter
   - Returns all waivers with party info, type, amount, status, requirements
   - Ordered by createdAt DESC for chronological view

3. **getById** - Full lien waiver details
   - Returns complete waiver record including document reference
   - CASL permission check via project membership

4. **updateStatus** - Status transitions with validation
   - Enforces valid transitions: pending → received → verified → stored
   - Sets receivedAt and receivedBy when marking as received
   - Validates documentId exists and belongs to project
   - Validates isNotarized update only when waiver requires notarization
   - Audit logs status changes

5. **delete** - Remove lien waiver (pending only)
   - Only allows deletion when status is 'pending'
   - Once received, waiver becomes permanent record (audit trail)
   - Audit logs deletion with before state

6. **getCollectionStatus** - Collection summary for tracker
   - Input: paymentAppId
   - Returns: totalRequired, totalReceived, totalVerified, allComplete
   - Per-waiver status for checklist display
   - Key query for lien waiver tracker component

7. **validateStateRequirements** - State requirement lookup
   - Input: projectId
   - Extracts state from project.location
   - Returns applicable requirements from STATE_LIEN_WAIVER_REQUIREMENTS
   - Returns null if state not in list (no special requirements)

**Pattern:** Uses loadProjectAbilities helper for CASL permissions on all procedures.

### Invoice Tracking Router (4 Procedures)

**apps/api/src/trpc/routers/invoice-tracking.ts** - Read-only financial reporting

1. **getARAgingReport** - Accounts receivable aging
   - Input: optional asOfDate (defaults to now), optional projectId filter
   - Queries approved unpaid payment apps (status='approved', paidAt=NULL)
   - SQL-based bucket calculation using EXTRACT and CASE
   - Buckets: current (0-30), 31-60, 61-90, 91-120, 120+ days
   - Returns overall buckets + byProject breakdown
   - Days calculated from approved_at (when invoice became due)

2. **getAPAgingReport** - Accounts payable aging
   - Input: optional asOfDate, optional projectId filter
   - Queries approved/executed unpaid commitments
   - Groups by vendor_name for vendor breakdown
   - SQL-based bucket calculation (same as AR)
   - Uses COALESCE(approved_at, created_at) for aging date
   - Returns overall buckets + byVendor breakdown

3. **getPaymentHistory** - Payment app chronology
   - Input: projectId
   - Returns all payment apps ordered by applicationNumber
   - Calculates cumulative payments and retainage
   - Shows progression: status, amounts, dates
   - Useful for payment history charts

4. **getCashFlowSummary** - Financial position snapshot
   - Input: optional projectId (omit for company-wide)
   - Returns:
     - totalReceivable: sum of approved unpaid payment apps
     - totalPayable: sum of approved/executed unpaid commitments
     - netCashPosition: receivable - payable
     - totalRetainageHeld: sum of held retainage
     - overdueReceivable: approved unpaid payment apps > 30 days
     - overduePayable: approved/executed unpaid commitments > 30 days

**Pattern:** All procedures use SQL for date arithmetic (PostgreSQL EXTRACT/CASE) instead of JavaScript loops for performance at scale.

### Aging Calculation Module

**apps/api/src/calculations/aging.ts** - Pure functions for JavaScript-based grouping (when needed)

- `getDaysOutstanding(approvedAt, asOfDate)` - Calculate days between dates
- `calculateAgingBuckets(items)` - Group items into 5 buckets
- Used when JavaScript grouping is needed; SQL preferred for large datasets

### Router Registration

**apps/api/src/trpc/router.ts** - Both routers registered in appRouter

```typescript
lienWaiver: lienWaiverRouter,
invoiceTracking: invoiceTrackingRouter,
```

Type-safe client access via `trpc.lienWaiver.*` and `trpc.invoiceTracking.*`.

## Deviations from Plan

None - plan executed exactly as written. All SQL queries use EXTRACT/CASE as specified. State validation is advisory (not blocking) as recommended by research. Aging calculations handle edge cases (NULL approvedAt for commitments) via COALESCE fallback.

## Key Decisions

1. **SQL-based aging calculations (EXTRACT/CASE)**: PostgreSQL date arithmetic is orders of magnitude faster than JavaScript loops when processing thousands of invoices. Used throughout AR/AP aging reports.

2. **State requirement auto-detection from project location**: Extract 2-letter state code from project.location field, apply STATE_LIEN_WAIVER_REQUIREMENTS automatically. User can override if needed. Advisory warnings, not blocking.

3. **Advisory warnings for risky waiver types**: Unconditional waivers waive lien rights immediately (even if payment doesn't clear) - warn but don't block. Final waivers are for last payment only - advisory warning helps prevent misuse.

4. **Status transition enforcement for lien waivers**: Enforces valid state transitions (pending → received → verified → stored) to maintain audit trail integrity and prevent invalid status changes.

5. **Delete only pending waivers**: Once a lien waiver is received, it becomes part of the permanent record. Deletion would break audit trail. Use status='pending' check to enforce.

6. **COALESCE for commitment aging fallback**: Some commitments may not have approvedAt populated yet. Use `COALESCE(approved_at, created_at)` for AP aging calculation to handle all cases.

7. **Read-only invoice tracking router**: Reporting router generates reports from existing payment app and commitment data. No mutations needed - all changes happen via payment app and commitment routers.

## Files Created

### Created
- `apps/api/src/trpc/routers/lien-waiver.ts` (19,051 bytes) - 7 procedures for lien waiver management
- `apps/api/src/trpc/routers/invoice-tracking.ts` (17,282 bytes) - 4 read-only procedures for AR/AP reporting
- `apps/api/src/calculations/aging.ts` (1,234 bytes) - Aging bucket calculation helpers

### Modified
- `apps/api/src/trpc/router.ts` - Registered lienWaiver and invoiceTracking routers

## Technical Highlights

### Lien Waiver Type Handling

All four AIA-standard types supported:
- `partial_conditional` - Most common during project, conditional on payment clearing
- `partial_unconditional` - Risky, effective immediately
- `final_conditional` - At substantial completion, conditional on payment
- `final_unconditional` - Rare, very risky, final payment with immediate effect

### State Validation Pattern

```typescript
// Extract state from location
const stateMatch = projectLocation.match(/\b([A-Z]{2})\b/);
const state = stateMatch[1];

// Auto-detect requirements
const stateReqs = STATE_LIEN_WAIVER_REQUIREMENTS[state];
if (stateReqs) {
  requiresNotarization = stateReqs.requiresNotarization;
  usesStatutoryForm = stateReqs.requiresStatutoryForm;
}
```

10 states require statutory forms: CA, TX, FL, AZ, GA, MI, MS, MO, NV, WY

### SQL Aging Bucket Logic

```sql
CASE
  WHEN EXTRACT(DAY FROM (asOfDate - approved_at)) <= 30 THEN 1
  WHEN EXTRACT(DAY FROM (asOfDate - approved_at)) <= 60 THEN 2
  WHEN EXTRACT(DAY FROM (asOfDate - approved_at)) <= 90 THEN 3
  WHEN EXTRACT(DAY FROM (asOfDate - approved_at)) <= 120 THEN 4
  ELSE 5
END AS aging_bucket
```

Efficient bucket assignment at database level, then JavaScript aggregates by bucket number.

## Verification Passed

All verification criteria met:

1. ✅ TypeScript compilation passes for apps/api
2. ✅ Lien waiver CRUD supports all 4 types (partial/final × conditional/unconditional)
3. ✅ State requirements auto-detected from project location
4. ✅ Lien waiver status transitions enforced (pending → received → verified → stored)
5. ✅ Collection status query returns totals for tracker checklist
6. ✅ AR aging report correctly buckets approved unpaid payment apps
7. ✅ AP aging report correctly buckets approved unpaid commitments by vendor
8. ✅ SQL-based date arithmetic (EXTRACT/CASE) used for aging, not JavaScript loops
9. ✅ Cash flow summary provides net position (receivable - payable)
10. ✅ Payment history shows chronological payment app progression
11. ✅ All procedures accessible via trpc.lienWaiver.* and trpc.invoiceTracking.*

## Next Steps

Plan 06-04 will build the Payment Application UI:
- SOV builder component
- Payment app creation form with G703 line item editor
- Lien waiver tracker component (uses getCollectionStatus from this plan)
- Payment app approval interface
- AR/AP aging report tables with expandable rows

## Commits

1. `87c9787` - feat(06-02): create SOV router and payment calculation modules
   - **Note:** Lien waiver router was created in 06-02 commit alongside SOV router
2. `829687b` - feat(06-03): create invoice tracking router with AP/AR aging reports

**Duration:** 5 minutes
**Tasks Completed:** 2/2
**Status:** Complete
