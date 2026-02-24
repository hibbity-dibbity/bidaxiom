# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.
**Current focus:** v1.7 Project Flow Enhancements — Phase 50: Send to Customer Flow

## Current Position

Phase: 50 of 52 (Send to Customer Flow)
Plan: 04 complete
Status: In progress (4/? plans done for Phase 50)
Last activity: 2026-02-24 — 50-04 complete: rebuilt CO detail header to Phase 46 two-row layout, removed ApprovalPanel entirely, wired SendToCustomerDialog with customerEmail and changeOrder.sendToCustomer mutation, removed orphaned approval filter options from CO list

Progress: v1.0-v1.6: [██████████] 100% | v1.7: [█████░░░░░] 55% (Phase 50 Plan 04 complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 191
- Average duration: ~4.3 min/plan
- Total execution time: ~11.8 hours

**Recent trend (v1.7 phases):**
- Phase 47: 1 plan — sidebar trimmed to 5 nav items
- Phase 48: 2 plans — tab bar trimmed, 4 placeholder pages, mode UI fully removed from 5 files
- Phase 49: 3 plans complete — tab bar reordered, Expenses placeholder, Proposal rename, Change Orders ungated
- Phase 50: 4 plans complete — send email infrastructure (50-01), SendToCustomerDialog component (50-02), proposal detail page header + dialog wiring (50-03), CO detail header rebuild + ApprovalPanel removal (50-04)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table (46 phases, v1.6 complete).

Recent decisions relevant to v1.7:
- [Phase 46]: project-tabs.tsx tab routing uses `<Link href scroll={false}>` — preserve this pattern when redesigning tabs in Phase 49
- [Phase 47]: Removed Bidding, Financials, Documents, Reports nav entries — routes remain on disk
- [Phase 47]: Removed Navigation group heading; SidebarGroup wrapper retained for future use
- [Phase 48]: Removed Budget, SOV, Commitments, Payment Apps, RFQs from ALL_SECTIONS in project-tabs.tsx — gcOnly filter logic and projectMode prop preserved as inert code
- [Phase 48]: Replaced 4 removed tab page.tsx files with Lock icon placeholder pages; original content preserved in git history; route files stay on disk per plan
- [Phase 48]: Placeholder page pattern uses useParams hook (not props) for projectSlug in client components
- [Phase 48-02]: setModeMutation, handleModeSwitch, LienWaiverTracker import retained as dead code — only UI access points removed, not underlying code
- [Phase 48-02]: New projects default to simple mode (projectMode: "simple" in form defaultValues); gc_advanced estimate fallback also changed to simple
- [Phase 49-01]: Proposals tab href stays /estimates to preserve existing routes — only display name changes from "Estimates" to "Proposals"
- [Phase 49-01]: Expenses placeholder uses Receipt icon (not Lock) — future feature pattern, not phase-gated; no toast
- [Phase 49-01]: Added /expenses no-op prefetch handler to sectionPrefetchMap to avoid undefined lookup on new tab
- [Phase 49-02]: Only display strings renamed to Proposal/Proposals; URL paths (/estimates/...), variable names, tRPC procedures, component names, TypeScript types, and CSV filename intentionally unchanged
- [Phase 49-02]: WorkflowSidebar.tsx excluded from rename — confirmed dead UI (commented out in workflow/page.tsx)
- [Phase 49-03]: Removed phaseGated: "change_orders" from tab config only — PHASE_FEATURE_GATES in packages/shared left intact as server-side mutation guard
- [Phase 50-01]: estimates.sendToCustomer uses CASL "manage" action (stronger than submitEstimate's "update") — per plan spec
- [Phase 50-01]: under_contract blocks resend on estimates (terminal status guard); all other statuses idempotently transition to "submitted"
- [Phase 50-01]: changeOrder.sendToCustomer: PCO number assigned once and reused — if (!co.pcoNumber) guard prevents duplicate sequential numbers
- [Phase 50-02]: Pre-population guards check open===true AND field==="" to avoid overwriting user edits on dialog reopen
- [Phase 50-02]: Reset useEffect fires on open===false — dialog always starts clean on next open
- [Phase 50-02]: eslint-disable on pre-population effect dependency array — intentional one-time-on-open behavior
- [Phase 50-03]: estimates list page has no status filter dropdown — accepted/rejected filter cleanup not applicable; documented as not present
- [Phase 50-03]: void recipients/subject/note in onSend callback — mutation takes only estimateId; dialog data is ephemeral per spec
- [Phase 50-04]: CO detail void/delete buttons kept as secondary action row below header — not in 3-dot dropdown (destructive + status-conditional)
- [Phase 50-04]: onSend callback voids recipients/subject/note — changeOrder.sendToCustomer only needs changeOrderId; email delivery metadata deferred to future email layer
- [Phase 50-04]: Orphaned status filter cleanup scoped to change-order-list.tsx (the component); removed pending_approval, approved, rejected from filter dropdown

### Pending Todos

None.

### Blockers/Concerns

- Clerk webhook secret is still placeholder (`whsec_xxx`). Tenant auto-provisioning via webhooks won't work until configured with real secret from Clerk dashboard.

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 50-04-PLAN.md — rebuilt CO detail header to Phase 46 two-row layout, removed ApprovalPanel, wired SendToCustomerDialog with customerEmail, removed orphaned CO status filter options; 3 tasks, 3 commits (870f858, 0dd3560, c74ed29)
Resume file: None
