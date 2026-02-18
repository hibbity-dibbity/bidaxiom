# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.
**Current focus:** v1.4 Rebranding & UX Upgrades — roadmap defined, ready for Phase 30

## Current Position

Phase: 32 (Flat Design System) — COMPLETE
Plan: 32-02 complete — Five Tier A custom div panels patched flat; human verified all pages; zero regressions on interactive elements
Status: Full flat design system applied app-wide. Card primitive flat (Plan 01). All five custom panel files flat (Plan 02). Buttons, inputs, badges, dropdowns unaffected. Phase 32 complete.
Last activity: 2026-02-18 — Plan 32-02 executed; human verification approved

Progress: v1.0: [██████████] 100% | v1.1: [██████████] 100% | v1.2: [██████████] 100% | v1.3: [██████████] 100% | v1.4: [█████░░░░░] ~25%

## Performance Metrics

**Velocity:**
- Total plans completed: 111
- Average duration: 4.3 min
- Total execution time: ~9.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 20 | 3 | 9.9 min | 3.3 min |
| 21 | 2 | 4 min | 2 min |
| 22 | 4 | ~15 min | ~3.8 min |
| 23 | 1 | 5 min | 5 min |
| 24 | 2 | ~6 min | ~3 min |
| 25 | 3 | ~11 min | ~3.7 min |
| 26 | 3 | ~40 min | ~13 min |
| 27 | 3 | ~13 min | ~4.3 min |
| 28 | 3 | ~12 min | ~4 min |
| 29 | 4 | ~10 min + UAT | ~3.3 min (excl. UAT) |
| 30 | 3 | ~12 min | ~4 min |
| 31 | 2 | ~35 min (incl. human review) | ~17.5 min |
| 32 | 2 | ~20 min (incl. human verify) | ~10 min |

**Recent Trend:**
- Last 5 plans: 32-02 (~15 min incl. human verify), 32-01 (~5 min), 31-02 (~15 min), 31-01 (~20 min), 30-03 (~4 min)
- Trend: Phase 32 complete — flat design system applied app-wide in two surgical plans; zero TypeScript errors introduced across either plan

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table (full log, 29 phases).

**v1.4 decisions:**
- 30-01: Used Next.js `title.template` object so child pages inherit "Page | BIDAXIOM" without per-page changes
- 30-01: Removed `SidebarFooter` block entirely (rather than hiding) to avoid dead code
- 30-02: Added metadata at layout level so client-component pages (which cannot export metadata per Next.js 14 rules) still get meaningful BIDAXIOM tab titles through inheritance
- 30-02: Dashboard layout title set to "Dashboard" because all dashboard page.tsx files are "use client" components — per-route titles not achievable without converting them to server components
- 30-03: User prefers plain "BIDAXIOM" in dashboard tabs over "Dashboard | BIDAXIOM" — removed layout-level title, root layout default applies; sign-in retains "Sign In | BIDAXIOM"
- 31-01: Primary action color = cyan-teal (H=188, 80%, 45%/50%) not slate-blue; slate-blue moves to --foreground for body text in light mode; dark mode primary stays vivid L=50% not L=65%; outline buttons need button.tsx update (border-input→border-primary)
- 31-02: Outline button variant uses border-primary text-primary (not border-input text-foreground) so secondary actions display in brand cyan-teal; dual favicon: app/icon.png (file-based auto-detection) + metadata.icons (belt-and-suspenders for PWA/bookmarks)
- 32-01: Card base class: remove tokens entirely (not add rounded-none/shadow-none/border-none) to avoid CSS specificity problems; hover affordance = hover:bg-muted/50 transition-colors (background tint, not shadow) for flat design consistency
- 32-02: Tier B table wrappers deferred (not part of DESIGN-01 scope); chart tooltips and floating overlays intentionally kept rounded (floating UI elements, not card panels); settings Link panels use hover:bg-muted/50 transition-colors to preserve click affordance

### Pending Todos

None.

### Blockers/Concerns

- Clerk webhook secret is still placeholder (`whsec_xxx`). Tenant auto-provisioning via webhooks won't work until configured with real secret from Clerk dashboard.

## Session Continuity

Last session: 2026-02-18
Stopped at: Completed 32-02-PLAN.md — Five Tier A custom panels patched flat; human verification approved; Phase 32 complete
Resume file: None
