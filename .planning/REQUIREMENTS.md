# Requirements: ConstructionSaaS v1.3

**Defined:** 2026-02-17
**Core Value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.

**Milestone Focus:** Polish, gap closure, and UX reliability — completing unfinished routing, fixing auth flows, consolidating account settings, and tightening the core user experience.

## v1.3 Requirements

### Session & Auth Flow

- [ ] **SESS-01**: When session expires while the user is on a page, the app immediately redirects to the sign-in page (not discovered via a failed action)
- [ ] **SESS-02**: After signing in, the user is redirected to the page they originally requested (return URL redirect completes correctly)

### Account Settings

- [ ] **ACCT-01**: User can access a consolidated account settings page at /settings/account
- [ ] **ACCT-02**: Account settings page includes MFA configuration (enable, disable, QR code setup)
- [ ] **ACCT-03**: Account settings page includes password change functionality
- [ ] **ACCT-04**: User dropdown in top navigation links directly to /settings/account instead of separate Settings and MFA links

### Navigation

- [ ] **NAV-01**: Sidebar is static — always visible, no dynamic toggle; layout is consistent across all pages; dynamic sidebar code removed

### Slug Routing

- [ ] **SLUG-01**: Customer detail page is accessible via slug-based URL (e.g., /customers/abc-construction)
- [ ] **SLUG-02**: Customer edit page uses slug-based URL
- [ ] **SLUG-03**: Subcontractor detail page uses slug-based URL (e.g., /subcontractors/smith-plumbing)
- [ ] **SLUG-04**: Subcontractor edit page uses slug-based URL

### Global Search

- [ ] **SRCH-01**: Global search results include estimates alongside projects and customers
- [ ] **SRCH-02**: Search result items display their type label (Project, Estimate, Customer) for clarity

### Dashboard

- [ ] **DASH-01**: Clicking a dashboard KPI widget navigates to the relevant page with pre-filtered results matching the widget's metric

### Job Number Edit

- [ ] **JOBEDIT-01**: When a project's job number is manually changed on the edit project page, the company's auto-generation counter increments to prevent future duplicate job numbers

### UI/UX Polish

- [ ] **UX-01**: List and table views display an informative empty state when no records exist (not a blank table)
- [ ] **UX-02**: Data loading states are consistent — skeleton loaders or spinners appear during fetches instead of blank content areas
- [ ] **UX-03**: API errors surface consistently via toast notifications with actionable messages

## Out of Scope

Items explicitly excluded from v1.3:

| Feature | Reason |
|---------|--------|
| Customer/sub portals | External-facing portals deferred; v1.3 only fixes internal routing |
| Email notifications | Not requested; separate milestone when notification system is designed |
| Invite team members | Not in scope; auth system redesign would be needed |
| New financial features | v1.3 is polish-focused; new financial workflows deferred |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SESS-01 | Phase 25 | Pending |
| SESS-02 | Phase 25 | Pending |
| ACCT-01 | Phase 26 | Pending |
| ACCT-02 | Phase 26 | Pending |
| ACCT-03 | Phase 26 | Pending |
| ACCT-04 | Phase 26 | Pending |
| NAV-01 | Phase 26 | Pending |
| SLUG-01 | Phase 27 | Pending |
| SLUG-02 | Phase 27 | Pending |
| SLUG-03 | Phase 27 | Pending |
| SLUG-04 | Phase 27 | Pending |
| SRCH-01 | Phase 28 | Pending |
| SRCH-02 | Phase 28 | Pending |
| DASH-01 | Phase 28 | Pending |
| JOBEDIT-01 | Phase 29 | Pending |
| UX-01 | Phase 29 | Pending |
| UX-02 | Phase 29 | Pending |
| UX-03 | Phase 29 | Pending |

**Coverage:**
- v1.3 requirements: 18 total
- Mapped to phases: 18/18
- Unmapped: 0

---
*Requirements defined: 2026-02-17*
*Last updated: 2026-02-17 — traceability filled in after roadmap creation (Phases 25-29)*
