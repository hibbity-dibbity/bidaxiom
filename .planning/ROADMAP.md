# Roadmap: ConstructionSaaS

## Milestones

- ✅ **v1.0 MVP** — Phases 1-12 (shipped Feb 14, 2026)
- ✅ **v1.1 Enterprise UX Redesign** — Phases 13-19 (shipped Feb 16, 2026)
- ✅ **v1.2 Job Number System Fixes & Reliability** — Phases 20-24 (shipped Feb 17, 2026)
- 🚧 **v1.3 Polish & Gap Closure** — Phases 25-29 (started Feb 17, 2026)

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

---

## Current Milestone: v1.3 Polish & Gap Closure

**Milestone Goal:** Complete unfinished routing migrations, fix auth session flows, consolidate account settings, revert to static sidebar, and tighten overall UX reliability across list views, loading states, and error handling.

### Phases

- [x] **Phase 25: Session & Auth Flow** - Immediate redirect on session expiry; return URL after sign-in (completed 2026-02-17)
- [x] **Phase 26: Account Settings & Shell Cleanup** - Consolidated /settings/account page; static sidebar (completed 2026-02-17)
- [x] **Phase 27: Slug Routing Completion** - Customer and subcontractor detail/edit pages on slug URLs (completed 2026-02-17)
- [x] **Phase 28: Search & Dashboard Enhancements** - Estimates in global search; dashboard KPI click-through with pre-filtering (completed 2026-02-18)
- [ ] **Phase 29: UX Polish & Tech Debt** - Empty states, loading states, consistent error toasts, job number counter on edit

### Phase Details

#### Phase 25: Session & Auth Flow
**Goal**: Users are never silently stuck on a stale page — session expiry redirects immediately to sign-in, and users land back where they intended after signing in.
**Depends on**: Nothing (first phase of v1.3)
**Requirements**: SESS-01, SESS-02
**Success Criteria** (what must be TRUE):
  1. When a session expires while a user is on any page, they are automatically redirected to the sign-in page without needing to take an action first
  2. After signing in, the user is taken to the page they originally tried to access (not the default dashboard)
  3. Return URL is preserved correctly across the sign-in flow (no loss on page refresh at sign-in)
**Plans**: 3 plans
Plans:
- [x] 25-01-PLAN.md — Fix return URL (sign-in Server Component refactor + getSafeRedirectUrl + MFA flow)
- [x] 25-02-PLAN.md — Session expiry detection (useSessionWatcher hook + tRPC 401 interceptor)
- [x] 25-03-PLAN.md — Browser UAT verification of SESS-01 and SESS-02

#### Phase 26: Account Settings & Shell Cleanup
**Goal**: All account management is in one place at /settings/account, the user dropdown is clean, and the sidebar always shows the same global navigation items (no project-context switching) while keeping collapse/expand toggle.
**Depends on**: Phase 25
**Requirements**: ACCT-01, ACCT-02, ACCT-03, ACCT-04, NAV-01
**Completed**: 2026-02-17
**Success Criteria** (what must be TRUE):
  1. User can navigate to /settings/account and see a single page that consolidates profile, password change, and MFA configuration
  2. MFA can be enabled, disabled, and reconfigured (QR code setup) from the account settings page
  3. Password can be changed from the account settings page without visiting a separate URL
  4. The user dropdown in the top navigation links directly to /settings/account — no separate "Settings" and "MFA" links
  5. The sidebar always shows global navigation on all pages with no project-context switching; icon-only collapse preserved
**Plans**: 3 plans
Plans:
- [x] 26-01-PLAN.md — API mutations: auth.changePassword and auth.disableMfa
- [x] 26-02-PLAN.md — Shell cleanup: static sidebar, user dropdown consolidation, MFA bug fix, Account Settings card
- [x] 26-03-PLAN.md — Account settings page: Profile, Password Change, MFA sections + human verify

#### Phase 27: Slug Routing Completion
**Goal**: Customer and subcontractor detail and edit pages use human-readable slug URLs, completing the slug routing migration that was finished for projects in v1.1.
**Depends on**: Phase 26
**Requirements**: SLUG-01, SLUG-02, SLUG-03, SLUG-04
**Success Criteria** (what must be TRUE):
  1. Navigating to a customer's detail page produces a slug-based URL (e.g., /customers/abc-construction) not a UUID URL
  2. Editing a customer uses a slug-based URL; saving or navigating away preserves the slug URL pattern
  3. Navigating to a subcontractor's detail page produces a slug-based URL (e.g., /subcontractors/smith-plumbing)
  4. Editing a subcontractor uses a slug-based URL; the URL does not revert to UUID at any point
**Plans**: 3 plans
Plans:
- [ ] 27-01-PLAN.md — Fix project-header UUID link + add edit dialog to customer detail page
- [ ] 27-02-PLAN.md — Subcontractor post-rename slug navigation
- [ ] 27-03-PLAN.md — Browser UAT verification of SLUG-01 through SLUG-04

#### Phase 28: Search & Dashboard Enhancements
**Goal**: Global search surfaces estimates alongside projects and customers with clear type labels, and dashboard KPI widgets navigate to pre-filtered list pages so clicking a widget is immediately useful.
**Depends on**: Phase 27
**Requirements**: SRCH-01, SRCH-02, DASH-01
**Success Criteria** (what must be TRUE):
  1. Typing in global search (⌘K) returns estimate results alongside project and customer results
  2. Each search result displays a type label (Project, Estimate, Customer) so the user can distinguish result types at a glance
  3. Clicking a dashboard KPI widget navigates to the relevant page with filters pre-applied matching the widget's metric (e.g., "My Active Projects" opens projects list filtered to the current user's active projects)
**Plans**: 3 plans
Plans:
- [ ] 28-01-PLAN.md — Estimate search + customer URL bug fix + Estimates CommandGroup in command palette
- [ ] 28-02-PLAN.md — Dashboard KPI widget onClick handlers
- [ ] 28-03-PLAN.md — Browser UAT verification of SRCH-01, SRCH-02, DASH-01

#### Phase 29: UX Polish & Tech Debt
**Goal**: Every list and table view communicates clearly when empty, loading states are consistent across the app, API errors always surface via toast notifications, and manually editing a job number on the edit page correctly advances the auto-generation counter.
**Depends on**: Phase 28
**Requirements**: UX-01, UX-02, UX-03, JOBEDIT-01
**Success Criteria** (what must be TRUE):
  1. List and table views with no records display an informative empty state (message and/or call-to-action) instead of a blank table body
  2. All data-fetching views show a skeleton loader or spinner during fetches rather than blank content areas
  3. API errors across the app surface as toast notifications with actionable messages rather than silent failures or unformatted console errors
  4. When a user manually types a job number on the edit project page and saves, the company's auto-generation counter is updated so the next auto-generated number does not conflict
**Plans**: TBD

---

## Progress

| Phase | Status | Plans | Completed |
|-------|--------|-------|-----------|
| 25 | ✅ Complete | 3/3 | 2026-02-17 |
| 26 | ✅ Complete | 3/3 | 2026-02-17 |
| 27 | ✅ Complete | 3/3 | 2026-02-17 |
| 28 | ⬜ Not started | Complete    | 2026-02-18 |
| 29 | ⬜ Not started | TBD | — |
