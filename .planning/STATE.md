# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.
**Current focus:** v1.7 Project Flow Enhancements — Phase 50: Send to Customer Flow

## Current Position

Phase: 50 of 52 (Send to Customer Flow)
Plan: 02 complete
Status: In progress (2/? plans done for Phase 50)
Last activity: 2026-02-24 — 50-02 complete: created SendToCustomerDialog shared component — controlled Radix dialog with four fields, pre-population on open, reset on close

Progress: v1.0-v1.6: [██████████] 100% | v1.7: [████░░░░░░] 45% (Phase 50 Plan 02 complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 189
- Average duration: ~4.3 min/plan
- Total execution time: ~11.7 hours

**Recent trend (v1.7 phases):**
- Phase 47: 1 plan — sidebar trimmed to 5 nav items
- Phase 48: 2 plans — tab bar trimmed, 4 placeholder pages, mode UI fully removed from 5 files
- Phase 49: 3 plans complete — tab bar reordered, Expenses placeholder, Proposal rename, Change Orders ungated
- Phase 50: 2 plans complete — send email infrastructure (50-01), SendToCustomerDialog component (50-02)

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
- [Phase 50-02]: Pre-population guards check open===true AND field==="" to avoid overwriting user edits on dialog reopen
- [Phase 50-02]: Reset useEffect fires on open===false — dialog always starts clean on next open
- [Phase 50-02]: eslint-disable on pre-population effect dependency array — intentional one-time-on-open behavior

### Pending Todos

None.

### Blockers/Concerns

- Clerk webhook secret is still placeholder (`whsec_xxx`). Tenant auto-provisioning via webhooks won't work until configured with real secret from Clerk dashboard.

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 50-02-PLAN.md — created SendToCustomerDialog shared component; 1 task, 1 commit (d582ce9)
Resume file: None
