---
phase: 17-estimating-workflow-setup-core
plan: 01
subsystem: estimating
tags: [schema, types, validation, foundation]
dependency_graph:
  requires: [tenant-schema, shared-types]
  provides: [estimate-tables, estimate-types, estimate-schemas]
  affects: [tenant-context, CASL-subjects]
tech_stack:
  added: []
  patterns: [tenant-schema-extension, zod-validation, type-inference]
key_files:
  created:
    - packages/shared/src/types/estimates.ts
    - packages/shared/src/schemas/estimates.ts
  modified:
    - apps/api/src/db/schema/tenant.ts
    - apps/api/src/tenant/context.ts
    - packages/shared/src/types/index.ts
    - packages/shared/src/schemas/index.ts
    - packages/shared/src/types/auth.ts
decisions: []
metrics:
  duration: 4
  completed: 2026-02-16
---

# Phase 17 Plan 01: Estimate Schema and Types Foundation Summary

**One-liner:** Database schema, TypeScript types, and Zod validation for estimating workflow with versioning, templates, and SOV tracking.

## What Was Built

Created the complete data layer foundation for the estimating workflow including:

1. **Database Schema (7 tables)**
   - `estimates` - Core estimate records with status, versioning, overhead/markup config
   - `estimateLineItems` - Individual cost line items with quantities, units, costs
   - `costCodeTemplates` - Company and personal reusable estimate templates
   - `templateLineItems` - Predefined line items within templates
   - `laborRateTemplates` - Labor classification rate templates
   - `estimateVersions` - Complete estimate snapshots for change tracking
   - `sovVersions` - Schedule of Values version history linked to estimates

2. **TypeScript Types**
   - Enums: EstimateStatus, CostType, TemplateScope, MarkupBase, OverheadType, SOVGroupingMethod, Unit
   - Interfaces: EstimateTotals, SOVLineItem, LaborRates

3. **Zod Validation Schemas**
   - Create/update estimate schemas
   - Create/update line item schemas
   - Template application schema
   - Template creation schemas (cost code + labor rate)
   - SOV generation and update schemas

4. **CASL Authorization**
   - Added subjects: Estimate, EstimateTemplate, LaborRateTemplate, SOV

## Key Implementation Details

**Template References Without FK:** `estimateLineItems.sourceTemplateId` has NO foreign key constraint. This allows line items to track their template origin even after the template is deleted or modified, preventing orphaned references while maintaining audit trail.

**Versioning Strategy:** Estimates use `currentVersion` integer field incremented on major changes. Full snapshots stored in `estimateVersions` table as JSONB for complete history without complex joins.

**Scope-Based Templates:** Both cost code and labor rate templates support `company` (shared) and `personal` (user-specific) scopes for flexibility.

**SOV Linkage:** `sovVersions` table links to both `estimateVersions` (estimate snapshot at SOV creation) and `changeOrders` (if SOV created from approved change) for complete traceability.

**Numeric Precision:** Followed existing pattern using `NUMERIC(15,2)` for currency and `NUMERIC(15,4)` for quantities/unit costs to support fractional quantities.

## Technical Patterns Used

1. **Tenant Schema Extension:** Added tables to `createTenantSchema()` function following existing budget/change order patterns
2. **Type Inference:** Frontend types will be inferred from Drizzle schema using `InferSelectModel`
3. **Zod Validation:** Input validation enforced at tRPC layer before database operations
4. **CASL Subjects:** Authorization rules will be defined in abilities.ts (Phase 17-02)

## Files Created/Modified

**Created:**
- `packages/shared/src/types/estimates.ts` - Domain types and enums
- `packages/shared/src/schemas/estimates.ts` - Zod validation schemas

**Modified:**
- `apps/api/src/db/schema/tenant.ts` - Added 7 estimate tables
- `apps/api/src/tenant/context.ts` - Exposed new tables in tenant context
- `packages/shared/src/types/index.ts` - Re-exported estimate types
- `packages/shared/src/schemas/index.ts` - Re-exported estimate schemas
- `packages/shared/src/types/auth.ts` - Added CASL subjects

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- ✅ All 7 database tables defined in tenant schema (19 references found)
- ✅ Tables added to tenant context return statement
- ✅ Shared types exported and compile without errors
- ✅ Zod schemas exported (9 schemas created)
- ✅ CASL subjects updated (4 new subjects added)
- ✅ TypeScript compilation succeeds in packages/shared
- ✅ No breaking changes to existing code

## Next Steps

Phase 17-02 will implement:
- tRPC routers for estimate CRUD operations
- Template application logic
- SOV generation from estimate line items
- CASL ability rules for estimate permissions
- Estimate calculation service (totals, overhead, markup)

## Self-Check: PASSED

**Files verified:**
- ✅ packages/shared/src/types/estimates.ts - EXISTS
- ✅ packages/shared/src/schemas/estimates.ts - EXISTS
- ✅ apps/api/src/db/schema/tenant.ts - MODIFIED (7 tables added)
- ✅ apps/api/src/tenant/context.ts - MODIFIED (7 tables exposed)

**Commits verified:**
- ✅ 3280ba2 - feat(17-01): add estimate database tables to tenant schema
- ✅ 6c52877 - feat(17-01): add shared types and Zod schemas for estimates
