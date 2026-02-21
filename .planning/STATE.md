# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.
**Current focus:** v1.6 UX Redesign & Polish — Phase 41: Design Foundation (ready to plan)

## Current Position

Phase: 41 of 46 (Design Foundation)
Plan: —
Status: Ready to plan
Last activity: 2026-02-21 — v1.6 roadmap created; 6 phases defined, 27/27 requirements mapped

Progress: v1.0: [██████████] 100% | v1.1: [██████████] 100% | v1.2: [██████████] 100% | v1.3: [██████████] 100% | v1.4: [██████████] 100% | v1.5: [██████████] 100% | v1.6: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 157 (138 through v1.4, +19 in v1.5)
- Average duration: ~4.3 min/plan
- Total execution time: ~11.3 hours

**Recent trend (v1.5 phases):**
- Phase 36: 7 plans — lifecycle state machine + mode system
- Phase 37: 2 plans — project deletion with safeguards
- Phase 38: 8 plans — PDF generation + document naming
- Phase 39: 5 plans (+ inline fixes during UAT)
- Phase 40: 4 plans (+ inline fixes during UAT)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table (40 phases, v1.5 complete).

Recent decisions relevant to v1.6:
- [v1.6 research]: Do NOT use Radix ScrollArea for tables with sticky headers — confirmed open GitHub issue (radix-ui/primitives #2783); use plain `div` with `overflow-auto` and `max-height` instead
- [v1.6 research]: 52 TSX files in apps/web have hardcoded palette color classes without dark: companions — Phase 41 must fix systemically; grep audit required in every PR
- [v1.6 research]: React Hook Form Controller show/hide must use CSS visibility (never conditional JS mounting) — conditional wrapper causes unmount+remount, resetting field values to undefined; useForm<any> in change-order-form.tsx hides this from TypeScript
- [v1.6 research]: project-tabs.tsx uses `<Link href scroll={false}>` for tab navigation — must NOT be replaced with Radix Tabs state; preserves back button, URL sharing, and sectionPrefetchMap prefetch

### Pending Todos

None.

### Blockers/Concerns

- Phase 43 (Budget Domain Redesign) requires `/gsd:research-phase` before planning — TanStack Table `getGroupedRowModel` + `@tanstack/react-virtual` pairing has integration nuances.
- Clerk webhook secret is still placeholder (`whsec_xxx`). Tenant auto-provisioning via webhooks won't work until configured with real secret from Clerk dashboard.

## Session Continuity

Last session: 2026-02-21
Stopped at: v1.6 roadmap created — Phase 41 ready to plan. Next step: `/gsd:plan-phase 41`
Resume file: None
