# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.
**Current focus:** v1.5 Project Lifecycle Redesign & Document Engine — Phase 36 Plan 05 complete

## Current Position

Phase: 36 (in progress)
Plan: 05 complete — project list phase badge + project creation mode dropdown
Status: 36-05 complete — lifecycle phase badge in project list table; Project Mode dropdown in creation form; all Phase 36 UI surfaces complete
Last activity: 2026-02-19 — 36-05 complete: project list phase column + creation form mode dropdown (commits dc6a031, 78ae6ad)

Progress: v1.0: [██████████] 100% | v1.1: [██████████] 100% | v1.2: [██████████] 100% | v1.3: [██████████] 100% | v1.4: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 133 (113 through v1.3, +16 in v1.4, +4 in v1.5 so far)
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
| 36 | 02 | ~2 min | 2 | 3 |
| 36 | 03 | ~8 min | 2 | 3 |
| 36 | 04 | ~4 min | 2 | 5 |
| 36 | 05 | ~3 min | 2 | 3 |

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions logged in PROJECT.md Key Decisions table (full log, 35 phases).
- [Phase 36]: lifecyclePhase defaults to opportunity; projectMode defaults to gc_advanced for backward compat with existing tenants
- [Phase 36-02]: isValidTransition uses index-based comparison (LIFECYCLE_ORDER.indexOf) for O(1) ordinal arithmetic
- [Phase 36-02]: tryAutoAdvance silently returns (no throw) when project is already at or past target phase
- [Phase 36-02]: LIFECYCLE_ORDER and LifecyclePhase were not exported from @construction/shared index — fixed as Rule 3 deviation
- [Phase 36-03]: setMode has no lifecyclePhase guard — mode changes allowed at any project phase
- [Phase 36-03]: tryAutoAdvance placed after create audit log; silently no-ops if project not in preceding phase
- [Phase 36]: canTransition client-side guard uses orgRole===org:admin OR project team estimator/project_administrator; API enforces full RBAC regardless
- [Phase 36-05]: Read-only phase badge in project list uses inline Badge + phaseColors (not LifecyclePhaseBadge) — keeps list column cell minimal and server-friendly
- [Phase 36-05]: projectMode defaults to gc_advanced in form defaultValues; explicit form value takes precedence over server's user-preference fallback

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

Last session: 2026-02-19
Stopped at: Completed 36-05-PLAN.md — project list phase badge + creation form mode dropdown (commits dc6a031, 78ae6ad)
Resume file: None
