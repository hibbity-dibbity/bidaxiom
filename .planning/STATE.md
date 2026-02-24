# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.
**Current focus:** v1.7 Project Flow Enhancements — Phase 49: Project Tabs Redesign

## Current Position

Phase: 49 of 52 (Project Tabs Redesign)
Plan: 01 complete
Status: In progress (1/? plans done for Phase 49)
Last activity: 2026-02-24 — 49-01 complete: tab bar reordered to 6 tabs, "Estimates" renamed to "Proposals", Expenses placeholder page created, breadcrumb labels added for estimates and expenses

Progress: v1.0-v1.6: [██████████] 100% | v1.7: [████░░░░░░] 40% (Phase 49 Plan 01 complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 188
- Average duration: ~4.3 min/plan
- Total execution time: ~11.7 hours

**Recent trend (v1.7 phases):**
- Phase 47: 1 plan — sidebar trimmed to 5 nav items
- Phase 48: 2 plans — tab bar trimmed, 4 placeholder pages, mode UI fully removed from 5 files
- Phase 49: 1 plan complete — tab bar reordered, Proposals rename, Expenses placeholder

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

### Pending Todos

None.

### Blockers/Concerns

- Clerk webhook secret is still placeholder (`whsec_xxx`). Tenant auto-provisioning via webhooks won't work until configured with real secret from Clerk dashboard.

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 49-01-PLAN.md — tab reorder, Proposals rename, Expenses placeholder, breadcrumb labels; 3 tasks, 3 commits (c2603c4, e3088a5, b144cd0)
Resume file: None
