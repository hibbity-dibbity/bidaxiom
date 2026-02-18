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
