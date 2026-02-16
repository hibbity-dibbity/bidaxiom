# Phase 18 Plan 03: One-Click Estimate-to-Project Conversion Summary

**One-liner:** Atomic conversion service transforms accepted estimates into active projects with pre-populated budgets from estimate line items

**Status:** Complete
**Completed:** 2026-02-16
**Duration:** 2.4 minutes

## Overview

Implemented one-click estimate-to-project conversion that eliminates manual data re-entry by automatically creating budget line items from estimate line items. The conversion uses atomic database transactions to ensure data integrity across estimate status updates, project activation, and budget creation.

## Changes Made

### 1. Project Conversion Service (Task 1)

**File:** `apps/api/src/services/projectConversion.ts` (new)

**Purpose:** Service layer function that handles the complete estimate-to-project conversion logic with atomic transaction guarantees.

**Key features:**
- Validates estimate is in "accepted" status before conversion
- Prevents double conversion by checking for existing budget
- Transaction updates estimate to "under_contract", project to "active", and creates budget line items
- Maps estimate line items to budget line items preserving cost codes, descriptions, and calculated amounts
- Returns project ID and count of created budget line items for confirmation

**Lines:** 99

### 2. Convert to Project tRPC Procedure (Task 2)

**Files modified:**
- `apps/api/src/trpc/routers/estimates.ts` - Added convertToProject procedure
- `packages/shared/src/schemas/estimates.ts` - Added convertToProjectSchema and type

**Purpose:** Exposes conversion functionality via tRPC API with input validation.

**Key features:**
- Simple procedure accepts estimateId UUID
- Delegates all logic to conversion service
- Uses protectedProcedure (user authentication sufficient, no CASL needed for conversion)
- Returns projectId and budgetLineItemsCreated count

## Technical Decisions

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Atomic transaction for conversion | Ensures all-or-nothing conversion - if budget creation fails, estimate and project status don't change | Manual cleanup on error (error-prone) |
| Prevent double conversion check | Checking for existing budget prevents data duplication if user clicks "Convert" multiple times | Allow multiple conversions with version tracking (unnecessary complexity) |
| Calculate budget amounts from quantity × unit cost | Budget line items store total amounts, not unit pricing breakdown | Copy raw unitCost/quantity to budget (budget schema doesn't support units) |
| Use protectedProcedure without CASL | User must be authenticated and belong to tenant; project-level permissions already enforced by project access | Add CASL permission check (redundant, project access already gated) |

## Verification Results

All verification steps passed:

### Task 1 Verification
✅ `convertEstimateToProject` export found in service file
✅ `db.transaction` call found for atomic operations
✅ `budgetLineItems` creation logic found
✅ TypeScript compilation successful (Drizzle ORM dependency warnings are pre-existing project issue)

### Task 2 Verification
✅ `convertToProject:` procedure found in estimates router
✅ Import and usage of `convertEstimateToProject` found
✅ `convertToProjectSchema` definition found in shared schemas
✅ Procedure correctly passes `ctx.userId` to service

## Success Criteria Met

- [x] projectConversion service exports convertEstimateToProject function
- [x] Service validates estimate status before conversion (line 38: `if (estimate.status !== "accepted")`)
- [x] Service prevents double conversion by checking existing budget (lines 47-56)
- [x] Transaction updates estimate to "under_contract" and project to "active" (lines 60-74)
- [x] Budget line items created with matching cost codes and amounts (lines 78-90)
- [x] tRPC convertToProject procedure accepts estimateId and returns conversion result (lines 916-923 in estimates.ts)

## Deviations from Plan

None - plan executed exactly as written.

## Files Modified

**Created:**
- `apps/api/src/services/projectConversion.ts` - New service with conversion logic

**Modified:**
- `apps/api/src/trpc/routers/estimates.ts` - Added import and procedure
- `packages/shared/src/schemas/estimates.ts` - Added schema and type export

## Commits

- `a6c011a` - feat(18-03): create project conversion service
- `b3a885e` - feat(18-03): add convertToProject tRPC procedure

## Dependencies & Integration

**Depends on:**
- Phase 17 estimate creation and line items schema
- Phase 4 budget line items schema
- Existing project status enum

**Enables:**
- Frontend "Convert to Project" button on accepted estimates
- Automated project budget population from estimates
- Seamless transition from estimating to project management

**Integration points:**
- Service uses `ctx.tenant.db.query.estimates.findFirst()` with relations
- Transaction uses `tx.update()` and `tx.insert()` for atomic operations
- Budget line items use `budgetAmount`, `committedCost`, `actualCost` columns from Phase 4 schema

## Known Limitations

1. **No rollback on partial failure:** If estimate/project update succeeds but budget insert fails, transaction rolls back automatically (this is correct behavior, not a limitation).
2. **No validation of cost codes:** Service accepts any costCodeId from estimate without validating it exists in cost codes table (follows existing pattern from Phase 17).
3. **No audit log:** Conversion doesn't create audit log entry (Phase 18-04 will add lifecycle event tracking).
4. **No project status "bidding":** Conversion goes directly from estimate to "active" project (bidding status not yet in schema, planned for Phase 18-01).

## Next Steps

Phase 18-04 will implement:
- Lifecycle event tracking for estimate status transitions
- Audit trail for conversion operations
- Notification system for conversion completion

## Self-Check: PASSED

All claims verified:
- ✅ File exists: apps/api/src/services/projectConversion.ts
- ✅ Commit exists: a6c011a
- ✅ Commit exists: b3a885e

---

*Generated: 2026-02-16*
*Phase: 18 - Estimating Workflow Lifecycle and Conversion*
*Plan: 03 - One-Click Estimate-to-Project Conversion*
