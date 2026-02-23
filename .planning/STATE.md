# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.
**Current focus:** v1.6 UX Redesign & Polish — Phase 44: Change Order & Payment App Redesign (plan 03 complete)

## Current Position

Phase: 44 of 46 (Change Order & Payment App Redesign)
Plan: 03 complete
Status: Phase 44 IN PROGRESS — Plan 03 complete
Last activity: 2026-02-23 — Phase 44 Plan 03 complete: CSV export and inline Approve/Mark Paid actions added to PaymentAppList; LIST-04 and LIST-06 satisfied

Progress: v1.0: [██████████] 100% | v1.1: [██████████] 100% | v1.2: [██████████] 100% | v1.3: [██████████] 100% | v1.4: [██████████] 100% | v1.5: [██████████] 100% | v1.6: [██░░░░░░░░] 17%

## Performance Metrics

**Velocity:**
- Total plans completed: 174 (138 through v1.4, +19 in v1.5, +6 in v1.6 Phase 41, +5 in v1.6 Phase 42, +5 in v1.6 Phase 43, +1 in v1.6 Phase 44)
- Average duration: ~4.3 min/plan
- Total execution time: ~11.7 hours

**Recent trend (v1.5-1.6 phases):**
- Phase 38: 8 plans — PDF generation + document naming
- Phase 39: 5 plans (+ inline fixes during UAT)
- Phase 40: 4 plans (+ inline fixes during UAT)
- Phase 41: 6 plans — design token foundation, 56-file CSS migration, VISUAL-03

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
- [42-01]: StatusBadge active variant = GREEN tier (text-financial-positive), same as approved/completed — not brand-blue (text-primary); active/operational states signal positive progress
- [42-01]: Lifecycle domain wrapper components (e.g., estimates/lifecycle/StatusBadge.tsx) eliminated; call sites hold local variant/label maps as module-level constants instead
- [42-02]: BudgetLineItemTable uses TanStack sort with enableSortingRemoval: false — 2-state cycle only (asc/desc, no unsorted after first click)
- [42-02]: SovEditor intentionally omits TanStack sort — row order controlled by up/down mutation buttons; sort would conflict with manual ordering UX
- [42-02]: Sticky table layout uses plain div overflow-auto + max-h-[600px], NOT Radix ScrollArea (confirmed open GitHub issue radix-ui/primitives #2783)
- [42-02]: TableFooter replaces inline totals TableRow inside TableBody — semantic HTML + enables sticky bottom-0 positioning
- [42-02]: option element text uses inline toLocaleString (not CurrencyDisplay) — JSX elements cannot be rendered inside native option text nodes
- [42-04]: No footer on ProjectsTable — user explicitly decided no footer needed for projects list
- [42-04]: ChangeOrderList card-per-row layout fully replaced with TanStack Table — card layout cannot support frozen columns or tabular scanning
- [42-04]: currencyFormatter (Intl.NumberFormat) removed from ChangeOrderList in favor of CurrencyDisplay component
- [42-05]: CommitmentList card-per-row layout fully replaced with TanStack Table — card layout cannot support frozen columns or tabular scanning
- [42-05]: CO line items table: no TanStack sort (no sort UX requirement); sticky layout only — same decision as SovEditor in 42-02
- [42-05]: EstimateLineItemsTable: no TanStack sort — grouped section rendering via lineItemsByDivision is incompatible with getSortedRowModel data flow
- [42-05]: grandTotalCost/grandTotalMargin computed from lineItems prop (not TanStack row model) to preserve correctness with grouped rendering
- [42-05]: Footer colSpan math: GC/Advanced mode (colSpan=5); Simple mode omits CSI Code column (colSpan=4)
- [43-01]: FilterChip interface exported from filter-chips.tsx so caller components can import the type without re-declaring it
- [43-01]: ColumnPicker returns null when no hideable columns — safe to render in any context
- [43-01]: storageKey uses col-picker:{tableKey} prefix to prevent cross-table localStorage key collision
- [43-02]: G703Continuation converted from plain Table to useReactTable to enable column visibility state — plain Table has no column model
- [43-02]: G703 rowIndex for onLineItemChange computed via lineItems.indexOf(item) to preserve original array index semantics
- [43-02]: ProjectsTable isFiltered changed from optional to required — page already passes it; required ensures future consumers cannot omit it
- [43-02]: CommitmentList expand row colSpan uses table.getVisibleLeafColumns().length for dynamic visible column count
- [43-04]: Search input not chipped on Projects/Subcontractors — search box is the UI representation; only secondary filter dimensions (status, customer, assignedUser, dates, trade) become chips
- [43-04]: Customers page has no FilterChips — only a search filter, no secondary filter dimensions to chip
- [43-04]: HardHat replaces Building2 as domain icon for Subcontractors EmptyState — more domain-specific
- [43-05]: EstimatesPage search bar shown conditionally (only when estimates.length > 0) — avoids rendering search on a genuinely-empty page that already shows EmptyState
- [43-05]: RFQs filteredRfqs derivation converted from ternary to useMemo with multi-condition filter — enables debouncedSearch without duplicating filter logic
- [43-05]: RFQs ChevronLeft back-to-project button removed — redundant with sidebar navigation
- [43-03]: Draft row state is separate from TanStack row model — footer totals computed from server array only; draft row excluded by construction (no filtering needed)
- [43-03]: CurrencyInput onKeyDown added to props interface and passed through to underlying Input — required for Enter/Escape keyboard handling in draft rows
- [43-03]: Empty state condition updated to `items.length === 0 && !draftRow` in both components — allows draft row to display on empty table without flicker
- [44-01]: normalizedRole computed once before .map() in both list endpoints — not recalculated per row; matches existing approve/reject mutation pattern
- [44-01]: Empty list guard (length === 0) skips inArray DB call entirely — prevents inArray([]) edge case and avoids unnecessary DB round-trip
- [44-01]: First pending step wins in pendingStepMap — consistent with approve/reject mutation behavior (which uses find(s => s.status === 'pending'))
- [44-03]: Export CSV button placed in left side of filter toolbar alongside status Select — consistent with standard toolbar layout patterns
- [44-03]: canCurrentUserApprove cast via (row.original as any) — field is present at runtime from 44-01 API change but not yet in static ColumnDef type; avoids separate type augmentation
- [44-03]: Mark Paid shows for status===approved with no canCurrentUserApprove check — any user with project access can mark as paid per spec

### Pending Todos

None.

### Blockers/Concerns

- Clerk webhook secret is still placeholder (`whsec_xxx`). Tenant auto-provisioning via webhooks won't work until configured with real secret from Clerk dashboard.

## Session Continuity

Last session: 2026-02-23
Stopped at: Phase 44 Plan 03 complete — CSV export and inline Approve/Mark Paid actions added to PaymentAppList. LIST-04 and LIST-06 satisfied.
Resume file: None
