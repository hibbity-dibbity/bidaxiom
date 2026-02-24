# Roadmap: ConstructionSaaS

## Milestones

- ✅ **v1.0 MVP** — Phases 1-12 (shipped Feb 14, 2026)
- ✅ **v1.1 Enterprise UX Redesign** — Phases 13-19 (shipped Feb 16, 2026)
- ✅ **v1.2 Job Number System Fixes & Reliability** — Phases 20-24 (shipped Feb 17, 2026)
- ✅ **v1.3 Polish & Gap Closure** — Phases 25-29 (shipped Feb 18, 2026)
- ✅ **v1.4 Rebranding & UX Upgrades** — Phases 30-35 (shipped Feb 18, 2026)
- ✅ **v1.5 Lifecycle, PDF Generation & Document Redesign** — Phases 36-40 (shipped Feb 21, 2026)
- ✅ **v1.6 UX Redesign & Polish** — Phases 41-46 (shipped Feb 23, 2026)
- 🚧 **v1.7 Project Flow Enhancements** — Phases 47-52 (in progress)

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

<details>
<summary>✅ v1.6 UX Redesign & Polish (Phases 41-46) — SHIPPED Feb 23, 2026</summary>

**Delivered:** Procore-level UX density — CSS design token system, 12 upgraded financial tables, inline approvals in list views, CSV export everywhere, horizontal stepper + live currency masking in estimates, and compact sticky project header with financial stat bar.

**Phases:**
- [x] Phase 41: Design Foundation (6 plans) — CSS variable token system, 56-file dark mode migration, approval buttons to page headers
- [x] Phase 42: Shared UI Primitives (5 plans) — Sticky/frozen/sorted tables, unified 4-tier StatusBadge
- [x] Phase 43: Budget Domain Redesign (5 plans) — ColumnPicker, inline draft rows, search + FilterChips + EmptyState
- [x] Phase 44: Change Order and Payment App Redesign (5 plans) — Inline approve/reject/mark-paid, CSV export across 6 tables
- [x] Phase 45: Estimates Redesign (4 plans) — Horizontal stepper bar, react-number-format live masking, section grouping
- [x] Phase 46: Project Header, Tabs, and Navigation Chrome (4 plans) — Sticky 3-row header, financial stat bar, tab count badges

**Archive:** [.planning/milestones/v1.6-ROADMAP.md](./milestones/v1.6-ROADMAP.md)

</details>

---

## Active Milestone: v1.7 Project Flow Enhancements

**Milestone Goal:** Simplify and streamline the project experience — remove GC/Advanced complexity, redesign project tabs for a clean Simple mode flow, eliminate approval bottlenecks, allow free lifecycle navigation, and simplify trade terminology.

### Phases

- [x] **Phase 47: Sidebar Cleanup** — Remove Bidding, Financials, Documents, Reports sections and the "Navigation" group heading (completed 2026-02-23)
- [x] **Phase 48: Project Mode Removal** — Remove the mode switcher from all UI surfaces and hide all GC/Advanced-specific tabs and features (completed 2026-02-24)
- [ ] **Phase 49: Project Tabs Redesign** — Reorder and relabel tabs: Overview → Documents → Proposals → Change Orders → Invoices → Expenses
- [ ] **Phase 50: Send-to-Customer Flow** — Remove approval requirement; add "Send to Customer" dialog with auto-populated recipient and status-advance on confirm
- [ ] **Phase 51: Lifecycle Phase Freedom** — Remove all phase guards; allow free navigation to any lifecycle phase from any phase
- [ ] **Phase 52: Trade Simplification** — Replace CSI codes with a simple 12-trade list on subcontractor forms and filter dropdowns

## Phase Details

### Phase 47: Sidebar Cleanup
**Goal**: Users see a clean sidebar with only the essential navigation entries — no sections for Bidding, Financials, Documents, or Reports
**Depends on**: Nothing (v1.7 first phase)
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, NAV-05
**Success Criteria** (what must be TRUE):
  1. The sidebar contains no "Bidding" section or any links within it (RFQs, Bid Comparison, etc.)
  2. The sidebar contains no "Financials" section or any links within it (Budget, Invoices, etc.)
  3. The sidebar contains no "Documents" section or any links within it
  4. The sidebar contains no "Reports" section or any links within it
  5. The word "Navigation" does not appear as a heading or label anywhere in the sidebar
**Plans**: TBD

### Phase 48: Project Mode Removal
**Goal**: No user-facing controls for switching between Simple and GC/Advanced modes exist; all GC/Advanced-only features are hidden from the project UI
**Depends on**: Phase 47
**Requirements**: MODE-01, MODE-02, TABS-04
**Success Criteria** (what must be TRUE):
  1. No project page shows a mode switcher control, toggle, or menu item for GC/Advanced vs Simple
  2. The project tab bar does not display Budget, SOV, Commitments, or Payment Applications tabs
  3. Any project-level entry point or action that exclusively belongs to GC/Advanced mode is absent from the UI
  4. Existing data (budget lines, SOV rows, payment apps) is preserved in the database — only the UI access points are removed
**Plans**: 2 plans
Plans:
- [ ] 48-01-PLAN.md — Remove GC-only tabs from tab bar; replace four tab pages with placeholder pages
- [ ] 48-02-PLAN.md — Remove mode badge, mode-switch menu item, Project Mode form field; clean Overview GC CTAs and in-tab mode conditionals

### Phase 49: Project Tabs Redesign
**Goal**: The project detail page shows tabs in the correct order with updated labels, including an Expenses placeholder tab
**Depends on**: Phase 48
**Requirements**: TABS-01, TABS-02, TABS-03
**Success Criteria** (what must be TRUE):
  1. Project tabs appear left-to-right in order: Overview, Documents, Proposals, Change Orders, Invoices, Expenses
  2. The tab previously labeled "Estimates" is now labeled "Proposals" and the heading, breadcrumbs, and action buttons inside the tab all read "Proposals"
  3. Clicking the Expenses tab navigates to a placeholder page with a contextual empty state (icon, heading, description) — no data entry is available
  4. No "Estimates" label appears anywhere in the project tab context
**Plans**: 2 plans
Plans:
- [ ] 49-01-PLAN.md — Reorder ALL_SECTIONS, rename tab to "Proposals", add Expenses entry and placeholder page, update breadcrumb segment labels
- [ ] 49-02-PLAN.md — Rename all user-visible "Estimate"/"Estimates" strings to "Proposal"/"Proposals" in estimates route pages and shared components

### Phase 50: Send-to-Customer Flow
**Goal**: Proposals and change orders can be sent to the customer with a single button click that advances the document status to Sent — no approval workflow required
**Depends on**: Phase 49
**Requirements**: FLOW-01, FLOW-02, FLOW-03, FLOW-04
**Success Criteria** (what must be TRUE):
  1. A proposal detail page has a "Send to Customer" button that opens a dialog; no approval step or approval status is required before the button appears
  2. A change order detail page has a "Send to Customer" button with the same dialog behavior; no approval workflow gates it
  3. The Send to Customer dialog contains a recipient email field; when the project has a customer with a primary contact email, that email is pre-populated on open
  4. Clicking "Confirm" (or equivalent) in the dialog changes the document's status to "Sent" and closes the dialog — no email is transmitted
**Plans**: TBD

### Phase 51: Lifecycle Phase Freedom
**Goal**: Users can move a project to any lifecycle phase in a single click from any current phase — no guards, no confirmation dialogs, no sequential restrictions
**Depends on**: Phase 50
**Requirements**: PHASE-01, PHASE-02, PHASE-03
**Success Criteria** (what must be TRUE):
  1. Clicking a lifecycle phase badge or control allows the user to select any phase (earlier or later) without a confirmation dialog or justification prompt
  2. A project currently in "Active" can be moved directly to "Opportunity" or "Archived" or any other phase in one action
  3. No error or blocking message appears when transitioning to an earlier phase
  4. No financial state, contract status, or billing status check blocks any phase transition
**Plans**: TBD

### Phase 52: Trade Simplification
**Goal**: The subcontractor trade selection field uses a plain 12-item list instead of CSI codes; CSI division codes are absent from all subcontractor and filter UI surfaces
**Depends on**: Phase 51
**Requirements**: TRADE-01, TRADE-02
**Success Criteria** (what must be TRUE):
  1. The trade selector on the subcontractor create and edit forms shows exactly: Plumbing, Electrical, HVAC, Concrete, Metal Buildings, Framing, Roofing, Painting, Flooring, Drywall, General, Other — no CSI codes or division numbers
  2. The trade filter dropdown on the subcontractors list page uses the same 12-item list
  3. No CSI division code or section reference (e.g., "03 00 00 Concrete" or "Division 15") appears in any subcontractor form, filter, badge, or search result
**Plans**: TBD

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-12. MVP Phases | v1.0 | 60/60 | Complete | 2026-02-14 |
| 13-19. Enterprise UX Phases | v1.1 | 50/50 | Complete | 2026-02-16 |
| 20-24. Job Number Phases | v1.2 | 12/12 | Complete | 2026-02-17 |
| 25-29. Polish Phases | v1.3 | 16/16 | Complete | 2026-02-18 |
| 30-35. Rebrand Phases | v1.4 | 16/16 | Complete | 2026-02-18 |
| 36-40. Document Engine Phases | v1.5 | 27/27 | Complete | 2026-02-21 |
| 41-46. UX Redesign Phases | v1.6 | 29/29 | Complete | 2026-02-23 |
| 47. Sidebar Cleanup | v1.7 | Complete    | 2026-02-23 | - |
| 48. Project Mode Removal | v1.7 | Complete    | 2026-02-24 | - |
| 49. Project Tabs Redesign | v1.7 | 0/2 | Not started | - |
| 50. Send-to-Customer Flow | v1.7 | 0/TBD | Not started | - |
| 51. Lifecycle Phase Freedom | v1.7 | 0/TBD | Not started | - |
| 52. Trade Simplification | v1.7 | 0/TBD | Not started | - |
