# ConstructionSaaS

## What This Is

A cloud-first, API-first construction SaaS platform for small-to-mid-sized commercial contractors (GCs, subcontractors, and hybrid companies). The platform delivers a full project lifecycle — from RFQ issuance and bid management through budget tracking, change orders, and pay applications — with AI-powered document drafting and multi-company collaboration. Designed as a responsive web application with schema-per-company database isolation and zero-trust security.

## Core Value

A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.

## Current State

**Shipped:** v1.0 MVP + v1.1 Enterprise UX Redesign (Feb 2026)

**What's built:**
- Complete project financial lifecycle (RFQs → bidding → budget → change orders → payment apps)
- Multi-tenant auth with custom JWT, MFA, and organization management
- QuickBooks bi-directional integration for projects, invoices, and bills
- Document management with workflows (RFIs, submittals, transmittals)
- Reporting & analytics with custom builder and scheduled delivery
- Calendar integration (Google, Microsoft) with bi-directional sync
- Enterprise-grade UI with dark mode, global search, and company branding
- Guided estimate workflow with cost code templates, labor rates, and SOV builder
- Estimate lifecycle (draft → submitted → bid → won → active project)
- Slug-based routing, persistent headers, and component library

**Tech stack:** Next.js 14, Fastify, tRPC, Drizzle ORM, PostgreSQL (schema-per-tenant), Redis, MinIO (S3), Tailwind CSS

**Codebase:** 142,961 lines of TypeScript across 19 phases (12 v1.0 + 7 v1.1)

## Requirements

### Validated

<!-- Shipped in v1.0 and v1.1. See archived REQUIREMENTS.md for full details. -->

**v1.0 Core Platform (Phases 1-12):**
- ✓ Multi-tenant authentication with MFA and organization management — v1.0
- ✓ Schema-per-company database isolation with audit logging — v1.0
- ✓ Company configuration (GC/Sub/Both types, CSI trades) — v1.0
- ✓ Project management with team access controls and document storage — v1.0
- ✓ Budget tracking with cost codes, committed costs, and forecasting — v1.0
- ✓ Change order management with approval workflows — v1.0
- ✓ Payment applications with retainage and lien waiver tracking — v1.0
- ✓ RFQ issuance and bid management with versioning — v1.0
- ✓ QuickBooks bi-directional integration — v1.0
- ✓ Document workflows (RFI, Submittal, Transmittal) with approvals — v1.0
- ✓ Custom reports with builder, export (PDF/Excel), and scheduling — v1.0
- ✓ Calendar integration (Google, Microsoft) with bi-directional sync — v1.0

**v1.1 Enterprise UX (Phases 13-19):**
- ✓ Unified navigation with global search (⌘K) and contextual sidebar — v1.1
- ✓ Dark mode with FOUC prevention and company logo branding — v1.1
- ✓ Standardized form inputs (phone, address) with centralized validation — v1.1
- ✓ Enterprise dashboard with 10 KPI widgets (user + company metrics) — v1.1
- ✓ Slug-based project routing with persistent headers — v1.1
- ✓ Advanced filtering with URL state management (nuqs) — v1.1
- ✓ Guided estimate workflow (6 steps) with cost code templates — v1.1
- ✓ Estimate lifecycle management (draft → bid → won → active project) — v1.1
- ✓ Reusable component library with CVA variants and formatting utilities — v1.1

### Active

<!-- v1.2 Job Number System Fixes -->

**Milestone v1.2: Job Number System Fixes & Reliability** (Started: 2026-02-17)

**Goal:** Fix broken job number auto-generation system and ensure reliable increment tracking across all project touchpoints.

**Target fixes:**
- Restore job number field visibility (project creation, company settings)
- Fix auto-generation assignment to new projects
- Fix auto-increment after manual job number usage
- Implement duplicate prevention
- Handle year rollover sequence resets
- Ensure job numbers display across project list, detail pages, and estimates

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

**Current status:** v1.0 + v1.1 shipped with full project financial lifecycle, enterprise-grade UX, and guided estimate workflow. Platform handles budget tracking, change orders, payment applications, RFQ management, and bi-directional QuickBooks sync. 142K lines of TypeScript across 19 phases.

**Known technical debt:**
- Frontend slug routing incomplete for customers and subcontractors (backend ready, frontend not migrated from UUID routes)
- Dashboard KPI widgets don't auto-filter target pages (e.g., "My Active Projects" doesn't pre-filter to user's projects)
- Global search doesn't include estimates (only projects and customers)

**Go-to-market:** Both GCs and subs need to find value from day one. GCs use the platform to issue RFQs and manage project financials. Subs use it to respond to RFQs and manage their own projects/bids. Free sub accounts (profile + RFQ response + limited projects) create network effects.

**AI approach:** v1 AI focuses on document drafting (RFQs, emails, reports, scope review, consistent verbiage). AI strictly respects user permissions and company data boundaries — zero cross-customer leakage. Bid parsing/analysis deferred to v2.

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
| Schema-per-company DB isolation | Strong data isolation without per-company DB instance ops overhead | ✓ Proven — works well across 19 phases |
| Custom auth over Clerk (Phase 12) | Eliminate third-party dependency, reduce costs, full control over flows | ✓ Good — JWT + MFA working well |
| Cookie-based theme storage (Phase 13) | Prevents FOUC by ensuring server HTML matches client hydration | ✓ Good — no flash on load |
| Slug-based routing (Phases 16-19) | Bookmarkable URLs, SEO-friendly, human-readable | ⚠️ Revisit — partial (projects done, customers/subs deferred) |
| Guided estimate workflow over spreadsheet-first (Phase 17) | Reduces cognitive load for solo operators, clear next steps | ✓ Good — user preference toggle available |
| Component library extraction at 3+ uses (Phase 19) | Prevents premature abstraction while encouraging reuse | ✓ Good — StatusBadge, CurrencyDisplay proven |
| QuickBooks as v1 ERP target | Most common ERP among target market (small-mid commercial contractors) | ✓ Good — bi-directional sync working |
| Responsive web (no native mobile) for v1 | Faster to ship; field use works via mobile browser until usage patterns justify native | ✓ Good — mobile browser working well |

---
*Last updated: 2026-02-17 after starting v1.2 milestone*
