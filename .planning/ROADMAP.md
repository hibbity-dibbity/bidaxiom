# Roadmap: ConstructionSaaS

## Milestones

- ✅ **v1.0 MVP** — Phases 1-12 (shipped Feb 14, 2026)
- ✅ **v1.1 Enterprise UX Redesign** — Phases 13-19 (shipped Feb 16, 2026)
- ✅ **v1.2 Job Number System Fixes & Reliability** — Phases 20-24 (shipped Feb 17, 2026)
- ✅ **v1.3 Polish & Gap Closure** — Phases 25-29 (shipped Feb 18, 2026)
- ✅ **v1.4 Rebranding & UX Upgrades** — Phases 30-35 (shipped Feb 18, 2026)
- ✅ **v1.5 Lifecycle, PDF Generation & Document Redesign** — Phases 36-40 (shipped Feb 21, 2026)
- 🚧 **v1.6 UX Redesign & Polish** — Phases 41-46 (in progress)

## Shipped Milestones

<details>
<summary>✅ v1.0 MVP (Phases 1-12) — SHIPPED Feb 14, 2026</summary>

**Delivered:** Complete project financial lifecycle with multi-tenant auth, QuickBooks integration, and document workflows

**Phases:**
- [x] Phase 1: Foundation & Multi-Tenant Infrastructure (8 plans) — Authentication, tenant isolation, audit logging
- [x] Phase 2: Company Setup & Configuration (2 plans) — Company types, trade configuration, CSI standards
- [x] Phase 3: Project Management Core (5 plans) — Projects, access control, document management
- [x] Phase 4: Budget & Cost Tracking (4 plans) — Cost codes, budget vs actuals, committed costs
- [x] Phase 5: Change Order Management (4 plans) — Owner/internal/sub change orders, approval workflows
- [x] Phase 6: Payment Applications (5 plans) — AIA G702/G703, retainage, lien waivers
- [x] Phase 7: Bidding & Procurement (5 plans) — RFQ issuance, bid collection, comparison
- [x] Phase 8: QuickBooks Integration (5 plans) — OAuth connection, bi-directional sync
- [x] Phase 9: Document Management Enhancement (8 plans) — Versioning, workflows (RFI/Submittal/Transmittal)
- [x] Phase 10: Reporting & Analytics (5 plans) — Custom reports, dashboards, scheduled delivery
- [x] Phase 11: Calendar Integration (5 plans) — Google/Outlook sync, project milestones
- [x] Phase 12: Custom Authentication Migration (8 plans) — Replace Clerk with custom JWT/MFA

**Archive:** [.planning/milestones/v1.0-ROADMAP.md](./milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.1 Enterprise UX Redesign (Phases 13-19) — SHIPPED Feb 16, 2026</summary>

**Delivered:** Enterprise-grade UI with Procore-style density, guided estimate workflow, and component library

**Phases:**
- [x] Phase 13: Navigation & Theme Foundation (11 plans) — Top bar, sidebar, dark mode, branding
- [x] Phase 14: Form Standardization & Validation (8 plans) — Phone/address inputs, centralized validation
- [x] Phase 15: Dashboard Redesign (5 plans) — KPI widgets (user + company metrics)
- [x] Phase 16: Projects Interface Redesign (7 plans) — Slug routing, persistent headers, filtering
- [x] Phase 17: Estimating Workflow - Setup & Core (11 plans) — Guided workflow, templates, SOV builder
- [x] Phase 18: Estimating Workflow - Lifecycle & Conversion (4 plans) — Bid generation, won/lost, project conversion
- [x] Phase 19: Component Library & Architecture (6 plans) — Reusable components, formatting utilities

**Archive:** [.planning/milestones/v1.1-ROADMAP.md](./milestones/v1.1-ROADMAP.md)

</details>

<details>
<summary>✅ v1.2 Job Number System Fixes & Reliability (Phases 20-24) — SHIPPED Feb 17, 2026</summary>

**Delivered:** Complete job number system — auto-generation, manual assignment, duplicate prevention, year rollover, and rollover-aware settings UI

**Phases:**
- [x] Phase 20: Configuration Foundation (3 plans) — JSONB persistence, template validation, schema provisioning
- [x] Phase 21: Assignment & Auto-Generation (2 plans) — Atomic counter increment, job number field on project creation
- [x] Phase 22: Validation & Duplicate Prevention (4 plans) — ilike duplicate detection, edit-page self-exclusion, blur validation UX
- [x] Phase 23: Display & Integration (1 plan) — Job numbers in list, header, and estimates confirmed
- [x] Phase 24: Year Rollover Logic (2 plans) — startingSequenceNumber, reset branch, computeNextSequenceNumber shared utility, settings UX redesign

**Archive:** [.planning/milestones/v1.2-ROADMAP.md](./milestones/v1.2-ROADMAP.md)

</details>

<details>
<summary>✅ v1.3 Polish & Gap Closure (Phases 25-29) — SHIPPED Feb 18, 2026</summary>

**Delivered:** Session expiry detection, consolidated account settings, slug routing for customers/subs, estimates in search, dashboard click-through, and consistent empty states/loading/error handling

**Phases:**
- [x] Phase 25: Session & Auth Flow (3 plans) — SessionWatcher, tRPC 401 interceptor, return URL preservation
- [x] Phase 26: Account Settings & Shell Cleanup (3 plans) — /settings/account, static sidebar, password change + MFA management
- [x] Phase 27: Slug Routing Completion (3 plans) — Customer/sub slug URLs, generateNameSlug (no UUID prefix)
- [x] Phase 28: Search & Dashboard Enhancements (3 plans) — Estimates in ⌘K search, 9 KPI widgets with pre-filtered navigation
- [x] Phase 29: UX Polish & Tech Debt (4 plans) — Empty states, skeleton loading, global error toasts, job number counter-advance

**Archive:** [.planning/milestones/v1.3-ROADMAP.md](./milestones/v1.3-ROADMAP.md)

</details>

<details>
<summary>✅ v1.4 Rebranding & UX Upgrades (Phases 30-35) — SHIPPED Feb 18, 2026</summary>

**Delivered:** Full BIDAXIOM rebrand with new color palette, flat design system, currency format on blur, company selector in user dropdown, and subcontractors in global search

**Phases:**
- [x] Phase 30: Brand Identity & Sidebar Cleanup (3 plans) — BIDAXIOM copy, page titles, logo resize, sidebar cleanup
- [x] Phase 31: Color Palette & Favicon (2 plans) — Cyan-teal primary palette, BIDAXIOM favicon
- [x] Phase 32: Flat Design System (2 plans) — Sharp corners, no borders/shadows on all cards/panels
- [x] Phase 33: Company Selector in User Dropdown (2 plans) — Company switcher + "Create new company" in user menu
- [x] Phase 34: Currency Format on Blur (5 plans) — CurrencyInput component, $X,XXX.XX display across 7 fields
- [x] Phase 35: Subcontractors in Global Search (2 plans) — Subcontractors CommandGroup in ⌘K search

**Archive:** [.planning/milestones/v1.4-ROADMAP.md](./milestones/v1.4-ROADMAP.md)

</details>

<details>
<summary>✅ v1.5 Lifecycle, PDF Generation & Document Redesign (Phases 36-40) — SHIPPED Feb 21, 2026</summary>

**Delivered:** 9-phase lifecycle state machine, Simple/GC project modes, project deletion with safeguards, PDF generation for all 4 document types, custom .docx/.xlsx template engine with field mapping, and unified flat document table.

**Phases:**
- [x] Phase 36: Project Lifecycle State Machine + Simple/GC Mode (7 plans) — 9-phase state machine, auto-advance, audit log, mode-aware feature visibility
- [x] Phase 37: Project Deletion with Safeguards (2 plans) — Admin deletion, lifecycle guards, soft-delete, 30-day recovery
- [x] Phase 38: PDF Generation + Document Naming (8 plans) — Proposal/CO/G702/RFQ PDFs, company branding, naming conventions
- [x] Phase 39: Custom Template Import + Field Mapping (6 plans) — .docx/.xlsx upload, field detection, mapping UI, preview, activation
- [x] Phase 40: Document System Redesign (4 plans) — Unified flat table, nuqs filters, bulk ops, workflow navigation

**Archive:** [.planning/milestones/v1.5-ROADMAP.md](./milestones/v1.5-ROADMAP.md)

</details>

---

## Active Milestone: v1.6 UX Redesign & Polish

**Milestone Goal:** Redesign BIDAXIOM's UX to Procore-level density and polish — systematic dark mode audit, design token enforcement, dense financial tables, filter chips on all list views, inline approvals, compact sticky project header, and visual consistency enforced across all 40+ pages.

**Note on research:** Phase 43 (Budget Domain Redesign) requires `/gsd:research-phase` before planning — TanStack Table `getGroupedRowModel` combined with `@tanstack/react-virtual` has integration nuances that must be verified. All other phases use standard patterns and can proceed directly to planning.

### Phases

- [ ] **Phase 41: Design Foundation** — Dark mode audit, semantic token system, canonical class recipes, npm package installation
- [x] **Phase 42: Shared UI Primitives** — Dense table component, badge variants, status badge consolidation, visual consistency (completed 2026-02-22)
- [ ] **Phase 43: Budget Domain Redesign** — Dense financial tables, column picker, inline row add, filter chips, empty states
- [ ] **Phase 44: Change Order and Payment App Redesign** — CSV export, inline approve/reject, inline mark-paid on list rows
- [ ] **Phase 45: Estimates Redesign** — Horizontal stepper bar, react-number-format currency inputs, form section grouping
- [ ] **Phase 46: Project Header, Tabs, and Navigation Chrome** — Compact sticky header, financial stat bar, tab count badges, URL-based tab routing

## Phase Details

### Phase 41: Design Foundation
**Goal**: The application's CSS token system, dark mode compliance, and Tailwind class recipes are the correct foundation for all subsequent redesign work — every page renders correctly in dark mode and every surface uses semantic tokens rather than hardcoded palette classes.
**Depends on**: Nothing (first v1.6 phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, VISUAL-03
**Success Criteria** (what must be TRUE):
  1. Toggling to dark mode on any page produces no visible white/light backgrounds, amber washes, or slate text — all 52 previously identified hardcoded palette class violations are resolved.
  2. Financial data across all surfaces renders positive values in green, negative values in red, and pending/neutral values in amber — using the `--financial-positive`, `--financial-negative` semantic CSS tokens, not inline Tailwind palette classes.
  3. The `COMPONENT-ORGANIZATION.md` file contains documented canonical Tailwind class recipes for table rows, list views, and form fields; no per-page deviation in row height, cell padding, or typography scale is permitted without updating the canonical.
  4. Three new npm packages are installed in `apps/web/` and importable: `@tanstack/react-virtual` v3, `motion` v12, and `react-number-format` v5.
  5. Approval action buttons on change order and payment application detail pages appear in the page header action area — not inside dropdown menus or overflow controls.
**Plans**: 6 plans

Plans:
- [x] 41-01-PLAN.md — CSS token foundation: financial tokens in globals.css + tailwind.config, 3 npm packages, COMPONENT-ORGANIZATION.md canonical recipes
- [x] 41-02-PLAN.md — Group A+B: auth pages (4) + settings/integrations pages (7) palette class migration
- [x] 41-03-PLAN.md — Group C+D: project/customer/sub pages (8) + bidding components (5) palette class migration
- [x] 41-04-PLAN.md — Group E: budget components (6) — financial token migration + surface bg migration
- [x] 41-05-PLAN.md — Group F: change order + payment app (10) — VISUAL-03 approval button relocation + color migration
- [x] 41-06-PLAN.md — Group G: estimates workflow (7) + integrations (3) + shared/currency-display/status-badge (5) migration

### Phase 42: Shared UI Primitives
**Goal**: The shared `components/ui/` primitives and `components/shared/` domain components are correctly configured for Procore-level density — table row height, badge variants, and status badge semantics are locked in before any domain phase inherits them.
**Depends on**: Phase 41
**Requirements**: TABLE-01, TABLE-02, TABLE-03, TABLE-04, TABLE-05, VISUAL-01, VISUAL-02
**Success Criteria** (what must be TRUE):
  1. All financial tables rendered by the updated `table.tsx` display a sticky frozen header row that stays visible during vertical scroll — achieved without Radix ScrollArea.
  2. Wide financial tables (budget, SOV) freeze their first column so that the cost code or description remains visible when the user scrolls horizontally.
  3. All financial amount columns are right-aligned with tabular-nums font variant and `$` prefix; `CurrencyDisplay` is used for read-only cells throughout.
  4. Clicking any financial table column header cycles between ascending and descending sort states (2-state cycle, `enableSortingRemoval: false`) with a dual-chevron (`ChevronsUpDown`) indicator for the unsorted state and a directional chevron for the active sort state.
  5. All financial tables display a sticky summary footer row at the bottom of the scrollable area showing column totals or key aggregates.
  6. The duplicate `estimates/lifecycle/StatusBadge.tsx` component is deleted and every one of its former call sites uses `components/shared/status-badge.tsx` instead.
  7. Status badges across all surfaces (projects, change orders, estimates, payment applications, documents, RFQs) render using the 4-tier semantic model: gray for draft/inactive, amber for pending/review, green for approved/active/complete, red for rejected/void.
**Plans**: 5 plans

Plans:
- [ ] 42-01-PLAN.md — Status badge consolidation: active variant → green, delete lifecycle/StatusBadge, update estimate detail page
- [ ] 42-02-PLAN.md — Budget + SOV tables: TanStack sort + sticky header/footer + frozen first col + CurrencyDisplay
- [ ] 42-03-PLAN.md — G703 + PaymentAppList: sticky header/footer + frozen col + TanStack sort (PaymentAppList) + CurrencyDisplay
- [ ] 42-04-PLAN.md — ProjectsTable + ChangeOrderList: sticky + frozen col + footer + fix sort icons + card-to-table conversion
- [ ] 42-05-PLAN.md — Customers + Subcontractors + CommitmentList + CO line items + EstimateLineItemsTable: sticky/frozen/sort for remaining tables

### Phase 43: Budget Domain Redesign
**Goal**: The budget domain surfaces — line item table, summary cards, and list views — are redesigned to Procore-level density with column picker, inline row addition, filter chips, and consistent empty states, establishing the domain redesign pattern that change order and payment app phases will replicate.
**Depends on**: Phase 42
**Requirements**: TABLE-06, TABLE-07, LIST-01, LIST-02, LIST-03
**Note**: Requires `/gsd:research-phase` before planning. TanStack Table `getGroupedRowModel` combined with `@tanstack/react-virtual` has integration nuances that must be verified before implementation planning begins.
**Success Criteria** (what must be TRUE):
  1. The budget line item table and projects list view have a column picker control (popover with checkbox list) that shows and hides individual columns; the user's selection is reflected immediately without a page reload.
  2. SOV line items and change order line items can be added as a new inline row directly in the table by clicking "Add line item" — no modal dialog opens.
  3. Every major list view (projects, customers, subcontractors, change orders, payment applications, estimates, RFQs) has an inline search bar directly above the table that filters the visible result set.
  4. Active filter selections on all list views display as removable filter chips below the search bar; each chip shows the filter label and value with an × dismiss button; a "Clear all" link removes all active filters simultaneously.
  5. Every list view displays a contextual empty state with icon, heading, description, and a context-appropriate CTA button when no records match the current filters or when the list is genuinely empty.
**Plans**: TBD

### Phase 44: Change Order and Payment App Redesign
**Goal**: Change order and payment application list views gain CSV export and inline approval actions — users can approve, reject, or mark paid directly from the list row without navigating to the detail page.
**Depends on**: Phase 43
**Requirements**: LIST-04, LIST-05, LIST-06
**Success Criteria** (what must be TRUE):
  1. All list views with filtering support have an "Export CSV" button that downloads the currently filtered and sorted result set as a CSV file.
  2. Change order list rows display inline Approve and Reject action buttons for pending COs; activating either shows a confirmation before the irreversible status change is applied; the CO status updates without a full page navigation.
  3. Payment application list rows display inline Approve and Mark Paid action buttons for pending pay apps; the status updates without navigating to the detail page.
**Plans**: TBD

### Phase 45: Estimates Redesign
**Goal**: The estimate creation wizard and its forms are redesigned with a visible progress stepper, properly masked currency inputs across all amount fields, and visual section grouping on multi-section forms — the most complex form surface in BIDAXIOM is also the most polished.
**Depends on**: Phase 44
**Requirements**: FORM-01, FORM-02, FORM-03
**Note**: Highest form state regression risk — every Controller must use CSS visibility for show/hide (never conditional JS mounting). Full 6-step form submission UAT verified in the Network tab is mandatory before phase complete.
**Success Criteria** (what must be TRUE):
  1. The estimate creation wizard displays a horizontal stepper bar at the top with all 6 steps labeled, the current step highlighted, and completed steps visually marked; users can navigate back to any completed step by clicking it.
  2. All currency input fields across the application (change order amounts, budget entries, pay app values, line item unit costs) use `react-number-format` NumericFormat with `$` prefix, thousands separators, and 2 decimal precision; the value submitted to the server is a number, not a formatted string.
  3. Multi-section create and edit forms (change order, project, customer) use clear visual section grouping with section headings and consistent spacing — fields are not presented as an undivided flat list.
**Plans**: TBD

### Phase 46: Project Header, Tabs, and Navigation Chrome
**Goal**: The project detail page has a compact sticky header with a financial stat bar and tab count badges, and the tab navigation system is confirmed URL-based with browser back/forward support — the shared chrome across all 10 project tabs is polished and regression-free.
**Depends on**: Phase 45
**Requirements**: CHROME-01, CHROME-02, CHROME-03, CHROME-04
**Note**: Navigation chrome is shared across all 10 project tabs — a regression here breaks the entire project detail experience. Confirm `<Link href scroll={false}>` tab routing and `sectionPrefetchMap` registrations are preserved before writing any code. URL-based routing must not be replaced with Radix Tabs state.
**Success Criteria** (what must be TRUE):
  1. The project detail page has a sticky header with maximum 80px height that remains fixed at the top of the viewport during vertical scroll on all 10 project tabs.
  2. The sticky project header includes an inline financial stat bar showing contract value, approved change orders total, billed to date, balance to complete, and retainage held — all visible without scrolling or expanding any control.
  3. Project navigation tabs display a count badge for pending action items on tabs where pending items exist (e.g., "Change Orders (3)" when 3 change orders await approval).
  4. Tab navigation uses `<Link href scroll={false}>` — not Radix Tabs component state — so browser back and forward buttons work, tab URLs are shareable, and hover-prefetch via `sectionPrefetchMap` fires correctly.
**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1-12 (v1.0) | 60/60 | Complete | 2026-02-14 |
| 13-19 (v1.1) | 50/50 | Complete | 2026-02-16 |
| 20-24 (v1.2) | 12/12 | Complete | 2026-02-17 |
| 25-29 (v1.3) | 16/16 | Complete | 2026-02-18 |
| 30-35 (v1.4) | 16/16 | Complete | 2026-02-18 |
| 36-40 (v1.5) | 23/23 | Complete | 2026-02-21 |
| 41. Design Foundation | 6/6 | Complete | 2026-02-21 |
| 42. Shared UI Primitives | 0/5 | Complete    | 2026-02-22 |
| 43. Budget Domain Redesign | 0/TBD | Not started | - |
| 44. Change Order and Payment App Redesign | 0/TBD | Not started | - |
| 45. Estimates Redesign | 0/TBD | Not started | - |
| 46. Project Header, Tabs, and Navigation Chrome | 0/TBD | Not started | - |
