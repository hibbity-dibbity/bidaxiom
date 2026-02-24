# Milestones

## v1.0 MVP (Shipped: 2026-02-14)

**Phases completed:** 12 phases (Phases 1-12), 60 plans

**Key accomplishments:**
- Complete project financial lifecycle (RFQs → bidding → budget → change orders → payment apps)
- Schema-per-tenant multi-tenant auth with custom JWT, MFA, and organization management
- QuickBooks bi-directional integration for projects, invoices, and bills
- Document management with RFI, Submittal, and Transmittal workflows
- Custom report builder with PDF/Excel export and scheduled delivery
- Calendar integration (Google, Microsoft) with bi-directional sync

---

## v1.1 Enterprise UX Redesign (Shipped: 2026-02-16)

**Phases completed:** 7 phases (Phases 13-19), 50 plans

**Key accomplishments:**
- Enterprise shell: top bar, collapsible sidebar, dark mode with FOUC prevention, company logo branding
- Slug-based project routing with persistent headers and advanced URL-state filtering
- Guided 6-step estimate workflow with cost code templates, labor rates, and SOV builder
- Estimate lifecycle management: draft → submitted → bid → won → active project conversion
- 10 KPI widgets on enterprise dashboard (user + company metrics)
- Reusable component library with CVA variants, StatusBadge, CurrencyDisplay, and formatting utilities

---

## v1.2 Job Number System Fixes & Reliability (Shipped: 2026-02-17)

**Phases completed:** 5 phases (Phases 20-24), 12 plans

**Key accomplishments:**
- Job number configuration: format template, starting sequence, enabled toggle — JSONB persistence
- Atomic counter increment on project create; auto-generation with collision-safe loop
- Case-insensitive duplicate detection (ilike); edit-page self-exclusion
- Blur validation on create and edit forms with inline error links to conflicting project
- Job numbers displayed in project list, detail header, and estimates
- Year rollover: startingSequenceNumber configures reset target; rollover-aware preview in settings UI

---

## v1.3 Polish & Gap Closure (Shipped: 2026-02-18)

**Phases completed:** 5 phases (Phases 25-29), 16 plans

**Key accomplishments:**
- Instant session expiry detection: SessionWatcher + tRPC 401 interceptor auto-redirect to sign-in with return URL preservation
- Consolidated /settings/account page with profile, password change (refresh token revocation), and MFA enable/disable
- Static sidebar with icon-only collapse; no project-context switching — consistent navigation across all pages
- Slug-based routing for customers and subcontractors using clean name-only URLs (no UUID prefix)
- Estimates in global search (⌘K) with type labels; 9 dashboard KPI widgets with pre-filtered click-through
- Consistent empty states (icon + heading + CTA), skeleton loading, global QueryCache error toasts, job number counter-advance on edit

---

## v1.4 Rebranding & UX Upgrades (Shipped: 2026-02-18)

**Phases completed:** 35 phases, 152 plans, 53 tasks

**Key accomplishments:**
- Customer and subcontractor forms using PhoneInput and AddressInput with proper React Hook Form integration

---


## v1.5 Document Engine (Shipped: 2026-02-21)

**Phases completed:** 34 phases, 163 plans, 55 tasks

**Key accomplishments:**
- Customer and subcontractor forms using PhoneInput and AddressInput with proper React Hook Form integration

---


## v1.6 UX Redesign & Polish (Shipped: 2026-02-23)

**Phases completed:** 6 phases (Phases 41-46), 29 plans
**Timeline:** 2026-02-21 → 2026-02-23 (3 days)
**Files changed:** 167 files, +21,487 / -2,340 lines

**Key accomplishments:**
- CSS variable design token system (`text-financial-positive/negative/pending`) migrated across 56 files — dark-mode-ready financial color semantics application-wide
- 12 financial tables upgraded to Procore-level density — sticky headers, frozen first columns, TanStack sort, sticky financial footers — plus unified 4-tier StatusBadge
- ColumnPicker (column visibility), inline draft rows, debounced search, removable FilterChips, and contextual EmptyState with CTAs across all 7 major list views
- Inline Approve/Reject/Mark Paid in CO and pay app list rows with confirmation dialogs + CSV export across all 6 filtered table views
- New horizontal stepper bar with teal/slate visual states + react-number-format live currency masking in estimate wizard
- Sticky 3-row project chrome: title/info/stats header, 5-field financial stat bar, "(N)" count badges on CO/Pay App/Documents/Invoices tabs

---


## v1.7 Project Flow Enhancements (Shipped: 2026-02-24)

**Phases completed:** 6 phases (Phases 47-52), 16 plans
**Timeline:** 2026-02-23 → 2026-02-24 (2 days)
**Files changed:** 92 files, +9,130 / -1,208 lines

**Key accomplishments:**
- Sidebar trimmed to 5 nav items — Bidding, Financials, Documents, Reports sections and "Navigation" heading fully removed
- Project mode switcher removed from all UI surfaces; GC/Advanced features hidden; new projects default to simple mode
- Project tabs redesigned to 6-tab clean flow: Overview → Documents → Proposals → Change Orders → Invoices → Expenses
- "Send to Customer" flow replaces approval workflows on both proposals and change orders — auto-populated customer email, one-click status advance, no approval required
- Lifecycle phase freedom: any-to-any phase transitions in a single click with no guards, confirmation dialogs, or justification required
- Trade simplification: 12-item SIMPLE_TRADES list with multi-select combobox replaces CSI codes on all subcontractor surfaces (form, list, detail, command palette)

---

