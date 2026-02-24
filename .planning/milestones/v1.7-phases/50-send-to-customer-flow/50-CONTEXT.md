# Phase 50: Send-to-Customer Flow - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a "Send to Customer" action to proposal and change order detail pages. The action opens a dialog pre-populated with the customer's contact email, allows adding additional recipients, collects a subject and optional note, and marks the document status as "Submitted" on confirm. No email is actually transmitted. Existing Approve/Reject/Submit buttons are removed from both page types. Orphaned status options are cleaned up.

This phase also aligns the proposal detail page header (and CO detail page header) to the standard layout established in recent phases — this is a prerequisite to correct button placement, not scope creep.

</domain>

<decisions>
## Implementation Decisions

### Button placement
- Both proposal and change order detail page headers must match the standard layout from Phase 46 (sticky compact header pattern)
- Header structure:
  - Line 1: `← Proposal Details` / `← Change Order Details` (back nav)
  - Vertical gap
  - Line 2: `[Document Name]` `[Status Badge]` · · · [3-dot dropdown: Generate PDF, Send to Customer] `[Edit Proposal / Edit Change Order]` button
- "Send to Customer" lives in the 3-dot dropdown alongside "Generate PDF"
- Same placement on both proposal and change order detail pages for consistency

### Dialog design
- Title: "Send to Customer"
- Content (top to bottom):
  1. Document name — view-only display
  2. Recipient email — pre-populated from project customer's primary contact email; user can add additional addresses
  3. Subject line — pre-populated (e.g., "Proposal: [Name]" or "Change Order: [Name]")
  4. Optional note / message field
- Confirm button label: "Send"
- Cancel button: standard "Cancel"

### Status behavior
- Proposals: "Send" transitions status to `"submitted"` (existing status value — no new status needed)
- Button is always visible and clickable regardless of current proposal status
- Re-sendable: sending again is idempotent — status just updates to "submitted" again; no warning needed
- Change orders: Claude researches the CO status machine and applies the equivalent "submitted/sent" status, matching the proposal pattern where possible

### Approval flow removal
- Proposal detail page: Remove Approve, Reject, and Submit buttons entirely — no approval flow remains
- Change order detail page: Remove Approve and Reject buttons entirely
- Status badge / filter cleanup: Remove status options that no longer have an action path (e.g., "approved" status option if the approval action is removed) — Claude assesses which values are safe to remove without breaking existing data

### Claude's Discretion
- Exact dialog component implementation (Radix Dialog, controlled state)
- How to handle CO status mapping (research existing CO status values)
- Which status badge/filter values to clean up (research existing usage before removing)
- Header layout alignment details (read existing proposal/CO detail pages before editing)

</decisions>

<specifics>
## Specific Ideas

- The 3-dot dropdown pattern with "Generate PDF" already exists in some form — Send to Customer should be added there, not as a standalone button
- The proposal detail header "currently does not" match the Phase 46 standard — this must be fixed as part of this phase before button placement can be correct
- No actual email sending — the dialog is a status-transition UI, not an email composer

</specifics>

<deferred>
## Deferred Ideas

- Actual email delivery (sending via SMTP/SendGrid) — out of scope; dialog is purely a status-advance action
- Email history / audit trail of sends — future phase
- Customer portal link included in the send dialog — future phase

</deferred>

---

*Phase: 50-send-to-customer-flow*
*Context gathered: 2026-02-24*
