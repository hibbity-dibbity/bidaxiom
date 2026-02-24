# Requirements: ConstructionSaaS v1.8

**Defined:** 2026-02-24
**Core Value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.

**Milestone Focus:** Streamline the new project creation form and overhaul the project detail experience — cleaner form with condensed Project Number, Customer Budget + Building Dimensions, financial KPIs in the stat bar, Overview tab cleanup with Notes, and document editing on the Documents tab.

---

## v1.8 Requirements

### CREATE — New Project Form

- [ ] **CREATE-01**: The "Set up a new construction project with team, phases, and cost codes" description is removed from the new project page
- [ ] **CREATE-02**: The "Basic Information / Essential project details and timeline" section heading is removed from the new project form
- [ ] **CREATE-03**: The "Location" section heading is removed from the new project form
- [ ] **CREATE-04**: Default placeholder address across all location fields in the application is changed to 8400 Kirby Dr, Houston, TX 77054
- [ ] **CREATE-05**: Project Number field is moved above Project Name on the new project form
- [ ] **CREATE-06**: Project Number is displayed as: label "Project Number" + auto-generated value shown below as read-only text + "Manual Entry" button alongside; clicking "Manual Entry" makes the field editable and changes the button label to "Use Auto-Generated"; clicking "Use Auto-Generated" restores the auto-generated value and returns to read-only display
- [ ] **CREATE-07**: Team Members section is removed from the new project form
- [ ] **CREATE-08**: Project Phases section is removed from the new project form
- [ ] **CREATE-09**: CSI Cost Codes section is removed from the new project form
- [ ] **CREATE-10**: A Customer Budget field is added to the new project form; it accepts a dollar amount and applies currency format ($X,XXX.XX) on blur
- [ ] **CREATE-11**: A Building Dimensions section is added to the new project form with separate Width, Length, and Height fields (all optional, unit: feet)
- [ ] **CREATE-12**: Building square footage (Width × Length) is auto-calculated and stored on the project record; it is not displayed on the create form itself

### HEADER — Project Detail Sticky Header

- [ ] **HEADER-01**: Start Date and End Date are displayed in the project sticky header info row, inline with customer and address, each rendered as a clickable element that opens a date picker
- [ ] **HEADER-02**: Team Members KPI is removed from the project header stat bar
- [ ] **HEADER-03**: A Profit KPI is added to the header stat bar; Projected Profit = Contract Amount − Total Costs from the latest active estimate (sum of all estimate line item markups); Actual Profit shows as "—" until Expenses feature is built
- [ ] **HEADER-04**: A Margin KPI is added to the header stat bar; Projected Margin = Projected Profit ÷ Contract Amount (displayed as percentage); Actual Margin shows as "—" until Expenses feature is built
- [ ] **HEADER-05**: A Customer Budget KPI is added to the header stat bar showing the project's customer budget amount and its delta vs the estimated contract amount (over/under)

### OVERVIEW — Overview Tab

- [ ] **OVERVIEW-01**: KPI cards are removed from the Overview tab
- [ ] **OVERVIEW-02**: The Customer Information section is removed from the Overview tab (customer name and link remain in the sticky header)
- [ ] **OVERVIEW-03**: The Project Details section on the Overview tab displays: project description, building width, building length, building height, and calculated square footage
- [ ] **OVERVIEW-04**: In the Team Members section, the "people assigned to this project" description text is removed
- [ ] **OVERVIEW-05**: In the Team Members section, the assigned-date column is removed
- [ ] **OVERVIEW-06**: Team member role values are displayed in proper case (e.g., "Project Manager" not "project manager")
- [ ] **OVERVIEW-07**: Team Members table column headers are removed (no header row)
- [ ] **OVERVIEW-08**: The Project Phases section is removed from the Overview tab
- [ ] **OVERVIEW-09**: A Notes section is added to the Overview tab with a multi-line text input and a "Add Note" submit button
- [ ] **OVERVIEW-10**: Project notes are displayed below the input in reverse-chronological order (newest first), each note showing the note text, the user's full name, and a timestamp

### DOCS — Documents Tab

- [ ] **DOCS-01**: Users can edit a document's file name and document type after it has been uploaded (via an edit action on each document row)
- [ ] **DOCS-02**: The Status column and status filter are removed from the Documents tab

---

## Future Requirements

Items discussed but deferred to a future milestone:

| Feature | Reason |
|---------|--------|
| Actual Profit / Actual Margin from expenses | Expenses data model not yet built; KPIs show "—" until Expenses milestone |
| Expenses functionality | Placeholder tab only in v1.7; data model + CRUD deferred |
| Email sending backend | UI-only "Send to Customer" in v1.7; SMTP/API delivery deferred |
| GC/Advanced mode features | Hidden in v1.7; re-introduction deferred to future milestone |

---

## Out of Scope

Items explicitly excluded from v1.8:

| Feature | Reason |
|---------|--------|
| Building height in square footage calculation | Square footage = Width × Length only (height is stored for reference/reporting, not used in area calculation) |
| Notes access control | All project team members can read and add notes — no role restriction |
| Document version history editing | Only name and type are editable; version history is immutable |
| Tailwind v4 migration | Not in scope |
| Mobile native app | Web-first |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CREATE-01 | Phase 53 | Pending |
| CREATE-02 | Phase 53 | Pending |
| CREATE-03 | Phase 53 | Pending |
| CREATE-04 | Phase 53 | Pending |
| CREATE-05 | Phase 53 | Pending |
| CREATE-06 | Phase 53 | Pending |
| CREATE-07 | Phase 53 | Pending |
| CREATE-08 | Phase 53 | Pending |
| CREATE-09 | Phase 53 | Pending |
| CREATE-10 | Phase 53 | Pending |
| CREATE-11 | Phase 53 | Pending |
| CREATE-12 | Phase 53 | Pending |
| HEADER-01 | Phase 54 | Pending |
| HEADER-02 | Phase 54 | Pending |
| HEADER-03 | Phase 54 | Pending |
| HEADER-04 | Phase 54 | Pending |
| HEADER-05 | Phase 54 | Pending |
| OVERVIEW-01 | Phase 55 | Pending |
| OVERVIEW-02 | Phase 55 | Pending |
| OVERVIEW-03 | Phase 55 | Pending |
| OVERVIEW-04 | Phase 55 | Pending |
| OVERVIEW-05 | Phase 55 | Pending |
| OVERVIEW-06 | Phase 55 | Pending |
| OVERVIEW-07 | Phase 55 | Pending |
| OVERVIEW-08 | Phase 55 | Pending |
| OVERVIEW-09 | Phase 55 | Pending |
| OVERVIEW-10 | Phase 55 | Pending |
| DOCS-01 | Phase 56 | Pending |
| DOCS-02 | Phase 56 | Pending |

**Coverage:**
- v1.8 requirements: 29 total
- Mapped to phases: 29/29
- Unmapped: 0

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 — initial definition*
