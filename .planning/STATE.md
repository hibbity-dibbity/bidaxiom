# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.
**Current focus:** v1.4 Rebranding & UX Upgrades — roadmap defined, ready for Phase 30

## Current Position

Phase: 34 (Live Currency Formatting) — COMPLETE
Plan: 34-05 complete — Human-verified end-to-end confirmation that all 7 currency fields format as $X,XXX.XX on blur; FORM-01 closed
Status: Phase 34 complete. All 5 plans executed (34-01 through 34-05). All 7 currency input fields now format as $X,XXX.XX on blur — user-verified in running app.
Last activity: 2026-02-18 — Quick task 27: grouped company items under "Company" heading in user dropdown

Progress: v1.0: [██████████] 100% | v1.1: [██████████] 100% | v1.2: [██████████] 100% | v1.3: [██████████] 100% | v1.4: [██████░░░░] ~30%

## Performance Metrics

**Velocity:**
- Total plans completed: 112
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
| 33 | 2 | ~4 min | ~2 min |
| 34 | 5 | ~18 min | ~3.6 min |

**Recent Trend:**
- Last 5 plans: 34-05 (~5 min human verify), 34-04 (~5 min), 34-03 (~5 min est), 34-02 (~5 min), 34-01 (~3 min)
- Trend: Phase 34 fully closed — all 5 plans done; all 7 currency fields formatted and user-verified; FORM-01 satisfied

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table (full log, 29 phases).

**v1.4 decisions:**
- 34-04: SOVLineItemCard CurrencyInput onChange fires on blur — all state updates handled inline in onChange; no separate onBlur needed; isCurrency opt-in prop on EditableCell routes unitCost through CurrencyInput while quantity and customMarkupPercent remain plain number inputs
- 34-03: adjustmentAmount optional semantics preserved via n===0 ? undefined : n mapping in onChange — CurrencyInput returns 0 when cleared, maps to undefined for mutation; parseCurrencyInput not needed after refactor
- 34-02: RHF Controller pattern used for CurrencyInput fields — Controller wraps CurrencyInput; field.onChange(n) stores numeric value; valueAsNumber not usable with type=text inputs
- 34-01: CurrencyInput uses type="text" inputMode="decimal" + isFocusedRef; raw number shown on focus, $X,XXX.XX formatted on blur; parseCurrencyInput strips $, commas, whitespace via regex
- 34: FORM-01 changed from live-as-you-type to format-on-blur — live masking (use-mask-input) was tried and reverted; format-on-blur (onBlur handler with Intl.NumberFormat) is the chosen approach
- 33-01: Company selector merged into UserMenu (trpc.organization.list.useQuery + opacity Check icon pattern); CompanySwitcher deleted; top bar simplified to Search → Bell → UserMenu
- 30-01: Used Next.js `title.template` object so child pages inherit "Page | BIDAXIOM" without per-page changes
- 30-01: Removed `SidebarFooter` block entirely (rather than hiding) to avoid dead code
- 30-02: Added metadata at layout level so client-component pages (which cannot export metadata per Next.js 14 rules) still get meaningful BIDAXIOM tab titles through inheritance
- 30-02: Dashboard layout title set to "Dashboard" because all dashboard page.tsx files are "use client" components — per-route titles not achievable without converting them to server components
- 30-03: User prefers plain "BIDAXIOM" in dashboard tabs over "Dashboard | BIDAXIOM" — removed layout-level title, root layout default applies; sign-in retains "Sign In | BIDAXIOM"
- 31-01: Primary action color = cyan-teal (H=188, 80%, 45%/50%) not slate-blue; slate-blue moves to --foreground for body text in light mode; dark mode primary stays vivid L=50% not L=65%; outline buttons need button.tsx update (border-input→border-primary)
- 31-02: Outline button variant uses border-primary text-primary (not border-input text-foreground) so secondary actions display in brand cyan-teal; dual favicon: app/icon.png (file-based auto-detection) + metadata.icons (belt-and-suspenders for PWA/bookmarks)
- 32-01: Card base class: remove tokens entirely (not add rounded-none/shadow-none/border-none) to avoid CSS specificity problems; hover affordance = hover:bg-muted/50 transition-colors (background tint, not shadow) for flat design consistency
- 32-02: Tier B table wrappers deferred (not part of DESIGN-01 scope); chart tooltips and floating overlays intentionally kept rounded (floating UI elements, not card panels); settings Link panels use hover:bg-muted/50 transition-colors to preserve click affordance

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 26 | restore dark/light/system mode toggle to settings/account page | 2026-02-18 | (see git) | [26-restore-dark-light-system-mode-toggle-to](./quick/26-restore-dark-light-system-mode-toggle-to/) |
| 27 | redesign user dropdown layout with grouped company section | 2026-02-18 | (see git) | [27-redesign-user-dropdown-layout-with-group](./quick/27-redesign-user-dropdown-layout-with-group/) |

### Pending Todos

None.

### Blockers/Concerns

- Clerk webhook secret is still placeholder (`whsec_xxx`). Tenant auto-provisioning via webhooks won't work until configured with real secret from Clerk dashboard.

## Session Continuity

Last session: 2026-02-18
Stopped at: Completed 34-05-PLAN.md — FORM-01 satisfied; Phase 34 fully closed
Resume file: None
