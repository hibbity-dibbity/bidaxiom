# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.
**Current focus:** v1.6 UX Redesign & Polish — Phase 41: Design Foundation (in progress)

## Current Position

Phase: 41 of 46 (Design Foundation)
Plan: 02 complete (auth pages + settings/integrations pages token migration)
Status: In progress
Last activity: 2026-02-21 — 41-02 complete: 11 auth/settings pages migrated to CSS variable tokens (dark mode compliant)

Progress: v1.0: [██████████] 100% | v1.1: [██████████] 100% | v1.2: [██████████] 100% | v1.3: [██████████] 100% | v1.4: [██████████] 100% | v1.5: [██████████] 100% | v1.6: [█░░░░░░░░░] 4%

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
- [41-01]: Financial tokens use flat string format in tailwind.config.ts (no nested object) — no foreground variant needed for these semantic colors
- [41-01]: motion v12 import path is 'motion/react' not 'framer-motion' — documented in COMPONENT-ORGANIZATION.md Canonical Class Recipes
- [41-01]: Dark mode financial tokens use lighter palette steps (400) vs light mode (600) for WCAG contrast on dark backgrounds
- [41-02]: Amber callout (read-only warning) maps to bg-muted + border-border — neutral info surface, not a warning surface
- [41-02]: Success state icons (checkmark, connection confirmed) use text-financial-positive + bg-muted wrapper — replaces bg-green-100/text-green-600 pattern which had no dark: counterpart
- [41-02]: field-mapping-client badge states: mapped fields use bg-muted + text-financial-positive; unmapped use bg-muted + text-foreground — eliminates dark: companion hacks

### Pending Todos

None.

### Blockers/Concerns

- Phase 43 (Budget Domain Redesign) requires `/gsd:research-phase` before planning — TanStack Table `getGroupedRowModel` + `@tanstack/react-virtual` pairing has integration nuances.
- Clerk webhook secret is still placeholder (`whsec_xxx`). Tenant auto-provisioning via webhooks won't work until configured with real secret from Clerk dashboard.

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 41-02-PLAN.md — 11 auth/settings pages token migration. Next step: Continue Wave 2 with 41-03 through 41-06.
Resume file: None
