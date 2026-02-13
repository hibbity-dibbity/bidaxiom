---
phase: 06-payment-applications
plan: 02
subsystem: payment-applications-api
tags: [trpc, sov, payment-app, g702, retainage, approval-workflow]
completed: 2026-02-13
duration: 8 min

dependency_graph:
  requires: [06-01, 04-02, 05-02]
  provides: [sov-api, payment-app-api, g702-calculations, retainage-calculation]
  affects: [06-03, 06-04]

tech_stack:
  added: []
  patterns: [g702-calculations, progressive-retainage, sequential-numbering, approval-workflow-reuse]

key_files:
  created:
    - apps/api/src/calculations/retainage.ts
    - apps/api/src/calculations/payment-app.ts
    - apps/api/src/trpc/routers/sov.ts
    - apps/api/src/trpc/routers/payment-app.ts
  modified:
    - apps/api/src/trpc/router.ts

decisions:
  - title: "Progressive retainage rate calculation"
    rationale: "Supports industry pattern of decreasing retainage (10% → 5%) as project completion increases"
  - title: "Auto-populate previous percent complete from last approved payment app"
    rationale: "Simplifies payment app creation by carrying forward progress from previous billing period"
  - title: "Sequential PAY-YYYY-NNN numbering with SELECT FOR UPDATE"
    rationale: "Reuses Phase 5 pattern to prevent duplicate payment app numbers under concurrent requests"
  - title: "Budget line item locking only (actualCost update deferred)"
    rationale: "budget_line_items table lacks actualCost column; adding it requires schema migration (architectural change)"

metrics:
  tasks_completed: 2
  files_modified: 5
  files_created: 4
  procedures_added: 18
  commits: 2
---

# Phase 6 Plan 2: SOV and Payment App API Summary

SOV management router (7 procedures), payment calculation modules (G702 formulas, progressive retainage), and payment app router (11 procedures) with complete lifecycle management including approval workflow and budget locking.

## What Was Built

### Calculation Modules (Pure Functions)

1. **retainage.ts** - Progressive retainage calculation
   - `getCurrentRetainageRate()` - Finds applicable retainage rate from progressive schedule based on project completion percentage
   - `calculateRetainage()` - Calculates retainage amount from total and rate with 2 decimal precision

2. **payment-app.ts** - AIA G702/G703 calculation functions
   - `calculateLineItemAmounts()` - Calculates work completed this period, materials stored, total completed and stored, and retainage for a single line item
   - `calculatePaymentAppTotals()` - Aggregates line items into G702 summary: contract sum to date, total completed and stored, retainage, current payment due, balance to finish

### SOV Router (7 Procedures)

1. **list** - Returns SOV items ordered by orderIndex with total scheduled value
2. **create** - Creates single SOV item with auto-generated itemNumber (sequential) and orderIndex
3. **bulkCreate** - Creates multiple SOV items in transaction with sequential numbering
4. **importFromBudget** - Auto-creates SOV items from existing budget line items (skips items that already have SOV entries)
5. **update** - Updates SOV item (blocked if non-draft payment apps exist for project)
6. **delete** - Deletes SOV item (blocked if payment app line items reference it)
7. **reorder** - Updates orderIndex for multiple items based on array position

### Payment App Router (11 Procedures)

1. **create** - Creates payment app from SOV line items with percent complete
   - Auto-populates previousPercentComplete from most recent approved payment app
   - Validates currentPercentComplete >= previousPercentComplete
   - Calculates project completion percentage for retainage rate lookup
   - Gets retainage rate from company config (uses default for now)
   - Calculates all G702 totals using calculation modules
   - Generates sequential applicationNumber (PAY-YYYY-NNN)
   - Creates retainageHeld record

2. **list** - Lists payment apps for project with optional status filter

3. **getById** - Gets payment app with line items (JOIN sovItems for details), approval steps, and retainage record

4. **submit** - Submits payment app for approval
   - Creates approval workflow steps from input
   - Updates status to 'submitted'

5. **approve** - Approves current pending approval step
   - Validates user can approve (role or specific user check)
   - Marks step as approved
   - If all steps approved (final approval):
     - Updates budget line items: locks them (isLocked=true) for change order enforcement
     - Updates payment app status to 'approved'
     - NOTE: actualCost update deferred - requires schema change to add column to budget_line_items

6. **reject** - Rejects payment app
   - Marks current pending step as rejected
   - Skips remaining pending steps
   - Updates status to 'rejected'

7. **markPaid** - Marks approved payment app as paid

8. **getApprovalStatus** - Returns all approval steps with canCurrentUserApprove flag

9. **getSummary** - Aggregated summary for project dashboard
   - Counts by status (draft, submitted, under_review, approved, rejected, paid)
   - Amounts by status (totalApproved, totalPending, totalPaid)

10. **getRetainage** - Returns all retainage held records for project with totals (totalHeld, totalReleased, totalEligibleForRelease)

11. **releaseRetainage** - Releases retainage amount
    - Validates amount <= available to release
    - Updates releasedAmount and status (to 'released' if fully released)
    - Audit logs as FINANCIAL_CHANGE

### Sequential Numbering

`getNextPaymentAppNumber()` helper function:
- Uses SELECT FOR UPDATE on paymentAppCounters table
- Format: PAY-YYYY-NNN (e.g., PAY-2024-001, PAY-2024-002)
- Scoped by project and year
- Prevents duplicate numbers under concurrent requests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 4 - Architectural] Budget actualCost column missing**
- **Found during:** Task 2 - approve procedure implementation
- **Issue:** budget_line_items table lacks actualCost column needed for PYMT-06 requirement
- **Decision:** Added TODO comment and implemented budget locking only
- **Rationale:** Adding column to existing table (from Phase 4) is architectural change requiring schema migration
- **Impact:** Budget line items are locked on approval (enforces change order workflow) but actualCost updates deferred
- **Files modified:** apps/api/src/trpc/routers/payment-app.ts
- **Next steps:** Schema migration to add actualCost NUMERIC(15,2) column to budget_line_items table

**2. [Rule 2 - Missing Critical] Company profile retainageConfig missing**
- **Found during:** Task 2 - create procedure implementation
- **Issue:** companyProfiles JSONB doesn't include retainageConfig field
- **Fix:** Used default retainage configuration (10% rate) with TODO comment
- **Files modified:** apps/api/src/trpc/routers/payment-app.ts
- **Verification:** Payment apps create successfully with default 10% retainage
- **Next steps:** Add retainageConfig to company profile JSONB schema and UI

---

**Total deviations:** 1 architectural (blocked by schema constraint), 1 missing critical (defaulted for now)

**Impact on plan:** Core payment app functionality complete (creation, workflow, calculations) but budget actualCost updates require schema migration. All procedures implemented as specified except budget update logic (commented with TODO).

## Implementation Notes

**G702 Calculation Flow:**
1. User provides lineItems with sovItemId, currentPercentComplete, materialsStoredThisPeriod
2. System queries most recent approved payment app for previousPercentComplete
3. For each line item: workCompletedThisPeriod = ((current% - previous%) / 100) × scheduledValue
4. Retainage calculated per line using progressive rate based on project completion
5. Totals aggregated: originalContractSum (SOV total), netChangeByChangeOrders (approved COs), previousPayments (sum of approved payment apps), currentPaymentDue (earned less retainage - previous payments)

**Progressive Retainage:**
- Company config can specify multiple rate tiers: [{ upToPercent: 50, rate: 10 }, { upToPercent: 100, rate: 5 }]
- System finds first tier where projectCompletionPercent <= tier.upToPercent
- If project exceeds all tiers, uses last tier's rate
- Currently defaulted to 10% flat rate (retainageConfig not in schema yet)

**Approval Workflow:**
- Reuses Phase 5 approval step pattern: stepOrder, approverRole, approverUserId, requirementType (all/any/specific)
- Each step must be approved sequentially before next step becomes pending
- Final approval triggers budget line item locking
- Rejection skips all remaining pending steps

**SOV Locking:**
- SOV items can be updated only when all payment apps are draft
- Once any payment app is submitted, SOV is locked (prevents changing scheduled values after billing has started)
- Delete prevented if any payment app line items reference the SOV item

## Files Changed

**Created:**
- `apps/api/src/calculations/retainage.ts` (49 lines) - Progressive retainage rate calculation
- `apps/api/src/calculations/payment-app.ts` (113 lines) - G702 formula calculations
- `apps/api/src/trpc/routers/sov.ts` (630 lines) - SOV router with 7 procedures
- `apps/api/src/trpc/routers/payment-app.ts` (1094 lines) - Payment app router with 11 procedures

**Modified:**
- `apps/api/src/trpc/router.ts` - Imported and registered sovRouter and paymentAppRouter

## Next Steps

**Phase 6 Plan 3:** Build lien waiver and invoice tracking API (lien waiver 4-type support, AP/AR aging reports)

**Phase 6 Plan 4:** Build payment application UI (SOV builder, payment app creation form, approval interface, aging reports)

**Schema Migrations Needed:**
1. Add actualCost NUMERIC(15,2) DEFAULT 0 to budget_line_items table
2. Add retainageConfig JSONB to companyProfiles table metadata

## Commits

1. `87c9787` - feat(06-02): create SOV router and payment calculation modules
2. `2611180` - feat(06-02): create payment app tRPC router with approval workflow

**Duration:** 8 minutes
**Tasks Completed:** 2/2
**Status:** Complete with noted schema constraints
