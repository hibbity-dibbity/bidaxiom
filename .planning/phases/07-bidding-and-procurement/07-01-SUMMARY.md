---
phase: 07-bidding-and-procurement
plan: 01
subsystem: database, auth, types
tags: [drizzle, postgres, casl, zod, rfq, bidding, subcontractor, procurement]

# Dependency graph
requires:
  - phase: 04-budget-and-cost-tracking
    provides: Budget line items and commitment structures
  - phase: 06-payment-applications
    provides: Tenant schema patterns and CASL permission patterns
provides:
  - Tenant-scoped bidding tables (RFQs, bids, amendments, invitations, directory, leveling notes)
  - Shared Zod schemas for bidding operations
  - CASL permissions for bidding subjects across all organizational roles
affects: [08-bidding-api, 09-bidding-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Bid versioning with snapshot pattern (similar to document versions)
    - RFQ amendment immutable trail (similar to change order history)
    - Denormalized bidder company name for historical integrity
    - TEXT reference for commitmentId to avoid circular FK complexity
    - JSONB line items for flexible bid structures

key-files:
  created:
    - packages/shared/src/types/bidding.ts
  modified:
    - apps/api/src/db/schema/tenant.ts
    - apps/api/src/tenant/provision.ts
    - apps/api/src/tenant/context.ts
    - apps/api/src/auth/abilities.ts
    - packages/shared/src/types/auth.ts
    - packages/shared/src/index.ts

key-decisions:
  - "TEXT column for commitmentId on bids table to avoid circular FK complexity"
  - "Denormalized bidderCompanyName for historical record integrity"
  - "JSONB for bid line items to support flexible bid structures without rigid schema"
  - "Estimators have full manage permissions for SubcontractorDirectory, RFQ, and Bid subjects"
  - "Foremen have read access to RFQs for awareness of awarded subcontractors"

patterns-established:
  - "Bid versioning: snapshot pattern with versionNumber and triggerAmendmentId for tracking amendment-triggered revisions"
  - "RFQ amendments: immutable trail with amendmentNumber sequence (1, 2, 3...)"
  - "Invitation tracking: supports both directory subcontractors and external email invitations"
  - "Bid leveling: separate notes table with adjustmentAmount for scope normalization during comparison"

# Metrics
duration: 3 min
completed: 2026-02-13
---

# Phase 7 Plan 1: Bidding Schema and Permissions Summary

**7 tenant-scoped bidding tables with Drizzle ORM definitions, raw SQL provisioning, Zod validation schemas, and role-based CASL permissions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-13T16:29:48Z
- **Completed:** 2026-02-13T16:33:13Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- 7 new tenant-scoped tables for bidding and procurement workflow
- Complete Zod validation schemas for all bidding operations
- CASL permissions integrated across all organizational roles
- Bid versioning and RFQ amendment immutable trails
- Subcontractor directory with trade capability tracking

## Task Commits

Each task was committed atomically:

1. **Task 1: Add bidding tables to tenant schema and update provisioning** - `1c963bc` (feat)
   - Added 7 tables: subcontractor_directory, rfqs, rfq_amendments, rfq_invitations, bids, bid_versions, bid_leveling_notes
   - Raw SQL CREATE TABLE statements in provision.ts
   - 8 performance indexes (project, status, RFQ lookups)
   - Exposed all tables in tenant context

2. **Task 2: Create shared bidding types and update CASL abilities** - `654f59a` (feat)
   - Created bidding.ts with 11 Zod schemas and 2 interfaces
   - Added SubcontractorDirectory to AppSubjects union
   - Updated CASL abilities for 6 roles (estimator, PM, accountant, superintendent, foreman, member)
   - Exported all bidding types from shared package

## Files Created/Modified

**Created:**
- `packages/shared/src/types/bidding.ts` - Complete Zod schemas and TypeScript types for RFQ, bid, amendment, invitation, subcontractor, and leveling operations

**Modified:**
- `apps/api/src/db/schema/tenant.ts` - 7 new table definitions with references and constraints
- `apps/api/src/tenant/provision.ts` - Raw SQL CREATE TABLE statements and indexes
- `apps/api/src/tenant/context.ts` - Exposed all 7 bidding tables in schema object
- `apps/api/src/auth/abilities.ts` - Added SubcontractorDirectory permissions for all roles
- `packages/shared/src/types/auth.ts` - Added SubcontractorDirectory to AppSubjects
- `packages/shared/src/index.ts` - Exported all bidding schemas, enums, and types

## Decisions Made

**1. TEXT reference for commitmentId instead of UUID FK**
- Rationale: Avoids circular dependency between bids and commitments tables (bid can create commitment, commitment references bid)
- Trade-off: Application-level validation required instead of DB constraint
- Benefit: Simpler migration path and no complex FK dependency graph

**2. Denormalized bidderCompanyName on bids table**
- Rationale: Preserves historical record even if subcontractor is deleted or renamed
- Pattern: Same as payment app denormalization from Phase 6
- Benefit: Audit trail integrity and historical reporting accuracy

**3. JSONB for bid line items**
- Rationale: Flexible structure without rigid schema; supports varying bid formats
- Trade-off: No FK to budget line items (optional costCodeId field for linkage)
- Benefit: Handles diverse bid structures from different subcontractors

**4. Estimator role has full manage permissions for bidding**
- Rationale: Estimators drive the bidding process end-to-end
- Scope: manage Bid, manage RFQ, manage SubcontractorDirectory
- Distinction: PMs can manage RFQ but only read bids (separation of concerns)

**5. Foremen have read access to RFQs**
- Rationale: Field supervisors need awareness of which subs are awarded for coordination
- Scope: read RFQ only (no bid details, no directory access)
- Benefit: Field visibility without exposing pricing or bid evaluation data

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tables, schemas, and permissions implemented without issues. Pre-existing TypeScript errors in trpc/router.ts and trpc/routers/user.ts (Clerk type inference) remain unchanged.

## Next Phase Readiness

Schema foundation complete. Ready for:
- **07-02**: RFQ and Bid tRPC routers for CRUD operations
- **07-03**: Bidding UI components for RFQ creation and bid management
- **07-04**: Bid comparison and leveling tools

All subsequent bidding plans depend on this schema and will use the established patterns:
- Bid versioning via bid_versions table
- RFQ amendments as immutable trail
- Subcontractor directory as master list
- CASL permissions already enforced per role

---
*Phase: 07-bidding-and-procurement*
*Completed: 2026-02-13*

## Self-Check: PASSED

All claims verified:
- ✓ Created file exists: packages/shared/src/types/bidding.ts
- ✓ Both commits found: 1c963bc, 654f59a
- ✓ 7 table definitions present in schema (25 references found)
- ✓ SubcontractorDirectory in AppSubjects union
- ✓ Estimator has manage SubcontractorDirectory permission
