---
phase: 18-estimating-workflow-lifecycle-and-conversion
plan: 02
subsystem: api
tags: [lifecycle, state-machine, bid-generation, transactions, drizzle-orm]

# Dependency graph
requires:
  - phase: 18-01
    provides: Estimate-bid schema extension with linkedBidId and closure tracking fields
provides:
  - Status transition validation service (state machine pattern)
  - Bid generation from estimate with immutable snapshot
  - tRPC procedures for estimate submission, bid generation, and bid status updates
  - Automatic project status synchronization
affects: [18-04, ui-estimate-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - State machine pattern for status transitions
    - Immutable bid snapshots in bidVersions table
    - Atomic transaction for multi-table status updates

key-files:
  created:
    - apps/api/src/services/estimateLifecycle.ts
    - apps/api/src/services/bidGeneration.ts
    - apps/api/src/migrate-phase18-bids.ts
  modified:
    - apps/api/src/db/schema/tenant.ts
    - apps/api/src/trpc/routers/estimates.ts
    - packages/shared/src/schemas/estimates.ts

key-decisions:
  - "rfqId nullable on bids table to support estimate-based bids alongside RFQ-based bids"
  - "projectId added to bids table for unified project association"
  - "State machine pattern enforces valid status transitions server-side"
  - "Immutable bid snapshots preserve estimate breakdown at bid generation time"
  - "Atomic transactions ensure status consistency across estimates, bids, and projects"

patterns-established:
  - "Status transition validation via canTransitionEstimate/canTransitionBid functions"
  - "Bid generation creates bid, bid version, and bidirectional links in single transaction"
  - "Submit estimate updates both estimate status and project status atomically"
  - "Mark bid won updates both bid and estimate status atomically"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 18 Plan 02: Estimate Lifecycle Management with Bid Generation Summary

**State machine validation for estimate/bid status transitions with immutable bid snapshots and atomic multi-table updates**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T17:48:22Z
- **Completed:** 2026-02-16T17:51:07Z
- **Tasks:** 2 (plus 1 schema update task from checkpoint decision)
- **Files modified:** 6

## Accomplishments
- Schema updated to support estimate-based bids (rfqId nullable, projectId added)
- Status transition state machine prevents invalid lifecycle transitions
- Bid generation creates immutable snapshot with complete estimate breakdown
- All lifecycle operations use database transactions for atomicity

## Task Commits

Each task was committed atomically:

1. **Schema Update: Make rfqId nullable and add projectId** - `601d3c8` (feat)
2. **Task 2: Implement bid generation service and tRPC procedures** - `6d7a13f` (feat)

**Plan metadata:** (to be committed after SUMMARY)

## Files Created/Modified
- `apps/api/src/db/schema/tenant.ts` - Updated bids table schema (rfqId nullable, projectId added)
- `apps/api/src/migrate-phase18-bids.ts` - Migration script for existing tenants
- `apps/api/src/services/estimateLifecycle.ts` - State machine validation for estimate and bid status transitions
- `apps/api/src/services/bidGeneration.ts` - Bid generation with immutable snapshot pattern
- `apps/api/src/trpc/routers/estimates.ts` - submitEstimate, generateBid, and updateBidStatus procedures
- `packages/shared/src/schemas/estimates.ts` - Type exports for GenerateBidInput and UpdateBidStatusInput

## Decisions Made
- **Option A selected from checkpoint:** Made rfqId nullable and added projectId column to bids table. This unifies RFQ-based bids and estimate-based bids in the same table structure while maintaining referential integrity.
- **State machine pattern:** Explicit VALID_ESTIMATE_TRANSITIONS and VALID_BID_TRANSITIONS maps prevent invalid status transitions server-side (e.g., can't mark draft bid as won).
- **Immutable snapshots:** Bid versions store complete estimate breakdown (line items, costs, markup) at bid generation time for historical accuracy.
- **Atomic transactions:** All lifecycle operations (submit, generate bid, update status) use database transactions to ensure multi-table consistency (estimate + bid + project status changes happen together or not at all).

## Deviations from Plan

None - plan executed exactly as written, including checkpoint decision implementation.

## Issues Encountered

None - schema migration ran successfully, all procedures compiled and verified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Estimate lifecycle management complete with bid generation
- Ready for Plan 18-04 (UI components for estimate submission and bid tracking)
- All database schema changes applied via migration script
- State machine validation prevents invalid transitions

## Self-Check: PASSED

All files and commits verified:
- ✓ apps/api/src/services/estimateLifecycle.ts exists
- ✓ apps/api/src/services/bidGeneration.ts exists
- ✓ apps/api/src/migrate-phase18-bids.ts exists
- ✓ Commit 1194bfc exists (Task 1 - lifecycle validation)
- ✓ Commit 601d3c8 exists (Schema update)
- ✓ Commit 6d7a13f exists (Task 2 - bid generation)

---
*Phase: 18-estimating-workflow-lifecycle-and-conversion*
*Completed: 2026-02-16*
