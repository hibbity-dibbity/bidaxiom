# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.
**Current focus:** v1.6 UX Redesign & Polish — Phase 41: Design Foundation (in progress)

## Current Position

Phase: 41 of 46 (Design Foundation)
Plan: 06 complete (Group G — estimates workflow, integration cards, shared components, dashboard token migration)
Status: In progress
Last activity: 2026-02-21 — 41-06 complete: 15 files migrated to CSS variable tokens — currency-display, status-badge, estimates workflow steps (01-05), MarginCalculator, SOVBuilder, integration cards, document-uploader, workflow-detail, kpi-card

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
- [41-04]: EAC, ETC, Total Budget primary metric amounts use text-primary (not text-financial-*) — primary metric values get brand teal, not directional financial color
- [41-04]: Recharts Bar fill props left as hex strings (#2563eb, #d97706) — chart library configuration values are not Tailwind classes, no token equivalent applies
- [41-04]: commitment-list statusColors Record replaced by StatusBadge with statusVariants mapping: executed→active, closed→cancelled; type label badge uses variant=draft (neutral)
- [41-06]: System errors (upload fail, sync fail) use text-destructive not text-financial-negative — destructive for actionable system errors, financial-negative for negative financial values only
- [41-06]: Calendar provider icon colors (blue/orange) replaced with text-primary/text-muted-foreground — provider-specific palette colors have no token equivalent
- [41-06]: Workflow approve/reject action buttons use text-financial-positive/negative with border-border — consistent token replacement for colored borders
- [41-06]: Reject dialog button uses bg-destructive pattern not raw bg-red-600 — consistent with other destructive action buttons
- [41-03]: Winning bid highlight in bid-comparison-table uses text-financial-positive on amount text only (not row background) — financial tokens on number text only
- [41-03]: rfq-form.tsx validation errors use text-destructive (form errors, not financial values — different semantic than text-financial-negative)
- [41-03]: Phase lifecycle badge variants follow: opportunity/estimating/submitted→pending, awarded→approved, active/substantial_completion→active, closed→completed, warranty→warning, archived→cancelled
- [41-05]: typeColors bg-amber-500 (internal CO type) replaced with bg-orange-500 — amber falls in the design token audit pattern and must not appear in Group F files
- [41-05]: aging-report-table 31-60 and 61-90 day buckets use text-muted-foreground — severity gradient: current=financial-positive, mid-range=muted-foreground, severely-overdue=financial-negative
- [41-05]: VISUAL-03 pattern — canCurrentUserApprove queried at detail level; dialog state flows down as props to ApprovalPanel; action button triggers live in page headers
- [41-05]: G702Form is now display-only; Submit/Mark Paid mutations lifted to paymentAppId page.tsx

### Pending Todos

None.

### Blockers/Concerns

- Phase 43 (Budget Domain Redesign) requires `/gsd:research-phase` before planning — TanStack Table `getGroupedRowModel` + `@tanstack/react-virtual` pairing has integration nuances.
- Clerk webhook secret is still placeholder (`whsec_xxx`). Tenant auto-provisioning via webhooks won't work until configured with real secret from Clerk dashboard.

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 41-05-PLAN.md — Group F (change order + payment app) token migration + VISUAL-03. All Wave 2 plans complete (41-02 through 41-06).
Resume file: None
