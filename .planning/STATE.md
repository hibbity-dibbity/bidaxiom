# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.
**Current focus:** v1.8 New Project Page Stage 1 — Phase 55 up next

## Current Position

Phase: 55 of 56 (Overview Tab Redesign + Notes)
Plan: 01 complete — Plan 02 up next
Status: In progress
Last activity: 2026-02-25 — Phase 55 Plan 01 complete (project_notes table + notesRouter)

Progress: v1.8: [████░░░░░░] 50% (2/4 phases complete; Phase 55 in progress)

## Performance Metrics

**Velocity:**
- Total plans completed: 194
- Average duration: ~4.3 min/plan
- Total execution time: ~11.8 hours

**Recent trend (v1.8 phases):**
- Phase 53: 2 plans complete — 5 new DB columns (customer_budget, building dimensions, sqft), form rewrite (click-to-edit job number, dimensions + budget fields, no legacy sections)
- Phase 54: 3 plans complete — getHeaderStats API extended (profit/margin/budget delta), date pickers in Row 2, stat bar rewrite (Team Members removed, Profit/Margin/Customer Budget added)
- Phase 55 Plan 01: project_notes table + notesRouter (list/create/delete) — API foundation for Overview tab Notes section (~6 min)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table (52 phases, v1.7 complete).

Recent decisions relevant to v1.8:
- Phase 48: projectMode: "simple" as new project default; existing projects retain gc_advanced
- Phase 49: Expenses placeholder uses Receipt icon (coming soon), not lock icon (upgrade required)
- Phase 46: getHeaderStats runs all 9 sub-queries in Promise.all; contractValue priority chain: accepted estimate + approved COs > project.budget > 0
- Phase 54: projectedProfit = estimateTotal - (directCosts + overheadAmount); margin returned as decimal; customerBudgetDelta = contractValue - customerBudget (positive = over)
- Phase 54: tRPC mutation for date saving is `trpc.project.update` (not `updateProject`)
- Phase 55: Notes use hard delete (no soft delete); author name computed in JS from LEFT JOIN; 500-char limit at Zod layer only

### Pending Todos

None.

### Blockers/Concerns

- Clerk webhook secret is still placeholder (`whsec_xxx`). Tenant auto-provisioning via webhooks won't work until configured with real secret from Clerk dashboard.

## Session Continuity

Last session: 2026-02-25
Stopped at: Completed 55-01-PLAN.md — Notes API foundation done; ready for 55-02 (Overview tab UI)
Resume file: None
