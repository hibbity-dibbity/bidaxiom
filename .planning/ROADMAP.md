# Roadmap: ConstructionSaaS

## Milestones

- ✅ **v1.0 MVP** — Phases 1-12 (shipped Feb 14, 2026)
- ✅ **v1.1 Enterprise UX Redesign** — Phases 13-19 (shipped Feb 16, 2026)
- ✅ **v1.2 Job Number System Fixes & Reliability** — Phases 20-24 (shipped Feb 17, 2026)
- ✅ **v1.3 Polish & Gap Closure** — Phases 25-29 (shipped Feb 18, 2026)
- ✅ **v1.4 Rebranding & UX Upgrades** — Phases 30-35 (shipped Feb 18, 2026)
- ✅ **v1.5 Lifecycle, PDF Generation & Document Redesign** — Phases 36-40 (shipped Feb 21, 2026)
- ✅ **v1.6 UX Redesign & Polish** — Phases 41-46 (shipped Feb 23, 2026)
- ✅ **v1.7 Project Flow Enhancements** — Phases 47-52 (shipped Feb 24, 2026)
- ✅ **v1.8 New Project Page Stage 1** — Phases 53-56 (shipped Feb 25, 2026)

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

<details>
<summary>✅ v1.7 Project Flow Enhancements (Phases 47-52) — SHIPPED Feb 24, 2026</summary>

**Delivered:** Clean simple-mode project flow — sidebar trimmed, GC/Advanced features hidden, 6-tab project layout with Proposals + Expenses, Send to Customer replaces approvals, free lifecycle navigation, and simple 12-trade selector for subcontractors.

**Phases:**
- [x] Phase 47: Sidebar Cleanup (1 plan) — Bidding/Financials/Documents/Reports removed, "Navigation" heading gone
- [x] Phase 48: Project Mode Removal (2 plans) — Mode switcher removed, GC/Advanced features hidden, new projects default simple mode
- [x] Phase 49: Project Tabs Redesign (3 plans) — 6-tab layout, Proposals label, Expenses placeholder
- [x] Phase 50: Send-to-Customer Flow (4 plans) — Send dialog with auto-populated email, status advance, no approval required
- [x] Phase 51: Lifecycle Phase Freedom (2 plans) — Any-to-any phase transitions, no guards or dialogs
- [x] Phase 52: Trade Simplification (4 plans) — SIMPLE_TRADES (12 trades), TradeCombobox, all subcontractor surfaces updated

**Archive:** [.planning/milestones/v1.7-ROADMAP.md](./milestones/v1.7-ROADMAP.md)

</details>

<details>
<summary>✅ v1.8 New Project Page Stage 1 (Phases 53-56) — SHIPPED Feb 25, 2026</summary>

**Delivered:** Streamlined new project form with Building Dimensions + Customer Budget, financial KPI stat bar (Profit/Margin/Customer Budget), Overview tab rebuilt with Notes section, Documents tab with inline editing and Status removal.

**Phases:**
- [x] Phase 53: New Project Form Cleanup + Schema (2 plans) — 5 DB columns, click-to-edit Project Number, Building Dimensions, Customer Budget, legacy sections removed
- [x] Phase 54: Project Header Updates (3 plans) — Projected Profit/Margin/Customer Budget KPIs, Start/End date pickers, Team Members KPI removed
- [x] Phase 55: Overview Tab Redesign + Notes (3 plans) — Flat Dimensions grid, compact Team Members, project_notes table + notesRouter, Notes section with reverse-chron display
- [x] Phase 56: Documents Tab Cleanup (3 plans) — document.update mutation, 7-column table with inline edit, PDF inline preview, file Type filter, Status removed

**Archive:** [.planning/milestones/v1.8-ROADMAP.md](./milestones/v1.8-ROADMAP.md)

</details>
