---
phase: 05-change-order-management
plan: 01
subsystem: database, api, shared-types
tags: [drizzle, casl, zod, change-orders, schema, permissions]

# Dependency graph
requires:
  - phase: 04-budget-and-cost-tracking
    provides: budget line items and commitments for CO references
provides:
  - 5 new tenant-scoped tables for change order management
  - Discriminated union Zod schemas for owner/internal/subcontractor COs
  - CASL permissions for ChangeOrder subject across all roles
  - Status transition validation map
affects: [05-02-change-order-api, 05-03-change-order-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Discriminated union for type-specific CO validation
    - Sequential counter tables for PCO/CO numbering
    - Multi-step approval workflow pattern
    - Field-level audit trail via history table

key-files:
  created:
    - packages/shared/src/types/change-order.ts
  modified:
    - apps/api/src/db/schema/tenant.ts
    - apps/api/src/tenant/provision.ts
    - apps/api/src/tenant/context.ts
    - packages/shared/src/index.ts
    - apps/api/src/auth/abilities.ts

key-decisions:
  - "Discriminated union validates different fields per CO type (owner has requestedBy, internal has reason, subcontractor has commitmentId)"
  - "Sequential counters table without unique constraint (enforced via SELECT FOR UPDATE in service layer)"
  - "Approval workflow supports role-based, user-specific, or any-with-role approval requirements"
  - "Change order history tracks field-level changes with revision numbers for complete audit trail"

patterns-established:
  - "Pattern 1: Discriminated union for type-specific validation ensures correct fields per change order type"
  - "Pattern 2: Sequential counter tables with SELECT FOR UPDATE prevent race conditions in number generation"
  - "Pattern 3: Multi-step approval workflow with flexible requirement types (all/any/specific)"

# Metrics
duration: 4 min
completed: 2026-02-13
---

# Phase 5 Plan 1: Change Order Schema, Types, and Permissions Summary

**5 tenant-scoped tables for three-tier change order system (owner/internal/subcontractor) with discriminated union Zod validation and role-based CASL permissions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-13T15:08:03Z
- **Completed:** 2026-02-13T15:12:06Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- 5 new change order tables with proper relationships to projects, commitments, and budget line items
- Discriminated union Zod schemas ensure type-safe validation for each CO type
- CASL abilities properly scope ChangeOrder access (manage for PM, approve for accountant/superintendent, read for others)
- Sequential numbering system ready via changeOrderCounters table
- Multi-step approval workflow infrastructure in place

## Task Commits

Each task was committed atomically:

1. **Task 1: Add change order tables to tenant schema, provisioning, and context** - `e7bfac5` (feat)
2. **Task 2: Create shared change order types and update CASL abilities** - `375a63e` (feat)

## Files Created/Modified

- `packages/shared/src/types/change-order.ts` - Discriminated union schemas, enums, status transitions
- `apps/api/src/db/schema/tenant.ts` - Added 5 new tables: changeOrders, changeOrderLineItems, changeOrderCounters, approvalWorkflowSteps, changeOrderHistory
- `apps/api/src/tenant/provision.ts` - Raw SQL CREATE TABLE for all 5 tables + 7 indexes; also added customers table and updated projects FK
- `apps/api/src/tenant/context.ts` - Exposed all 5 new tables in RequestTenantContext
- `packages/shared/src/index.ts` - Re-exported all change order types
- `apps/api/src/auth/abilities.ts` - Added approve permission for accountant/superintendent, read for estimator/foreman/member

## Decisions Made

- **Discriminated union for CO types:** Owner COs require requestedBy, internal require reason enum, subcontractor require commitmentId. This ensures type-safe validation at creation time.
- **Sequential counters without DB constraint:** Uniqueness enforced via SELECT FOR UPDATE in service layer to avoid migration complexity with composite unique constraints.
- **Flexible approval requirements:** Supports "all" (all approvers must approve), "any" (first approval completes step), "specific" (exact user must approve).
- **Field-level history tracking:** Change order history table records every field change with old/new values for complete audit trail.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added customers table to provision.ts**
- **Found during:** Task 1 (adding change order tables)
- **Issue:** Projects table in tenant.ts references customers with FK, but customers table was missing from provision.ts raw SQL
- **Fix:** Added CREATE TABLE for customers with proper columns matching tenant.ts schema
- **Files modified:** apps/api/src/tenant/provision.ts
- **Verification:** TypeScript compilation passes, customers FK in projects table is valid
- **Committed in:** e7bfac5 (part of Task 1 commit)

**2. [Rule 3 - Blocking] Added job_number and customer_id to projects table in provision.ts**
- **Found during:** Task 1 (updating provision.ts)
- **Issue:** Projects table in tenant.ts has job_number and customer_id columns, but provision.ts raw SQL was missing these
- **Fix:** Added job_number TEXT and customer_id UUID with FK to customers table
- **Files modified:** apps/api/src/tenant/provision.ts
- **Verification:** Projects table now matches tenant.ts schema definition
- **Committed in:** e7bfac5 (part of Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking issues)
**Impact on plan:** Both fixes were necessary for referential integrity and schema consistency. No scope creep.

## Issues Encountered

None - plan executed smoothly with expected blocking fixes for missing provision.ts entries.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Foundation complete for change order API (Plan 02) and UI (Plan 03). All tables, types, and permissions in place. Sequential numbering system ready for implementation.

## Self-Check: PASSED

Verified:
- Created file exists: packages/shared/src/types/change-order.ts
- Commit e7bfac5 exists in git history
- Commit 375a63e exists in git history

---
*Phase: 05-change-order-management*
*Completed: 2026-02-13*
