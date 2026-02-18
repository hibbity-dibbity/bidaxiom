# Requirements: ConstructionSaaS v1.4

**Defined:** 2026-02-18
**Core Value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.

**Milestone Focus:** Rebrand to BIDAXIOM, apply new color palette, flatten card design system, add live currency formatting, move company selector to user dropdown, add subcontractors to global search, and clean up sidebar.

## v1.4 Requirements

### Branding

- [ ] **BRAND-01**: All site labels, navigation text, and copy reference "BIDAXIOM" (replacing any prior brand name references throughout the app)
- [ ] **BRAND-02**: Browser/tab page titles use format "{Page Name} | BIDAXIOM" across all pages and routes
- [ ] **BRAND-03**: Color palette updated to match BIDAXIOM logo colors — palette extracted from logo, reviewed by user, then applied to Tailwind config and CSS variables
- [ ] **BRAND-04**: Sign-in page logo is rendered 25% smaller than its current size with 25px of additional bottom padding below the logo

### Design System

- [ ] **DESIGN-01**: All card and panel components use sharp corners (border-radius: 0), no border, and no drop shadow — flat section appearance throughout the app

### Navigation

- [ ] **NAV-02**: The user dropdown in the top navigation bar includes a company selector (switch between user's companies) and a "Create new company" option, positioned below the existing Account Settings link

### Forms

- [ ] **FORM-01**: All currency and amount input fields reformat to US currency live as the user types (e.g., typing "12500" produces "$12,500.00"), following the same live-format pattern as phone number input fields

### Search

- [ ] **SRCH-03**: Global search (⌘K) results include subcontractor records with a "Subcontractor" type label, displayed alongside existing Projects, Customers, and Estimates result groups

### Cleanup

- [ ] **CLEAN-01**: Version number display and the horizontal divider rule above it are removed from the left sidebar

## Out of Scope

Items explicitly excluded from v1.4:

| Feature | Reason |
|---------|--------|
| Multi-company backend changes | Company switching is already supported; v1.4 only moves the UI |
| Custom per-company color themes | Single global palette; per-company theming deferred |
| Currency localization (non-US) | US format only for v1.4; international formatting deferred |
| New financial features | v1.4 is branding/UX focused; new financial workflows deferred |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRAND-01 | Phase 30 | Pending |
| BRAND-02 | Phase 30 | Pending |
| BRAND-03 | Phase 30 | Pending |
| BRAND-04 | Phase 30 | Pending |
| DESIGN-01 | Phase 31 | Pending |
| NAV-02 | Phase 32 | Pending |
| FORM-01 | Phase 33 | Pending |
| SRCH-03 | Phase 34 | Pending |
| CLEAN-01 | Phase 30 | Pending |

**Coverage:**
- v1.4 requirements: 9 total
- Mapped to phases: 9/9
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-18*
*Last updated: 2026-02-18 — initial definition*
