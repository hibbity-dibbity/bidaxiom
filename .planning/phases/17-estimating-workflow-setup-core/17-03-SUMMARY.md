---
phase: 17-estimating-workflow-setup-core
plan: 03
subsystem: estimating
tags: [templates, tRPC, CRUD, permissions, deep-clone]
dependency_graph:
  requires: [17-01, tenant-schema, shared-types, CASL-abilities]
  provides: [template-CRUD, template-application, personal-templates]
  affects: [company-settings, estimate-workflow]
tech_stack:
  added: []
  patterns: [deep-clone-pattern, scope-based-permissions, company-setting-gates]
key_files:
  created:
    - apps/api/src/trpc/routers/estimateTemplates.ts
  modified:
    - packages/shared/src/types/company.ts
    - apps/api/src/db/schema/tenant.ts
    - apps/api/src/trpc/router.ts
decisions:
  - Deep clone template line items without FK constraints - preserves template mutability
  - Scope-based permissions (company requires admin, personal requires company setting)
  - Permissive default for allowPersonalTemplates (null treated as true)
metrics:
  duration: 4
  completed: 2026-02-16
---

# Phase 17 Plan 03: Estimate Templates Router and Application Logic Summary

**One-liner:** tRPC router for cost code and labor rate templates with CRUD operations, deep clone application to estimates, and company-controlled personal template permissions.

## What Was Built

Created complete template management functionality for the estimating workflow:

1. **Cost Code Template Procedures (5)**
   - `listCostCodeTemplates` - Query templates by scope (company/personal/all) with optional project type filter
   - `getCostCodeTemplateById` - Fetch template with all line items, verify access permissions
   - `createCostCodeTemplate` - Create company (admin only) or personal templates (if allowed)
   - `applyCostCodeTemplate` - Deep clone all template line items to estimate in transaction
   - `deleteCostCodeTemplate` - Remove owned personal or company templates (scope-based permissions)

2. **Labor Rate Template Procedures (4)**
   - `listLaborRateTemplates` - Query labor rate templates by scope
   - `createLaborRateTemplate` - Create company or personal labor rate templates
   - `applyLaborRateTemplate` - Update labor line item unit costs based on classification matching
   - `deleteLaborRateTemplate` - Remove owned templates with scope-based permissions

3. **Company Setting Integration**
   - Added `allowPersonalTemplates` field to `company_profiles` table (nullable boolean)
   - Added to `CompanyConfig` type and schema in shared package
   - Template creation checks this setting before allowing personal scope

4. **Router Registration**
   - Registered `estimateTemplatesRouter` in tRPC root router as `estimateTemplates`
   - Separate from main `estimatesRouter` for clean separation of concerns

## Key Implementation Details

**Deep Clone Pattern:** `applyCostCodeTemplate` creates new estimate line items by copying all fields from template line items, generating new UUIDs, and setting `sourceTemplateId` for audit trail. Critically, `sourceTemplateId` has NO foreign key constraint - this allows templates to be deleted or modified without orphaning estimate line items. The template reference is purely informational.

**Scope-Based Permissions:**
- Company templates require `can('create', 'EstimateTemplate')` permission (admin only)
- Personal templates require company setting `allowPersonalTemplates !== false`
- Template deletion enforces ownership (personal) or admin permission (company)
- Template access verification prevents users from viewing other users' personal templates

**Permissive Default:** The `allowPersonalTemplates` field is nullable with an implicit default of `true`. This means:
- Existing companies without the field set can create personal templates
- New companies can create personal templates unless explicitly disabled
- No migration needed - existing data works without schema changes

**Labor Classification Matching:** `applyLaborRateTemplate` extracts labor classification from line item descriptions using pattern matching (e.g., "Foreman - Site Prep" → "Foreman"), then looks up the rate in the template's rates JSONB object. Only matching classifications are updated, allowing partial application.

**Transaction Safety:** `applyCostCodeTemplate` wraps all line item insertions and estimate update in a single transaction. If template is not found or has no line items, the transaction rolls back with appropriate error.

## Technical Patterns Used

1. **authorizedProcedure**: All template procedures use CASL permissions for fine-grained access control
2. **Manual ability loading**: Template application loads project abilities explicitly for estimate update permission
3. **Drizzle transactions**: Multi-step operations use `db.transaction()` for atomicity
4. **JSONB for rates**: Labor rate templates store classification-to-rate mapping as JSONB for flexibility
5. **Scope filtering with OR conditions**: Template list queries use Drizzle `or()` to filter by company + personal in single query

## Files Created/Modified

**Created:**
- `apps/api/src/trpc/routers/estimateTemplates.ts` - 654 lines, 9 procedures

**Modified:**
- `packages/shared/src/types/company.ts` - Added allowPersonalTemplates to CompanyConfig
- `apps/api/src/db/schema/tenant.ts` - Added allowPersonalTemplates column to company_profiles
- `apps/api/src/trpc/router.ts` - Registered estimateTemplates router

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- ✅ All 9 procedures exist (grep found 9 matches)
- ✅ `sourceTemplateId` used with NO FK constraint comment
- ✅ `allowPersonalTemplates` field added to shared types
- ✅ `estimateTemplates` router registered in tRPC index
- ✅ TypeScript compilation succeeds without errors
- ✅ Deep clone pattern preserves template mutability

## Next Steps

Phase 17-04 will implement:
- Frontend UI for template library browsing
- Template creation wizard (cost code + labor rate)
- Template application flow with preview
- Template management (edit, delete, duplicate)
- Personal vs company template toggle in UI

## Self-Check: PASSED

**Files verified:**
- ✅ apps/api/src/trpc/routers/estimateTemplates.ts - EXISTS (654 lines, 9 procedures)
- ✅ packages/shared/src/types/company.ts - MODIFIED (allowPersonalTemplates added)
- ✅ apps/api/src/db/schema/tenant.ts - MODIFIED (allowPersonalTemplates column added)
- ✅ apps/api/src/trpc/router.ts - MODIFIED (estimateTemplates registered)

**Commits verified:**
- ✅ bcfffb7 - feat(17-03): create estimate templates router with cost code and labor rate procedures
- ✅ 8b48c8e - feat(17-03): add allowPersonalTemplates company setting and register templates router
