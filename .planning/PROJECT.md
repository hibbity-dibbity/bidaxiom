# ConstructionSaaS

## What This Is

A cloud-first, API-first construction SaaS platform for small-to-mid-sized commercial contractors (GCs, subcontractors, and hybrid companies). The platform delivers a full project lifecycle — from RFQ issuance and bid management through budget tracking, change orders, and pay applications — with AI-powered document drafting and multi-company collaboration. Designed as a responsive web application with schema-per-company database isolation and zero-trust security.

## Core Value

A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.

## Current Milestone: v1.1 Enterprise UX Redesign

**Goal:** Transform the UI/UX from functional MVP to enterprise-grade tool optimized for solo operators with Procore-style density, guided workflows, and modern navigation patterns.

**Target features:**
- Procore-style enterprise layout with higher data density and dark mode
- Unified top bar + contextual collapsible sidebar navigation
- Global search across jobs, projects, and customers
- Form standardization (phone format, structured addresses, centralized validation)
- Company logo upload and branding throughout platform
- Dashboard redesign with KPI + task + pipeline widgets
- Projects page redesigned as compact table with advanced filtering
- Project detail persistent header with dynamic section loading
- Guided estimate builder workflow (step-by-step default, optional spreadsheet mode)
- Estimate lifecycle management (estimate → bid → award → active project)
- Component library and reusable UI system
- Clean routing with slug-safe URLs
- SSO architecture (OAuth-ready for Google/Microsoft)

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Central identity with multi-org/multi-company membership
- [ ] Company types: GC-only, Sub-only, Both (hybrid)
- [ ] Schema-per-company database isolation
- [ ] Zero Trust security: MFA, short-lived tokens, server-side PBAC
- [ ] Subscription tier & add-on module access control
- [ ] Configurable trades per company (CSI-based + custom specialties)
- [ ] Flexible project model: phases, cost codes, roles, audited access
- [ ] GC-issued RFQs with in-platform and external sub invitations
- [ ] Free sub accounts: company profile, respond to RFQs, limited projects
- [ ] Paid sub accounts: full project creation, bid building, downstream RFQs
- [ ] AI-assisted document drafting (RFQs, emails, reports from project context)
- [ ] Bid ownership: snapshot + versioning, upstream change notifications
- [ ] JV bid sharing (formal, scoped, time-bound collaboration for bids)
- [ ] CSI-based cost codes with budget vs actuals
- [ ] Committed costs, change orders (owner/internal/sub)
- [ ] Pay applications & retainage tracking
- [ ] Cost-to-complete forecasting
- [ ] QuickBooks bi-directional ERP integration
- [ ] Calendar integration (company + user level, bi-directional)
- [ ] Immutable audit logging of sensitive actions
- [ ] Responsive web application (desktop, tablet, mobile browser)

### Out of Scope

- Owner/client portals — not contractor-focused, deferred indefinitely
- Payroll processing / full accounting replacement — QuickBooks handles this
- Residential construction workflows — commercial/industrial only
- Native mobile apps — responsive web first, native later
- CPM scheduling engine — calendar integration only for v1
- Full JV execution workflows — bid sharing only in v1; JV project execution deferred
- Time & Production Tracking module — paid add-on, deferred to v2
- Equipment, Tools & Materials module — paid add-on, deferred to v2
- AI bid document parsing (extracting from Word/Excel/PDF) — v2; v1 focuses on AI drafting
- Open-ended per-customer customizations — only trade/template configuration allowed

## Context

**Market:** Small-to-mid-sized commercial contractors are underserved. Enterprise tools (Procore, Sage) are expensive and complex. Smaller tools lack multi-company collaboration and financial depth. The gap is a platform that handles the full GC↔Sub lifecycle affordably.

**Go-to-market:** Both GCs and subs need to find value from day one. GCs use the platform to issue RFQs and manage project financials. Subs use it to respond to RFQs and manage their own projects/bids. Free sub accounts (profile + RFQ response + limited projects) create network effects.

**Trades:** Companies self-configure using CSI-based trade lists plus custom specialties with subcategories. Trades are metadata — they inform RFQs, bids, and reporting but historical data is never mutated by trade updates.

**AI approach:** v1 AI focuses on document drafting (RFQs, emails, reports, scope review, consistent verbiage). AI strictly respects user permissions and company data boundaries — zero cross-customer leakage. Bid parsing/analysis deferred to v2.

**Free tier model:** Sub accounts can create a company profile, respond to GC-issued RFQs, view past bid history, and manage a limited number of projects. Paid accounts unlock full project creation, bid building, and downstream RFQ capabilities.

**JV scope:** v1 supports JV bid sharing — companies can formally collaborate on bids with scoped, time-bound, audited agreements. Full JV project execution (shared access, cost splitting) deferred.

## Constraints

- **Architecture**: Cloud-agnostic, containerized deployment — no vendor lock-in
- **API-first**: Frontend consumes the same APIs as integrations — no backend-for-frontend shortcuts
- **Database**: Schema-per-company isolation within shared infrastructure; no cross-schema joins
- **Security**: Zero Trust — every request authenticated, authorized, scoped to company + project
- **Tenancy**: Parent organization → multiple companies; users can belong to multiple orgs/companies with contextual roles
- **Tech stack**: Research-determined — open to whatever fits best for construction SaaS
- **ERP**: QuickBooks bi-directional sync is the v1 integration target
- **Compliance**: Immutable audit logs for financial changes, bid submissions, schedule updates

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Schema-per-company DB isolation | Strong data isolation without per-company DB instance ops overhead | — Pending |
| RFQ & Bidding as core value hook | Contractors evaluate tools by how they handle bids — this is the entry point | — Pending |
| AI drafting over AI parsing for v1 | Drafting provides immediate value; parsing requires more complex document handling | — Pending |
| JV bid sharing only (no execution) in v1 | Full JV execution is high complexity; bid sharing proves the collaboration model | — Pending |
| Calendar integration only (no CPM) for v1 | CPM engine is a major build; calendar sync meets scheduling needs while we validate core | — Pending |
| No paid add-on modules in v1 | Ship core lifecycle first — add-ons (time tracking, equipment) come after core is validated | — Pending |
| Cloud-agnostic deployment | Avoids vendor lock-in; keeps deployment flexible as business needs evolve | — Pending |
| Free sub tier with real functionality | Profile + RFQ response + limited projects drives adoption and network effects | — Pending |
| QuickBooks as v1 ERP target | Most common ERP among target market (small-mid commercial contractors) | — Pending |
| Responsive web (no native mobile) for v1 | Faster to ship; field use works via mobile browser until usage patterns justify native | — Pending |

---
*Last updated: 2026-02-14 after starting milestone v1.1*
