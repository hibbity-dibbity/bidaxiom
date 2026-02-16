---
phase: 17-estimating-workflow-setup-core
plan: 02
subsystem: estimating
tags: [trpc-router, calculations, crud, versioning, authorization]
dependency_graph:
  requires: [17-01, tenant-schema, shared-types, CASL-abilities]
  provides: [estimates-api, calculation-service, estimate-versioning]
  affects: [trpc-router, api-layer]
tech_stack:
  added: []
  patterns: [tiered-calculation-cascade, immutable-versioning, auto-recalculation, CASL-authorization]
key_files:
  created:
    - apps/api/src/services/estimateCalculations.ts
    - apps/api/src/services/test-estimate-calculations.ts
    - apps/api/src/trpc/routers/estimates.ts
  modified:
    - apps/api/src/trpc/router.ts
    - packages/shared/src/index.ts
decisions:
  - title: "Overhead applies to direct costs, markup applies based on markupBase setting"
    rationale: "Industry-standard calculation order ensures accurate margin calculations; overhead calculated first, then markup applies to either direct costs only or direct+overhead depending on company setting"
    alternatives: "Could apply markup first then overhead, but this breaks standard construction accounting practices"
  - title: "Tiered markup cascade: line item override → estimate override → company default"
    rationale: "Provides maximum flexibility while maintaining company standards; allows per-line customization without losing default configuration"
    alternatives: "Flat markup percentage, but doesn't support different rates for labor/material/equipment/subcontractor"
  - title: "Denormalized totals on estimates table for performance"
    rationale: "Frequent total queries (list view, dashboard) would be slow if calculated on-demand; recalculate and store on line item changes"
    alternatives: "Calculate totals client-side, but breaks list queries and requires fetching all line items"
metrics:
  duration: 6
  completed: 2026-02-16
---

# Phase 17 Plan 02: Estimates tRPC Router with CRUD and Calculation Engine Summary

**One-liner:** Backend API for estimate management with tiered markup calculation, auto-save support, immutable versioning on submit, and CASL-enforced permissions.

## What Was Built

Created the complete backend API layer for estimating workflow including:

1. **Estimate Calculation Service** (`estimateCalculations.ts`)
   - `calculateLineItemMarkup()` - Tiered fallback hierarchy (line item → estimate → company defaults)
   - `calculateEstimateTotals()` - Full estimate calculation with overhead, markup, margin
   - Pure functions with no side effects, well-typed interfaces
   - Supports percentage and fixed overhead
   - Configurable markup base (direct costs only or direct+overhead)

2. **Estimates tRPC Router** (7 procedures)
   - **list** - Get all estimates for project with line item counts
   - **getById** - Fetch single estimate with all line items
   - **create** - Create new estimate in draft status
   - **update** - Update estimate fields with auto-recalculation
   - **updateLineItem** - Update line item and trigger estimate recalculation
   - **submit** - Create immutable version snapshot and change status to submitted
   - **delete** - Delete draft estimates only (enforces status validation)

3. **Router Integration**
   - Registered in main tRPC router as `estimates`
   - Exported estimate types from shared package for client-side type inference
   - Follows existing patterns from budget and change-order routers

4. **Verification Testing**
   - Created comprehensive test script verifying all calculation scenarios
   - Tested tiered markup cascade (line item override > estimate override > company default)
   - Verified overhead calculation (percentage vs fixed)
   - Confirmed markup base handling (direct vs direct+overhead)
   - All calculations produce correct results to 2 decimal places

## Key Implementation Details

**Tiered Markup Cascade:** Line items can override markup percentage. If not set, estimate-level overrides are checked per cost type. Finally falls back to company defaults (laborMarkup, materialMarkup, equipmentMarkup, subcontractorMarkup).

**Auto-Recalculation:** Updating estimate overhead/markup settings or any line item triggers recalculation of denormalized totals (directCosts, overheadAmount, markupAmount, totalCost). This ensures list queries are fast without fetching all line items.

**Immutable Versioning:** Submit procedure creates complete snapshot (estimate + lineItems + totals) in estimateVersions table before changing status. Atomic transaction ensures consistency.

**CASL Authorization:** All procedures use `loadProjectAbilities()` pattern to enforce project-level permissions. Follows existing budget/change-order router patterns.

**Status Validation:** Only draft estimates can be updated or deleted. Status changes must go through submit procedure to create version snapshots.

**Calculation Order (per RESEARCH.md Pattern 4):**
1. Calculate direct costs: sum(quantity × unitCost)
2. Calculate overhead: percentage of direct OR fixed amount
3. Determine markup base: direct only OR direct+overhead (configurable)
4. Calculate markup: per line item with tiered cascade, summed
5. Calculate total: directCosts + overhead + totalMarkup
6. Calculate margin: (totalMarkup / totalCost) × 100

## Technical Patterns Used

1. **Tiered Calculation Engine with Override Cascade** - Markup configuration has 3-level fallback
2. **Immutable Versioning** - Transaction-based snapshot creation following Phase 5 change order patterns
3. **Denormalized Performance** - Store calculated totals for fast queries, recalculate on changes
4. **CASL Project-Level Permissions** - Manual ability loading with team membership context
5. **Type-Safe tRPC Procedures** - End-to-end type safety from API to client

## Files Created/Modified

**Created:**
- `apps/api/src/services/estimateCalculations.ts` - Pure calculation functions
- `apps/api/src/services/test-estimate-calculations.ts` - Verification test script
- `apps/api/src/trpc/routers/estimates.ts` - 7 tRPC procedures for estimate CRUD

**Modified:**
- `apps/api/src/trpc/router.ts` - Registered estimates router
- `packages/shared/src/index.ts` - Exported estimate types and enums for client use

## Deviations from Plan

None - plan executed exactly as written. All 7 procedures implemented with correct authorization, calculation logic, and versioning as specified.

## Verification Results

**Calculation Service:**
- ✅ Test 1: Basic calculation with company defaults - PASSED (all totals correct)
- ✅ Test 2: Override cascade - PASSED (line item 30%, estimate 25%, company 15%)
- ✅ Test 3: Markup base with overhead - PASSED (correct markup on direct costs)
- ✅ Test 4: Fixed overhead - PASSED (fixed $2,000 overhead calculated correctly)

**Router Implementation:**
- ✅ 7 procedures exported (list, getById, create, update, updateLineItem, submit, delete)
- ✅ Router registered in main router (estimates key)
- ✅ CASL authorization enforced on all procedures
- ✅ Submit creates immutable version snapshot in transaction
- ✅ Update/updateLineItem trigger total recalculation
- ✅ Only draft estimates can be deleted

**TypeScript Compilation:**
- ✅ Shared package builds successfully
- ✅ Estimate types exported from @construction/shared
- ✅ Router compiles without estimate-specific errors
- ℹ️ Unrelated TypeScript errors in other files (customer, sov, quickbooks) exist but are not introduced by this plan

## Next Steps

Phase 17-03 will implement:
- Template management routers (cost code templates, labor rate templates)
- Template application logic (clone template to estimate)
- Company-level and personal-scope template CRUD
- Template library UI components

Phase 17-04 will implement:
- SOV generation from estimate line items
- SOV grouping strategies (CSI, phase, payment schedule)
- SOV adjustment and validation (total must match estimate)
- SOV versioning linked to estimate versions

## Self-Check: PASSED

**Files verified:**
- ✅ apps/api/src/services/estimateCalculations.ts - EXISTS
- ✅ apps/api/src/services/test-estimate-calculations.ts - EXISTS
- ✅ apps/api/src/trpc/routers/estimates.ts - EXISTS
- ✅ apps/api/src/trpc/router.ts - MODIFIED (estimates router registered)
- ✅ packages/shared/src/index.ts - MODIFIED (estimate types exported)

**Commits verified:**
- ✅ 76e1824 - feat(17-02): create estimate calculation service
- ✅ 6f1c01b - feat(17-02): create estimates tRPC router with CRUD and versioning

**Verification executed:**
```bash
npx tsx apps/api/src/services/test-estimate-calculations.ts
# All 4 tests passed with correct output
```
