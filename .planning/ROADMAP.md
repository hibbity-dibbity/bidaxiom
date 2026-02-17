# Roadmap: ConstructionSaaS

## Milestones

- ✅ **v1.0 MVP** — Phases 1-12 (shipped Feb 14, 2026)
- ✅ **v1.1 Enterprise UX Redesign** — Phases 13-19 (shipped Feb 16, 2026)
- 🚧 **v1.2 Job Number System Fixes** — Phases 20-24 (started Feb 17, 2026)

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

---

## Current Milestone: v1.2 Job Number System Fixes

**Started:** 2026-02-17
**Goal:** Fix broken job number auto-generation system and ensure reliable increment tracking across all project touchpoints.
**Phases:** 20-24 (5 phases total)
**Requirements:** 16 (across 5 categories)

### Phases

- [x] **Phase 20: Configuration Foundation** - Restore job number configuration UI and settings (completed 2026-02-17)
- [ ] **Phase 21: Assignment & Auto-Generation** - Fix core auto-generation and manual assignment logic
- [ ] **Phase 22: Validation & Duplicate Prevention** - Prevent duplicate job numbers and enforce format validation
- [ ] **Phase 23: Display & Integration** - Ensure job numbers display across all UI touchpoints
- [ ] **Phase 24: Year Rollover Logic** - Implement year transition and sequence reset handling

## Phase Details

### Phase 20: Configuration Foundation
**Goal**: Company admins can configure job number format, starting sequence, and auto-generation settings through a visible and functional UI.

**Depends on**: Nothing (first phase)

**Requirements**: JOBCFG-01, JOBCFG-02, JOBCFG-03, JOBCFG-04

**Success Criteria** (what must be TRUE):
1. Admin can access job number configuration section in company settings page
2. Admin can set job number format pattern (e.g., "YY-####")
3. Admin can set starting sequence number (e.g., 1001)
4. Admin can toggle auto-generation on/off via checkbox
5. Configuration changes save successfully and persist across sessions

**Plans**: 3 plans in 1 wave

Plans:
- [x] 20-01-PLAN.md — Verify and fix configuration persistence (data integrity, mutation logic)
- [x] 20-02-PLAN.md — Enhanced validation and preview (error messages, inline feedback)
- [x] 20-03-PLAN.md — Schema mismatch fix for company settings

---

### Phase 21: Assignment & Auto-Generation
**Goal**: New projects receive job numbers automatically when auto-generation is enabled, with manual override support and correct counter incrementation.

**Depends on**: Phase 20 (configuration must exist)

**Requirements**: JOBASGN-01, JOBASGN-02, JOBASGN-03, JOBASGN-04, JOBASGN-05

**Success Criteria** (what must be TRUE):
1. When auto-generation enabled, new project receives job number automatically on creation
2. User can manually enter custom job number on project creation form (field is visible)
3. Manual job number entry increments the auto-generation counter to prevent future duplicates
4. Auto-generation counter persists correctly across multiple sequential project creations
5. Job number field is visible and functional on new project form (not hidden)

**Plans**: 2 plans in 1 wave

Plans:
- [ ] 21-01-PLAN.md — Server-side auto-generation and counter increment logic
- [ ] 21-02-PLAN.md — Job number field visibility and UX improvements

---

### Phase 22: Validation & Duplicate Prevention
**Goal**: System prevents duplicate job numbers and validates format compliance with clear error messages.

**Depends on**: Phase 21 (assignment logic must work)

**Requirements**: JOBVAL-01, JOBVAL-02, JOBVAL-03

**Success Criteria** (what must be TRUE):
1. Attempting to create project with duplicate job number shows validation error
2. Job number format must match configured pattern (validated on submission)
3. Clear, actionable error messages appear when validation fails (not generic "Error")

**Plans**: 4 plans in 3 waves

Plans:
- [ ] 22-01-PLAN.md — Backend foundation: upgrade checkJobNumberAvailability (ilike, excludeProjectId, name+slug) and export validation utils from shared
- [ ] 22-02-PLAN.md — New project form blur validation (format check + duplicate detection with clickable error link)
- [ ] 22-03-PLAN.md — Edit project page creation with pre-filled form and blur validation (self-exclusion via excludeProjectId)
- [ ] 22-04-PLAN.md — Human verification of validation UX on both forms

---

### Phase 23: Display & Integration
**Goal**: Job numbers display prominently across all project touchpoints (list, detail, cards, estimates).

**Depends on**: Phase 21 (job numbers must be assigned correctly)

**Requirements**: JOBDISP-01, JOBDISP-02, JOBDISP-03, JOBDISP-04

**Success Criteria** (what must be TRUE):
1. Job numbers appear as column in project list/table view
2. Job number displays prominently in project detail page header
3. Job numbers display on project cards if card view exists
4. Job numbers carry through from estimates to projects after conversion

**Plans**: TBD

---

### Phase 24: Year Rollover Logic
**Goal**: Job number sequence resets correctly when year changes, preserving existing project job numbers.

**Depends on**: Phase 21 (auto-generation must work)

**Requirements**: JOBROLL-01, JOBROLL-02, JOBROLL-03

**Success Criteria** (what must be TRUE):
1. When new year starts, sequence counter resets to configured starting number
2. Year component in job number (YY or YYYY) updates automatically for new projects
3. Existing projects retain their original job numbers after year rollover (no retroactive changes)

**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 20. Configuration Foundation | 3/3 | Complete    | 2026-02-17 |
| 21. Assignment & Auto-Generation | 0/2 | Not started | - |
| 22. Validation & Duplicate Prevention | 0/4 | Not started | - |
| 23. Display & Integration | 0/0 | Not started | - |
| 24. Year Rollover Logic | 0/0 | Not started | - |

**Overall Milestone Progress**: 20% (1 of 5 phases complete)

---

*Roadmap created: 2026-02-10 (v1.0)*
*Last updated: 2026-02-17 after Phase 22 planning*
