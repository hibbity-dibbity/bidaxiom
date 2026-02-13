# Roadmap: ConstructionSaaS

## Overview

A cloud-first construction management SaaS that enables GCs and subs to collaborate on the full project financial lifecycle. The roadmap delivers this value through nine phases: foundation (authentication and multi-tenant isolation), company configuration, project management, budget tracking, change orders, payment applications, bidding workflows, and finally external integrations (QuickBooks and calendar). Each phase builds on the previous, establishing data integrity patterns and security boundaries before adding complexity.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Multi-Tenant Infrastructure** - Authentication, tenant isolation, audit logging, authorization
- [x] **Phase 2: Company Setup & Configuration** - Company types, trade configuration, CSI-based standards
- [x] **Phase 3: Project Management Core** - Project creation, access control, document management
- [x] **Phase 4: Budget & Cost Tracking** - Cost codes, budget vs actuals, committed costs, forecasting
- [ ] **Phase 5: Change Order Management** - Owner/internal/sub change orders, approval workflows, audit trail
- [ ] **Phase 6: Payment Applications** - AIA G702/G703 forms, retainage, lien waivers, invoice tracking
- [ ] **Phase 7: Bidding & Procurement** - RFQ issuance, bid collection, comparison, directory, versioning
- [ ] **Phase 8: QuickBooks Integration** - OAuth connection, bi-directional sync, error handling
- [ ] **Phase 9: Calendar Integration** - Google/Outlook sync, project milestones on calendars
- [ ] **Phase 10: Custom Authentication Migration** - Replace Clerk with custom auth (JWT, sessions, MFA, org management)

## Phase Details

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
- [ ] 05-01-PLAN.md — DB schema (5 tables), shared types (discriminated union), CASL abilities (wave 1)
- [ ] 05-02-PLAN.md — Change order tRPC router with sequential numbering, approval workflow, budget updates (wave 2)
- [ ] 05-03-PLAN.md — Frontend: CO list, creation form, detail view, approval panel, history timeline (wave 3)
- [ ] 05-04-PLAN.md — Gap closure: Add submit for approval dialog to change order detail page (wave 1)

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
**Plans**: 4 plans across 3 waves

Plans:
- [ ] 06-01-PLAN.md — DB schema (7 tables), shared types (SOV, payment app, lien waiver, retainage), CASL abilities (wave 1)
- [ ] 06-02-PLAN.md — SOV tRPC router, payment app calculation engine, payment app tRPC router with approval workflow and budget updates (wave 2)
- [ ] 06-03-PLAN.md — Lien waiver tRPC router with four-type support, invoice tracking with AP/AR aging reports (wave 2)
- [ ] 06-04-PLAN.md — Frontend: SOV editor, payment app list/create/detail (G702/G703), lien waiver tracker, aging reports, project navigation (wave 3)

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
- [ ] 07-01-PLAN.md — DB schema (7 tables), shared bidding types, CASL abilities (wave 1)
- [ ] 07-02-PLAN.md — RFQ tRPC router with lifecycle, amendments, invitations + subcontractor directory router (wave 2)
- [ ] 07-03-PLAN.md — Bid tRPC router with versioning, comparison, leveling, award-to-commitment (wave 2)
- [ ] 07-04-PLAN.md — Frontend: RFQ list, creation, detail, bid comparison pages (wave 3)
- [ ] 07-05-PLAN.md — Frontend: subcontractor directory pages, sidebar navigation (wave 3)

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
- [ ] 08-01-PLAN.md -- DB schema (3 QBO tables), shared types, CASL abilities (wave 1)
- [ ] 08-02-PLAN.md -- OAuth module, token encryption, BullMQ queue, QBO client factory (wave 1)
- [ ] 08-03-PLAN.md -- Sync workers, entity mappers (project/invoice/bill), CDC fallback (wave 2)
- [ ] 08-04-PLAN.md -- tRPC quickbooks router, webhook handler, server registration (wave 2)
- [ ] 08-05-PLAN.md -- Frontend: integrations settings page, sync status, OAuth callback (wave 3)

### Phase 9: Calendar Integration
**Goal**: Users can connect calendars with bi-directional sync of project milestones
**Depends on**: Phase 3
**Requirements**: CALR-01, CALR-02, CALR-03
**Success Criteria** (what must be TRUE):
  1. User can connect Google Calendar or Outlook/Microsoft 365 calendar
  2. Calendar events sync bi-directionally at company and user level
  3. Project milestones and deadlines appear on connected calendars
**Plans**: TBD

Plans:
- [ ] 09-01: TBD during planning
- [ ] 09-02: TBD during planning

### Phase 10: Custom Authentication Migration
**Goal**: Replace Clerk with a custom-built authentication system to eliminate third-party dependency, reduce costs, and gain full control over auth flows
**Depends on**: Phase 9 (all features complete before migration)
**Requirements**: TBD during planning
**Success Criteria** (what must be TRUE):
  1. Custom JWT-based authentication replaces all Clerk auth flows (sign-in, sign-up, password reset)
  2. Custom MFA implementation (TOTP authenticator app) replaces Clerk MFA
  3. Custom organization/company management replaces Clerk Organizations
  4. Custom invitation system replaces Clerk invitation flow
  5. All existing user sessions are migrated without requiring re-registration
  6. Role-based access control continues to work identically (CASL integration preserved)
  7. Webhook-based tenant provisioning replaced with direct provisioning on org creation
  8. Zero Clerk dependencies remain in codebase
**Plans**: TBD

Plans:
- [ ] 10-01: TBD during planning
- [ ] 10-02: TBD during planning
- [ ] 10-03: TBD during planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Multi-Tenant Infrastructure | 8/8 | Complete | 2026-02-12 |
| 2. Company Setup & Configuration | 2/2 | Complete | 2026-02-12 |
| 3. Project Management Core | 5/5 | Complete | 2026-02-12 |
| 4. Budget & Cost Tracking | 4/4 | Complete | 2026-02-12 |
| 5. Change Order Management | 0/4 | Not started | - |
| 6. Payment Applications | 0/TBD | Not started | - |
| 7. Bidding & Procurement | 0/TBD | Not started | - |
| 8. QuickBooks Integration | 0/TBD | Not started | - |
| 9. Calendar Integration | 0/TBD | Not started | - |
| 10. Custom Authentication Migration | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-10*
*Last updated: 2026-02-12*
