# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.
**Current focus:** v1.8 complete — all 4 phases shipped (Phases 53-56)

## Current Position

Phase: 56 of 56 (Documents Tab Cleanup)
Plan: 03 complete — Human verification checkpoint passed
Status: Complete — v1.8 shipped
Last activity: 2026-02-25 — Phase 56 complete (all tests passed; PDF inline preview, file type filter, column reorder, filter label fixes committed)

Progress: v1.8: [██████████] 100% (All 4 phases complete — shipped Feb 25, 2026)

## Performance Metrics

**Velocity:**
- Total plans completed: 197
- Average duration: ~4.3 min/plan
- Total execution time: ~11.9 hours

**Recent trend (v1.8 phases):**
- Phase 53: 2 plans complete — 5 new DB columns (customer_budget, building dimensions, sqft), form rewrite (click-to-edit job number, dimensions + budget fields, no legacy sections)
- Phase 54: 3 plans complete — getHeaderStats API extended (profit/margin/budget delta), date pickers in Row 2, stat bar rewrite (Team Members removed, Profit/Margin/Customer Budget added)
- Phase 55 Plan 01: project_notes table + notesRouter (list/create/delete) — API foundation for Overview tab Notes section (~6 min)
- Phase 55 Plan 02: Overview tab complete rewrite — stripped 5 sections, rebuilt Project Details/Team Members/Notes (~8 min)
- Phase 55 Plan 03: Human verification checkpoint — all 5 Overview tab criteria confirmed passing (<1 min)
- Phase 56 Plan 01: document.update mutation (extension-preserving rename, duplicate check, CASL) + Status filter removal from DocumentFilters (~8 min)
- Phase 56 Plan 02: UnifiedDocumentTable rewrite (7 columns, inline edit row, file format badge) + DocumentRowMenu simplification + status removed from page.tsx (~6 min)
- Phase 56 Plan 03: Human verification checkpoint — all DOCS criteria confirmed; checkpoint fixes (column swap, file type filter, PDF inline preview, date filter removal) committed and approved (<5 min)

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
- Phase 55: Trash icon shown on all notes regardless of author — server enforces ownership on delete (simpler client, correct security boundary)
- Phase 55: Overview tab section layout: no Card wrappers, no headings, no dividers — space-y-8 provides all separation
- Phase 56-01: document.update file extension preserved from existing doc name (not user input) — user edits display name only
- Phase 56-01: No audit log on document.update (consistent with Phase 55 notes router precedent)
- Phase 56-02: Inline edit Save/Cancel buttons replace DocumentRowMenu in Actions cell while row is in edit mode
- Phase 56-02: View/Preview and Download kept as separate menu items (both open URL in new tab) for semantic clarity
- Phase 56-02: projectSlug retained in DocumentRowMenu props (renamed _projectSlug) for API stability

### Pending Todos

None.

### Blockers/Concerns

- Clerk webhook secret is still placeholder (`whsec_xxx`). Tenant auto-provisioning via webhooks won't work until configured with real secret from Clerk dashboard.

## Session Continuity

Last session: 2026-02-25
Stopped at: Phase 56 complete — v1.8 shipped
Resume file: None
