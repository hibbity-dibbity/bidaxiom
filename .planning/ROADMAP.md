# Roadmap: ConstructionSaaS

## Milestones

- ✅ **v1.0 MVP** — Phases 1-12 (shipped Feb 14, 2026)
- ✅ **v1.1 Enterprise UX Redesign** — Phases 13-19 (shipped Feb 16, 2026)
- ✅ **v1.2 Job Number System Fixes & Reliability** — Phases 20-24 (shipped Feb 17, 2026)
- ✅ **v1.3 Polish & Gap Closure** — Phases 25-29 (shipped Feb 18, 2026)
- 🚧 **v1.4 Rebranding & UX Upgrades** — Phases 30-35 (in progress)

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

---

## Current Milestone: v1.4 Rebranding & UX Upgrades

**Goal:** Fully rebrand the application as BIDAXIOM, apply an extracted color palette, flatten the card design system, add live currency formatting, expose company switching in the user dropdown, and expand global search to include subcontractors.

### Phases

- [x] **Phase 30: Brand Identity & Sidebar Cleanup** — Rename all app copy to BIDAXIOM, set page titles, resize sign-in logo, remove version from sidebar (completed 2026-02-18)
- [x] **Phase 31: Color Palette & Favicon** — Extract palette from BIDAXIOM logo, present for user approval, apply to Tailwind config and CSS variables, set favicon (completed 2026-02-18)
- [x] **Phase 32: Flat Design System** — Remove border-radius, borders, and drop shadows from all card/panel components app-wide (completed 2026-02-18)
- [x] **Phase 33: Company Selector in User Dropdown** — Add company switcher and "Create new company" option below Account Settings in top-nav user menu (completed 2026-02-18)
- [x] **Phase 34: Currency Format on Blur** — All currency/amount inputs reformat to US currency display when the user leaves the field (completed 2026-02-18)
- [ ] **Phase 35: Subcontractors in Global Search** — Add subcontractor results with "Subcontractor" type label to ⌘K search

### Phase Details

#### Phase 30: Brand Identity & Sidebar Cleanup
**Goal:** Users see "BIDAXIOM" everywhere — in navigation, copy, browser tabs, and the sign-in screen — and the sidebar is free of the version number clutter.
**Depends on:** Nothing (first phase of milestone)
**Requirements:** BRAND-01, BRAND-02, BRAND-04, CLEAN-01
**Success Criteria** (what must be TRUE):
  1. Every page title in the browser tab reads "{Page Name} | BIDAXIOM" with no prior brand name visible
  2. All navigation labels, headings, and body copy reference "BIDAXIOM"; no legacy brand names remain
  3. The sign-in page logo is visibly smaller than before and has extra space below it before the form
  4. The left sidebar shows no version number and no horizontal divider rule above where it was
**Plans:** 3/3 plans complete

#### Phase 31: Color Palette & Favicon
**Goal:** The app's color palette matches the BIDAXIOM logo — extracted programmatically, approved by the user before any code change, then applied globally through Tailwind config and CSS variables. The BIDAXIOM icon is set as the browser favicon.
**Depends on:** Phase 30
**Requirements:** BRAND-03, BRAND-05
**Success Criteria** (what must be TRUE):
  1. User is presented with the extracted palette (primary, accent, neutral, semantic colors) before any color is changed in the codebase
  2. After user approval, all primary interactive elements (buttons, links, active states) render in the new brand color
  3. After user approval, all CSS custom properties and Tailwind config entries reflect the new palette with no hardcoded legacy color values remaining
  4. The sign-in page, dashboard, and a data-heavy page (e.g., project list) all visually reflect the new palette consistently
  5. The browser tab and bookmarks display the BIDAXIOM icon (bidaxiom-icon.png) as the favicon
**Plans:** 2/2 plans complete

#### Phase 32: Flat Design System
**Goal:** Every card and panel in the application has sharp corners, no border, and no drop shadow — producing a flat, section-based visual language throughout.
**Depends on:** Phase 31
**Requirements:** DESIGN-01
**Success Criteria** (what must be TRUE):
  1. Cards and panels on the dashboard show no rounded corners, no visible border outline, and no box shadow
  2. Cards and panels on project pages, estimate pages, and settings pages exhibit the same flat appearance
  3. No regression: interactive elements (buttons, inputs, badges) that should retain their styling are unaffected
**Plans:** 2/2 plans complete
Plans:
- [ ] 32-01-PLAN.md — Flatten Card primitive + replace hover shadows on interactive cards (6 files)
- [ ] 32-02-PLAN.md — Patch custom Tier A div panels + human verification checkpoint (5 files)

#### Phase 33: Company Selector in User Dropdown
**Goal:** A user who belongs to multiple companies can switch between them — and create a new company — without leaving their current page, using the top-nav user dropdown.
**Depends on:** Phase 30
**Requirements:** NAV-02
**Success Criteria** (what must be TRUE):
  1. Opening the user dropdown reveals a company selector section below Account Settings, listing all companies the user belongs to
  2. Clicking a different company switches the active tenant context and the UI reflects the new company's data
  3. A "Create new company" option is present and navigates to the company creation flow
**Plans:** 2/2 plans complete
Plans:
- [ ] 33-01-PLAN.md — Add company selector to UserMenu + remove CompanySwitcher from top bar (3 files)
- [ ] 33-02-PLAN.md — Human verification checkpoint (0 files)

#### Phase 34: Currency Format on Blur
**Goal:** Every currency and amount field in the app displays US dollar notation when the user leaves the field, so amounts are always shown formatted without disrupting typing.
**Depends on:** Phase 30
**Requirements:** FORM-01
**Success Criteria** (what must be TRUE):
  1. After leaving any amount field, the value displays as "$X,XXX.XX"
  2. The formatted value is correctly parsed and persisted as a numeric value (not a string with symbols) when the form is saved
  3. Currency fields on estimate line items, budget entries, and change order forms all exhibit this behavior
**Plans:** 5/5 plans complete
Plans:
- [ ] 34-01-PLAN.md — parseCurrencyInput utility + CurrencyInput component (2 files)
- [ ] 34-02-PLAN.md — RHF forms: change-order-form + commitment-form amountChange/amount (2 files)
- [ ] 34-03-PLAN.md — Plain-state forms: budget-line-item-table + sov-editor + bid-comparison-table (3 files)
- [ ] 34-04-PLAN.md — Inline editors: SOVLineItemCard + EstimateLineItemsTable unitCost (2 files)
- [ ] 34-05-PLAN.md — Human verification checkpoint (0 files)

#### Phase 35: Subcontractors in Global Search
**Goal:** A user searching via ⌘K can find subcontractor records alongside projects, customers, and estimates, with clear labeling so the result type is immediately obvious.
**Depends on:** Phase 30
**Requirements:** SRCH-03
**Success Criteria** (what must be TRUE):
  1. Typing a subcontractor name in the ⌘K search palette surfaces matching subcontractor records
  2. Each subcontractor result displays a "Subcontractor" type label visually distinct from other result types
  3. Clicking a subcontractor result navigates to the correct subcontractor detail page
**Plans:** 2 plans
Plans:
- [ ] 35-01-PLAN.md — Add subcontractor query to search API + Subcontractors CommandGroup in command palette (2 files)
- [ ] 35-02-PLAN.md — Human verification checkpoint (0 files)

---

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1-12 | v1.0 | 60/60 | ✅ Complete | 2026-02-14 |
| 13-19 | v1.1 | 50/50 | ✅ Complete | 2026-02-16 |
| 20-24 | v1.2 | 12/12 | ✅ Complete | 2026-02-17 |
| 25-29 | v1.3 | 16/16 | ✅ Complete | 2026-02-18 |
| 30. Brand Identity & Sidebar Cleanup | v1.4 | Complete    | 2026-02-18 | - |
| 31. Color Palette | v1.4 | Complete    | 2026-02-18 | - |
| 32. Flat Design System | v1.4 | Complete    | 2026-02-18 | - |
| 33. Company Selector in User Dropdown | v1.4 | Complete    | 2026-02-18 | - |
| 34. Live Currency Formatting | v1.4 | Complete    | 2026-02-18 | - |
| 35. Subcontractors in Global Search | v1.4 | 0/2 | Not started | - |
