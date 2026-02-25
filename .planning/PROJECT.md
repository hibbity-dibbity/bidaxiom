# ConstructionSaaS

## What This Is

A cloud-first, API-first construction SaaS platform for small-to-mid-sized commercial contractors (GCs, subcontractors, and hybrid companies). The platform delivers a full project lifecycle — from RFQ issuance and bid management through budget tracking, change orders, and pay applications — with AI-powered document drafting and multi-company collaboration. Designed as a responsive web application with schema-per-company database isolation and zero-trust security.

## Core Value

A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.

## Current State

**Shipped:** v1.0–v1.6 (all milestones complete as of Feb 23, 2026)

**What's built:**
- Complete project financial lifecycle (RFQs → bidding → budget → change orders → payment apps)
- 9-phase project lifecycle state machine (Opportunity → Archived) with auto-advance and audit log
- Simple vs GC/Advanced project complexity modes with mode-aware feature visibility
- Project deletion with lifecycle guards, soft-delete, and 30-day admin recovery window
- PDF generation for proposals, change orders, AIA G702/G703 payment apps, and RFQs
- Custom branded PDF/Word/Excel template import with visual field mapping (docxtemplater+mammoth pipeline)
- Document naming conventions with per-company sequence counters
- Unified flat document table — all document types (PDFs, uploads, RFIs, submittals, transmittals) in one view with nuqs URL-state filters
- Multi-tenant auth with custom JWT, MFA, and organization management
- QuickBooks bi-directional integration for projects, invoices, and bills
- Document workflows (RFIs, submittals, transmittals) with approval chains
- Reporting & analytics with custom builder and scheduled delivery
- Calendar integration (Google, Microsoft) with bi-directional sync
- Procore-level UX density: CSS design token system (`text-financial-positive/negative/pending`), 12 financial tables with sticky headers/frozen columns/TanStack sort, unified 4-tier StatusBadge
- Inline approval actions (Approve/Reject/Mark Paid) in CO and pay app list views without page navigation
- CSV export across all 6 filtered table views
- ColumnPicker (column visibility), inline draft rows, search + FilterChips, contextual EmptyState on all major list views
- Horizontal stepper bar in estimate wizard with live react-number-format currency masking
- Sticky 3-row project chrome: title/info/stats header, 5-field financial stat bar, count badges on key tabs
- Enterprise-grade UI with dark mode, global ⌘K search (projects, customers, estimates, subcontractors)
- Full BIDAXIOM rebrand — cyan-teal palette, flat design system, BIDAXIOM favicon
- Company selector in user dropdown (switch companies without page reload)
- Guided estimate workflow with cost code templates, labor rates, and SOV builder
- Estimate lifecycle (draft → submitted → bid → won → active project)
- Slug-based routing for projects, customers, and subcontractors (fully migrated)
- Job number system — auto-generation, manual assignment, duplicate prevention, year rollover
- Session expiry detection with immediate redirect + return URL preservation
- Consolidated account settings (/settings/account) with password change and MFA management
- Consistent empty states, skeleton loading, and global API error toast handling

**Tech stack:** Next.js 14, Fastify, tRPC, Drizzle ORM, PostgreSQL (schema-per-tenant), Redis, MinIO (S3), Tailwind CSS, Puppeteer, docxtemplater, LibreOffice (optional), archiver, react-number-format, motion v12, @tanstack/react-virtual

**Codebase:** ~185,000+ lines of TypeScript across 46 phases

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

**v1.5 Project Lifecycle Redesign & Document Engine (Phases 36-40):**
- ✓ 9-phase lifecycle state machine (Opportunity → Archived) with auto-advance on system events — v1.5
- ✓ Simple vs GC/Advanced project complexity modes; mode locked at Active phase — v1.5
- ✓ Phase-conditional feature gating (Change Orders active-only, estimates edit-locked post-Estimating) — v1.5
- ✓ Project deletion with lifecycle guards, confirmation dialog, soft-delete, and 30-day recovery — v1.5
- ✓ PDF generation for proposals, change orders, AIA G702/G703 payment apps, and RFQs — v1.5
- ✓ Company logo + brand colors embedded in PDFs — v1.5
- ✓ Document naming conventions with configurable template and per-company sequence counters — v1.5
- ✓ Custom .docx/.xlsx template import with visual field mapping and preview PDF (docxtemplater+mammoth) — v1.5
- ✓ Unified flat document table — all document types in one view with type/status/date/author filters — v1.5

**v1.6 UX Redesign & Polish (Phases 41-46):**
- ✓ CSS variable design token system (`text-financial-positive/negative/pending`) — dark-mode-ready semantic colors across 56 files — v1.6
- ✓ 12 financial tables upgraded to Procore density: sticky headers, frozen first columns, TanStack sort (2-state), sticky financial footers — v1.6
- ✓ Unified 4-tier StatusBadge (gray/amber/green/red) — eliminated all domain-specific badge components — v1.6
- ✓ ColumnPicker (column visibility), inline draft rows (no dialog), debounced search, FilterChips, EmptyState with CTAs on all 7 major list views — v1.6
- ✓ Inline Approve/Reject/Mark Paid in CO and pay app list rows with confirmation dialogs; getHeaderStats cache invalidated on approval — v1.6
- ✓ CSV export across all 6 filtered table views (Projects, Subcontractors, Change Orders, Payment Apps, Estimates, RFQs) — v1.6
- ✓ Horizontal stepper bar in estimate wizard (teal/slate visual states); react-number-format live `$` masking on all currency inputs — v1.6
- ✓ Sticky 3-row project chrome: compact title/info/stats header, 5-field financial stat bar, "(N)" count badges on CO/Pay App/Documents/Invoices tabs — v1.6
- ✓ Canonical COMPONENT-ORGANIZATION.md recipes enforced across all surfaces — v1.6

**v1.7 Project Flow Enhancements (Phases 47-52):**
- ✓ Sidebar trimmed to 5 items — Bidding, Financials, Documents, Reports sections and "Navigation" heading removed — v1.7
- ✓ Project mode switcher removed from all UI; GC/Advanced features hidden; Budget/SOV/Commitments/Payment Apps tabs replaced with placeholder pages; new projects default to simple mode — v1.7
- ✓ Project tabs redesigned: Overview → Documents → Proposals → Change Orders → Invoices → Expenses; "Proposals" replaces "Estimates" label throughout project context — v1.7
- ✓ "Send to Customer" flow: dialog with auto-populated customer email on both proposals and COs; confirms status advance to submitted/pco_submitted; no approval step required — v1.7
- ✓ Free lifecycle phase navigation: any-to-any phase transitions in a single click, no guards or confirmation dialogs, optimistic badge update with spinner — v1.7
- ✓ Trade simplification: 12-trade SIMPLE_TRADES list with multi-select combobox replaces CSI codes on all subcontractor surfaces (form, list filter/badges, detail, command palette) — v1.7

**v1.8 New Project Page Stage 1 (Phases 53-56):**
- ✓ New project form rebuilt — click-to-edit Project Number widget, Building Dimensions section with sqft auto-compute, Customer Budget field; Team Members/Project Phases/CSI Cost Codes sections removed; address placeholder updated — v1.8
- ✓ 5 nullable DB columns added to projects across all tenants (`customer_budget`, `building_width`, `building_length`, `building_height`, `building_sqft`) with idempotent migration — v1.8
- ✓ Financial KPI stat bar — `getHeaderStats` extended with Projected Profit/Margin/Customer Budget delta; Start/End date pickers in header Row 2; Team Members KPI removed — v1.8
- ✓ `project_notes` table + `notesRouter` (list/create/delete with ownership enforcement, reverse-chron, 500-char limit) — multi-tenant migration, registered in `appRouter` — v1.8
- ✓ Overview tab rebuilt — KPI cards, Customer Info, Project Phases removed; flat Dimensions grid, compact Team Members with title-case roles, functional Notes section — v1.8
- ✓ Documents tab — `document.update` mutation (extension-preserving rename, duplicate check, CASL); 7-column table with inline edit; PDF inline preview via `forPreview` flag; file Type filter; Status column/filter removed — v1.8

### Active

*(Empty — next milestone requirements defined via `/gsd:new-milestone`)*

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

**Current status:** v1.8 shipped (Feb 25, 2026) — v1.0–v1.8 complete; planning next milestone. ~197K+ lines of TypeScript across 56 phases.

**Known technical debt:**
- Phase 27 VERIFICATION.md never generated (UAT summary serves as substitute)
- Sign-in page: `redirect_url` unvalidated at page level (getSafeRedirectUrl only fires at router.push time — no current exposure, defense-in-depth gap)
- MFA `hasMfa` state refresh lag after `disableMfa` — shows stale "Enabled" until re-login/refresh
- `type UnifiedDocument = any` in 3 document components (deferred type safety — tRPC AppRouter inference not yet wired for `listUnified`)
- `softDelete` (project deletion) does not re-validate lifecycle phase independently — relies on UI calling `checkDeletable` first (defense-in-depth gap only)
- `billingCategory` DB column deferred; Phase 36 shows Cost Type (UI-only bridge) — full billing category deferred to v2.0
- SendToCustomerDialog captures recipients/subject/note but discards them (intentional — email backend deferred to future milestone; status-update-only per v1.7 spec)
- Dead code preserved from v1.7: setModeMutation/handleModeSwitch functions, Badge import, prefetch handlers for removed GC routes (budget/sov/commitments/payment-apps/rfqs), isValidTransition export in lifecycle-state-machine.ts, stale breadcrumb keys (bids/financials), stale JSDoc in transitionLifecyclePhase router
- `project.update` handler missing write blocks for `buildingWidth/Length/Height/Sqft` — dimensions set at creation are preserved but cannot be updated via edit page (4-line fix deferred to v1.9)

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
| lifecyclePhase defaults to opportunity; projectMode defaults to gc_advanced for existing tenants (Phase 36) | Backward compatibility — existing projects use all advanced features; new projects can opt into Simple | ✓ Good |
| PHASE_FEATURE_GATES uses inclusive allowed-phase lists; estimates.create unguarded (Phase 36) | Permissive-by-default prevents over-blocking; estimates.create unguarded to preserve auto-advance flow | ✓ Good |
| checkDeletable checks all blocking factors simultaneously returning complete reasons array (Phase 37) | Single pre-flight returns all blockers at once — better UX than sequential checks | ✓ Good |
| listDeleted lazy-purges rows older than 30 days inline before SELECT (Phase 37) | No background job needed — purge happens naturally on every admin view of deleted projects | ✓ Good |
| Puppeteer (headless Chrome) as PDF renderer; HTML builder for all 4 doc types (Phase 38) | Avoids native dependencies (wkhtmltopdf, WeasyPrint); pure Node.js; consistent with Docker deployment | ✓ Good |
| documentNamingCounters company-scoped (not project-scoped); nullable JSONB for settings (Phase 38) | Sequential PDF numbers are company-wide; null = use platform default naming pattern | ✓ Good |
| docxtemplater+mammoth pipeline for custom template rendering; LibreOffice optional (Phase 39) | LibreOffice preserves Word formatting better; mammoth is fallback — no mandatory native install | ✓ Good |
| Partial unique index (doc_type WHERE is_active=true) enforces one-active-template-per-type at DB level (Phase 39) | DB-level constraint cheaper and more reliable than application-level enforcement | ✓ Good |
| listUnified post-query type filter; author options from project.getBySlug teamMembers (Phase 40) | React Query deduplicates teamMembers request; post-query filter avoids complex SQL for 8 document types | ✓ Good |
| Bulk-download proxied through Next.js API route to eliminate CORS (Phase 40) | Direct browser→Fastify POST blocked by CORS preflight; server-side proxy consistent with tRPC pattern | ✓ Good |
| No Radix ScrollArea for sticky tables (Phase 41) | Open GitHub issue radix-ui/primitives #2783 — sticky headers break inside ScrollArea; use plain div overflow-auto + max-height | ✓ Good |
| Financial tokens: flat string format in tailwind.config.ts (Phase 41) | No nested object; no foreground variant needed for semantic financial colors | ✓ Good |
| motion v12 import path is 'motion/react' not 'framer-motion' (Phase 41) | Breaking change in v12; wrong import silently falls back to no-op | ✓ Good |
| React Hook Form Controller show/hide via CSS visibility, never conditional JS mounting (Phase 41) | Conditional mount triggers unmount+remount, resetting field values to undefined | ✓ Good |
| project-tabs.tsx tab routing via `<Link href scroll={false}>`, NOT Radix Tabs state (Phase 41) | URL-based routing preserves back button, shareable URLs, and sectionPrefetchMap hover-prefetch | ✓ Good |
| StatusBadge active variant = green (text-financial-positive), same as approved (Phase 42) | Active/operational states signal positive progress, not brand-blue; consistent with approved/completed | ✓ Good |
| TanStack sort: enableSortingRemoval: false — 2-state cycle only (Phase 42) | No unsorted state after first click; more predictable for financial tables | ✓ Good |
| canCurrentUserApprove computed per-request in bulk list endpoint via inArray (Phase 44) | Same pattern as approve/reject mutations; first pending step wins; empty guard skips inArray([]) | ✓ Good |
| getHeaderStats runs all 9 sub-queries in Promise.all (Phase 46) | No sequential awaits; contractValue priority chain: accepted estimate + approved COs > project.budget > 0 | ✓ Good |
| Approval mutations invalidate getHeaderStats alongside list queries (Phase 46) | Without this, tab badge counts go stale for up to 5 min after inline approval | ✓ Good |
| Sidebar trimmed to 5 entries; removed nav routes (Bidding, Financials, Documents, Reports) preserved on disk (Phase 47) | Routes may be needed for GC/Advanced milestone; deleting them would lose history | ✓ Good |
| GC/Advanced dead code (setModeMutation, handleModeSwitch, LienWaiverTracker import) retained rather than deleted (Phase 48) | UI-only removal; underlying code preserved for possible GC/Advanced re-introduction | ✓ Good |
| projectMode: "simple" as new project default; existing projects retain gc_advanced (Phase 48) | Backward compatible — existing projects unaffected; only new projects get clean simple mode | ✓ Good |
| Proposals tab href stays /estimates; only display name "Proposals" changes (Phase 49) | URL migration would require slug renames and redirect chain — not worth the risk for a label change | ✓ Good |
| Expenses placeholder uses Receipt icon (no toast) — future feature pattern, not phase-gate (Phase 49) | Lock icon + toast signals "upgrade required"; Receipt icon signals "coming soon" — more accurate intent | ✓ Good |
| PHASE_FEATURE_GATES server-side guard for Change Orders preserved despite tab gate removal (Phase 49) | Tab visibility is client-side UX; server-side mutation guard is defense-in-depth; both can coexist | ✓ Good |
| estimates.sendToCustomer uses CASL "manage" (stronger than submitEstimate "update"); under_contract blocks resend (Phase 50) | "manage" signals intentional customer-facing action; terminal contract state should never be resent | ✓ Good |
| changeOrder.sendToCustomer: PCO number assigned once on first send; if(!co.pcoNumber) guard prevents duplicate counter increment (Phase 50) | Idempotent PCO numbering; repeat sends reuse same number without consuming sequence | ✓ Good |
| SendToCustomerDialog pre-population fires only when open===true AND field==="" — preserves user edits on reopen (Phase 50) | One-time population guard prevents overwriting user's custom recipient entry after first fill | ✓ Good |
| No success toast on lifecycle phase transition — badge optimistic update is the confirmation (Phase 51) | Toasts are for async results where the UI doesn't change; badge update makes the phase change immediately visible | ✓ Good |
| isValidTransition guard removed from API router; isBackward variable retained for audit log metadata only (Phase 51) | Audit log still records direction; removing guard doesn't mean losing audit trail context | ✓ Good |
| Preserve old trades JSONB (number[]) column; new trade JSONB (string[]) column separate (Phase 52) | RFQ procedures query old trades column; migration only adds columns, never removes — zero RFQ regression risk | ✓ Good |
| useForm<any> with zodResolver in SubcontractorForm (Phase 52) | AddressInput requires nested address.* paths; flat Zod schema requires top-level fields; runtime validation via zodResolver preserves correctness | ✓ Good |
| TanStack Table row model factories at module level, not inline (Phase 52 bug fix) | Inline factory calls create new references every render; TanStack Table's useLayoutEffect detects reference changes and loops infinitely when data transitions through undefined | ✓ Good |
| All new project columns nullable (no DEFAULT, no NOT NULL) for backward compat (Phase 53) | Existing projects get null values for new fields — no migration failures, no defaults needed | ✓ Good |
| buildingSqft excluded from Zod schema; server-computed as width × length on create (Phase 53) | Prevents user from submitting a sqft value that disagrees with width × length | ✓ Good |
| projectedProfit = estimateTotal − (directCosts + overheadAmount) from accepted estimate only (Phase 54) | CO revenue excluded from cost side to avoid profit inflation; actual profit deferred until Expenses built | ✓ Good |
| Margin returned as decimal (e.g. 0.185) from API; UI layer converts to percentage for display (Phase 54) | Avoids format coupling between API and presentation layer | ✓ Good |
| DatePickerField fires trpc.project.update.useMutation (not updateProject — actual procedure name is update) (Phase 54) | Correct procedure name is `update`; plan had typo; auto-fixed during execution | ✓ Good |
| Notes use hard delete (no soft delete); ownership enforced server-side; trash icon visible to all (Phase 55) | Server enforces delete permission — simpler client, correct security boundary | ✓ Good |
| Overview tab section layout: space-y-8 only, no Card wrappers, no section dividers (Phase 55) | Clean flat layout; section headings + spacing provide all visual separation needed | ✓ Good |
| document.update file extension preserved from existing doc name (not user input) (Phase 56) | User always edits display name only; extension reconstruction transparent to the user | ✓ Good |
| No audit log on document.update (Phase 56) | Consistent with Phase 55 notes router precedent — keep simple, no audit trail for name/category edits | ✓ Good |
| Inline edit Save/Cancel buttons replace DocumentRowMenu in Actions cell while editing (Phase 56) | Prevents conflicting UI states; single-row edit constraint enforced at editingId state level | ✓ Good |
| forPreview flag on getDownloadUrl omits filename from generateDownloadUrl (Phase 56) | Omitting filename removes Content-Disposition: attachment header → browser renders PDF inline | ✓ Good |
| File type filter applied client-side in page.tsx via useMemo (Phase 56) | API's listUnified doesn't filter by extension; client-side filter avoids API change for simple extension matching | ✓ Good |

---
*Last updated: 2026-02-25 — v1.8 milestone complete*
