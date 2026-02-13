---
phase: 04-budget-and-cost-tracking
plan: 01
subsystem: database
tags: [drizzle-orm, postgresql, zod, casl, budget, commitments, cost-tracking]

# Dependency graph
requires:
  - phase: 03-project-management-core
    provides: Tenant schema foundation with projects, documents, and team management
provides:
  - Three-tier budget tracking schema (budget line items, commitments, commitment line items)
  - CSI MasterFormat cost code reference data with 24 divisions
  - Shared Zod validation schemas for budget and commitment management
  - CASL permissions for Budget and Commitment subjects across all roles
  - Raw SQL provisioning for budget tables with performance indexes
affects: [04-budget-and-cost-tracking, 05-change-order-management, 06-payment-applications]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Three-tier cost tracking model (budgeted, committed, actual)
    - Budget line item locking via isLocked boolean for payment app integration
    - CSI cost codes 0-49 for standard divisions, 50+ for custom company codes
    - NUMERIC(15,2) for all currency columns to ensure exact decimal precision
    - Commitment line items with optional budget line item reference for cost allocation

key-files:
  created:
    - packages/shared/src/types/budget.ts
  modified:
    - apps/api/src/db/schema/tenant.ts
    - apps/api/src/tenant/provision.ts
    - apps/api/src/tenant/context.ts
    - apps/api/src/auth/abilities.ts
    - packages/shared/src/types/auth.ts
    - packages/shared/src/index.ts

key-decisions:
  - "NUMERIC(15,2) for all currency columns prevents floating-point precision errors in financial calculations"
  - "Budget line item locking with isLocked/lockedAt/lockedBy enforces change order workflow after payment applications"
  - "CSI divisions 0-49 as standard cost codes, 50+ reserved for company custom codes"
  - "Commitment line items reference budget line items with ON DELETE SET NULL to preserve historical data"
  - "24 CSI MasterFormat divisions included (commonly used divisions 0-14, 21-23, 26-28, 31-33)"
  - "Foremen granted read access to Budget and Commitment (need visibility for their assigned projects)"

patterns-established:
  - "Budget line items lock when payment applications are created (prevents unauthorized budget manipulation)"
  - "Commitment types: subcontract or purchase_order with status lifecycle (draft → pending → approved → executed → closed)"
  - "Company-configurable cost codes via costCodeConfig in company profiles (enabled CSI divisions + custom codes)"
  - "Variance threshold configuration in company profiles (warning at 10%, critical at 20% by default)"

# Metrics
duration: 111min
completed: 2026-02-13
---

# Phase 04 Plan 01: Budget and Cost Tracking Schema Summary

**Extended tenant schema with three-tier budget tracking model, CSI cost codes, and CASL budget/commitment permissions**

## Performance

- **Duration:** 111 minutes (1h 51m)
- **Started:** 2026-02-13T02:09:48Z
- **Completed:** 2026-02-13T04:01:25Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Created three new tenant-scoped tables for budget tracking: budget_line_items, commitments, commitment_line_items
- Implemented raw SQL provisioning with proper indexes (project lookups, commitment references, budget cross-references)
- Established shared Zod schemas for budget line items, commitments, cost codes, and forecast types
- Updated CASL abilities to support Budget and Commitment permissions across all organizational roles
- Included 24 CSI MasterFormat divisions as reference data for cost code standardization

## Task Commits

Each task was committed atomically:

1. **Task 1: Add budget tables to tenant schema and update provisioning** - `263b928` (feat)
   - Added budget_line_items table with cost code tracking and locking mechanism
   - Added commitments table for subcontracts and purchase orders
   - Added commitment_line_items table mapping commitments to budget lines
   - Imported boolean from drizzle-orm/pg-core for isLocked column
   - Updated provision.ts with raw SQL CREATE TABLE statements for all three tables
   - Added indexes: idx_budget_line_items_project, idx_commitments_project, idx_commitment_line_items_commitment, idx_commitment_line_items_budget
   - Updated context.ts to expose budgetLineItems, commitments, commitmentLineItems in schema

2. **Task 2: Create shared budget types and update CASL abilities** - `93bc55b` (feat)
   - Created packages/shared/src/types/budget.ts with commitment enums, CSI divisions, cost code config, budget schemas, commitment schemas, forecast interfaces
   - Added Commitment to AppSubjects type union in auth.ts
   - Updated all role abilities in abilities.ts to include Commitment permissions
   - Project managers and accountants can manage Commitments
   - Estimators, superintendents, foremen, and members can read Commitments
   - Foremen granted read access to Budget and Commitment (need cost visibility for assigned projects)
   - Exported all new types and schemas from packages/shared/src/index.ts

## Files Created/Modified

- `packages/shared/src/types/budget.ts` - Commitment enums, 24 CSI divisions with descriptions, cost code config schemas, budget line item creation/update schemas, commitment creation/update schemas, forecast metrics interfaces, variance alert interface, budget summary interface, variance thresholds schema
- `apps/api/src/db/schema/tenant.ts` - Added budgetLineItems, commitments, commitmentLineItems tables to tenant schema with NUMERIC(15,2) for currency, boolean for locking, references with proper cascade/set null behavior
- `apps/api/src/tenant/provision.ts` - Raw SQL CREATE TABLE statements for all three budget tables with indexes for performance
- `apps/api/src/tenant/context.ts` - Extended RequestTenantContext.schema to include budgetLineItems, commitments, commitmentLineItems
- `apps/api/src/auth/abilities.ts` - Added Commitment permissions for all roles (manage for PM/accountant, read for others), added Budget/Commitment read for foremen
- `packages/shared/src/types/auth.ts` - Added Commitment to AppSubjects type union
- `packages/shared/src/index.ts` - Exported all budget types, schemas, and interfaces

## Decisions Made

1. **NUMERIC(15,2) for currency columns**: PostgreSQL NUMERIC ensures exact decimal precision for financial calculations, preventing floating-point rounding errors that compound across hundreds of line items.

2. **Budget line item locking mechanism**: isLocked/lockedAt/lockedBy columns enforce that budget line items cannot be modified after payment applications are created against them. Changes require formal change orders (Phase 5).

3. **CSI cost codes 0-49, custom codes 50+**: Standard CSI MasterFormat divisions use IDs 0-49. Companies can add custom cost codes starting at 50 to avoid conflicts with future CSI divisions.

4. **Commitment line items optional budget reference**: budgetLineItemId can be NULL to support commitments that don't map to existing budget lines. ON DELETE SET NULL preserves historical commitment data when budget lines are deleted.

5. **24 CSI divisions included**: Commonly used divisions (0-14 general/structural, 21-23 MEP, 26-28 electrical/communications, 31-33 site work) cover typical commercial construction. More can be added as needed.

6. **Foremen budget/commitment read access**: Foremen need to see costs for their assigned projects to make informed decisions on materials, labor, and progress. Previously only had document access.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Pre-existing TypeScript error in document router**: apps/api/src/trpc/routers/document.ts line 501 has a type error (null vs undefined) that existed before this plan. Did not fix as it's outside plan scope. Error does not affect budget schema functionality.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 04 Plan 02 (Budget tRPC Router):**
- Database schema complete with all budget tables and indexes
- Shared validation schemas ready for tRPC procedures
- CASL abilities ready to enforce Budget and Commitment permissions
- Tenant provisioning will create all budget tables automatically for new tenants

**Blockers:**
None

**Notes:**
- Budget tRPC router will implement CRUD operations, budget locking, variance calculation, and forecast metrics
- Commitment tRPC router will handle subcontract/PO creation with line item management and status lifecycle
- Budget variance alerts will check configurable thresholds (warning/critical) from company profiles

## Self-Check: PASSED

All claimed files and commits verified:
- All 7 key files exist on disk
- Commit 263b928 (Task 1) exists in git log
- Commit 93bc55b (Task 2) exists in git log
- TypeScript compilation passes for packages/shared
- Budget tables added to tenant schema return value
- CASL abilities include Commitment permissions for all roles

---
*Phase: 04-budget-and-cost-tracking*
*Completed: 2026-02-13*
