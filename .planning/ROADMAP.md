# Roadmap: ConstructionSaaS

## Overview

A cloud-first construction management SaaS that enables GCs and subs to collaborate on the full project financial lifecycle. The roadmap delivers this value through two major milestones:

**v1.0 (Complete):** Foundation through Custom Authentication - Phases 1-12 deliver the core platform with authentication, multi-tenant isolation, company configuration, project management, budget tracking, change orders, payment applications, bidding workflows, QuickBooks integration, enhanced document management, reporting and analytics, and calendar integration.

**v1.1 (In Progress):** Enterprise UX Redesign - Phases 13-19 transform the UI/UX from functional MVP to enterprise-grade tool optimized for solo operators with Procore-style density, guided workflows, and modern navigation patterns.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

### v1.0 Phases (Complete)

- [x] **Phase 1: Foundation & Multi-Tenant Infrastructure** - Authentication, tenant isolation, audit logging, authorization
- [x] **Phase 2: Company Setup & Configuration** - Company types, trade configuration, CSI-based standards
- [x] **Phase 3: Project Management Core** - Project creation, access control, document management
- [x] **Phase 4: Budget & Cost Tracking** - Cost codes, budget vs actuals, committed costs, forecasting
- [x] **Phase 5: Change Order Management** - Owner/internal/sub change orders, approval workflows, audit trail
- [x] **Phase 6: Payment Applications** - AIA G702/G703 forms, retainage, lien waivers, invoice tracking
- [x] **Phase 7: Bidding & Procurement** - RFQ issuance, bid collection, comparison, directory, versioning
- [x] **Phase 8: QuickBooks Integration** - OAuth connection, bi-directional sync, error handling
- [x] **Phase 9: Document Management Enhancement** - Versioning, workflows (RFI/Submittal/Transmittal), granular permissions, tagging
- [x] **Phase 10: Reporting & Analytics** - Pre-built reports, custom builder, dashboards, export (PDF/Excel/CSV), scheduled delivery
- [x] **Phase 11: Calendar Integration** - Google/Outlook sync, project milestones on calendars
- [x] **Phase 12: Custom Authentication Migration** - Replace Clerk with custom auth (JWT, sessions, MFA, org management)

### v1.1 Phases (Enterprise UX Redesign)

- [ ] **Phase 13: Navigation & Theme Foundation** - Unified top bar, contextual sidebar, dark mode with FOUC prevention, company branding
- [ ] **Phase 14: Form Standardization & Validation** - Standardized inputs (phone, address, date), centralized Zod schemas, backward compatible validation
- [ ] **Phase 15: Dashboard Redesign** - KPI widgets (user-level and company-level), task management, pipeline visibility
- [ ] **Phase 16: Projects Interface Redesign** - Compact table view, advanced filtering (nuqs), slug-safe URLs, persistent header
- [ ] **Phase 17: Estimating Workflow - Setup & Core** - Guided step-by-step builder, cost code templates, labor rates, SOV builder
- [ ] **Phase 18: Estimating Workflow - Lifecycle & Conversion** - Bid generation, submission, won/lost tracking, conversion to active project
- [ ] **Phase 19: Component Library & Architecture** - Reusable UI system, clean routing, dynamic content loading, architectural polish

## Phase Details

### v1.0 Phase Details

### Phase 1: Foundation & Multi-Tenant Infrastructure
**Goal**: Users can securely authenticate and all data is isolated by company with full audit trails
**Depends on**: Nothing (first phase)
**Requirements**: IDMT-01, IDMT-02, IDMT-03, IDMT-04, IDMT-05, IDMT-06, IDMT-07, IDMT-08, IDMT-09, IDMT-10, RWEB-01, RWEB-02
**Success Criteria** (what must be TRUE):
  1. User can create account with email/password and log in across browser sessions
  2. Admin and financial users are required to use MFA to access the platform
  3. User can belong to multiple organizations and companies with different roles in each
  4. All data requests are scoped to correct company schema with no cross-company data leakage
  5. Sensitive actions (financial changes, bid submissions, schedule updates) are immutably audit-logged
  6. Application is fully functional on desktop, tablet, and mobile browsers
**Plans**: 8 plans across 7 waves

Plans:
- [x] 01-01: Monorepo scaffolding, Next.js + Fastify + Tailwind + shadcn/ui (wave 1)
- [x] 01-02: Clerk auth, sign-in/sign-up pages, MFA enforcement, DB schemas (wave 2)
- [x] 01-03: Tenant schema provisioning via Clerk webhooks (wave 3)
- [x] 01-04: tRPC setup with tenant context propagation (wave 4)
- [x] 01-05: CASL authorization — roles, abilities, middleware (wave 5)
- [x] 01-06: App shell — collapsible sidebar, company switcher, responsive layout (wave 5)
- [x] 01-07: Immutable audit logging with triggers (wave 6)
- [x] 01-08: End-to-end integration smoke test (wave 7)

### Phase 2: Company Setup & Configuration
**Goal**: Companies can self-identify type and configure trades with CSI standards plus custom specialties
**Depends on**: Phase 1
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05
**Success Criteria** (what must be TRUE):
  1. Company can self-identify as GC-only, Sub-only, or Both (hybrid)
  2. Company can configure trades from CSI-based standard list plus add custom specialty trades
  3. Trade configuration affects RFQ filtering and bid categorization but never mutates historical data
**Plans**: 2 plans across 2 waves

Plans:
- [x] 02-01-PLAN.md — Backend: DB schema with effective dating, CSI seed data, company tRPC router (wave 1)
- [x] 02-02-PLAN.md — Frontend: Company setup UI with type selection, trade combobox, custom trades (wave 2)

### Phase 3: Project Management Core
**Goal**: Users can create projects with team access controls and manage versioned documents
**Depends on**: Phase 2
**Requirements**: PROJ-01, PROJ-02, PROJ-03, PROJ-04, PROJ-05, PROJ-06
**Success Criteria** (what must be TRUE):
  1. User can create project with name, location, type, dates, team, configurable phases and cost codes
  2. User can view project dashboard showing budget status, schedule, and recent activity
  3. User can upload documents (contracts, invoices, specs) with folder structure and version control
  4. Project has explicit, audited access control (who can see/edit what) enforced on every request
**Plans**: 5 plans across 3 waves

Plans:
- [x] 03-01-PLAN.md — DB schema, shared types, CASL abilities for projects (wave 1)
- [x] 03-02-PLAN.md — MinIO Docker service and S3 storage client (wave 1)
- [x] 03-03-PLAN.md — Project tRPC router with CRUD and team management (wave 2)
- [x] 03-04-PLAN.md — Document tRPC router with upload, versioning, folders (wave 2)
- [x] 03-05-PLAN.md — Frontend: project list, creation, dashboard, document browser (wave 3)

### Phase 4: Budget & Cost Tracking
**Goal**: Users can track project budgets against actuals and committed costs with real-time forecasting
**Depends on**: Phase 3
**Requirements**: BUDG-01, BUDG-02, BUDG-03, BUDG-04, BUDG-05, BUDG-06
**Success Criteria** (what must be TRUE):
  1. User can create project budget with line items mapped to CSI cost codes (configurable per company)
  2. User can view budget vs actuals vs committed costs in real-time dashboard
  3. User can track committed costs (subcontracts and purchase orders) against budget
  4. User can generate cost-to-complete forecasts based on current actuals and commitments
  5. Budget line items lock once payment application is created against them (changes require change order)
**Plans**: 4 plans across 4 waves

Plans:
- [x] 04-01-PLAN.md — DB schema, shared types, CASL abilities for budget/commitments (wave 1)
- [x] 04-02-PLAN.md — Budget tRPC router with CRUD, locking, variance, forecast (wave 2)
- [x] 04-03-PLAN.md — Commitment tRPC router with line items, status lifecycle (wave 3)
- [x] 04-04-PLAN.md — Frontend: budget dashboard, line item editor, commitment pages, Recharts (wave 4)

### Phase 5: Change Order Management
**Goal**: Users can create change orders with approval workflows that automatically update budgets
**Depends on**: Phase 4
**Requirements**: CHNG-01, CHNG-02, CHNG-03, CHNG-04, CHNG-05
**Success Criteria** (what must be TRUE):
  1. User can create change orders for owner, internal, and subcontractor types
  2. Change orders automatically update budget when approved via configurable multi-party workflows
  3. PCOs (Pending Change Orders) and approved COs use separate numbering sequences
  4. Change order history is tracked with full audit trail (who, when, old/new values)
**Plans**: 4 plans across 3 waves

Plans:
- [x] 05-01-PLAN.md — DB schema (5 tables), shared types (discriminated union), CASL abilities (wave 1)
- [x] 05-02-PLAN.md — Change order tRPC router with sequential numbering, approval workflow, budget updates (wave 2)
- [x] 05-03-PLAN.md — Frontend: CO list, creation form, detail view, approval panel, history timeline (wave 3)
- [x] 05-04-PLAN.md — Gap closure: Add submit for approval dialog to change order detail page (wave 1)

### Phase 6: Payment Applications
**Goal**: Users can create and track payment applications with retainage and lien waivers
**Depends on**: Phase 5
**Requirements**: PYMT-01, PYMT-02, PYMT-03, PYMT-04, PYMT-05, PYMT-06
**Success Criteria** (what must be TRUE):
  1. User can create pay applications following AIA G702/G703 format with stored materials and retainage
  2. Pay applications have configurable multi-party approval workflow (PM, superintendent, owner)
  3. User can track lien waiver collection status per payment
  4. User can view invoice tracking (AP/AR) with aging reports
  5. Approved pay applications automatically update committed cost actuals in budget
**Plans**: 5 plans

Plans:
- [x] 06-01-PLAN.md — DB schema (7 tables), shared types (SOV, payment app, lien waiver, retainage), CASL abilities (wave 1)
- [x] 06-02-PLAN.md — SOV tRPC router, payment app calculation engine, payment app tRPC router with approval workflow and budget updates (wave 2)
- [x] 06-03-PLAN.md — Lien waiver tRPC router with four-type support, invoice tracking with AP/AR aging reports (wave 2)
- [x] 06-04-PLAN.md — Frontend: SOV editor, payment app list/create/detail (G702/G703), lien waiver tracker, aging reports, project navigation (wave 3)
- [x] 06-05-PLAN.md — Gap closure: Add budget actualCost column, retainageConfig to company profiles, update payment app approval to write budget actuals (wave 1)

### Phase 7: Bidding & Procurement
**Goal**: GCs can issue RFQs and subs can respond with versioned bids that convert to budget commitments
**Depends on**: Phase 4
**Requirements**: BIDS-01, BIDS-02, BIDS-03, BIDS-04, BIDS-05, BIDS-06, BIDS-07
**Success Criteria** (what must be TRUE):
  1. GC user can create and issue RFQs to subcontractors (in-platform and external invitations)
  2. Sub user can respond to RFQs with bid submissions
  3. User can compare bids side-by-side with scope leveling
  4. User can maintain subcontractor directory with trades and past bid history
  5. RFQs support versioning and amendments (immutable originals with amendment trail)
  6. Bids support snapshot versioning with upstream change notifications
  7. Awarded bids can be converted into budget commitments
**Plans**: 5 plans across 3 waves

Plans:
- [x] 07-01-PLAN.md — DB schema (7 tables), shared bidding types, CASL abilities (wave 1)
- [x] 07-02-PLAN.md — RFQ tRPC router with lifecycle, amendments, invitations + subcontractor directory router (wave 2)
- [x] 07-03-PLAN.md — Bid tRPC router with versioning, comparison, leveling, award-to-commitment (wave 2)
- [x] 07-04-PLAN.md — Frontend: RFQ list, creation, detail, bid comparison pages (wave 3)
- [x] 07-05-PLAN.md — Frontend: subcontractor directory pages, sidebar navigation (wave 3)

### Phase 8: QuickBooks Integration
**Goal**: Companies can connect QuickBooks with bi-directional sync for projects, invoices, and bills
**Depends on**: Phase 6
**Requirements**: QBKS-01, QBKS-02, QBKS-03, QBKS-04, QBKS-05
**Success Criteria** (what must be TRUE):
  1. Company can connect QuickBooks Online account via OAuth
  2. Projects sync bi-directionally between platform and QuickBooks
  3. Invoices and bills sync bi-directionally with QuickBooks
  4. User can view sync status and last successful sync timestamp
  5. Sync failures are queued for retry with user notification
**Plans**: 5 plans across 3 waves

Plans:
- [x] 08-01-PLAN.md — DB schema (3 QBO tables), shared types, CASL abilities (wave 1)
- [x] 08-02-PLAN.md — OAuth module, token encryption, BullMQ queue, QBO client factory (wave 1)
- [x] 08-03-PLAN.md — Sync workers, entity mappers (project/invoice/bill), CDC fallback (wave 2)
- [x] 08-04-PLAN.md — tRPC quickbooks router, webhook handler, server registration (wave 2)
- [x] 08-05-PLAN.md — Frontend: integrations settings page, sync status, OAuth callback (wave 3)

### Phase 9: Document Management Enhancement
**Goal**: Enhance existing document system with enterprise features - versioning, workflows, permissions, and tagging
**Depends on**: Phase 3 (builds on existing document infrastructure)
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06
**Success Criteria** (what must be TRUE):
  1. Documents can be tagged and categorized for advanced search and filtering
  2. Users can share documents with granular permissions (view/edit) beyond project team
  3. Documents can be part of formal workflows (RFI, Submittal, Transmittal) with approval chains
  4. Workflow approvals follow configurable multi-step processes with role-based access
  5. All document access and workflow actions are fully audited
  6. Users can search documents by name, tags, category, and content type
**Plans**: 8 plans across 3 waves

Plans:
- [x] 09-01-PLAN.md — DB schema for tags, categories, access logs, permissions (wave 1)
- [x] 09-02-PLAN.md — Document tagging and search API procedures (wave 2)
- [x] 09-03-PLAN.md — Granular permissions schema and CASL enhancements (wave 2)
- [x] 09-04-PLAN.md — Document/folder sharing API with permission management (wave 3)
- [x] 09-05-PLAN.md — Workflow schema (RFI/Submittal/Transmittal) with approval chains (wave 1)
- [x] 09-06-PLAN.md — Workflow tRPC router with lifecycle and approval procedures (wave 2)
- [x] 09-07-PLAN.md — Frontend: search, tagging, sharing, workflow creation and approval UI (wave 3)
- [x] 09-08-PLAN.md — Gap closure: Complete share dialog with getDocumentPermissions and current shares table (wave 1)

### Phase 10: Reporting & Analytics
**Goal**: Build comprehensive reporting and analytics system with pre-built reports, custom builder, dashboards, and scheduled delivery
**Depends on**: Phases 3-9 (all data sources)
**Requirements**: REPT-01, REPT-02, REPT-03, REPT-04, REPT-05, REPT-06
**Success Criteria** (what must be TRUE):
  1. Users can create custom reports with visual builder (drag-and-drop columns, filters)
  2. Pre-built report templates cover common use cases (project status, budget variance, payment status, change orders, bid comparison)
  3. Reports can be exported to PDF, Excel, and CSV formats
  4. Interactive dashboards display charts and graphs using recharts
  5. Financial analytics calculate industry-standard metrics (CPI, earned value, cash flow projections)
  6. Reports can be scheduled for automatic email delivery (daily, weekly, monthly, quarterly)
  7. Materialized views cache report data for performance (1-hour TTL)
  8. Role-based access controls report creation and viewing
**Plans**: 5 plans across 3 waves

Plans:
- [x] 10-01-PLAN.md — DB schema (report definitions, templates, schedules, materialized data), shared types, CASL abilities (wave 1)
- [x] 10-02-PLAN.md — Report execution engine, query builder, analytics calculator, report tRPC router (wave 2)
- [x] 10-03-PLAN.md — Export services (PDF via puppeteer, Excel via exceljs, CSV), download endpoints (wave 2)
- [x] 10-04-PLAN.md — Scheduled delivery (BullMQ job processor, nodemailer email sender, schedule router) (wave 2)
- [x] 10-05-PLAN.md — Frontend: report list, builder with drag-and-drop, filter UI, chart preview, export/schedule dialogs, pre-built templates (wave 3)

### Phase 11: Calendar Integration
**Goal**: Users can connect calendars with bi-directional sync of project milestones
**Depends on**: Phase 3
**Requirements**: CALR-01, CALR-02, CALR-03
**Success Criteria** (what must be TRUE):
  1. User can connect Google Calendar or Outlook/Microsoft 365 calendar
  2. Calendar events sync bi-directionally at company and user level
  3. Project milestones and deadlines appear on connected calendars
**Plans**: 5 plans across 3 waves

Plans:
- [x] 11-01-PLAN.md — DB schema (3 calendar tables), shared types, CASL abilities (wave 1)
- [x] 11-02-PLAN.md — Google and Microsoft OAuth modules, client factories, BullMQ queue (wave 1)
- [x] 11-03-PLAN.md — Sync workers, event mappers, webhook handlers (wave 2)
- [x] 11-04-PLAN.md — tRPC calendar router, webhook routes, OAuth callbacks, worker startup (wave 2)
- [x] 11-05-PLAN.md — Frontend: calendar connection cards, sync status, OAuth callback, project sync (wave 3)

### Phase 12: Custom Authentication Migration
**Goal**: Replace Clerk with a custom-built authentication system to eliminate third-party dependency, reduce costs, and gain full control over auth flows
**Depends on**: Phase 11 (all features complete before migration)
**Requirements**: AUTH-01 through AUTH-08 (derived from success criteria)
**Success Criteria** (what must be TRUE):
  1. Custom JWT-based authentication replaces all Clerk auth flows (sign-in, sign-up, password reset)
  2. Custom MFA implementation (TOTP authenticator app) replaces Clerk MFA
  3. Custom organization/company management replaces Clerk Organizations
  4. Custom invitation system replaces Clerk invitation flow
  5. All existing user sessions are migrated without requiring re-registration
  6. Role-based access control continues to work identically (CASL integration preserved)
  7. Webhook-based tenant provisioning replaced with direct provisioning on org creation
  8. Zero Clerk dependencies remain in codebase
**Plans**: 8 plans across 5 waves

Plans:
- [x] 12-01-PLAN.md — Auth schema (7 tables), dependencies install, JWT/password/MFA/token/rate-limit utility modules (wave 1)
- [x] 12-02-PLAN.md — Auth tRPC router (register, login, refresh, verify-email, reset-password, MFA setup/verify, org switch) + email service (wave 2)
- [x] 12-03-PLAN.md — Organization management tRPC router (create, invite, members, roles) with direct tenant provisioning (wave 2)
- [x] 12-04-PLAN.md — API auth switchover: replace Clerk JWT verification with custom JWT in context, procedures, tenant resolution (wave 3)
- [x] 12-05-PLAN.md — Frontend auth infrastructure: iron-session, AuthProvider, custom middleware, tRPC token forwarding (wave 3)
- [x] 12-06-PLAN.md — Frontend auth pages: sign-in, sign-up, verify-email, reset-password, MFA setup (wave 4)
- [x] 12-07-PLAN.md — Frontend dashboard components: company switcher, user menu, onboarding, members page (wave 4)
- [x] 12-08-PLAN.md — Clerk removal: uninstall dependencies, remove webhooks, cleanup, data migration script (wave 5)

### v1.1 Phase Details (Enterprise UX Redesign)

### Phase 13: Navigation & Theme Foundation
**Goal**: Users navigate via unified top bar and contextual sidebar with dark mode support and company branding
**Depends on**: Phase 12 (v1.0 complete)
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, NAV-05, NAV-06, THEME-01, THEME-02, THEME-03, THEME-04, THEME-05, THEME-06, THEME-07, THEME-08, THEME-09
**Success Criteria** (what must be TRUE):
  1. User navigates via unified top navigation bar with global search, primary modules, profile dropdown, and settings
  2. Global search returns instant results across job numbers, project names, and customer names
  3. Contextual sidebar displays navigation options based on active page context and can be collapsed with persistent preference
  4. User can toggle dark mode from Account Settings with FOUC prevention via cookie-based theme storage
  5. Company logo displays in top navigation, sidebar (collapsed and expanded), and sign-in page
  6. Layout uses Procore-style compact spacing with sharp corners, consistent typography, and subtle construction accent color
**Plans**: 10 plans (6 original + 4 gap closure)

Plans:
- [x] 13-01-PLAN.md — Dark mode with cookie-based FOUC prevention (wave 1)
- [x] 13-02-PLAN.md — Company branding backend (logo upload schema, S3, tRPC) (wave 1)
- [x] 13-03-PLAN.md — Global search command palette with ⌘K shortcut (wave 2)
- [x] 13-04-PLAN.md — Navigation enhancement (contextual sidebar, URL state, persistent collapse) (wave 2)
- [x] 13-05-PLAN.md — Procore-style design system (compact spacing, sharp corners, typography, accent) (wave 3)
- [x] 13-06-PLAN.md — Company branding UI integration (logo display, upload UI) (wave 3)
- [x] 13-07-PLAN.md — Gap closure: Fix search layout shift and no results bug (wave 1)
- [x] 13-08-PLAN.md — Gap closure: Fix sidebar collapse glitch (wave 1)
- [x] 13-09-PLAN.md — Gap closure: Fix logo upload database column mismatch (wave 1)
- [ ] 13-10-PLAN.md — UAT gap closure: Fix command palette double-Escape bug (wave 1)

### Phase 14: Form Standardization & Validation
**Goal**: All forms use standardized inputs with centralized validation that is backward compatible with existing data
**Depends on**: Phase 13
**Requirements**: FORM-01, FORM-02, FORM-03, FORM-04, FORM-05, FORM-06
**Success Criteria** (what must be TRUE):
  1. Phone number fields enforce (###) ###-#### format with input masking
  2. Address input uses structured fields with state dropdown containing all US states
  3. Form validation rules are centralized in reusable Zod schemas shared between client and server
  4. Form validation errors display consistently across all forms
  5. Existing data validation is backward compatible and does not break historical records
**Plans**: Not yet planned

### Phase 15: Dashboard Redesign
**Goal**: Dashboard displays user-level and company-level KPI widgets with task and pipeline visibility
**Depends on**: Phase 13
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, DASH-08, DASH-09, DASH-10, DASH-11, DASH-12, DASH-13
**Success Criteria** (what must be TRUE):
  1. Dashboard displays user-level widgets: My Active Projects, My Open Bids, My To-Do
  2. Dashboard displays company-level widgets: Total Active Projects, Open Bids, Pending Pay Apps, Bid Opportunities, Revenue in Progress, Backlog, Estimating Pipeline Value
  3. Activity feed is removed from dashboard (moved to Settings)
  4. Invite Team Members widget is removed from dashboard
  5. All "Coming in Phase X" placeholders are replaced with functional widgets or removed
**Plans**: Not yet planned

### Phase 16: Projects Interface Redesign
**Goal**: Projects page displays compact table with advanced filtering and project detail uses persistent header with slug-safe URLs
**Depends on**: Phase 13, Phase 14
**Requirements**: PROJV2-01, PROJV2-02, PROJV2-03, PROJV2-04, PROJV2-05, PROJV2-06, PROJV2-07, PROJV2-08, PROJV2-09, PROJV2-10, PROJV2-11, PROJV2-12, PROJV2-13, PROJV2-14, PROJV2-15
**Success Criteria** (what must be TRUE):
  1. Projects page displays projects in compact table format with columns: Job #, Project Name, Customer Name, Status
  2. Projects can be filtered by Customer, Job #, Status, Date, and Assigned User
  3. Project detail page uses slug-safe URL format: /projects/{jobnumber}-{projectname}
  4. Project detail page displays persistent header with Job #, Project Name, Status, Customer Name (linked), Address, Key Metrics
  5. Project detail page header never reloads when navigating between sections
  6. Project sections load dynamically below persistent header without navigating to new pages
**Plans**: Not yet planned

### Phase 17: Estimating Workflow - Setup & Core
**Goal**: User can create estimates using guided step-by-step workflow with cost code templates, labor rates, and SOV builder
**Depends on**: Phase 14
**Requirements**: EST-01, EST-02, EST-03, EST-04, EST-05, EST-06, EST-07, EST-08, EST-09, EST-10
**Success Criteria** (what must be TRUE):
  1. User can create estimate using guided step-by-step workflow (default mode)
  2. Guided estimate builder includes cost code template selection, labor rate template application, overhead and markup logic configuration, material pricing entry, and SOV builder
  3. Guided estimate builder displays margin visibility throughout workflow
  4. User can switch to spreadsheet-style estimating grid mode via Account Settings preference
  5. Spreadsheet mode allows bulk entry of estimate line items
  6. User can convert completed estimate to budget with one click
**Plans**: Not yet planned

### Phase 18: Estimating Workflow - Lifecycle & Conversion
**Goal**: User can generate bids from estimates, submit, track won/lost, and convert to active projects
**Depends on**: Phase 17
**Requirements**: EST-11, EST-12, EST-13, EST-14, EST-15, EST-16, EST-17
**Success Criteria** (what must be TRUE):
  1. User can generate bid from estimate and submit bid
  2. User can mark bid as Won or Lost
  3. User can convert won bid to active project with one click
  4. Project status transitions are automated based on estimating lifecycle stage
  5. Estimating workflow is designed for minimal cognitive load with clear next steps
  6. Estimating workflow requires minimal clicks between stages
**Plans**: Not yet planned

### Phase 19: Component Library & Architecture
**Goal**: Reusable UI component system is centralized with clean routing and dynamic content loading
**Depends on**: All previous v1.1 phases
**Requirements**: ARCH-01, ARCH-02, ARCH-03, ARCH-04, ARCH-05, ARCH-06, ARCH-07
**Success Criteria** (what must be TRUE):
  1. UI components are modular and reusable across pages
  2. Routing is clean with no unnecessary page refreshes
  3. Content loads dynamically without full page reloads where appropriate
  4. URLs follow hygiene standards (slug-safe, descriptive, bookmarkable)
  5. Reusable UI component system is centralized
  6. Validation layer is centralized and shared between client and server
  7. Architecture maintains scalable SaaS multi-tenant structure
**Plans**: Not yet planned

## Progress

**Execution Order:**
v1.0: Phases 1-12 (complete)
v1.1: Phases 13-19 (in progress)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| **v1.0 Phases** |
| 1. Foundation & Multi-Tenant Infrastructure | 8/8 | Complete | 2026-02-12 |
| 2. Company Setup & Configuration | 2/2 | Complete | 2026-02-12 |
| 3. Project Management Core | 5/5 | Complete | 2026-02-12 |
| 4. Budget & Cost Tracking | 4/4 | Complete | 2026-02-12 |
| 5. Change Order Management | 4/4 | Complete | 2026-02-13 |
| 6. Payment Applications | 5/5 | Complete | 2026-02-13 |
| 7. Bidding & Procurement | 5/5 | Complete | 2026-02-13 |
| 8. QuickBooks Integration | 5/5 | Complete | 2026-02-13 |
| 9. Document Management Enhancement | 8/8 | Complete | 2026-02-13 |
| 10. Reporting & Analytics | 5/5 | Complete | 2026-02-13 |
| 11. Calendar Integration | 5/5 | Complete | 2026-02-14 |
| 12. Custom Authentication Migration | 8/8 | Complete | 2026-02-14 |
| **v1.1 Phases (Enterprise UX Redesign)** |
| 13. Navigation & Theme Foundation | 9/10 | UAT Gap Closure | - |
| 14. Form Standardization & Validation | 0/TBD | Pending | - |
| 15. Dashboard Redesign | 0/TBD | Pending | - |
| 16. Projects Interface Redesign | 0/TBD | Pending | - |
| 17. Estimating Workflow - Setup & Core | 0/TBD | Pending | - |
| 18. Estimating Workflow - Lifecycle & Conversion | 0/TBD | Pending | - |
| 19. Component Library & Architecture | 0/TBD | Pending | - |

---
*Roadmap created: 2026-02-10 (v1.0)*
*Last updated: 2026-02-15 (Phase 13 UAT gap closure plan added)*
