# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.
**Current focus:** v1.5 Project Lifecycle Redesign & Document Engine — Phase 36 Plan 01 complete

## Current Position

Phase: 36 (in progress)
Plan: 01 complete — lifecycle types + schema foundation done
Status: 36-01 complete — shared types and Drizzle schema defined; ready for 36-02 (migration)
Last activity: 2026-02-18 — 36-01 complete: lifecycle enums, constants, Drizzle schema additions

Progress: v1.0: [██████████] 100% | v1.1: [██████████] 100% | v1.2: [██████████] 100% | v1.3: [██████████] 100% | v1.4: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 129 (113 through v1.3, +16 in v1.4)
- Average duration: ~4.3 min/plan
- Total execution time: ~9.9 hours

**By Phase (v1.4):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 30 | 3 | ~12 min | ~4 min |
| 31 | 2 | ~35 min (incl. human review) | ~17.5 min |
| 32 | 2 | ~20 min (incl. human verify) | ~10 min |
| 33 | 2 | ~4 min | ~2 min |
| 34 | 5 | ~18 min | ~3.6 min |
| 35 | 2 | ~7 min | ~3.5 min |

**By Phase (v1.5):**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 36 | 01 | ~2 min | 2 | 3 |

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions logged in PROJECT.md Key Decisions table (full log, 35 phases).
- [Phase 36]: lifecyclePhase defaults to opportunity; projectMode defaults to gc_advanced for backward compat with existing tenants

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 26 | restore dark/light/system mode toggle to settings/account page | 2026-02-18 | (see git) | [26-restore-dark-light-system-mode-toggle-to](./quick/26-restore-dark-light-system-mode-toggle-to/) |
| 27 | redesign user dropdown layout with grouped company section | 2026-02-18 | (see git) | [27-redesign-user-dropdown-layout-with-group](./quick/27-redesign-user-dropdown-layout-with-group/) |
| 28 | primary buttons to slate-blue; round checkboxes with slate-blue checkmark | 2026-02-18 | (see git) | [28-primary-buttons-to-slate-blue-round-chec](./quick/28-primary-buttons-to-slate-blue-round-chec/) |

### Pending Todos

None.

### Blockers/Concerns

- Clerk webhook secret is still placeholder (`whsec_xxx`). Tenant auto-provisioning via webhooks won't work until configured with real secret from Clerk dashboard.

## Session Continuity

Last session: 2026-02-18
Stopped at: Completed 36-01-PLAN.md — lifecycle types and schema foundation (commits c5875d2, 9e9e1cc)
Resume file: None
