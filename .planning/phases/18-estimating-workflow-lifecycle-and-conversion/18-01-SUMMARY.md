---
phase: 18-estimating-workflow-lifecycle-and-conversion
plan: 01
subsystem: database
tags: [drizzle-orm, postgresql, migration, schema-extension]

# Dependency graph
requires:
  - phase: 17-estimating-workflow-setup-core
    provides: Estimates table, line items, and workflow infrastructure
  - phase: 07-bidding-and-procurement
    provides: Bids table and RFQ workflow
provides:
  - Estimate-to-bid linking via estimateId FK on bids table
  - Bid closure tracking with closedAt/closedBy/closedNotes fields
  - Bidding project status for lifecycle automation
  - BidStatus type exported from shared package
  - Migration script for retroactive schema changes
affects: [18-estimating-workflow-lifecycle-and-conversion, bidding-and-procurement, project-management]

# Tech tracking
tech-stack:
  added: []
  patterns: [idempotent-migrations, estimate-bid-linking, lifecycle-status-tracking]

key-files:
  created:
    - apps/api/src/db/migrations/migrate-phase18-schema.ts
  modified:
    - apps/api/src/db/schema/tenant.ts
    - packages/shared/src/types/estimates.ts
    - packages/shared/src/schemas/estimates.ts

key-decisions:
  - "Estimate-bid linking via linkedBidId on estimates and estimateId on bids for bidirectional navigation"
  - "Closure tracking fields (closedAt/By/Notes) support bid won/lost workflow documentation"
  - "Bidding project status enables automated project lifecycle transitions from estimate workflow"
  - "Migration checks column existence for idempotency to support multiple runs"

patterns-established:
  - "Bidirectional linking: estimates.linkedBidId and bids.estimateId for two-way navigation"
  - "Lifecycle status comments: inline documentation explains status transitions"
  - "Idempotent migrations: information_schema queries prevent duplicate column additions"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 18 Plan 01: Estimate-Bid Lifecycle Schema Extension

**Bidirectional estimate-bid linking with closure tracking and bidding project status for lifecycle automation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T21:09:22Z
- **Completed:** 2026-02-16T21:11:03Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments
- Extended bids table with estimateId FK, closedAt, closedBy, closedNotes columns for estimate linking and closure tracking
- Added linkedBidId column to estimates table for bidirectional navigation
- Updated projects.status to include "bidding" for lifecycle automation support
- Exported BidStatus type with lifecycle values (draft, submitted, won, lost, withdrawn)
- Created idempotent migration script for existing tenants to add new columns

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend schema for estimate-bid lifecycle** - `1f98159` (feat)

## Files Created/Modified
- `apps/api/src/db/schema/tenant.ts` - Added linkedBidId to estimates, estimateId/closedAt/closedBy/closedNotes to bids, bidding status to projects
- `packages/shared/src/types/estimates.ts` - Exported BidStatus type with lifecycle documentation
- `packages/shared/src/schemas/estimates.ts` - Added generateBidSchema and updateBidStatusSchema for bid lifecycle operations
- `apps/api/src/db/migrations/migrate-phase18-schema.ts` - Idempotent migration script with column existence checks

## Decisions Made

**Bidirectional linking approach:** Estimates have linkedBidId (nullable UUID), bids have estimateId FK with ON DELETE SET NULL. This allows navigation from estimate to generated bid and from bid back to source estimate without rigid coupling.

**Closure tracking separate from status:** While bids.status tracks workflow state, separate closedAt/closedBy/closedNotes fields provide detailed closure documentation for won/lost decisions with timestamp, user, and reasoning.

**Bidding status on projects:** Adding "bidding" to projects.status enum enables automated status transitions when estimate generates bid, supporting lifecycle automation without requiring separate state tracking.

**Migration idempotency via column checks:** Migration queries information_schema to detect existing columns before ALTER TABLE, enabling safe re-runs and supporting tenants at different schema versions.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Schema foundation complete for estimate-to-bid lifecycle tracking. Ready for:
- Plan 18-02: Bid generation from estimates
- Plan 18-03: Bid status updates and project conversion
- Plan 18-04: Lifecycle automation and status transitions

Migration script available for retroactive schema updates to existing tenants.

## Self-Check: PASSED

All files and commits verified:
- ✓ apps/api/src/db/migrations/migrate-phase18-schema.ts exists
- ✓ Commit 1f98159 exists in git history

---
*Phase: 18-estimating-workflow-lifecycle-and-conversion*
*Completed: 2026-02-16*
