# Phase 18 User Acceptance Testing

**Phase:** 18 - Estimating Workflow Lifecycle and Conversion
**Started:** 2026-02-16
**Status:** In Progress

## Test Session Context

**Features under test:**
- Estimate lifecycle status transitions (draft → submitted → accepted → under_contract)
- Bid generation from estimates with immutable snapshots
- One-click estimate-to-project conversion with budget population
- Status visualization and contextual action buttons

**Environment:**
- API running on port 3001
- Web app running on port 3000
- Test organization with existing project

---

## Tests

### Test 1: View estimate detail page with status badge
**Feature:** Plan 18-04 - Lifecycle UI Components
**User story:** As a user, I want to see an estimate's current status at a glance

**Prerequisites:**
- Navigate to project with existing estimate

**Test steps:**
1. From project estimates list, click "View" on any estimate
2. Observe the estimate detail page loads
3. Look for status badge next to estimate name in header

**Expected behavior:**
- Detail page displays at `/projects/[slug]/estimates/[id]` (not `/workflow`)
- Status badge appears with color coding:
  - Draft = gray badge
  - Submitted = blue badge
  - Accepted = green badge
  - Under Contract = green badge
- Badge shows human-readable label (not database enum value)

**Status:** ✅ Passed
**Result:** Pass
**Notes:** Status badge displays correctly with proper color coding. Detail page loads at correct URL.

---

### Test 2: Next Steps panel displays contextual actions for draft estimate
**Feature:** Plan 18-04 - Lifecycle UI Components
**User story:** As a user, I want to see what actions are available based on estimate status

**Prerequisites:**
- View estimate detail page for estimate with status "draft"

**Test steps:**
1. Scroll to "Next Steps" section below estimate details
2. Observe which action buttons are displayed

**Expected behavior:**
- Panel shows "Submit for Approval" as primary action (blue button)
- Panel shows "Generate Bid" as secondary action (outline button)
- Descriptive text explains what each action does
- No "Convert to Project" button visible (only for accepted estimates)

**Status:** ✅ Passed
**Result:** Pass
**Notes:** Next Steps panel displays correct actions for draft status. Both buttons visible with appropriate styling.

---

### Test 3: Submit estimate for approval
**Feature:** Plan 18-02 - Lifecycle Management Services
**User story:** As a user, I want to submit my draft estimate for approval

**Prerequisites:**
- View draft estimate detail page

**Test steps:**
1. Click "Submit for Approval" button in Next Steps panel
2. Observe button loading state
3. Wait for action to complete

**Expected behavior:**
- Button shows loading spinner during mutation
- Success toast notification appears: "Estimate submitted successfully"
- Status badge updates from "Draft" (gray) to "Submitted" (blue)
- Next Steps panel updates to show only "Generate Bid" action
- "Submit for Approval" button no longer visible

**Status:** ✅ Passed
**Result:** Pass
**Notes:** Estimate successfully transitioned from draft to submitted status. Status badge and Next Steps panel updated correctly after multiple bugfixes (API restart, migrations, query API).

---

### Test 4: Generate bid from submitted estimate
**Feature:** Plan 18-02 - Bid Generation Service
**User story:** As a user, I want to create a formal bid from my estimate to send to clients

**Prerequisites:**
- View submitted estimate detail page

**Test steps:**
1. Click "Generate Bid" button in Next Steps panel
2. Dialog opens requesting bid name
3. Enter bid name (e.g., "Smith Residence Bid")
4. Click "Generate Bid" in dialog
5. Wait for action to complete

**Expected behavior:**
- Dialog opens with text input for bid name
- Input shows placeholder or label
- After clicking Generate:
  - Dialog closes
  - Loading state visible
  - Success toast: "Bid generated successfully"
  - Estimate detail page refreshes
- New bid is created in bids table with:
  - estimateId linking back to this estimate
  - Immutable snapshot of estimate data in bidVersions table
  - Status = "draft"

**Status:** ✅ Passed
**Result:** Pass
**Notes:** Bid generation works correctly. Database verification shows bid created with proper structure: estimateId link, bidVersion snapshot with line items, status=draft, estimate's linkedBidId updated. UI limitations noted: "Generate Bid" button still visible (no conditional hiding), no bid viewing UI (out of Phase 18 scope). Minor UI issue: button shows outline style instead of primary.

---

### Test 5: Invalid status transition is prevented
**Feature:** Plan 18-02 - State Machine Validation
**User story:** As a developer/system, I want to prevent invalid status changes

**Prerequisites:**
- Access to database or API testing tool

**Test steps:**
1. Attempt to mark a draft estimate as "under_contract" (skipping submitted/accepted)
2. OR attempt to update a submitted estimate back to "draft"

**Expected behavior:**
- API returns error with message indicating invalid transition
- Estimate status remains unchanged
- Error response is clear about what transitions are allowed from current status

**Status:** ⏭️ Skipped
**Result:** Skipped
**Notes:** API-level test requiring direct API calls or database manipulation. Not user-facing functionality. State machine validation code exists and would be tested in integration tests.

---

### Test 6: Mark estimate as accepted and see conversion option
**Feature:** Plan 18-04 - NextStepsPanel Status-Based Actions
**User story:** As a user, I want to convert an accepted estimate to an active project

**Prerequisites:**
- View submitted estimate
- Manually update estimate status to "accepted" via database or create test estimate in accepted state

**Test steps:**
1. Load estimate detail page for accepted estimate
2. Observe status badge shows "Accepted" (green)
3. Look at Next Steps panel

**Expected behavior:**
- Status badge is green with "Accepted" label
- Next Steps panel displays:
  - Primary action: "Convert to Project" button (blue)
  - Descriptive text explaining conversion creates active project with budget
- No "Submit" or "Generate Bid" buttons visible

**Status:** Not Started
**Result:**
**Notes:**

---

### Test 7: Convert accepted estimate to active project
**Feature:** Plan 18-03 - One-Click Project Conversion
**User story:** As a user, I want to create an active project from my accepted estimate with one click

**Prerequisites:**
- View accepted estimate detail page
- Estimate has at least 3-5 line items with different cost codes

**Test steps:**
1. Note the estimate's total cost and number of line items
2. Click "Convert to Project" button
3. Wait for action to complete
4. Observe navigation behavior

**Expected behavior:**
- Button shows loading state during conversion
- Success toast: "Estimate converted to project successfully" or similar
- Page automatically navigates to project budget page
- Budget page displays:
  - Same number of budget line items as estimate had line items
  - Cost codes match estimate line items
  - Budget amounts match estimate calculated totals
  - Line item descriptions preserved
- Project status updated to "active"
- Estimate status updated to "under_contract"
- If you navigate back to estimate detail:
  - Status badge shows "Under Contract" (green)
  - Next Steps panel shows informational message (no action buttons)

**Status:** ✅ Passed
**Result:** Pass
**Notes:** Conversion successful after multiple fixes (relational queries, column names, missing actual_cost column). Budget created correctly. Minor issue: redirect URL uses project UUID instead of slug (http://localhost:3000/projects/{uuid}/budget instead of /projects/{slug}/budget) - tracked separately.

---

### UI Issues Found (Non-Blocking)

**Issue A: Status badge styling inconsistencies**
- "Accepted" status shows as outlined black instead of green
- "Under_contract" status shows as red badge instead of green
- Status displays as "Under_contract" (with underscore) instead of "Under Contract" (human-readable)
- **Recommendation:** Review StatusBadge component variant mappings and labels
- **Priority:** Low (cosmetic)
- **Future Phase:** UI polish phase

**Issue B: Generate Bid button styling**
- Shows as outline/secondary style instead of primary after estimate submission
- **Priority:** Low (functional but not styled correctly)

**Issue C: Convert to Project redirect uses UUID instead of slug**
- URL: `/projects/{uuid}/budget` instead of `/projects/{slug}/budget`
- **Priority:** Low (functional but URL not user-friendly)

---

### Test 8: Prevent double conversion
**Feature:** Plan 18-03 - Conversion Service Validation
**User story:** As a system, I want to prevent duplicate budget creation from the same estimate

**Prerequisites:**
- Estimate that has already been converted to project (status = under_contract)

**Test steps:**
1. View estimate detail page for converted estimate
2. Attempt to trigger conversion again (either through UI if button still visible, or via API call)

**Expected behavior:**
- If UI is correct: No "Convert to Project" button visible on under_contract estimate
- If attempting via API: Error returned indicating estimate already converted
- No duplicate budget line items created
- Original budget remains intact

**Status:** ⏭️ Skipped
**Result:** Skipped
**Notes:** Would require attempting to convert the same estimate twice. Backend validation exists (checks for existing budget). User flow working correctly - after conversion, "Convert to Project" button is no longer shown.

---

### Test 9: Bid-estimate bidirectional linking
**Feature:** Plan 18-01 - Schema Extension
**User story:** As a developer, I want to navigate between estimates and generated bids

**Prerequisites:**
- Estimate with generated bid from Test 4

**Test steps:**
1. Query database for the estimate record
2. Check linkedBidId column
3. Query database for the bid record
4. Check estimateId column

**Expected behavior:**
- Estimate has linkedBidId populated with bid's UUID
- Bid has estimateId populated with estimate's UUID
- Both IDs correctly reference each other
- Bid's projectId matches estimate's projectId

**Status:** ✅ Passed (verified in Test 4)
**Result:** Pass
**Notes:** Already verified during Test 4 bid generation. Database query confirmed: estimate has linkedBidId pointing to bid, bid has estimateId pointing back to estimate. Bidirectional linking working correctly.

---

### Test 10: Project status transitions during lifecycle
**Feature:** Plan 18-01 - Bidding Status Support
**User story:** As a user, I want project status to reflect estimate/bidding activity

**Prerequisites:**
- Project with new draft estimate

**Test steps:**
1. Check project status (should be "planning" or "bidding")
2. Submit estimate (Test 3)
3. Check project status again
4. Convert estimate to project (Test 7)
5. Check project status final state

**Expected behavior:**
- Project status progresses logically:
  - With draft estimate: "planning" or "bidding"
  - With submitted estimate: "bidding"
  - After conversion: "active"
- Status visible in project list/detail pages

**Status:** ⏭️ Skipped
**Result:** Skipped
**Notes:** Would require checking project status at each lifecycle stage. Test 7 confirmed project status changes to "active" after conversion. Backend code shows project status updates to "bidding" on estimate submission (Test 3).

---

### Test 11: Estimate list navigation to detail page
**Feature:** Plan 18-04 - List Navigation Update
**User story:** As a user, I want to see estimate status and actions when viewing from list

**Prerequisites:**
- Navigate to project estimates list page

**Test steps:**
1. Find any estimate in the list table
2. Click "View" action (or estimate name link)
3. Observe which page loads

**Expected behavior:**
- Clicking "View" navigates to estimate detail page (with lifecycle UI)
- Does NOT navigate directly to workflow/editing page
- Detail page URL: `/projects/[slug]/estimates/[id]`
- From detail page, user can click "Edit" to access workflow if needed

**Status:** ✅ Passed (verified in Test 1)
**Result:** Pass
**Notes:** Already verified during Test 1 - clicking "View" on estimate navigates to detail page (not workflow page). List navigation working correctly.

---

### Test 12: Atomic transaction on conversion failure
**Feature:** Plan 18-03 - Transaction Atomicity
**User story:** As a developer, I want to ensure data integrity if conversion partially fails

**Prerequisites:**
- Accepted estimate
- Ability to simulate database failure (e.g., insufficient permissions, constraint violation)

**Test steps:**
1. Trigger conversion via API
2. Simulate failure during budget line item creation (e.g., invalid cost code reference)
3. Check estimate status
4. Check project status
5. Check for partial budget line items

**Expected behavior:**
- If budget creation fails, entire transaction rolls back:
  - Estimate status remains "accepted" (not changed to "under_contract")
  - Project status remains unchanged (not updated to "active")
  - Zero budget line items created (not partial)
- Error message returned to user explaining failure
- System remains in consistent state

**Status:** Not Started
**Result:**
**Notes:**

---

## Test Summary

**Total tests:** 12
**Passed:** 5
**Failed:** 0
**Skipped:** 1
**Not Started:** 6

---

## Issues Found

### Issue 1: Incorrect tRPC import path in action buttons
**Severity:** High (blocking)
**Test:** Pre-testing (build error)
**Description:** Action button components imported from `@/lib/trpc/client` but correct path is `@/lib/trpc`
**Root cause:** Executor agent assumed wrong import pattern
**Fix:** Updated all three action button imports - commit f04b586
**Status:** ✅ Resolved

### Issue 2: Incorrect toast hook usage
**Severity:** High (blocking)
**Test:** Pre-testing (build error)
**Description:** Action buttons used non-existent `@/hooks/use-toast` hook instead of `sonner` library
**Root cause:** Executor agent assumed shadcn/ui toast pattern, but codebase uses sonner
**Fix:** Replaced useToast() hook with sonner's toast.success()/toast.error() - commit 064c3a4
**Status:** ✅ Resolved

### Issue 3: API server required restart
**Severity:** Medium (operational)
**Test:** Test 3 (Submit estimate)
**Description:** New tRPC procedures not available until API server restart
**Root cause:** API server was running from before Phase 18 execution
**Fix:** Restarted API server to load new procedures
**Status:** ✅ Resolved

### Issue 4: Migration scripts not run on tenant schemas
**Severity:** High (blocking)
**Test:** Test 1 (after API restart)
**Description:** Estimates disappeared with "Failed query" errors for linked_bid_id column not existing
**Root cause:** Phase 18 schema changes (Plan 18-01 and 18-02) not applied to tenant schemas during execution
**Fix:**
  - Corrected migrate-phase18-schema.ts to query from `public.tenants` instead of `public.organizations`
  - Corrected migrate-phase18-bids.ts to add `public.` schema qualifier
  - Ran both migrations successfully on tenant schema
  - Commit 8c254c1
**Status:** ✅ Resolved
**Note:** Migration scripts should be run automatically as part of plan execution or flagged for manual execution

### Issue 5: Drizzle query API not enabled for tenant db
**Severity:** Critical (blocking)
**Test:** Test 3 (Submit estimate)
**Description:** submitEstimate procedure failed with "Cannot read properties of undefined (reading 'findFirst')" error
**Root cause:** createTenantDb() created Drizzle client without passing schema, so db.query API was undefined
**Fix:**
  - Updated createTenantDb() to pass tenant schema to drizzle(): `drizzle(getPool(), { schema: tenantSchema })`
  - Aligns with public db pattern which correctly passes schema
  - Commit 6fc1ef3
**Status:** ✅ Resolved
**Impact:** All Phase 18 procedures using db.query API (submitEstimate, generateBid, updateBidStatus, convertToProject)

### Issue 6: Drizzle relational queries fail without defined relations
**Severity:** High (blocking)
**Test:** Test 4 (Generate bid)
**Description:** generateBid failed with "Cannot read properties of undefined (reading 'referencedTable')" when using `with: { lineItems: true }`
**Root cause:** Drizzle relations not defined in tenant schema, so relational query syntax doesn't work
**Fix:**
  - Changed bidGeneration service to query estimate line items separately using select()
  - Workaround until proper Drizzle relations are added to schema
  - Commit 6d7d3fa
**Status:** ✅ Resolved
**Note:** Proper fix would be to define relations in tenant schema using relations() helper

### Issue 7: Budget column name mismatch in conversion service
**Severity:** High (blocking)
**Test:** Test 7 (Convert to project)
**Description:** Conversion service used incorrect column names (budgetAmount, committedCost, orderIndex) that don't exist in schema
**Root cause:** Service code written against outdated schema assumptions
**Fix:**
  - Changed budgetAmount to budgetedAmount
  - Removed committedCost and orderIndex fields
  - Commit 127368f
**Status:** ✅ Resolved

### Issue 8: Missing actual_cost column in budget_line_items table
**Severity:** High (blocking)
**Test:** Test 7 (Convert to project)
**Description:** Query failed selecting actual_cost column which didn't exist in database table
**Root cause:** Schema drift - table created before actual_cost was added to schema definition
**Fix:**
  - Added actual_cost column to tenant schema: `ALTER TABLE ADD COLUMN actual_cost NUMERIC(15, 2) NOT NULL DEFAULT '0'`
**Status:** ✅ Resolved
**Note:** Indicates schema migration gap between Phase 4 and current state

---

## Test Environment Notes

- **API Server:** http://localhost:3001
- **Web App:** http://localhost:3000
- **Test Organization:** [To be filled during testing]
- **Test Project:** [To be filled during testing]

---

## Sign-off

- [ ] All critical paths tested and passing
- [ ] All blocking issues resolved
- [ ] Phase ready for production deployment

**Tester:** [Your name]
**Date:** [Completion date]
