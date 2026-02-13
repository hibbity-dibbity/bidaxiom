---
phase: 07-bidding-and-procurement
plan: 03
subsystem: api, bidding
tags: [trpc, bidding, versioning, leveling, commitment-conversion, audit]

# Dependency graph
requires:
  - phase: 07-bidding-and-procurement
    plan: 01
    provides: Bidding schema (bids, bid_versions, bid_leveling_notes, rfqs, rfq_amendments)
  - phase: 04-budget-and-cost-tracking
    plan: 03
    provides: Commitment creation patterns
provides:
  - Bid submission API with versioning and RFQ validation
  - Bid comparison with scope leveling adjustments
  - Award-to-commitment conversion in single transaction
  - Amendment notification for bidders
affects: [07-04-bidding-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bid versioning: immutable snapshots with incremental versionNumber"
    - "Award procedure: single transaction for bid award + RFQ status + commitment creation + reject other bids"
    - "Scope leveling: adjustmentAmount sum added to totalAmount for comparison normalization"
    - "Amendment awareness: triggerAmendmentId tracks which amendment the bid version acknowledges"

key-files:
  created:
    - apps/api/src/trpc/routers/bid.ts
  modified:
    - apps/api/src/trpc/router.ts

key-decisions:
  - "Award procedure converts bid line items to commitment line items in single transaction"
  - "Bid comparison sorts by leveledAmount (totalAmount + leveling adjustments) ASC"
  - "Status transitions enforced at API level with validation rules (e.g., can't update awarded bid)"
  - "Only PMs/admins can award bids (manage RFQ permission required)"
  - "Rejecting other bids on award is automatic to maintain workflow integrity"

patterns-established:
  - "Bid submission validates RFQ is 'issued' before accepting bid"
  - "Version creation increments versionNumber from MAX(versionNumber) + 1"
  - "Comparison procedure calculates leveledAmount from bid_leveling_notes adjustments"
  - "Award converts bid to draft commitment with all line items mapped"

# Metrics
duration: 4 min
completed: 2026-02-13
---

# Phase 7 Plan 3: Bid Management API Summary

**Complete bid lifecycle API: submit, version, compare with leveling, award with commitment conversion**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-13T16:35:44Z
- **Completed:** 2026-02-13T16:40:06Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- 10 tRPC procedures covering full bid lifecycle
- Bid versioning with immutable snapshots
- Side-by-side comparison with scope leveling adjustments
- Award procedure with optional commitment conversion
- Amendment notifications for unacknowledged RFQ changes
- All mutations create audit logs

## Task Commits

Each task was committed atomically:

1. **Task 1: Create bid tRPC router with versioning and comparison** - `e2da05f` (feat)
   - 10 procedures: submit, updateVersion, listByRfq, getById, compare, addLevelingNote, removeLevelingNote, updateStatus, award, getAmendmentNotifications
   - Bid submission validates RFQ is 'issued' and creates first version
   - Version updates increment versionNumber and create immutable snapshot
   - Comparison calculates leveledAmount from totalAmount + leveling note adjustments
   - Award procedure creates commitment from bid line items when convertToCommitment=true
   - All mutations create audit logs with before/after state

2. **Task 2: Register bid router in app router** - `ad7a333` (feat)
   - Import bidRouter from ./routers/bid.js
   - Add bid: bidRouter to appRouter
   - 18 routers now registered in total

## Files Created/Modified

**Created:**
- `apps/api/src/trpc/routers/bid.ts` - Complete bid management API with 10 procedures

**Modified:**
- `apps/api/src/trpc/router.ts` - Registered bidRouter in appRouter

## Decisions Made

**1. Award converts bid to commitment in single transaction**
- Rationale: Ensures atomicity - if commitment creation fails, award is rolled back
- Implementation: Insert commitment, map bid line items to commitment_line_items, update bid.commitmentId
- Pattern: Same transaction updates bid status, RFQ status, creates commitment, rejects other bids

**2. Bid comparison sorts by leveledAmount**
- Rationale: GCs need apples-to-apples comparison after scope adjustments
- Calculation: leveledAmount = totalAmount + SUM(adjustmentAmount from leveling notes)
- Sort: ASC (lowest bid first)

**3. Status transitions enforced at API level**
- Rationale: Prevents invalid state changes (e.g., updating awarded bid, awarding rejected bid)
- Rules: submitted → under_review/shortlisted/rejected/withdrawn; under_review → shortlisted/rejected/withdrawn; shortlisted → rejected/withdrawn (award via separate procedure)
- Terminal states: awarded, rejected, withdrawn

**4. Only PMs/admins can award bids**
- Rationale: Award is a significant decision requiring management authority
- Implementation: Check `ability.can('manage', 'RFQ')` (not just 'update', 'Bid')
- Distinction: Estimators can manage bids but can't award (separation of evaluation from commitment)

**5. Automatic rejection of other bids on award**
- Rationale: Maintains workflow integrity - only one bid should be awarded per RFQ
- Implementation: UPDATE bids SET status='rejected' WHERE rfqId = ? AND id != ? AND status NOT IN ('withdrawn', 'rejected', 'awarded')
- User experience: No manual cleanup required

## Deviations from Plan

**[Rule 3 - Blocking Issue] Fixed schema mismatch in bid.ts**
- **Found during:** Task 1 type checking
- **Issue:** Bid router code referenced columns that don't exist in schema (bidderContactName, bidderContactPhone, submittedBy on bids table; createdBy on bid_versions table)
- **Fix:** Removed non-existent columns, used actual schema columns (bidderContactEmail, subcontractorId, notes on bids; submittedAt on bid_versions)
- **Files modified:** apps/api/src/trpc/routers/bid.ts
- **Commit:** e2da05f (same commit as Task 1)

## Issues Encountered

**Schema column mismatch** - Resolved via Rule 3 (auto-fix blocking issue). The plan assumed certain columns existed from 07-01, but the actual schema had different columns. Fixed by referencing the actual tenant.ts schema definition.

## Next Phase Readiness

Bid API complete. Ready for:
- **07-04**: Bid comparison UI and leveling tools
- **07-05**: RFQ and bid workflow UIs

All bid operations are now available via tRPC:
- Subcontractors can submit and update bids
- GCs can compare bids with scope leveling
- PMs can award bids and convert to commitments
- Amendment notifications keep bidders informed

---
*Phase: 07-bidding-and-procurement*
*Completed: 2026-02-13*

## Self-Check: PASSED

All claims verified:
- ✓ Created file exists: apps/api/src/trpc/routers/bid.ts
- ✓ Modified file exists: apps/api/src/trpc/router.ts
- ✓ Both commits found: e2da05f, ad7a333
- ✓ 10 procedures exist in bid router (submit, updateVersion, listByRfq, getById, compare, addLevelingNote, removeLevelingNote, updateStatus, award, getAmendmentNotifications)
- ✓ bidRouter registered in appRouter
- ✓ Award procedure creates commitment when convertToCommitment=true
- ✓ Compare calculates leveledAmount from leveling note adjustments
- ✓ Submit validates RFQ is 'issued'
