---
phase: 50-send-to-customer-flow
verified: 2026-02-24T08:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 50: Send to Customer Flow — Verification Report

**Phase Goal:** Proposals and change orders can be sent to the customer with a single button click that advances the document status to Sent — no approval workflow required
**Verified:** 2026-02-24
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | estimates.sendToCustomer sets estimate status to "submitted" (idempotent; blocks under_contract) | VERIFIED | `estimates.ts` lines 1121–1171: Drizzle update sets `status: "submitted"`, BAD_REQUEST guard on `under_contract` |
| 2 | changeOrder.sendToCustomer sets CO status to "pco_submitted" and does not duplicate pcoNumber | VERIFIED | `change-order.ts` lines 862–920: PCO reuse guard `if (!pcoNumber)`, then update sets `status: "pco_submitted"` |
| 3 | Both mutations are protected by CASL abilities | VERIFIED | `throwUnlessCan("manage", "Estimate")` at estimates.ts:1138; `throwUnlessCan("manage", "ChangeOrder")` at change-order.ts:879 |
| 4 | A voided change order cannot be sent (BAD_REQUEST) | VERIFIED | change-order.ts lines 894–899: `if (co.status === "void") throw TRPCError BAD_REQUEST` |
| 5 | SendToCustomerDialog renders all four fields with pre-population and reset behavior | VERIFIED | send-to-customer-dialog.tsx: documentName display, recipientInput, subject, note; two useEffects (open/close) |
| 6 | Send button disabled until recipientInput is non-empty | VERIFIED | Line 121: `disabled={isPending \|\| !recipientInput.trim()}` |
| 7 | Proposal detail page has Phase 46 two-row header with 3-dot dropdown containing Generate PDF + Send to Customer | VERIFIED | estimates/[estimateSlug]/page.tsx lines 116–166: back nav row 1, name+badge+DropdownMenu+Edit row 2 |
| 8 | Clicking Send on proposal calls estimates.sendToCustomer and pre-populates email from project.customer.email | VERIFIED | page.tsx line 65: mutation; line 214: `prePopulatedEmail={project?.customer?.email}`; line 215: `prePopulatedSubject={\`Proposal: ${estimate.name}\`}` |
| 9 | NextStepsPanel completely removed from proposal detail page | VERIFIED | grep for "NextStepsPanel" returns no results in estimates/[estimateSlug]/page.tsx |
| 10 | CO detail header matches Phase 46 two-row layout; ApprovalPanel removed entirely | VERIFIED | change-order-detail.tsx lines 192–242: two-row header; grep for "ApprovalPanel" returns nothing |
| 11 | CO detail SendToCustomerDialog pre-populated with customerEmail prop passed from page wrapper | VERIFIED | page.tsx line 25: `customerEmail={project?.customer?.email}`; detail component line 400: `prePopulatedEmail={customerEmail}` |
| 12 | Orphaned CO status filter options (pending_approval/approved/rejected) removed from list filter UI | VERIFIED | change-order-list.tsx SelectContent: only `all`, `draft`, `pco_submitted`, `void` remain |

**Score:** 12/12 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/trpc/routers/estimates.ts` | estimates.sendToCustomer mutation procedure | VERIFIED | Lines 1121–1171; substantive implementation with auth guard, CASL guard, status guard, Drizzle update, returns updated record |
| `apps/api/src/trpc/routers/change-order.ts` | changeOrder.sendToCustomer mutation procedure | VERIFIED | Lines 862–920; auth guard, CASL guard, void guard, PCO reuse, Drizzle update, returns updated record |
| `apps/web/components/shared/send-to-customer-dialog.tsx` | SendToCustomerDialog controlled component | VERIFIED | 129 lines; exports `SendToCustomerDialog`; four form fields, two useEffects, Send/Cancel buttons |
| `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/page.tsx` | Updated proposal detail page with send-to-customer flow | VERIFIED | Contains SendToCustomerDialog, sendToCustomer mutation, DropdownMenu with two items |
| `apps/web/components/change-order/change-order-detail.tsx` | Updated CO detail component with send-to-customer flow | VERIFIED | Contains SendToCustomerDialog, customerEmail prop, sendToCustomer mutation |
| `apps/web/app/(dashboard)/projects/[projectSlug]/change-orders/[changeOrderId]/page.tsx` | CO detail page passing customerEmail prop | VERIFIED | 28 lines; passes `customerEmail={project?.customer?.email}` to ChangeOrderDetail |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| estimates.ts | schema.estimates | Drizzle update setting status "submitted" | VERIFIED | `.update(schema.estimates).set({ status: "submitted" })` at line 1160 |
| change-order.ts | schema.changeOrders | Drizzle update setting status "pco_submitted" | VERIFIED | `.update(schema.changeOrders).set({ status: "pco_submitted" })` at line 907 |
| send-to-customer-dialog.tsx | components/ui/dialog | Dialog/DialogContent/DialogHeader/DialogFooter imports | VERIFIED | Lines 4–10: imports from `@/components/ui/dialog` |
| send-to-customer-dialog.tsx | onSend prop | handleSend callback with parsed recipients | VERIFIED | Lines 61–67: `onSend({ recipients, subject, note })` |
| estimates/[estimateSlug]/page.tsx | send-to-customer-dialog.tsx | SendToCustomerDialog import | VERIFIED | Line 10: `import { SendToCustomerDialog } from "@/components/shared/send-to-customer-dialog"` |
| estimates/[estimateSlug]/page.tsx | trpc.estimates.sendToCustomer | useMutation at line 65 | VERIFIED | `trpc.estimates.sendToCustomer.useMutation(...)` |
| estimates/[estimateSlug]/page.tsx | project?.customer?.email | prePopulatedEmail prop | VERIFIED | Line 214: `prePopulatedEmail={project?.customer?.email}` |
| change-order-detail.tsx | send-to-customer-dialog.tsx | SendToCustomerDialog import | VERIFIED | Line 50: `import { SendToCustomerDialog } from "@/components/shared/send-to-customer-dialog"` |
| change-order-detail.tsx | trpc.changeOrder.sendToCustomer | useMutation at line 126 | VERIFIED | `trpc.changeOrder.sendToCustomer.useMutation(...)` |
| change-orders/[changeOrderId]/page.tsx | change-order-detail.tsx | customerEmail prop | VERIFIED | Line 25: `customerEmail={project?.customer?.email}` passed to ChangeOrderDetail |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FLOW-01 | 50-01, 50-03 | Proposals and COs can be submitted to customer without approval step or workflow | SATISFIED | estimates.sendToCustomer bypasses state machine; NextStepsPanel (approval flow) removed from proposal detail page |
| FLOW-02 | 50-02, 50-04 | Detail pages include "Send to Customer" button opening a dialog with recipient field | SATISFIED | DropdownMenuItem "Send to Customer" opens SendToCustomerDialog with recipientInput field on both proposal and CO detail pages |
| FLOW-03 | 50-01, 50-02, 50-03, 50-04 | Customer's primary contact email auto-pre-populated in Send dialog | SATISFIED | Dialog pre-populated via `project?.customer?.email` on both proposal and CO pages; useEffect guard prevents overwrite of user edits |
| FLOW-04 | 50-01, 50-02, 50-03, 50-04 | Confirming dialog advances document status (no email sent; status update only) | SATISFIED | estimates.sendToCustomer sets `status: "submitted"`; changeOrder.sendToCustomer sets `status: "pco_submitted"`; no email transmission code present |

All four FLOW requirements are accounted for and satisfied. No orphaned requirements found — every FLOW requirement from REQUIREMENTS.md appears in at least one plan's `requirements` field.

---

## Anti-Patterns Found

None. Scan of all six modified/created files found:
- No TODO/FIXME/HACK/PLACEHOLDER comments in implementation code
- No stub return values (`return null`, `return {}`, `return []`)
- No empty handlers
- HTML `placeholder` attributes in input fields are legitimate UX copy, not implementation stubs
- `void subject; void note;` in onSend callbacks is intentional TypeScript unused-variable suppression documented in both 50-03 and 50-04 summaries — the mutation correctly takes only the document ID; dialog data is ephemeral

---

## Human Verification Required

The following behaviors are correct in code but require a running application to confirm:

### 1. Dialog Opens and Pre-Populates on Proposal Page

**Test:** Navigate to a proposal detail page for a project with a customer that has an email set. Click the 3-dot menu, select "Send to Customer."
**Expected:** Dialog opens; recipient email field contains the customer's primary email; subject field contains "Proposal: [proposal name]"
**Why human:** Email pre-population depends on runtime data flow from `trpc.project.getBySlug` returning `customer.email`; cannot verify field contents without live data.

### 2. Status Advances to Submitted After Send

**Test:** Open Send dialog on a draft or submitted proposal. Click Send. Confirm the status badge updates.
**Expected:** Status badge changes to "Submitted"; success toast appears; dialog closes.
**Why human:** Requires live tRPC mutation round-trip and cache invalidation to confirm the UI reflects the updated status.

### 3. CO Send Sets Status to pco_submitted

**Test:** Open Send dialog on a draft change order. Click Send. Observe status badge.
**Expected:** Status badge changes to "PCO Submitted"; PCO number assigned if not previously set; success toast shown.
**Why human:** PCO number assignment requires database round-trip with the counter table; cannot verify without running server.

### 4. Voided CO Cannot Be Sent

**Test:** Attempt to send a voided change order via the dialog.
**Expected:** Error toast appears: "Cannot send a voided change order"
**Why human:** Requires a voided CO record in the database to test the guard path.

### 5. Repeated Sends Do Not Duplicate PCO Number

**Test:** Send the same change order twice.
**Expected:** PCO number is identical on both sends; no duplicate counter increment.
**Why human:** Requires database inspection of `pcoNumber` and `changeOrderCounters` table between sends.

---

## Commit Verification

All 7 phase implementation commits confirmed present in git history:

| Commit | Description |
|--------|-------------|
| `7339bf1` | feat(50-01): add estimates.sendToCustomer mutation |
| `2b92d00` | feat(50-01): add changeOrder.sendToCustomer mutation |
| `d582ce9` | feat(50-02): create SendToCustomerDialog shared component |
| `b01f204` | feat(50-03): restructure proposal detail page header and wire SendToCustomerDialog |
| `870f858` | feat(50-04): restructure CO detail header, remove ApprovalPanel, wire SendToCustomerDialog |
| `0dd3560` | feat(50-04): pass customerEmail prop from CO detail page to ChangeOrderDetail |
| `c74ed29` | feat(50-04): remove orphaned status filter options from CO list page |

---

## Notable Observations (Non-Blocking)

1. **Pre-existing estimates/page.tsx status badge bug (logged by 50-03):** The proposals list page uses a ternary that maps `accepted` and `under_contract` statuses to the `"rejected"` badge variant. This is pre-existing, deferred, and out of scope for phase 50.

2. **Dialog recipients/subject/note not used by current mutation:** The `onSend` callback receives `{ recipients, subject, note }` from SendToCustomerDialog but both proposal and CO mutations use only the document ID. This is architecturally correct — the dialog captures email metadata for a future email-sending layer. The `void` suppressions are explicit and documented.

3. **CO list statusVariantMap retains all six statuses:** `pending_approval`, `approved`, and `rejected` remain in `statusVariantMap` in change-order-list.tsx for historical badge rendering — only the filter SelectItems were removed. This is the correct behavior.

---

## Summary

Phase 50 goal is fully achieved. The "Send to Customer" flow exists end-to-end on both the proposal and change order detail pages:

- A 3-dot dropdown on each detail page header contains "Send to Customer"
- Clicking it opens a dialog pre-populated with the customer's email and a document-specific subject line
- Confirming the dialog calls the appropriate tRPC mutation which advances the document status (proposal → "submitted", CO → "pco_submitted") with no approval workflow involved
- The ApprovalPanel and NextStepsPanel approval-flow UI components have been completely removed
- The CO list filter no longer exposes the three approval-era status options
- No email is transmitted — status update only, matching the FLOW-04 requirement precisely

---

_Verified: 2026-02-24_
_Verifier: Claude (gsd-verifier)_
