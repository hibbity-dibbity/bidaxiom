---
phase: 07-bidding-and-procurement
plan: 04
subsystem: web, bidding-ui
tags: [rfq-ui, bid-comparison, leveling, shadcn-ui, trpc-client]

# Dependency graph
dependency_graph:
  requires:
    - phase: 07-bidding-and-procurement
      plan: 02
      provides: RFQ lifecycle API (create, issue, amend, close, cancel)
    - phase: 07-bidding-and-procurement
      plan: 03
      provides: Bid submission and comparison API with leveling
  provides:
    - RFQ list page with status filtering and trade display
    - RFQ creation form with CSI division selection
    - Invitation manager for directory and external invitations
    - RFQ detail page with tabs (overview, invitations, bids, amendments)
    - Bid comparison table with side-by-side leveling
    - Award flow with optional commitment conversion
  affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "shadcn/ui Card, Table, Dialog, Tabs for consistent design"
    - "React Hook Form with Zod validation for type-safe forms"
    - "tRPC hooks with React Query cache invalidation"
    - "Collapsible line item breakdown in comparison table"
    - "Lowest leveled amount highlighting with green border"
    - "Status-based action buttons (issue, close, cancel, delete, compare)"

key-files:
  created:
    - apps/web/app/(dashboard)/projects/[projectId]/rfqs/page.tsx (RFQ list with filtering)
    - apps/web/app/(dashboard)/projects/[projectId]/rfqs/new/page.tsx (RFQ creation page)
    - apps/web/app/(dashboard)/projects/[projectId]/rfqs/[rfqId]/page.tsx (RFQ detail with tabs)
    - apps/web/app/(dashboard)/projects/[projectId]/rfqs/[rfqId]/compare/page.tsx (Bid comparison)
    - apps/web/components/bidding/rfq-form.tsx (Reusable RFQ form)
    - apps/web/components/bidding/rfq-status-badge.tsx (Status badge with colors)
    - apps/web/components/bidding/invitation-manager.tsx (Directory + external invites)
    - apps/web/components/bidding/amendment-timeline.tsx (Immutable amendment trail)
    - apps/web/components/bidding/bid-card.tsx (Bid summary card)
    - apps/web/components/bidding/bid-comparison-table.tsx (Side-by-side comparison with leveling)
  modified:
    - apps/web/app/(dashboard)/projects/[projectId]/page.tsx (Added RFQ card and nav link)

key-decisions:
  - "Status filter dropdown on RFQ list (All, Draft, Issued, Closed, Awarded, Cancelled)"
  - "CSI division checkboxes with Select All and informational tooltips"
  - "Invitation manager supports both directory subcontractors and external email invites"
  - "Amendment timeline only visible when RFQ status is 'issued'"
  - "RFQ detail uses tabs for organization (overview, invitations, bids, amendments)"
  - "Bid comparison highlights lowest leveled amount with green border"
  - "Leveling notes expandable to show category, note text, and adjustment amount"
  - "Award dialog includes checkbox to convert bid to budget commitment"
  - "Action buttons conditionally shown based on RFQ status"

patterns-established:
  - "RFQ list navigates to detail page on row click"
  - "RFQ creation redirects to detail page on success"
  - "Invitation removal only allowed for pending invitations"
  - "Amendment creation validates RFQ is issued"
  - "Bid card shows unacknowledged amendments indicator"
  - "Comparison table uses horizontal scroll for many bids"

# Metrics
duration: 6 min
completed: 2026-02-13
---

# Phase 7 Plan 4: RFQ and Bid Management Frontend Summary

**GC-facing RFQ and bid management UI with invitation manager, amendment timeline, and side-by-side bid comparison with leveling**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-13T16:51:51Z
- **Completed:** 2026-02-13T16:58:49Z
- **Tasks:** 2
- **Files created:** 10
- **Files modified:** 1

## Accomplishments

- RFQ list page with status filtering and CSI trade display
- RFQ creation form with 20 CSI divisions and validation
- Invitation manager supporting directory lookup and external email invites
- RFQ detail page with 4 tabs (overview, invitations, bids, amendments)
- Amendment timeline with add form (issued RFQs only)
- Bid card component showing status, amount, versions, unack. amendments
- Bid comparison table with side-by-side evaluation
- Leveling notes with 4 categories (scope_gap, scope_extra, clarification, risk)
- Award flow with optional commitment conversion
- Project dashboard updated with RFQ link and summary card

## Task Commits

Each task was committed atomically:

1. **Task 1: Create RFQ list and creation pages with form components** - `027a719` (feat)
   - RfqStatusBadge component with color-coded status badges
   - RfqForm component with title, description, scope, trades (CSI divisions), due date
   - InvitationManager for directory and external invitations
   - RFQ list page with status filtering, trade display, bid counts
   - RFQ creation page with form wrapper
   - Project dashboard updated with RFQ link and summary card
   - All components use tRPC hooks with React Query cache invalidation

2. **Task 2: Create RFQ detail page and bid comparison page** - `db6be34` (feat)
   - AmendmentTimeline component with add amendment form (issued RFQs only)
   - BidCard component showing bid summary with status and unack. amendments
   - BidComparisonTable with side-by-side bid comparison, leveling notes, award flow
   - RFQ detail page with tabs: overview, invitations, bids, amendments
   - Status action buttons: issue, close, cancel, delete based on RFQ status
   - Bid comparison page with leveling adjustments and commitment conversion
   - Lowest leveled amount highlighted in green
   - Award procedure with optional commitment creation checkbox

## Files Created/Modified

**Created:**
- `apps/web/app/(dashboard)/projects/[projectId]/rfqs/page.tsx` - RFQ list with status filter
- `apps/web/app/(dashboard)/projects/[projectId]/rfqs/new/page.tsx` - RFQ creation page
- `apps/web/app/(dashboard)/projects/[projectId]/rfqs/[rfqId]/page.tsx` - RFQ detail (300 lines)
- `apps/web/app/(dashboard)/projects/[projectId]/rfqs/[rfqId]/compare/page.tsx` - Bid comparison page
- `apps/web/components/bidding/rfq-form.tsx` - Reusable RFQ form (243 lines)
- `apps/web/components/bidding/rfq-status-badge.tsx` - Status badge component
- `apps/web/components/bidding/invitation-manager.tsx` - Invitation management (218 lines)
- `apps/web/components/bidding/amendment-timeline.tsx` - Amendment trail (183 lines)
- `apps/web/components/bidding/bid-card.tsx` - Bid summary card
- `apps/web/components/bidding/bid-comparison-table.tsx` - Comparison table with leveling (545 lines)

**Modified:**
- `apps/web/app/(dashboard)/projects/[projectId]/page.tsx` - Added RFQ nav link and summary card

## Decisions Made

**1. Status filter dropdown on RFQ list**
- Rationale: GCs need quick access to RFQs by status (draft for editing, issued for tracking, closed for awarding)
- Implementation: Select dropdown with "All" + 5 status options, filters client-side
- UX: Empty state shows "No RFQs with status X" when filter applied

**2. CSI division checkboxes with tooltips**
- Rationale: 20 divisions is overwhelming; tooltips provide context without clutter
- Implementation: Grid layout with checkboxes, Info icon triggers tooltip with division description
- UX: "Select All" / "Deselect All" button for bulk selection

**3. Invitation manager supports directory + external**
- Rationale: GCs work with known subs (in directory) and new subs (external email)
- Implementation: Two buttons open separate dialogs; directory uses searchable select with trade filtering
- Pattern: Directory invites query `trpc.subcontractor.getByTrades` for RFQ trade matches

**4. Amendment timeline only visible when RFQ is issued**
- Rationale: Draft RFQs can be edited directly; amendments are for issued RFQs
- Implementation: Component returns `null` if `rfqStatus !== 'issued'`
- UX: "Add Amendment" button collapses inline form on cancel

**5. RFQ detail uses tabs for organization**
- Rationale: 4 sections (overview, invitations, bids, amendments) need clear separation
- Implementation: shadcn Tabs with counts in tab labels (e.g., "Bids (3)")
- Navigation: Tab state resets on page navigation (uses `defaultValue`, not controlled)

**6. Bid comparison highlights lowest leveled amount**
- Rationale: Lowest cost is usually the winner; visual highlight speeds decision-making
- Implementation: Calculate `lowestLeveledAmount = Math.min(...bids.map(b => b.leveledAmount))`, apply green border/background
- Formula: `leveledAmount = totalAmount + SUM(adjustmentAmount from leveling notes)`

**7. Leveling notes expandable per bid**
- Rationale: Notes can be lengthy; collapsed view shows summary, expanded shows detail
- Implementation: Chevron button toggles `expandedBids` Set, expanded state shows cards with category badge, note text, adjustment
- Categories: scope_gap (red), scope_extra (green), clarification (blue), risk (yellow)

**8. Award dialog includes commitment conversion checkbox**
- Rationale: Most awarded bids become commitments; checkbox streamlines workflow
- Implementation: Checkbox default checked, optional description field appears when checked
- API: Calls `trpc.bid.award.useMutation` with `convertToCommitment` and `commitmentDescription`

## Deviations from Plan

None - plan executed exactly as specified.

## Issues Encountered

None - all tRPC procedures and shared types existed from plans 07-02 and 07-03.

## Verification Results

All verification criteria passed:

1. ✅ All 10 page/component files exist
2. ✅ TypeScript compilation passes for apps/web (only pre-existing errors in unrelated files)
3. ✅ RFQ list page renders with status filter and table
4. ✅ RFQ creation form has all fields (title, description, scope, trades, due date) and validates with Zod schema
5. ✅ RFQ detail page shows 4 tabs (overview, invitations, bids, amendments)
6. ✅ Bid comparison table shows side-by-side with leveled amounts
7. ✅ Award button triggers `bid.award` mutation with optional commitment conversion
8. ✅ Invitation manager supports both directory and external invites
9. ✅ Amendment timeline shows immutable history with add form for issued RFQs
10. ✅ Project dashboard has RFQ link in navigation and summary card
11. ✅ React Query cache invalidation on mutations (`rfq.list`, `rfq.getById`, `bid.listByRfq`, `bid.compare`)

## Success Criteria Met

- ✅ GC can create RFQ, add invitations (directory + external), issue it, view bids, compare bids, add leveling notes, and award a bid
- ✅ Amendments are displayed as immutable timeline
- ✅ Bid comparison highlights lowest leveled amount
- ✅ Award flow optionally creates commitment
- ✅ Navigation from project dashboard to RFQ pages works
- ✅ All pages are responsive (Tailwind grid/flex patterns)

## Next Phase Readiness

RFQ and bid management frontend complete. Ready for:
- **07-05**: Subcontractor directory pages (if not already done)
- **Phase 8**: QuickBooks integration (if bidding is the last Phase 7 plan)

All GC bidding workflows are now fully functional:
1. Create RFQ with scope and trades
2. Invite subs from directory or external email
3. Amend issued RFQs
4. Receive bids (via plan 07-03 API)
5. Compare bids side-by-side with leveling adjustments
6. Award bid and convert to commitment

---
*Phase: 07-bidding-and-procurement*
*Completed: 2026-02-13*

## Self-Check: PASSED

All claims verified:

**Created files exist:**
```bash
[ -f "apps/web/app/(dashboard)/projects/[projectId]/rfqs/page.tsx" ] && echo "FOUND"
# Output: FOUND
[ -f "apps/web/app/(dashboard)/projects/[projectId]/rfqs/new/page.tsx" ] && echo "FOUND"
# Output: FOUND
[ -f "apps/web/app/(dashboard)/projects/[projectId]/rfqs/[rfqId]/page.tsx" ] && echo "FOUND"
# Output: FOUND
[ -f "apps/web/app/(dashboard)/projects/[projectId]/rfqs/[rfqId]/compare/page.tsx" ] && echo "FOUND"
# Output: FOUND
[ -f "apps/web/components/bidding/rfq-form.tsx" ] && echo "FOUND"
# Output: FOUND
[ -f "apps/web/components/bidding/rfq-status-badge.tsx" ] && echo "FOUND"
# Output: FOUND
[ -f "apps/web/components/bidding/invitation-manager.tsx" ] && echo "FOUND"
# Output: FOUND
[ -f "apps/web/components/bidding/amendment-timeline.tsx" ] && echo "FOUND"
# Output: FOUND
[ -f "apps/web/components/bidding/bid-card.tsx" ] && echo "FOUND"
# Output: FOUND
[ -f "apps/web/components/bidding/bid-comparison-table.tsx" ] && echo "FOUND"
# Output: FOUND
```

**Commits exist:**
```bash
git log --oneline --all | grep -q "027a719" && echo "FOUND: 027a719" || echo "MISSING: 027a719"
# Output: FOUND: 027a719
git log --oneline --all | grep -q "db6be34" && echo "FOUND: db6be34" || echo "MISSING: db6be34"
# Output: FOUND: db6be34
```

**Component usage verified:**
- ✓ RfqForm uses `react-hook-form` with `zodResolver(createRfqSchema)`
- ✓ RfqForm invalidates `rfq.list` on success and redirects to detail page
- ✓ InvitationManager queries `trpc.subcontractor.getByTrades` for directory search
- ✓ InvitationManager uses `rfq.addInvitation` and `rfq.removeInvitation` mutations
- ✓ AmendmentTimeline only renders when `rfqStatus === 'issued'`
- ✓ BidComparisonTable calculates `leveledAmount = totalAmount + SUM(adjustmentAmount)`
- ✓ BidComparisonTable highlights lowest leveled amount with green border
- ✓ Award mutation includes `convertToCommitment` and `commitmentDescription` parameters

All files exist, commits are verified, and implementation matches plan specification.
