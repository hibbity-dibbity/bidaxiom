---
phase: 06-payment-applications
plan: 01
subsystem: payment-applications
tags: [schema, types, permissions, foundation]
completed: 2026-02-13
duration: 4 min

dependency_graph:
  requires: [04-01, 05-01]
  provides: [payment-app-schema, sov-schema, lien-waiver-types]
  affects: [06-02, 06-03, 06-04]

tech_stack:
  added: []
  patterns: [tenant-scoped-tables, multi-step-approval, sequential-numbering]

key_files:
  created:
    - packages/shared/src/types/payment-app.ts
  modified:
    - apps/api/src/db/schema/tenant.ts
    - apps/api/src/tenant/provision.ts
    - apps/api/src/tenant/context.ts
    - packages/shared/src/types/auth.ts
    - packages/shared/src/index.ts
    - apps/api/src/auth/abilities.ts

decisions:
  - title: "NUMERIC(15,2) for all currency columns"
    rationale: "Maintains consistency with Phase 4 budget tables; prevents floating-point errors in financial calculations"
  - title: "RESTRICT on SOV item deletion from payment app line items"
    rationale: "Prevents orphaned billing lines that would break payment app integrity"
  - title: "Progressive retainage rate support in config schema"
    rationale: "Allows retainage percentage to decrease as project completion increases (common industry pattern)"
  - title: "4 lien waiver types following AIA standard"
    rationale: "Covers all combinations: partial/final × conditional/unconditional per AIA G706/G707"
  - title: "State-specific lien waiver requirements table"
    rationale: "10 states require statutory forms; tracking requirements prevents compliance issues"

metrics:
  tasks_completed: 2
  files_modified: 6
  files_created: 1
  tables_added: 7
  indexes_added: 12
  commits: 2
---

# Phase 6 Plan 1: Payment Application Schema and Types Summary

Database schema, shared types, and CASL permissions established for complete payment application system (SOV, pay apps, retainage, lien waivers).

## What Was Built

### Database Schema (7 New Tables)

1. **sov_items** - Schedule of Values line items
   - Links to projects (CASCADE) and budget line items (SET NULL)
   - Stores scheduled value per line item with ordering
   - Item numbers for sequential SOV presentation

2. **payment_apps** - AIA G702 Application for Payment summary
   - Tracks all G702 fields: contract sum, retainage, payments
   - Status workflow: draft → submitted → under_review → approved → rejected → paid
   - Sequential application numbering via counters table

3. **payment_app_line_items** - AIA G703 Continuation Sheet lines
   - References SOV items with RESTRICT (prevents orphaned billing)
   - Tracks percent complete (previous and current)
   - Calculates work completed, materials stored, retainage per line

4. **payment_app_counters** - Sequential numbering by project and year
   - Enables PAY-2024-001, PAY-2024-002, etc. format
   - Scoped by project and year for organized tracking

5. **retainage_held** - Retainage tracking with progressive rate support
   - Links to payment apps for retainage held each period
   - Status: held → eligible_for_release → released
   - Tracks release amount, date, approver, and notes

6. **lien_waivers** - Four waiver types (AIA G706/G707 standard)
   - partial_conditional, partial_unconditional, final_conditional, final_unconditional
   - Tracks party name/type, through date, amount waived
   - Status workflow: pending → received → verified → stored
   - Notarization and statutory form flags for state compliance
   - Links to document storage for uploaded waiver PDFs

7. **payment_app_approval_steps** - Multi-step approval workflow
   - Reuses Phase 5 approval pattern: stepOrder, approverRole, requirementType
   - Supports "all" (all must approve), "any" (first approval wins), "specific" (exact user)

### Indexes (12 Total)

- sov_items: project_id, budget_line_item_id
- payment_apps: project_id, status
- payment_app_line_items: payment_app_id, sov_item_id
- payment_app_counters: (project_id, year) composite
- retainage_held: project_id, payment_app_id
- lien_waivers: project_id, payment_app_id
- payment_app_approval_steps: payment_app_id

### Shared Types (packages/shared/src/types/payment-app.ts)

**Enums:**
- paymentAppStatusEnum (6 statuses)
- lienWaiverTypeEnum (4 types: partial/final × conditional/unconditional)
- lienWaiverStatusEnum (4 statuses)
- lienWaiverPartyTypeEnum (3 types: subcontractor, supplier, vendor)
- retainageStatusEnum (3 statuses)
- paymentApprovalStepStatusEnum (4 statuses)

**Zod Schemas:**
- createSovItemSchema, updateSovItemSchema, bulkCreateSovItemsSchema
- createPaymentAppSchema (includes lineItems array)
- submitPaymentAppSchema (includes approvalSteps array)
- approveRejectPaymentAppSchema, markPaymentAppPaidSchema
- createLienWaiverSchema, updateLienWaiverStatusSchema
- retainageConfigSchema (with progressive rates support)

**TypeScript Interfaces:**
- AgingBucket, ARAgingReport, APAgingReport (for future AR/AP aging analysis)

**Constants:**
- VALID_PAYMENT_APP_STATUS_TRANSITIONS (enforces valid state transitions)
- STATE_LIEN_WAIVER_REQUIREMENTS (10 states: CA, TX, FL, AZ, GA, MI, MS, MO, NV, WY)

### CASL Permissions

**AppSubjects:** Added "PaymentApp" and "LienWaiver"

**Role Permissions:**
- org:admin - `manage all` (already covers PaymentApp and LienWaiver)
- org:project_manager - `manage PaymentApp`, `manage LienWaiver`
- org:accountant - `manage PaymentApp`, `manage LienWaiver` (need full payment app access)
- org:superintendent - `read PaymentApp`, `approve PaymentApp`, `read LienWaiver`
- org:estimator - `read PaymentApp`, `read LienWaiver`
- org:foreman - `read PaymentApp`, `read LienWaiver`
- org:member - `read PaymentApp`, `read LienWaiver`

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions

1. **NUMERIC(15,2) for currency columns**: Maintains consistency with Phase 4 budget tables; prevents floating-point errors in financial calculations.

2. **RESTRICT on SOV item deletion from payment app line items**: Prevents orphaned billing lines that would break payment app integrity. If a SOV item needs to be deleted, all payment app line items referencing it must be removed first.

3. **Progressive retainage rate support**: retainageConfigSchema includes optional `progressiveRates` array (upToPercent, rate). Common industry pattern: hold 10% until 50% complete, then 5% until substantial completion.

4. **4 lien waiver types following AIA standard**: Covers all combinations per AIA G706 (partial conditional/unconditional) and G707 (final conditional/unconditional). Ensures industry-standard compliance.

5. **State-specific lien waiver requirements table**: 10 states (CA, TX, FL, AZ, GA, MI, MS, MO, NV, WY) require statutory forms. Tracking requirements at type level prevents compliance issues during lien waiver creation.

## Files Modified

### Created
- `packages/shared/src/types/payment-app.ts` (257 lines) - Complete payment app type system

### Modified
- `apps/api/src/db/schema/tenant.ts` - Added 7 new table definitions
- `apps/api/src/tenant/provision.ts` - Added raw SQL CREATE TABLE + 12 indexes
- `apps/api/src/tenant/context.ts` - Exposed all 7 tables in RequestTenantContext
- `packages/shared/src/types/auth.ts` - Added PaymentApp and LienWaiver to AppSubjects
- `packages/shared/src/index.ts` - Re-exported payment-app types
- `apps/api/src/auth/abilities.ts` - Added PaymentApp and LienWaiver permissions per role

## Self-Check: PASSED

### Created Files Verification
```bash
# All files exist
FOUND: packages/shared/src/types/payment-app.ts
```

### Table Definitions Verification
```bash
# All 7 tables exist in tenant.ts
FOUND: sovItems (line 355)
FOUND: paymentApps (line 372)
FOUND: paymentAppLineItems (line 402)
FOUND: paymentAppCounters (line 421)
FOUND: retainageHeld (line 432)
FOUND: lienWaivers (line 451)
FOUND: paymentAppApprovalSteps (line 474)
```

### Provisioning Verification
```bash
# All 7 tables exist in provision.ts
FOUND: sov_items (line 470)
FOUND: payment_apps (line 496)
FOUND: payment_app_line_items (line 537)
FOUND: payment_app_counters (line 567)
FOUND: retainage_held (line 581)
FOUND: lien_waivers (line 605)
FOUND: payment_app_approval_steps (line 633)
```

### Context Exposure Verification
```bash
# All 7 tables exposed in context.ts
FOUND: sovItems (line 74)
FOUND: paymentApps (line 75)
FOUND: paymentAppLineItems (line 76)
FOUND: paymentAppCounters (line 77)
FOUND: retainageHeld (line 78)
FOUND: lienWaivers (line 79)
FOUND: paymentAppApprovalSteps (line 80)
```

### CASL Permissions Verification
```bash
# PaymentApp permissions exist for all roles
FOUND: abilities.ts line 43 (project_manager)
FOUND: abilities.ts line 60 (accountant)
FOUND: abilities.ts line 78 (estimator)
FOUND: abilities.ts line 95 (superintendent - read)
FOUND: abilities.ts line 96 (superintendent - approve)
FOUND: abilities.ts line 108 (foreman)
FOUND: abilities.ts line 126 (member)
```

### Commits Verification
```bash
# Both commits exist
FOUND: 61ddd34 (Task 1: 7 payment application tables)
FOUND: b8c74f8 (Task 2: shared payment app types and CASL permissions)
```

## Next Steps

Plan 06-02 will build the SOV and Payment App API (tRPC procedures for creating SOV items, generating payment applications, calculating retainage, approval workflow).

Plan 06-03 will build the Lien Waiver and Invoice API (lien waiver creation/tracking, invoice generation from payment apps).

Plan 06-04 will build the Payment Application UI (SOV builder, payment app creation form, lien waiver tracking, approval interface).

## Commits

1. `61ddd34` - feat(06-01): add 7 payment application tables to tenant schema
2. `b8c74f8` - feat(06-01): add shared payment app types and CASL permissions

**Duration:** 4 minutes
**Tasks Completed:** 2/2
**Status:** Complete
