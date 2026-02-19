# Roadmap: ConstructionSaaS

## Milestones

- ✅ **v1.0 MVP** — Phases 1-12 (shipped Feb 14, 2026)
- ✅ **v1.1 Enterprise UX Redesign** — Phases 13-19 (shipped Feb 16, 2026)
- ✅ **v1.2 Job Number System Fixes & Reliability** — Phases 20-24 (shipped Feb 17, 2026)
- ✅ **v1.3 Polish & Gap Closure** — Phases 25-29 (shipped Feb 18, 2026)
- ✅ **v1.4 Rebranding & UX Upgrades** — Phases 30-35 (shipped Feb 18, 2026)
- 📋 **v1.5 Lifecycle, PDF Generation & Document Redesign** — Phases 36-40 (planned)

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

---

## Active Milestone

<details open>
<summary>📋 v1.5 Lifecycle, PDF Generation & Document Redesign (Phases 36-40) — IN PROGRESS</summary>

**Goal:** Replace the flat project status model with a 9-phase state machine, add Simple vs GC complexity modes, generate professional PDF documents from within the app, redesign the document management system, and add project deletion.

**Build order is strictly sequential.** Phase 36 (lifecycle foundation) is a hard prerequisite for all downstream phases. Phase 38 (PDF generation) must be stable before Phase 39 (custom templates). Phase 40 (document redesign) depends on the documentType taxonomy finalized in Phases 38-39.

**Requirements coverage:** 30/30 v1.5 requirements mapped across 5 phases.

---

### Phase 36: Project Lifecycle State Machine + Simple/GC Mode

**Goal:** Every project in the system has a verified lifecycle phase and a complexity mode. The old flat status field is replaced.

**Depends on:** Phase 35 (v1.4 complete)

**Requirements:** LIFE-01, LIFE-02, LIFE-03, LIFE-04, LIFE-05, LIFE-06, MODE-01, MODE-02, MODE-03, MODE-04

**Plans:** 7/7 plans complete

Plans:
- [ ] 36-01-PLAN.md — Shared types + Drizzle schema (enums, LIFECYCLE_ORDER, projectLifecycleTransitions table)
- [ ] 36-02-PLAN.md — Database migration + lifecycle state machine logic module
- [ ] 36-03-PLAN.md — API mutations (transitionLifecyclePhase, setMode, getTransitionHistory, auto-advance hook)
- [ ] 36-04-PLAN.md — LifecyclePhaseBadge component + TransitionHistory feed + project header update
- [ ] 36-05-PLAN.md — Project list phase column + mode dropdown in project creation form
- [ ] 36-06-PLAN.md — Mode-aware tabs (Simple hides SOV/RFQs) + billing category in Simple estimates + lien waivers hidden in Simple mode
- [ ] 36-07-PLAN.md — Phase-conditional feature gating (LIFE-06): isFeatureAvailableInPhase helper, Change Orders Active+ guard, Estimates edit-lock post-Estimating

**Success Criteria** (what must be TRUE when this phase is complete):
1. Every project displays a color-coded lifecycle phase badge (Opportunity / Estimating / Submitted / Awarded / Active / Substantial Completion / Closed / Warranty / Archived) in the project list and project header — the old status field is gone from all UI surfaces.
2. An admin can manually advance a project to the next lifecycle phase via a phase transition action; forward-only transitions are enforced, and a backward transition requires an admin override with an explicit reason.
3. The system automatically advances projects through lifecycle phases based on system events (e.g., first estimate created moves the project from Opportunity to Estimating); auto-advance triggers are audited identically to manual transitions.
4. Every phase transition — manual or auto-triggered — writes an audit log entry recording the user or system actor, old phase, new phase, reason, and timestamp.
5. When creating a new project, the user selects Simple or GC/Advanced mode; the mode is visible as a read-only badge after the project reaches Active phase, and mode-appropriate features are shown or hidden (Simple hides CSI breakdown, SOV builder, subcontractor bid management, and lien waivers).
6. All existing projects are migrated to the nearest equivalent lifecycle phase and assigned GC/Advanced mode, with zero data loss and a recoverable rollback path.

---

### Phase 37: Project Deletion with Safeguards

**Goal:** Admins can permanently remove projects that have not progressed to financial activity, with a soft-delete safety net.

**Depends on:** Phase 36 (lifecycle phase required to gate deletion)

**Requirements:** DEL-01, DEL-02, DEL-03, DEL-04, DEL-05

**Plans:** 2 plans

Plans:
- [ ] 37-01-PLAN.md — DB schema columns, migration, shared types, 5 new tRPC procedures (checkDeletable, softDelete, restore, listDeleted, acknowledgeRestore)
- [ ] 37-02-PLAN.md — DeleteProjectButton compound component, table/header integration, Deleted Projects settings page

**Success Criteria** (what must be TRUE when this phase is complete):
1. An admin sees a "Delete Project" action on both the project detail page and the projects table row menu; non-admin users see no delete option on either surface.
2. Attempting to delete a project in Awarded, Active, Substantial Completion, Closed, or Warranty phase — or any project with existing change orders, payment applications, or committed costs — produces a clear blocking error message explaining why deletion is prevented.
3. A deletable project (Opportunity, Estimating, or Submitted phase with no financial records) triggers a confirmation dialog that requires the user to enter a reason for deletion before the delete action is enabled.
4. Deleted projects are soft-deleted (deleted_at and deleted_by timestamps set); the project disappears from all standard views, an admin recovery path exists for 30 days, and all deletion actions appear in the audit trail.

---

### Phase 38: PDF Generation + Document Naming

**Goal:** Users can generate a professional, branded PDF for any Proposal, Change Order, Payment Application, or RFQ directly from the relevant section of a project — and every generated document receives a consistent, auto-numbered filename.

**Depends on:** Phase 36 (lifecycle state referenced in PDFs; phase gates which doc types are generatable)

**Requirements:** PDF-01, PDF-02, PDF-03, PDF-04, PDF-05, PDF-06, NAME-01, NAME-02, NAME-03, NAME-04

**Estimated plans:** ~5

**Success Criteria** (what must be TRUE when this phase is complete):
1. From the Estimates section, clicking "Generate Proposal PDF" produces a downloadable PDF containing company logo, project name and address, estimate line items with quantities and rates, subtotals, total, and signature blocks — using the company's brand colors if configured.
2. From the Change Orders section, clicking "Generate PDF" on an approved or pending CO produces a downloadable PDF containing project name/number, CO number, description, cost breakdown by labor/materials, contract sum impact, schedule impact, and AIA-format signature blocks.
3. From the Payment Applications section, clicking "Generate PDF" produces an AIA G702/G703-compliant document auto-populated from the payment application record, including owner/contractor/architect project info, application number, period dates, contract price, retainage percentage, amount due, and SOV breakdown by cost code.
4. From the Bidding/Procurement section, clicking "Generate RFQ PDF" produces a downloadable PDF containing project name/address, scope items with description/qty/unit, submission deadline, and payment terms.
5. Every generated PDF is stored in the project's document library immediately upon generation and is accessible for download from the document list without re-generating.
6. In Company Settings, an admin can configure a naming format per document type using supported variables ({JOB-NUMBER}, {PROJECT-NAME}, {DOC-TYPE}, {SEQ}, {YEAR}, {MONTH}, {DATE}); a live preview shows the resulting filename; the sequence counter auto-increments atomically on each generation; documents generated without a custom convention use the default {DOC-TYPE}-{JOB-NUMBER}-{DATE} pattern.

**Plans:** TBD

---

### Phase 39: Custom Template Import + Field Mapping

**Goal:** A company admin can upload a branded Word or Excel template, map its merge fields to BIDAXIOM data, and activate it as the default for a document type — replacing the built-in layout with the company's own design.

**Depends on:** Phase 38 (core PDF pipeline must be stable before extending to arbitrary user templates)

**Requirements:** TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05, TMPL-06

**Estimated plans:** ~4

**Success Criteria** (what must be TRUE when this phase is complete):
1. An admin can upload a .docx or .xlsx file in Company Settings → Document Templates for any of the 4 document types; the system automatically detects all merge fields (e.g., {{project_name}}, {{total_amount}}) present in the file and presents them in a visual mapping interface.
2. The field mapping interface shows a progress indicator (e.g., "8 of 10 fields mapped") and prevents saving the template until every detected field is either mapped to a BIDAXIOM data field or explicitly marked as static text.
3. After completing field mapping, the admin can generate a preview PDF using sample data to verify layout and field substitution before activating the template — the preview uses the same rendering path as production generation.
4. A company can have one active template per document type; additional uploaded templates are stored but inactive; activating a new template does not delete or alter previously generated documents, which retain a reference to the exact template version used to produce them.

**Plans:** TBD

---

### Phase 40: Document System Redesign

**Goal:** The project Documents section is a unified flat table where every document — generated PDFs, uploaded files, RFIs, submittals, transmittals — is discoverable by type, status, date, or author without navigating folder trees.

**Depends on:** Phases 38-39 (documentType taxonomy must be finalized before existing documents are migrated to it)

**Requirements:** DOC-01, DOC-02, DOC-03, DOC-04, DOC-05

**Estimated plans:** ~4

**Success Criteria** (what must be TRUE when this phase is complete):
1. The project Documents section presents all documents (RFIs, submittals, transmittals, change orders, payment applications, proposals, and uploaded files) in a single flat table — the folder tree and tab navigation are gone.
2. Each table row displays: document name, type badge, status badge (Draft / Submitted / Approved / Rejected), related entity (e.g., "CO-005"), created by, created date, and a download link.
3. The table supports URL-state filters (via nuqs) for document type, status, date range, and author; applying a type filter reproduces the previous per-tab experience (e.g., filtering by "Submittal" shows all submittals).
4. Clicking a row for an RFI, Submittal, or Transmittal opens the full existing workflow detail view — approval chains, revisions, and comments are fully preserved and accessible from the flat table.

**Plans:** TBD

---

</details>

---

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1-12 | v1.0 | 60/60 | ✅ Complete | 2026-02-14 |
| 13-19 | v1.1 | 50/50 | ✅ Complete | 2026-02-16 |
| 20-24 | v1.2 | 12/12 | ✅ Complete | 2026-02-17 |
| 25-29 | v1.3 | 16/16 | ✅ Complete | 2026-02-18 |
| 30-35 | v1.4 | 16/16 | ✅ Complete | 2026-02-18 |
| 36 | v1.5 | Complete    | 2026-02-19 | - |
| 37 | v1.5 | 0/2 | Not started | - |
| 38 | v1.5 | 0/~5 | Not started | - |
| 39 | v1.5 | 0/~4 | Not started | - |
| 40 | v1.5 | 0/~4 | Not started | - |
