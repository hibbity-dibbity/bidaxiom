# Research Summary: BIDAXIOM v1.6 UX Redesign

**Project:** BIDAXIOM — Construction Management SaaS
**Milestone:** v1.6 — Procore-Level Density and Polish
**Domain:** Dense enterprise construction SaaS UI — financial data tables, approval workflow UI, project navigation, complex forms
**Researched:** 2026-02-21
**Synthesized:** 2026-02-21
**Overall Confidence:** HIGH

---

## Executive Summary

BIDAXIOM already has the right technical foundation for Procore-level density. The stack — TanStack Table v8, shadcn/ui, Tailwind with CSS variable tokens, React Hook Form, CVA — is mature and correctly wired. This redesign does not require replacing any component library or making backend changes. Only three new npm packages are needed (`@tanstack/react-virtual`, `motion`, `react-number-format`). The gap between the current state and Procore-level polish is a CSS discipline, density configuration, and interaction pattern problem — not a technology problem.

The recommended approach is a strict layered build order: token foundation first, shared UI primitives second, shared domain components third, domain-by-domain page redesigns fourth, and layout and navigation chrome last. This order is non-negotiable because CSS tokens propagate everywhere, primitives underpin domain components, and the project header and tabs are shared across all 10 project tabs. Attempting page-level redesigns before the foundation is stable forces rework. Each phase must target a single rendering surface and be independently verifiable — the biggest risk is scope creep, which stalls phases in a 164K-line, 40-phase codebase.

The central risk is dark mode regression. Direct codebase inspection found 52 TSX files with hardcoded Tailwind palette classes (e.g., `bg-amber-50`, `text-slate-600`) that bypass the CSS variable token system and break dark mode. Every redesign phase introduces temptation to add more. This must be addressed by a non-negotiable rule established in Phase 1: no background or text palette class without a paired `dark:` companion. The second risk is form state regression — React Hook Form Controllers are sensitive to conditional wrapper remounting, and the existing `useForm<any>` cast in the change order form hides these bugs from TypeScript. Every phase that touches a form-containing page must include a full form submission test verified in the Network tab.

---

## Key Findings

### Recommended Stack

See full analysis: `.planning/research/STACK.md`

The existing stack is complete for this redesign. Only three packages need to be added to `apps/web/`:

**Additions required:**
- `@tanstack/react-virtual` v3.13.18 — row virtualization for tables with 100+ rows. Pairs directly with the already-installed `@tanstack/react-table` v8; stays in-family. The TanStack official docs include a virtualized rows example using this exact combination.
- `motion` v12.34.3 — spring-physics animations for sidebar collapse, panel expansions, and row height transitions. Formerly Framer Motion; rebranded in late 2024. MIT licensed. All animated components require `"use client"` directive — a non-issue for interactive UI components.
- `react-number-format` v5.4.4 — currency and percentage masked inputs. The installed `use-mask-input` handles phone/date character patterns but not numeric formatting semantics (currency prefix, decimal precision, thousands separators). Wrap in `<Controller>` for React Hook Form integration.

**Already installed, just needs correct use:**
- `react-resizable-panels` v4.6.4 — already backs shadcn `Resizable`; enables Procore-style master-detail split-pane layouts. Verify installation with `npm ls react-resizable-panels` in `apps/web/` before Phase 4.
- `@radix-ui/react-scroll-area` — already in `package.json`. Critical note: do NOT use Radix ScrollArea for tables with sticky headers. It uses `display: table` internally and breaks `position: sticky` (confirmed open GitHub issue radix-ui/primitives #2783). Use a plain `div` with `overflow-auto` and a `max-height` constraint instead.

**Density is achieved through Tailwind class conventions, not new libraries:**
- Compact rows: `h-8 py-1 text-xs` (32px target)
- Default rows: `h-10 py-2 text-sm` (40px target)
- Table headers: `text-[11px] font-semibold uppercase tracking-wider`
- All financial cells: `text-right tabular-nums`

**Do not add:** AG Grid, react-virtuoso, react-data-grid, MUI, any CSS-in-JS library, or `styled-components`. Do not migrate to Tailwind v4 during this milestone — the existing v3.4.x CSS variable system is stable and correct; mixing a v4 migration into a UX redesign doubles the risk surface.

### Expected Features

See full analysis: `.planning/research/FEATURES-UX-REDESIGN.md`

**Must have (table stakes — construction professionals expect these; their absence makes the product feel unfinished):**
- Sticky frozen table headers on all scrollable financial tables
- Frozen first column on wide tables (budget, SOV) — cost code stays visible while scrolling right
- Right-aligned, tabular-nums currency values with $ prefix on all financial columns
- Semantic status badges across all surfaces: gray=draft, amber=pending, green=approved, red=rejected
- Sort by any column header (click to toggle asc/desc/none with chevron indicator)
- Sticky totals/summary footer row on all financial tables
- Inline search bar above every list view
- Filter chips pattern on all list views — removable pills showing active filters with "Clear all"
- Empty states with actionable CTA on all list views (never a blank screen)
- Approval action buttons prominent on CO and pay app detail pages — never buried in dropdown menus
- Compact sticky project header: name, status badge, job number, financial stat bar, tabs

**Should have (differentiators that elevate from baseline to best-in-class):**
- Column picker (show/hide columns) on financial tables and list views
- Row density control (compact/default toggle) on financial tables
- Side panel for row detail — replaces disorienting full-page modals; keeps table visible
- Bulk action floating bar when rows selected
- Inline row addition for SOV and CO line item tables — no modal disruption
- Tab count badges on project navigation tabs for action items ("Change Orders (3)")
- Financial health indicator in project header — single green/amber/red signal for budget variance
- Keyboard navigation in budget table and SOV builder
- Export CSV from all list views
- Inline approve/reject quick action on CO list rows

**Defer to v2+ (higher complexity, lower immediate impact):**
- User-controlled column pinning (drag-to-pin)
- Saved filter views ("My Pending Approvals")
- Snapshot comparison view in budget table
- Multi-select and copy-values across budget rows
- CSV/spreadsheet import for SOV

**Anti-features to explicitly avoid:**
- Modals for row detail — kills table context; use side panel instead
- Infinite scroll on list views — use pagination; virtual scroll only for spreadsheet tables
- Auto-advance approval status based on rules — creates financial and contractual liability
- Real-time collaboration cursors on financial data — concurrent edits cause data conflicts
- Dashboard widget customization grid — saved filters and column picker give 90% of the value at 10% of the complexity
- Zebra striping combined with hover and selected states — three gray states conflict visually

### Architecture Approach

See full analysis: `.planning/research/ARCHITECTURE-UX-REDESIGN.md`

The codebase uses a correct three-layer CSS architecture: semantic CSS variables in `globals.css`, token-to-utility mapping in `tailwind.config.ts`, and component class composition via CVA and `cn()`. The redesign must preserve this separation and never skip layers. The token system is the redesign's greatest structural asset — changing a token in `:root` and `.dark` simultaneously propagates the change to every component using it, with zero React re-renders.

**The five-layer dependency chain defines the required build order:**
1. Token layer (`globals.css` + `tailwind.config.ts`) — changes propagate everywhere; must be right first
2. Shared UI primitives (`components/ui/`) — `table.tsx`, `badge.tsx`, `card.tsx`, `button.tsx` — propagate to all domain components
3. Shared domain components (`components/shared/`) — `status-badge.tsx`, `currency-display.tsx` — used 14+ and 6+ places respectively
4. Domain components, one domain per PR — Budget first (most tables and most violations); then Change Orders and Pay Apps; then Estimates
5. Layout and navigation (`project-header.tsx`, `project-tabs.tsx`) — last; highest regression cost if broken early

**TanStack Table has two distinct modes in this codebase:**
- Display grids (document list, project list, CO list): read-only, compact density, sort headers — `unified-document-table.tsx` is the reference implementation
- Inline-edit spreadsheets (estimate line items, SOV builder): cell-level editing, keyboard tab navigation — `EstimateLineItemsTable.tsx` is the reference

Both already use `@tanstack/react-table` v8. The redesign configures them; it does not replace them.

**Known hardcoded color violations to fix (verified from codebase):**
- `budget-summary-cards.tsx`: `text-blue-600`, `text-amber-600`, `text-slate-600`
- `budget-line-item-table.tsx`: `text-red-600`, `text-green-600` on lock icons
- `project-header.tsx`: `bg-slate-500/10 text-slate-600 border-slate-200` on mode badge; `bg-amber-50 text-amber-800` on restored-project banner
- `estimates/lifecycle/StatusBadge.tsx`: duplicate of `components/shared/status-badge.tsx` — consolidate

**Do not extract prematurely:** `EstimateLineItemsTable`, `SOVBuilder`, `BudgetVarianceChart`, and `WorkflowDetail` must stay in their domain folders — too domain-specific to share. A generic `DataTable` shell in `components/shared/` is only warranted if Budget, CO, and Pay Apps share the exact same chrome — audit before extracting.

### Critical Pitfalls

See full analysis: `.planning/research/PITFALLS-UX-REDESIGN.md`

1. **Over-scoping phases stalls the milestone** — UX surfaces feel visually connected, creating pressure to change everything at once. A phase plan touching more than one rendering surface is a red flag. Hard limit: if a plan has more than 8 atomic tasks, split it. Each phase must have a UAT checklist completable without any other phase being merged first.

2. **Dark mode breakage from hardcoded palette classes** — 52 files in `apps/web/` already have this debt. Every new `bg-amber-`, `bg-white`, `bg-gray-`, or `bg-slate-` class without a `dark:` companion is a regression. Lock the rule in Phase 1 and enforce via grep in every PR review.

3. **Form state regression from layout changes** — Adding a conditionally-rendered wrapper (`{condition && <Wrapper>}`) around a React Hook Form `<Controller>` causes unmount and remount, resetting field values to `undefined`. The `useForm<any>` cast in `change-order-form.tsx` hides this from TypeScript — it only surfaces as a missing field in the Network tab payload. Rule: use CSS visibility (`hidden` / `opacity-0 pointer-events-none`) to show/hide form sections, never conditional JS mounting around controllers. Every form-touching phase must include a full-submission UAT step verified in the Network tab.

4. **Replacing URL-based tabs with Radix state tabs** — `project-tabs.tsx` uses `<Link href scroll={false}>` for tab navigation, enabling browser back button, URL sharing, and the hover-prefetch system (`sectionPrefetchMap`). Switching to Radix `<Tabs>` with React state breaks all three. Reserve Radix Tabs for in-page sub-sections only. Document this rule before any phase touches `project-tabs.tsx`.

5. **Stale shared component APIs** — `CurrencyDisplay` is referenced in 14+ places, `StatusBadge` in 6+. Any prop change must be preceded by a full grep of call sites. Always prefer additive API changes (new optional prop with a safe default) over breaking changes. The `variant` prop on `StatusBadge` must be typed as a string union, not `string`, so renames are compile errors.

6. **Tailwind class explosion and design drift across phases** — Each phase author without a defined recipe picks their own `py-` and `text-` values, producing tables with subtly different row heights on adjacent project tabs. Establish canonical class recipes in `COMPONENT-ORGANIZATION.md` before any page-level phase begins. Key canonicals: `TableCell: py-2 text-sm`; page wrapper: `container mx-auto py-6 space-y-6`; form field group: `space-y-2`.

---

## Implications for Roadmap

The research points to a seven-phase structure that precisely mirrors the five-layer dependency chain, with two domain phases split by complexity. Each phase can ship and be UAT-verified independently. Do not attempt to combine layers — the dependencies are real and rework is expensive at this codebase's scale.

### Phase 1: Design Foundation
**Rationale:** Token changes propagate everywhere automatically. If tokens are wrong, every subsequent phase inherits the problem. This is also the phase to establish the dark mode pairing rule, document canonical class recipes, and run the hardcoded color audit that defines the scope of cleanup work for subsequent phases.
**Delivers:** Updated `globals.css` with synchronized `:root` and `.dark` blocks; new semantic tokens (`--financial-positive`, `--financial-negative`, `--surface`); canonical recipe documentation added to `COMPONENT-ORGANIZATION.md`; hardcoded color audit report; three npm package installations (`@tanstack/react-virtual`, `motion`, `react-number-format`).
**From FEATURES.md:** Semantic color system for status states across all surfaces.
**Avoids:** Dark mode breakage (Pitfall 2); Tailwind class drift (Pitfall 3); Tailwind v4 migration trap.
**Research flag:** Standard patterns — skip `/gsd:research-phase`. CSS variable token overhaul is well-documented.

### Phase 2: Shared UI Primitives
**Rationale:** `components/ui/` changes propagate to every domain component simultaneously. Getting table row height, badge variants, and card style right here means every domain that follows inherits the correct baseline automatically. Modifying these after domain phases begin requires re-verifying all domain work.
**Delivers:** Dense `table.tsx` (TableHead `h-10` → `h-8`; TableCell `p-2` → `py-1.5 px-2`); `badge.tsx` extended with `success`, `warning`, and `info` variants; `card.tsx` adjusted for flat design (shadow reduction, padding review); `button.tsx` icon-only compact variant if audit identifies need.
**From FEATURES.md:** Sticky table header foundation, tabular-nums baseline, badge variant system.
**Avoids:** Stale shared component APIs (Pitfall 6) — lock primitives before domain phases use them; check every use site before committing any `ui/` change.
**Research flag:** Standard patterns — skip `/gsd:research-phase`. TanStack Table density configuration and shadcn UI modification are well-documented.

### Phase 3: Shared Domain Components
**Rationale:** `status-badge.tsx` and `currency-display.tsx` are used across 6+ and 14+ locations respectively. Consolidating the duplicate `estimates/lifecycle/StatusBadge.tsx` and ensuring both shared components are on the correct token-based color system must happen before domain redesigns reference them in redesigned states.
**Delivers:** Consolidated `StatusBadge` — estimates version merged into shared; `variant` prop typed as a string union for compiler safety; any `dark:` prefix classes replaced with CSS token references where feasible. `CurrencyDisplay` verified stable with no changes required. Hardcoded dark violations in both components resolved.
**From ARCHITECTURE.md:** Eliminate duplicate component instance. From FEATURES.md: Consistent status badge semantics across all surfaces.
**Avoids:** Stale shared component APIs (Pitfall 6) — grep all 14+ `CurrencyDisplay` and 6+ `StatusBadge` call sites before any change.
**Research flag:** Standard patterns — skip `/gsd:research-phase`. Straightforward consolidation.

### Phase 4: Budget Domain Redesign
**Rationale:** Budget is the most financially critical surface in BIDAXIOM, has the most tables, and has the most existing hardcoded color violations. It establishes the domain redesign pattern — dense table configuration, side panel detail, column picker, density control — that Change Orders and Pay Apps will replicate. Tackling it first produces the highest visual impact per phase.
**Delivers:** Dense `budget-line-item-table.tsx` with 32px compact rows, sticky header, frozen first column, right-aligned tabular-nums currency, sort headers, and totals footer. `budget-summary-cards.tsx` with tokenized colors and compact flat layout. CSI division row grouping with collapse and expand. Column picker (show/hide) and density control toggle. Side panel for line item drill-down replacing modal.
**From STACK.md:** TanStack Table column sizing with CSS variables; `@tanstack/react-virtual` if row count exceeds ~100 rows in practice.
**From FEATURES.md (P1):** Sticky headers, frozen first column, right-aligned currency, sort, totals row. (P2): Column picker, density control, side panel detail.
**Avoids:** Hardcoded color violations (Pitfall 2); creating a custom div-grid instead of configuring TanStack Table (confirmed anti-pattern in architecture research).
**Research flag:** Needs `/gsd:research-phase` before planning. The combination of TanStack Table `getGroupedRowModel` with `@tanstack/react-virtual` has specific integration nuances worth verifying before implementation planning begins.

### Phase 5: Change Order and Payment App Redesign
**Rationale:** CO and Pay App surfaces share the same structural pattern — list view with filter chips and bulk actions, detail page with prominent approval buttons and activity trail, and a financial table with inline line items. They are tackled together in sequence because the side panel pattern, bulk action bar, and status badge system established in Phase 4 apply directly.
**Delivers:** CO list with filter chips, bulk action floating bar, inline approve/reject action, status badges, empty states, and export CSV. CO detail with prominent Approve/Reject buttons in page header area, activity/audit trail, and single-page form with inline line item entry (no modal). Pay App list and detail redesigned to match the CO pattern.
**From FEATURES.md (P1):** Status badges, filter chips, empty states, prominent approval actions. (P2): Bulk action bar, inline approve from list, side panel for detail.
**Avoids:** Approval actions buried in menus; modal for line item entry; form state regression (Pitfall 4) — full form submission UAT required for CO and Pay App create and edit forms.
**Research flag:** Standard patterns — skip `/gsd:research-phase`. Approval workflow UI is well-documented against Procore patterns in FEATURES.md.

### Phase 6: Estimates Redesign
**Rationale:** Estimates is the most complex domain — 6-step wizard, inline-edit `EstimateLineItemsTable` with drag-and-drop, SOV builder with reorderable rows. It is tackled after Budget and CO/Pay Apps because it is unique enough that the simpler domain patterns do not transfer directly, and it has the highest form state regression risk (most `<Controller>` instances, most `useFieldArray` usage).
**Delivers:** Improved step indicator — horizontal stepper bar with labels and completion state. `EstimateLineItemsTable` density cleanup — 32px rows, tabular-nums, right-aligned currency, sticky section header rows. SOV builder drag-handle styling and row density improvement. Auto-save visual feedback on step transitions. Final review step layout polish.
**From STACK.md:** `motion` for step transition animations (must use `"use client"`; animate outer step container only, not individual Controllers). `react-number-format` for currency inputs in line item entry.
**From FEATURES.md (P1):** Right-aligned currency in line item table. (P2): Inline row addition (remove modal), keyboard navigation in line item table.
**Avoids:** Form state regression (Pitfall 4) — this is the highest-risk phase for Controller remounting; CSS visibility toggling for step hiding is mandatory; `key={field.id}` on all `useFieldArray` items must be verified after any layout change. Full 6-step form submission UAT required.
**Research flag:** Standard patterns — skip `/gsd:research-phase`. Wizard and inline-edit table patterns are well-documented. The dnd-kit integration in SOV builder should be verified not to have regressed from Phase 2 table changes.

### Phase 7: Project Header, Tabs, and Navigation Chrome
**Rationale:** The project header and tabs are shared across all 10 project tabs — a regression here breaks the entire project detail experience for every user on every project. They are saved for last precisely because all domain-level content (Budget, CO, Estimates, Documents) is stable and verified before the shared chrome is modified. Modifying the chrome first would require re-verifying all domain pages after every header change.
**Delivers:** Compact sticky project header (60–80px max height) with project name, status badge, job number, 3–5 key financial stat bar metrics, quick create button, and dark mode violations resolved. Tab count badges for action items on project navigation tabs. Routing convention documentation added before any code: `<Link href scroll={false}>` for navigation-level tabs; Radix `<Tabs>` reserved for in-page sub-sections only. `sectionPrefetchMap` verified complete for all existing tabs.
**From FEATURES.md (P1):** Compact sticky project header, financial stat bar. (P2): Tab count badges, financial health indicator.
**Avoids:** Navigation pattern regression (Pitfall 5) — `<Link href scroll={false}>` pattern and `sectionPrefetchMap` registrations must be preserved; document the URL-vs-state tabs rule before writing any code. Stale shared component APIs (Pitfall 6) — grep all 10 project tab pages for header prop call sites before any prop change.
**Research flag:** Standard patterns — skip `/gsd:research-phase`. Sticky header pattern is well-documented. The critical verification is responsive testing: combined sticky header + tabs height (target 80–110px) at both 1280px and 375px viewport widths.

### Phase Ordering Rationale

- Token foundation before everything: CSS variable changes propagate globally; wrong tokens compound across all seven phases.
- Shared primitives before domain: `table.tsx` row height is set once and inherited by every domain — set it right before domain work begins.
- Shared domain components before page-level: `StatusBadge` and `CurrencyDisplay` APIs must be locked before pages depend on them in redesigned form.
- Budget before CO and Pay Apps: Budget has the most tables and the most color violations; it establishes the domain redesign pattern.
- Estimates last in domain redesigns: most complex form state, unique drag-and-drop, patterns from simpler domains do not transfer directly.
- Navigation chrome last: shared across everything; highest regression cost if broken before domain pages are stable.

### Research Flags

Phases needing `/gsd:research-phase` before planning:
- **Phase 4 (Budget):** TanStack Table `getGroupedRowModel` combined with `@tanstack/react-virtual` is a specific pairing with integration nuances. Verify the interaction before implementation planning begins.

Phases with well-documented patterns (skip research):
- **Phase 1 (Foundation):** CSS variable token overhaul is standard.
- **Phase 2 (Primitives):** shadcn/ui component modification and TanStack Table density configuration are well-documented in official docs.
- **Phase 3 (Shared Components):** StatusBadge consolidation is a standard component merge.
- **Phase 5 (CO and Pay Apps):** Approval workflow UI patterns are directly mapped from Procore research in FEATURES-UX-REDESIGN.md.
- **Phase 6 (Estimates):** Wizard and inline-edit table patterns are well-documented; complexity is integration and form-state discipline, not pattern discovery.
- **Phase 7 (Chrome):** Sticky header patterns are well-documented; risk is responsive testing, not pattern discovery.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against npm registry Feb 2026; Radix ScrollArea sticky header bug confirmed via open GitHub issue; TanStack family pairing confirmed via official docs; motion license confirmed MIT |
| Features | MEDIUM-HIGH | Procore patterns verified via official support docs and release notes; NN/G sticky header guidelines are authoritative; BuilderTrend patterns from third-party reviews (not primary source) |
| Architecture | HIGH | All findings grounded in direct codebase inspection with specific file paths and line numbers; no inference; token system, component boundaries, and existing violations all confirmed |
| Pitfalls | HIGH | All pitfalls confirmed from direct codebase inspection; grep counts verified; specific line numbers confirmed (e.g., `change-order-form.tsx` line 63 `useForm<any>` cast, line 362 `key={field.id}`); no theoretical pitfalls |

**Overall confidence: HIGH**

### Gaps to Address

- **Budget table row count at runtime:** Whether `@tanstack/react-virtual` is actually necessary depends on how many rows budget tables have in production tenants. Flag for Phase 4 planner — suggested threshold: add virtualization if any tenant has more than 100 budget rows. Test with production data before deciding.
- **`react-resizable-panels` installation status:** STACK.md notes it already backs shadcn `Resizable`. Verify with `npm ls react-resizable-panels` in `apps/web/` before Phase 4 — it may already be available.
- **`vaul` installation status:** Verify with `npm ls vaul` in `apps/web/` before Phase 6 — it may already be a transitive dependency of shadcn `Drawer`.
- **Mobile breakpoints for project header:** Research recommends 60–80px max sticky header height, but BIDAXIOM's actual tab overflow behavior at 375px needs DevTools verification before Phase 7 planning.
- **Phase 40 document table as reference:** The `unified-document-table.tsx` from Phase 40 (the most recent and most mature table in the codebase) should be explicitly reviewed at the start of Phase 4 to establish the density baseline — the budget table and document table should converge visually, not diverge.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection or official documentation)

- Codebase inspection: `apps/web/app/globals.css` — token system, dark mode variable values
- Codebase inspection: `apps/web/tailwind.config.ts` — custom utilities and token registration
- Codebase inspection: `apps/web/components/ui/table.tsx` — current row heights (`h-10`, `p-2`)
- Codebase inspection: `apps/web/components/shared/status-badge.tsx` and `currency-display.tsx`
- Codebase inspection: `apps/web/components/budget/budget-summary-cards.tsx` and `budget-line-item-table.tsx`
- Codebase inspection: `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx` and `project-header.tsx`
- Codebase inspection: `apps/web/components/change-order/change-order-form.tsx`
- Codebase inspection: `apps/web/COMPONENT-ORGANIZATION.md`
- Grep audit: 52 TSX files in `apps/web/` containing hardcoded palette color classes (confirmed)
- Grep audit: `bg-amber-50` confirmed in 4 production files without dark variants
- [TanStack Table v8 — Virtualized Rows Example](https://tanstack.com/table/v8/docs/framework/react/examples/virtualized-rows) — official docs
- [TanStack Virtual v3 Installation](https://tanstack.com/virtual/latest/docs/installation) — v3.13.18 verified npm registry Feb 2026
- [Motion npm package](https://www.npmjs.com/package/motion) — v12.34.3 verified npm registry Feb 2026; MIT license confirmed
- [Radix ScrollArea + sticky positioning bug](https://github.com/radix-ui/primitives/issues/2783) — open GitHub issue; confirms table sticky header pitfall
- [Procore Change Order Statuses](https://support.procore.com/faq/what-are-the-default-statuses-for-change-orders-in-procore) — 10 default statuses with budget impact mapping
- [Procore Budget Improvements](https://www.procore.com/whats-new/budget-improvements) — column resizing, keyboard nav, side panel additions
- [NN/G — Sticky Headers](https://www.nngroup.com/articles/sticky-headers/) — height guidelines, content-to-chrome ratio

### Secondary (MEDIUM confidence — third-party sources, editorial)

- [Pencil & Paper — Enterprise Data Tables UX Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables) — row density standards, bulk actions, sticky footers
- [Procore What's New — NGX Change Orders](https://www.procore.com/whats-new) — NGX list view pattern, keyboard nav, multi-select
- [Procore User Reviews — Capterra](https://www.capterra.com/p/56250/Procore/reviews/) — real user UX pain points
- [Buildertrend Review 2026 — The Digital Project Manager](https://thedigitalprojectmanager.com/tools/buildertrend-review/) — UX strengths and weaknesses
- [react-number-format npm](https://www.npmjs.com/package/react-number-format) — v5.4.4 verified npm registry Feb 2026
- [shadcn/ui Inline Edit Table Block](https://ui.shadcn.com/blocks/tables-inline-edit) — official shadcn blocks

---

*Research completed: 2026-02-21*
*Synthesized: 2026-02-21*
*Ready for roadmap: yes*
*Suggested phases: 7*
*Research flags: Phase 4 (TanStack grouped rows + virtualization pairing)*
*Standard phases (no research needed): Phases 1, 2, 3, 5, 6, 7*
