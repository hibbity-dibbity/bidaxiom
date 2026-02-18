# ConstructionSaaS

## What This Is

A cloud-first, API-first construction SaaS platform for small-to-mid-sized commercial contractors (GCs, subcontractors, and hybrid companies). The platform delivers a full project lifecycle — from RFQ issuance and bid management through budget tracking, change orders, and pay applications — with AI-powered document drafting and multi-company collaboration. Designed as a responsive web application with schema-per-company database isolation and zero-trust security.

## Core Value

A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.

## Current State

**Shipped:** v1.0–v1.4 (all milestones complete as of Feb 18, 2026)

**What's built:**
- Complete project financial lifecycle (RFQs → bidding → budget → change orders → payment apps)
- Multi-tenant auth with custom JWT, MFA, and organization management
- QuickBooks bi-directional integration for projects, invoices, and bills
- Document management with workflows (RFIs, submittals, transmittals)
- Reporting & analytics with custom builder and scheduled delivery
- Calendar integration (Google, Microsoft) with bi-directional sync
- Enterprise-grade UI with dark mode, global ⌘K search (projects, customers, estimates, subcontractors)
- Full BIDAXIOM rebrand — cyan-teal palette, flat design system, BIDAXIOM favicon
- Company selector in user dropdown (switch companies without page reload)
- Currency format on blur ($X,XXX.XX) across all 7 amount fields
- Guided estimate workflow with cost code templates, labor rates, and SOV builder
- Estimate lifecycle (draft → submitted → bid → won → active project)
- Slug-based routing for projects, customers, and subcontractors (fully migrated)
- Job number system — auto-generation, manual assignment, duplicate prevention, year rollover
- Session expiry detection with immediate redirect + return URL preservation
- Consolidated account settings (/settings/account) with password change and MFA management
- Consistent empty states, skeleton loading, and global API error toast handling

**Tech stack:** Next.js 14, Fastify, tRPC, Drizzle ORM, PostgreSQL (schema-per-tenant), Redis, MinIO (S3), Tailwind CSS

**Codebase:** ~155,000+ lines of TypeScript across 35 phases

## Requirements

### Validated

<!-- Shipped through v1.3. See archived REQUIREMENTS.md files for full details. -->

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

**v1.2 Job Number System (Phases 20-24):**
- ✓ Job number auto-generation with configurable template and atomic counter — v1.2
- ✓ Manual job number assignment with duplicate prevention (ilike) — v1.2
- ✓ Blur validation on create/edit forms with inline conflict links — v1.2
- ✓ Year rollover with configurable startingSequenceNumber — v1.2

**v1.3 Polish & Gap Closure (Phases 25-29):**
- ✓ Session expiry detection with immediate redirect to sign-in (SessionWatcher + tRPC 401 interceptor) — v1.3
- ✓ Return URL preservation through sign-in flow (getSafeRedirectUrl) — v1.3
- ✓ Consolidated /settings/account page (profile, password change, MFA) — v1.3
- ✓ Static sidebar with icon-only collapse; no project-context switching — v1.3
- ✓ Slug-based routing for customers and subcontractors (generateNameSlug) — v1.3
- ✓ Estimates in global search (⌘K) with type labels — v1.3
- ✓ Dashboard KPI widgets navigate to pre-filtered list pages — v1.3
- ✓ Consistent empty states, skeleton loading, and global error toasts — v1.3
- ✓ Job number counter-advance on manual edit-page save — v1.3

**v1.4 Rebranding & UX Upgrades (Phases 30-35):**
- ✓ Full BIDAXIOM rebrand — all copy, navigation labels, browser tab titles updated — v1.4
- ✓ Cyan-teal primary color palette (H=188, 80%, 45%) extracted from logo; slate-blue foreground — v1.4
- ✓ BIDAXIOM favicon set in browser tab and bookmarks — v1.4
- ✓ Flat design system — all cards/panels: sharp corners, no borders, no shadows — v1.4
- ✓ Company selector in user dropdown — org list + active checkmark + "Create new company" — v1.4
- ✓ CurrencyInput component — $X,XXX.XX format on blur across 7 amount fields — v1.4
- ✓ Subcontractors in ⌘K global search — "Subcontractors" CommandGroup with slug navigation — v1.4

### Active

<!-- Next milestone to be defined. Run /gsd:new-milestone to start v1.5 planning. -->

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

**Current status:** v1.4 shipped — full BIDAXIOM rebrand complete. Cyan-teal palette, flat design system, currency format on blur, company selector in dropdown, subcontractors in search. ~155K lines of TypeScript across 35 phases.

**Known technical debt:**
- Phase 27 VERIFICATION.md never generated (UAT summary serves as substitute)
- Sign-in page: `redirect_url` unvalidated at page level (getSafeRedirectUrl only fires at router.push time — no current exposure, defense-in-depth gap)
- MFA `hasMfa` state refresh lag after `disableMfa` — shows stale "Enabled" until re-login/refresh

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
| Schema-per-company DB isolation | Strong data isolation without per-company DB instance ops overhead | ✓ Good — proven across 29 phases |
| Custom auth over Clerk (Phase 12) | Eliminate third-party dependency, reduce costs, full control over flows | ✓ Good — JWT + MFA working well |
| Cookie-based theme storage (Phase 13) | Prevents FOUC by ensuring server HTML matches client hydration | ✓ Good — no flash on load |
| Slug-based routing (Phases 16-27) | Bookmarkable URLs, SEO-friendly, human-readable | ✓ Complete — projects, customers, subs all migrated |
| Guided estimate workflow over spreadsheet-first (Phase 17) | Reduces cognitive load for solo operators, clear next steps | ✓ Good — user preference toggle available |
| Component library extraction at 3+ uses (Phase 19) | Prevents premature abstraction while encouraging reuse | ✓ Good — StatusBadge, CurrencyDisplay proven |
| QuickBooks as v1 ERP target | Most common ERP among target market (small-mid commercial contractors) | ✓ Good — bi-directional sync working |
| Responsive web (no native mobile) for v1 | Faster to ship; field use works via mobile browser until usage patterns justify native | ✓ Good — mobile browser working well |
| window.location.href for session redirects (Phase 25) | Full page reload ensures middleware re-evaluates iron-session cookie | ✓ Good — router.push would leave broken session |
| SessionWatcher client component pattern (Phase 25) | Dashboard layout stays a Server Component; tiny client wrapper mounts the hook | ✓ Good — clean separation |
| changePassword revokes refresh tokens, disableMfa does not (Phase 26) | Password change = credential rotation; MFA disable = settings change | ✓ Good — correct security model |
| generateNameSlug (no UUID prefix) for customers/subs (Phase 27) | UUID prefix pattern was a uniqueness mechanism that produced ugly URLs | ✓ Good — clean name-based slugs |
| router.replace for post-rename slug navigation (Phase 27) | Old slug not left in browser back-stack history | ✓ Good |
| QueryCache.onError for global error toasts (Phase 29) | v5 react-query API; defaultOptions.queries.onError silently no-ops in v5 | ✓ Good |
| No MutationCache.onError (Phase 29) | Mutations have per-mutation onError; global would double-toast every failure | ✓ Good |
| startingSequenceNumber floors nextSequenceNumber at maxUsed+1 (Phase 29) | Prevents duplicate job numbers when lowering startingSequenceNumber | ✓ Good |
| Uniqueness check inside db.transaction (Phase 29) | Load-compare-write has race window; transaction eliminates it | ✓ Good |
| Primary color = cyan-teal H=188, not slate-blue (Phase 31) | User approved after palette extraction; slate-blue moves to --foreground for body text | ✓ Good |
| Dashboard tabs show "BIDAXIOM" not "Dashboard \| BIDAXIOM" (Phase 30) | Dashboard layout.tsx has no metadata export; root default applies; user approved | ✓ Good |
| Flat card hover = background tint not shadow (Phase 32) | hover:bg-muted/50 transition-colors chosen for flat design consistency | ✓ Good |
| Tier B table wrappers excluded from DESIGN-01 (Phase 32) | "Card and panel components" ≠ data grid containers; intentional scoping | ✓ Good |
| CompanySwitcher deleted, not hidden (Phase 33) | Merged into UserMenu; no dead code left | ✓ Good |
| CurrencyInput fires onChange on blur only (Phase 34) | Format-on-blur chosen over live masking; use-mask-input tried and reverted | ✓ Good |
| Slug backfill migration required for subcontractor search (Phase 35) | isNotNull filter excludes null slugs; add-entity-slugs.ts one-time migration resolves it | ✓ Good |

---
*Last updated: 2026-02-18 — v1.4 milestone complete*
