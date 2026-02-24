# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.
**Current focus:** v1.7 Project Flow Enhancements — Phase 48: Project Mode Removal

## Current Position

Phase: 48 of 52 (Project Mode Removal)
Plan: 02 complete
Status: In progress (2/2 plans done for Phase 48)
Last activity: 2026-02-24 — 48-02 complete: mode badge, mode-switch menu, Project Mode form field, 5 GC CTA cards, lien waiver tabs, gc_advanced estimate fallback all removed

Progress: v1.0-v1.6: [██████████] 100% | v1.7: [███░░░░░░░] 30% (Phase 48 complete, Phase 49 next)

## Performance Metrics

**Velocity:**
- Total plans completed: 187
- Average duration: ~4.3 min/plan
- Total execution time: ~11.7 hours

**Recent trend (v1.7 phases):**
- Phase 47: 1 plan — sidebar trimmed to 5 nav items
- Phase 48: 2 plans — tab bar trimmed, 4 placeholder pages, mode UI fully removed from 5 files

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

### Pending Todos

None.

### Blockers/Concerns

- Clerk webhook secret is still placeholder (`whsec_xxx`). Tenant auto-provisioning via webhooks won't work until configured with real secret from Clerk dashboard.

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 48-02-PLAN.md — mode UI removed from 5 files, 3 tasks, 3 commits (83c9888, 4333c58, b06fa47)
Resume file: None
