# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.
**Current focus:** v1.7 Project Flow Enhancements — Phase 47: Sidebar Cleanup

## Current Position

Phase: 47 of 52 (Sidebar Cleanup)
Plan: —
Status: Ready to plan
Last activity: 2026-02-23 — v1.7 roadmap created (6 phases, 20 requirements mapped, Phases 47-52)

Progress: v1.0-v1.6: [██████████] 100% | v1.7: [░░░░░░░░░░] 0% (Phase 47 next)

## Performance Metrics

**Velocity:**
- Total plans completed: 185
- Average duration: ~4.3 min/plan
- Total execution time: ~11.7 hours

**Recent trend (v1.6 phases):**
- Phase 43: 5 plans — ColumnPicker, draft rows, FilterChips, EmptyState
- Phase 44: 5 plans — inline approvals, CSV export
- Phase 45: 4 plans — stepper bar, currency masking
- Phase 46: 4 plans — sticky header, financial stat bar, tab badges

*Updated after each plan completion*

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table (46 phases, v1.6 complete).

Recent decisions relevant to v1.7:
- [Phase 46]: project-tabs.tsx tab routing uses `<Link href scroll={false}>` — preserve this pattern when redesigning tabs in Phase 49
- [Phase 46]: Mode switch DropdownMenuItem in ellipsis menu — this entire control is removed in Phase 48
- [Phase 36]: lifecyclePhase defaults to opportunity; projectMode defaults to gc_advanced for existing tenants — Phase 48 hides mode UI but preserves underlying data

### Pending Todos

None.

### Blockers/Concerns

- Clerk webhook secret is still placeholder (`whsec_xxx`). Tenant auto-provisioning via webhooks won't work until configured with real secret from Clerk dashboard.
- Phase 48 must NOT delete GC/Advanced mode data or code — only hide UI access points. Verify this constraint during planning.

## Session Continuity

Last session: 2026-02-23
Stopped at: v1.7 roadmap created — 6 phases (47-52), 20/20 requirements mapped. Phase 47 ready to plan.
Resume file: None
