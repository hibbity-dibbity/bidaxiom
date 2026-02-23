# Requirements: ConstructionSaaS v1.7

**Defined:** 2026-02-23
**Core Value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.

**Milestone Focus:** Simplify and streamline the project experience — remove complexity, hide GC/Advanced features, redesign project tabs for a clean Simple mode flow, eliminate approval bottlenecks, allow free lifecycle navigation, and simplify trade terminology.

---

## v1.7 Requirements

### Navigation (NAV)

- [ ] **NAV-01**: The Bidding section is removed from the global sidebar navigation
- [ ] **NAV-02**: The Financials section is removed from the global sidebar navigation
- [ ] **NAV-03**: The Documents section is removed from the global sidebar navigation
- [ ] **NAV-04**: The Reports section is removed from the global sidebar navigation
- [ ] **NAV-05**: The "Navigation" group heading is removed from the sidebar

### Project Mode (MODE)

- [ ] **MODE-01**: The project mode switcher (GC/Advanced ↔ Simple) is removed from all UI surfaces; underlying code is preserved but no mode-related controls are shown to users
- [ ] **MODE-02**: All GC/Advanced-specific features (Budget, SOV, Commitments, Payment Applications tabs and entry points) are hidden from the project UI; data and code are preserved

### Project Tabs (TABS)

- [ ] **TABS-01**: Project detail page displays tabs in order: Overview → Documents → Proposals → Change Orders → Invoices → Expenses
- [ ] **TABS-02**: The "Proposals" tab replaces the former Estimates tab; the label "Proposals" is used throughout the project context (tab, page heading, action buttons, breadcrumbs)
- [ ] **TABS-03**: An Expenses tab exists as a navigable placeholder page with a contextual empty state; no data model is built yet
- [ ] **TABS-04**: Budget, SOV, Commitments, and Payment Applications tabs are removed from the project tab bar

### Proposal & Change Order Flow (FLOW)

- [ ] **FLOW-01**: Proposals and change orders can be generated as PDF and submitted to the customer without any approval step or approval workflow
- [ ] **FLOW-02**: Proposal and change order detail pages include a "Send to Customer" button that opens a send dialog with recipient field; no email is transmitted yet (backend deferred to a future milestone)
- [ ] **FLOW-03**: When a project has a customer assigned, the customer's primary contact email is automatically pre-populated as the recipient in the Send to Customer dialog
- [ ] **FLOW-04**: Confirming the Send to Customer dialog advances the document status to "Sent" (no email sent; status update only)

### Lifecycle Phase Navigation (PHASE)

- [ ] **PHASE-01**: Users can transition a project to any lifecycle phase from any current phase with a single click — no sequential restriction
- [ ] **PHASE-02**: Transitioning to an earlier phase requires no confirmation dialog, justification text, or explanation
- [ ] **PHASE-03**: All phase transition guards based on contract status, billing status, or financial state are removed

### Trade Simplification (TRADE)

- [ ] **TRADE-01**: The subcontractor/vendor trade selection field uses a predefined simple trade list (Plumbing, Electrical, HVAC, Concrete, Metal Buildings, Framing, Roofing, Painting, Flooring, Drywall, General, Other) instead of CSI code-based categories
- [ ] **TRADE-02**: CSI division codes and section references are removed from all non-estimate UI surfaces (subcontractor forms, filter dropdowns, search fields)

---

## Out of Scope

Items explicitly excluded from v1.7:

| Feature | Reason |
|---------|--------|
| Email sending backend (SMTP/API) | Frontend UI only in v1.7; email delivery deferred to a future milestone |
| Expenses data model and entry | Expenses tab is a placeholder; data model and CRUD deferred to a future milestone |
| GC/Advanced mode features | Entire feature set deferred to a future milestone when Simple mode is complete |
| New proposal/CO status model redesign | Existing status fields used; "Sent" status added; full workflow redesign deferred |
| Subcontractor page data model changes | Only trade field UI changes; no schema changes to subcontractor records |
| CSI codes in estimate line items | Already hidden in current Simple mode; no changes needed |
| Tailwind v4 migration | Not in scope |
| Mobile native app | Web-first |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAV-01 | TBD | Pending |
| NAV-02 | TBD | Pending |
| NAV-03 | TBD | Pending |
| NAV-04 | TBD | Pending |
| NAV-05 | TBD | Pending |
| MODE-01 | TBD | Pending |
| MODE-02 | TBD | Pending |
| TABS-01 | TBD | Pending |
| TABS-02 | TBD | Pending |
| TABS-03 | TBD | Pending |
| TABS-04 | TBD | Pending |
| FLOW-01 | TBD | Pending |
| FLOW-02 | TBD | Pending |
| FLOW-03 | TBD | Pending |
| FLOW-04 | TBD | Pending |
| PHASE-01 | TBD | Pending |
| PHASE-02 | TBD | Pending |
| PHASE-03 | TBD | Pending |
| TRADE-01 | TBD | Pending |
| TRADE-02 | TBD | Pending |

**Coverage:**
- v1.7 requirements: 20 total
- Mapped to phases: TBD (roadmapper assigns)
- Unmapped: 20 (pending roadmap)

---
*Requirements defined: 2026-02-23*
*Last updated: 2026-02-23 — initial definition*
