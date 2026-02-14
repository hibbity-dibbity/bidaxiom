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

## v1.1 Requirements - Enterprise UX Redesign

Requirements for milestone v1.1. Enterprise-grade UI/UX transformation.

### Navigation (NAV)

- [ ] **NAV-01**: Unified top navigation bar displays global search, primary modules, profile dropdown, and settings
- [ ] **NAV-02**: Global search searches across job numbers, project names, and customer names with instant results
- [ ] **NAV-03**: Contextual sidebar updates navigation options based on active page context
- [ ] **NAV-04**: Sidebar can be collapsed and persists user's collapsed/expanded preference
- [ ] **NAV-05**: Navigation patterns are not duplicated (no same action in multiple nav locations)
- [ ] **NAV-06**: Primary module navigation is accessible from all pages via top bar

### Theming & Branding (THEME)

- [ ] **THEME-01**: Dark mode can be toggled from Account Settings (not in top navigation) and persists across sessions
- [ ] **THEME-02**: Dark mode prevents flash of unstyled content (FOUC) using cookie-based theme storage
- [ ] **THEME-03**: Company logo can be uploaded and stored per company
- [ ] **THEME-04**: Company logo displays in top navigation bar
- [ ] **THEME-05**: Company logo displays in collapsed/expanded sidebar
- [ ] **THEME-06**: Company logo displays on sign-in page
- [ ] **THEME-07**: Layout uses Procore-style compact spacing with sharp corners (no border radius on cards)
- [ ] **THEME-08**: Typography follows consistent scale across all pages
- [ ] **THEME-09**: Subtle construction accent color is applied consistently throughout UI

### Forms & Validation (FORM)

- [ ] **FORM-01**: Phone number fields enforce (###) ###-#### format with input masking
- [ ] **FORM-02**: Address input uses structured fields: Street Address 1, Street Address 2, City, State (dropdown), Zip Code
- [ ] **FORM-03**: State dropdown contains all US states for address entry
- [ ] **FORM-04**: Form validation rules are centralized in reusable Zod schemas
- [ ] **FORM-05**: Form validation errors display consistently across all forms
- [ ] **FORM-06**: Existing data validation is backward compatible (doesn't break historical records)

### Dashboard (DASH)

- [ ] **DASH-01**: Dashboard displays user-level "My Active Projects" widget
- [ ] **DASH-02**: Dashboard displays user-level "My Open Bids" widget
- [ ] **DASH-03**: Dashboard displays user-level "My To-Do" widget
- [ ] **DASH-04**: Dashboard displays company-level "Total Active Projects" widget
- [ ] **DASH-05**: Dashboard displays company-level "Open Bids" widget
- [ ] **DASH-06**: Dashboard displays company-level "Pending Pay Apps" widget
- [ ] **DASH-07**: Dashboard displays company-level "Bid Opportunities" widget
- [ ] **DASH-08**: Dashboard displays company-level "Revenue in Progress" widget
- [ ] **DASH-09**: Dashboard displays company-level "Backlog" widget
- [ ] **DASH-10**: Dashboard displays company-level "Estimating Pipeline Value" widget
- [ ] **DASH-11**: Activity feed is removed from dashboard (moved to Settings)
- [ ] **DASH-12**: "Invite Team Members" widget is removed from dashboard
- [ ] **DASH-13**: All "Coming in Phase X" placeholders are replaced with functional widgets or removed

### Projects Interface (PROJV2)

- [ ] **PROJV2-01**: Projects page displays projects in compact table/list format
- [ ] **PROJV2-02**: Projects table shows columns: Job #, Project Name, Customer Name, Status
- [ ] **PROJV2-03**: Residential/Commercial label is removed from projects list (moved to detail page)
- [ ] **PROJV2-04**: Projects can be filtered by Customer
- [ ] **PROJV2-05**: Projects can be filtered by Job #
- [ ] **PROJV2-06**: Projects can be filtered by Status
- [ ] **PROJV2-07**: Projects can be filtered by Date
- [ ] **PROJV2-08**: Projects can be filtered by Assigned User
- [ ] **PROJV2-09**: Project detail page uses slug-safe URL format: /projects/{jobnumber}-{projectname}
- [ ] **PROJV2-10**: Project detail page displays persistent header with Job #, Project Name, Status, Customer Name (linked), Address, Key Metrics
- [ ] **PROJV2-11**: Project detail page header never reloads when navigating between sections
- [ ] **PROJV2-12**: Project sections (Documents, Budget, Commitments, etc.) load dynamically below persistent header
- [ ] **PROJV2-13**: Project section navigation does NOT navigate to new pages
- [ ] **PROJV2-14**: Project detail layout is compact (reduced visual weight, no verbose descriptions)
- [ ] **PROJV2-15**: Team section does not show assigned dates

### Estimating & Project Lifecycle (EST)

- [ ] **EST-01**: User can create estimate using guided step-by-step workflow (default mode)
- [ ] **EST-02**: Guided estimate builder includes cost code template selection
- [ ] **EST-03**: Guided estimate builder includes labor rate template application
- [ ] **EST-04**: Guided estimate builder includes overhead and markup logic configuration
- [ ] **EST-05**: Guided estimate builder includes material pricing entry
- [ ] **EST-06**: Guided estimate builder includes SOV (Schedule of Values) builder
- [ ] **EST-07**: Guided estimate builder displays margin visibility throughout workflow
- [ ] **EST-08**: User can switch to spreadsheet-style estimating grid mode via Account Settings preference
- [ ] **EST-09**: Spreadsheet mode allows bulk entry of estimate line items
- [ ] **EST-10**: User can convert completed estimate to budget with one click
- [ ] **EST-11**: User can generate bid from estimate
- [ ] **EST-12**: User can submit bid
- [ ] **EST-13**: User can mark bid as Won or Lost
- [ ] **EST-14**: User can convert won bid to active project with one click
- [ ] **EST-15**: Project status transitions are automated based on estimating lifecycle stage
- [ ] **EST-16**: Estimating workflow is designed for minimal cognitive load (clear next steps)
- [ ] **EST-17**: Estimating workflow requires minimal clicks between stages

### Architecture & Components (ARCH)

- [ ] **ARCH-01**: UI components are modular and reusable across pages
- [ ] **ARCH-02**: Routing is clean with no unnecessary page refreshes
- [ ] **ARCH-03**: Content loads dynamically without full page reloads where appropriate
- [ ] **ARCH-04**: URLs follow hygiene standards (slug-safe, descriptive, bookmarkable)
- [ ] **ARCH-05**: Reusable UI component system is centralized
- [ ] **ARCH-06**: Validation layer is centralized and shared between client and server
- [ ] **ARCH-07**: Architecture maintains scalable SaaS multi-tenant structure

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

### Authentication & SSO (Future)

- **AUTH-SSO-01**: SSO architecture supports OAuth providers (Google, Microsoft, etc.)
- **AUTH-SSO-02**: Sign-in page displays SaaS branding placeholder
- **AUTH-SSO-03**: OAuth provider integration for Google Workspace
- **AUTH-SSO-04**: OAuth provider integration for Microsoft 365

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
*Requirements defined: 2026-02-10 (v1.0), 2026-02-14 (v1.1)*
*Last updated: 2026-02-14 after milestone v1.1 definition*
