# Requirements: ConstructionSaaS

**Defined:** 2026-02-10
**Core Value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Identity & Multi-Tenancy

- [ ] **IDMT-01**: User can create an account with email and password
- [ ] **IDMT-02**: User can log in and session persists across browser refresh
- [ ] **IDMT-03**: User can log out from any page
- [ ] **IDMT-04**: Admin and financial role users are required to use MFA
- [ ] **IDMT-05**: User can belong to multiple parent organizations and companies
- [ ] **IDMT-06**: User roles are contextual per organization, company, and project
- [ ] **IDMT-07**: Each company has isolated database schema with no cross-company data leakage
- [ ] **IDMT-08**: All data requests are scoped to company + project via server-side authorization
- [ ] **IDMT-09**: Sensitive actions (financial changes, bid submissions, schedule updates) are immutably audit-logged
- [ ] **IDMT-10**: Permissions are resolved server-side using policy-based access control (PBAC)

### Company Configuration

- [ ] **COMP-01**: Company can self-identify as GC-only, Sub-only, or Both (hybrid)
- [ ] **COMP-02**: Company can configure trades from CSI-based standard list
- [ ] **COMP-03**: Company can add custom specialty trades with subcategories
- [ ] **COMP-04**: Trade configuration affects RFQ filtering and bid categorization
- [ ] **COMP-05**: Historical data is not mutated when company updates trade configuration

### Projects

- [ ] **PROJ-01**: User can create a project with name, location, type, dates, and team
- [ ] **PROJ-02**: Project supports configurable phases and cost codes
- [ ] **PROJ-03**: Project has explicit, audited access control (who can see/edit what)
- [ ] **PROJ-04**: User can view project dashboard showing budget status, schedule, and activity
- [ ] **PROJ-05**: User can upload and manage project documents (contracts, invoices, specs)
- [ ] **PROJ-06**: Documents have folder structure and version control

### Budget & Cost Tracking

- [ ] **BUDG-01**: User can create project budget with line items mapped to CSI cost codes
- [ ] **BUDG-02**: Cost codes are configurable per company (CSI defaults + custom codes)
- [ ] **BUDG-03**: User can view budget vs actuals vs committed costs in real-time
- [ ] **BUDG-04**: User can track committed costs (subcontracts and purchase orders against budget)
- [ ] **BUDG-05**: User can generate cost-to-complete forecasts
- [ ] **BUDG-06**: Budget line items are locked once a payment application is created against them (changes require change order)

### Change Orders

- [ ] **CHNG-01**: User can create change orders (owner, internal, and subcontractor types)
- [ ] **CHNG-02**: Change orders automatically update budget when approved
- [ ] **CHNG-03**: Change orders have configurable approval workflows (multi-party)
- [ ] **CHNG-04**: Change order history is tracked with full audit trail (who, when, old/new values)
- [ ] **CHNG-05**: PCOs (Pending Change Orders) and approved COs use separate numbering sequences

### Payment Applications

- [ ] **PYMT-01**: User can create pay applications following AIA G702/G703 format
- [ ] **PYMT-02**: Pay applications support stored materials and retainage tracking
- [ ] **PYMT-03**: Pay applications have configurable multi-party approval workflow (PM, superintendent, owner)
- [ ] **PYMT-04**: User can track lien waiver collection status per payment
- [ ] **PYMT-05**: User can view invoice tracking (AP/AR) with aging reports
- [ ] **PYMT-06**: Approved pay applications update committed cost actuals in budget

### Bidding & Procurement

- [ ] **BIDS-01**: GC user can create and issue RFQs to subcontractors (in-platform and external invitations)
- [ ] **BIDS-02**: Sub user can respond to RFQs with bid submissions
- [ ] **BIDS-03**: User can compare bids side-by-side with scope leveling
- [ ] **BIDS-04**: User can maintain a subcontractor directory with trades and past bid history
- [ ] **BIDS-05**: RFQs support versioning and amendments (immutable originals with amendment trail)
- [ ] **BIDS-06**: Bids support snapshot versioning with upstream change notifications
- [ ] **BIDS-07**: Awarded bids can be converted into budget commitments

### QuickBooks Integration

- [ ] **QBKS-01**: Company can connect QuickBooks Online account via OAuth
- [ ] **QBKS-02**: Projects sync bi-directionally between platform and QuickBooks
- [ ] **QBKS-03**: Invoices and bills sync bi-directionally with QuickBooks
- [ ] **QBKS-04**: User can view sync status and last successful sync timestamp
- [ ] **QBKS-05**: Sync failures are queued for retry with user notification

### Calendar Integration

- [ ] **CALR-01**: User can connect Google Calendar or Outlook/Microsoft 365 calendar
- [ ] **CALR-02**: Calendar events sync bi-directionally (company and user level)
- [ ] **CALR-03**: Project milestones and deadlines appear on connected calendars

### Responsive Web Application

- [ ] **RWEB-01**: Application is fully functional on desktop, tablet, and mobile browsers
- [ ] **RWEB-02**: Critical workflows (project dashboard, bid response, pay app review) are optimized for mobile viewport

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Subscription & Tier Control

- **SUBS-01**: Company feature access controlled by subscription tier and add-on modules
- **SUBS-02**: Free sub accounts: company profile, respond to RFQs, limited projects
- **SUBS-03**: Paid sub accounts: full project creation, bid building, downstream RFQs

### AI Engine

- **AIEN-01**: AI-assisted RFQ drafting from project context
- **AIEN-02**: AI-assisted email and report generation
- **AIEN-03**: Template library with AI-enhanced standardization
- **AIEN-04**: Scope review and consistent verbiage assistance
- **AIEN-05**: AI access strictly matches user permissions, per-company data only

### JV Collaboration

- **JVCL-01**: Companies can formally share bids via scoped, time-bound JV agreements
- **JVCL-02**: JV collaboration is audited and revocable
- **JVCL-03**: JV bids integrated into budget

### Communication

- **COMM-01**: RFI management with numbered tracking and response workflow
- **COMM-02**: Submittal management with spec tracking and review workflow
- **COMM-03**: Email integration (two-way sync, associate to projects)

### Advanced Features

- **ADVF-01**: Drawing management with version control and sheet navigation
- **ADVF-02**: Bid package management (drawings, specs, addenda bundling)
- **ADVF-03**: AI bid document parsing (extract from Word/Excel/PDF)
- **ADVF-04**: Multi-project portfolio view with roll-up reporting

### Paid Add-On Modules

- **ADDON-01**: Time & Production Tracking (crew-level, foreman UX, speech-to-text)
- **ADDON-02**: Equipment, Tools & Materials tracking (owned, rented, serialized)
- **ADDON-03**: JV / downstream RFQs

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Owner/client portals | Not contractor-focused, deferred indefinitely |
| Payroll processing / full accounting | QuickBooks handles this — integrate, don't replace |
| Residential construction workflows | Commercial/industrial only |
| Native mobile apps | Responsive web first, native later based on usage patterns |
| CPM scheduling engine | Calendar integration only; Procore/P6 own this space |
| Full JV execution workflows | High complexity; bid sharing deferred to v2, full execution much later |
| Safety management | Highly regulated, liability concerns, specialized domain |
| Quality control / inspections | Procore's differentiator, complex workflows |
| BIM / 3D model viewing | Extremely complex, niche for commercial |
| CRM / pipeline management | Pre-pre-construction bloat |
| Inventory / warehouse management | Track commitments/POs, not warehouse stock |
| Real-time co-editing | High complexity, low v1 priority |
| Banking integration (Plaid) | Defer to v2+ after core financials proven |
| Open-ended per-customer customizations | Only trade & template configuration allowed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| IDMT-01 | Phase 1 | Pending |
| IDMT-02 | Phase 1 | Pending |
| IDMT-03 | Phase 1 | Pending |
| IDMT-04 | Phase 1 | Pending |
| IDMT-05 | Phase 1 | Pending |
| IDMT-06 | Phase 1 | Pending |
| IDMT-07 | Phase 1 | Pending |
| IDMT-08 | Phase 1 | Pending |
| IDMT-09 | Phase 1 | Pending |
| IDMT-10 | Phase 1 | Pending |
| COMP-01 | Phase 2 | Pending |
| COMP-02 | Phase 2 | Pending |
| COMP-03 | Phase 2 | Pending |
| COMP-04 | Phase 2 | Pending |
| COMP-05 | Phase 2 | Pending |
| PROJ-01 | Phase 3 | Pending |
| PROJ-02 | Phase 3 | Pending |
| PROJ-03 | Phase 3 | Pending |
| PROJ-04 | Phase 3 | Pending |
| PROJ-05 | Phase 3 | Pending |
| PROJ-06 | Phase 3 | Pending |
| BUDG-01 | Phase 4 | Pending |
| BUDG-02 | Phase 4 | Pending |
| BUDG-03 | Phase 4 | Pending |
| BUDG-04 | Phase 4 | Pending |
| BUDG-05 | Phase 4 | Pending |
| BUDG-06 | Phase 4 | Pending |
| CHNG-01 | Phase 5 | Pending |
| CHNG-02 | Phase 5 | Pending |
| CHNG-03 | Phase 5 | Pending |
| CHNG-04 | Phase 5 | Pending |
| CHNG-05 | Phase 5 | Pending |
| PYMT-01 | Phase 6 | Pending |
| PYMT-02 | Phase 6 | Pending |
| PYMT-03 | Phase 6 | Pending |
| PYMT-04 | Phase 6 | Pending |
| PYMT-05 | Phase 6 | Pending |
| PYMT-06 | Phase 6 | Pending |
| BIDS-01 | Phase 7 | Pending |
| BIDS-02 | Phase 7 | Pending |
| BIDS-03 | Phase 7 | Pending |
| BIDS-04 | Phase 7 | Pending |
| BIDS-05 | Phase 7 | Pending |
| BIDS-06 | Phase 7 | Pending |
| BIDS-07 | Phase 7 | Pending |
| QBKS-01 | Phase 8 | Pending |
| QBKS-02 | Phase 8 | Pending |
| QBKS-03 | Phase 8 | Pending |
| QBKS-04 | Phase 8 | Pending |
| QBKS-05 | Phase 8 | Pending |
| CALR-01 | Phase 9 | Pending |
| CALR-02 | Phase 9 | Pending |
| CALR-03 | Phase 9 | Pending |
| RWEB-01 | Phase 1 | Pending |
| RWEB-02 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 53 total
- Mapped to phases: 53
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-10*
*Last updated: 2026-02-10 after roadmap creation*
