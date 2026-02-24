---
phase: 50-send-to-customer-flow
plan: "03"
subsystem: ui
tags: [react, proposal, header, dropdown, dialog, trpc, mutation]
dependency_graph:
  requires:
    - 50-01 (estimates.sendToCustomer mutation)
    - 50-02 (SendToCustomerDialog component)
  provides:
    - Updated proposal detail page with Phase 46 two-row header
    - Send to Customer flow wired end-to-end on proposal detail page
    - NextStepsPanel removed
  affects:
    - apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/page.tsx
tech_stack:
  added: []
  patterns:
    - Phase 46 two-row detail page header (back nav row + name/badge/actions row)
    - 3-dot DropdownMenu with Generate PDF and Send to Customer items
    - Controlled dialog opened from dropdown; mutation fired on Send
key_files:
  created: []
  modified:
    - apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/page.tsx
decisions:
  - "handleGeneratePdf function extracts generateProposalMutation.mutate call — clean separation from dropdown onClick handler"
  - "estimates list page has no status filter dropdown — no accepted/rejected filter options to remove; documented as not present"
  - "Pre-existing bug in estimates/page.tsx status badge ternary (under_contract falls to rejected variant) logged to deferred-items — out of scope for this plan"
  - "void recipients, void subject, void note in onSend callback — mutation takes only estimateId per API spec; dialog data is ephemeral"
metrics:
  duration_minutes: 2
  completed_date: 2026-02-24
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
---

# Phase 50 Plan 03: Proposal Detail Page Header Restructure Summary

**Rebuilt proposal detail page header to Phase 46 two-row layout, removed NextStepsPanel, and wired SendToCustomerDialog with pre-populated email and subject via the estimates.sendToCustomer mutation**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-24T06:49:06Z
- **Completed:** 2026-02-24T06:51:09Z
- **Tasks:** 2 (1 file change + 1 investigation/no-op)
- **Files modified:** 1

## Accomplishments

- Rebuilt proposal detail page header from flat single-row to Phase 46 standard two-row layout
- Row 1: ghost back-nav button ("Back to Proposals") linking to `/projects/[slug]/estimates`
- Row 2: `h1` estimate name + StatusBadge on left; 3-dot DropdownMenu + Edit Proposal button on right
- 3-dot menu contains "Generate PDF" (calls generateProposalMutation with Loader2 spinner when pending) and "Send to Customer" (opens dialog)
- SendToCustomerDialog wired with `project?.customer?.email` as `prePopulatedEmail` and `"Proposal: [estimate.name]"` as `prePopulatedSubject`
- `sendToCustomerMutation` fires on Send, invalidates `estimates.getBySlug`, shows success toast, closes dialog
- Removed `NextStepsPanel` import and JSX completely (was the only approval-flow item on the page)
- Confirmed proposals list page has no status filter dropdown — no accepted/rejected filter cleanup needed

## Task Commits

Each task was committed atomically:

1. **Task 1: Restructure proposal detail page header and remove approval flow** - `b01f204` (feat)
2. **Task 2: Remove orphaned status filter options** - No commit (no changes needed; filter does not exist on page)

## Files Created/Modified

- `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/page.tsx` — Phase 46 header, 3-dot dropdown, SendToCustomerDialog, sendToCustomer mutation; NextStepsPanel removed

## Decisions Made

1. **handleGeneratePdf function:** Extracted `generateProposalMutation.mutate(...)` into a named `handleGeneratePdf` function rather than inlining in the dropdown onClick. Keeps the dropdown handler clean and mirrors the pattern used in project-header.tsx.

2. **No filter to clean up:** The proposals list page (`estimates/page.tsx`) has a name search input only — no status filter dropdown exists. The plan's instructions say "make no changes and document that finding" — done.

3. **void ephemeral dialog data:** The `onSend` callback receives `{ recipients, subject, note }` from the dialog, but the mutation only takes `{ estimateId }`. Used `void recipients; void subject; void note;` to satisfy TypeScript's no-unused-vars rule while making the intentional discard explicit.

4. **generateProposalMutation in dropdown:** The existing "Generate Proposal PDF" button was a standalone button in the old header. It's now a `DropdownMenuItem` in the 3-dot menu with a disabled state while pending and a Loader2 spinner.

## Deviations from Plan

### Pre-existing Issue Discovered

**Pre-existing bug in estimates/page.tsx status badge ternary**
- **Found during:** Task 2 investigation
- **Issue:** The inline status badge ternary in the proposals list table uses `"rejected"` as a catch-all fallback, meaning `accepted` and `under_contract` statuses both render as "rejected" variant (orange/red). The correct variants would be `"approved"` for `accepted` and `"active"` for `under_contract`.
- **Action:** Logged to deferred-items — this is pre-existing and out of scope for this plan
- **Scope note:** Fixing this would require editing `estimates/page.tsx` beyond the plan's stated task

### No Other Deviations

All plan instructions executed exactly as written.

## Issues Encountered

None. All pre-existing TypeScript errors are in `customers/` pages and `api/` files — zero new errors introduced by this plan.

## User Setup Required

None.

## Next Phase Readiness

- Plan 04 will wire SendToCustomerDialog on the change order detail page using the same pattern established here
- `changeOrder.sendToCustomer` mutation already exists (50-01)
- `SendToCustomerDialog` component already exists (50-02)
- Pattern: import dialog, add `sendDialogOpen` state, add mutation with invalidation, add 3-dot dropdown to header, add dialog at bottom of JSX

---
*Phase: 50-send-to-customer-flow*
*Completed: 2026-02-24*
