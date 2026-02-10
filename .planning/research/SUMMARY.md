# Project Research Summary

**Project:** Construction Management SaaS
**Domain:** Multi-tenant commercial/industrial construction platform
**Researched:** 2026-02-10
**Confidence:** MEDIUM

## Executive Summary

This is a multi-tenant construction management SaaS targeting commercial GCs and subcontractors, positioned between residential-focused tools like Buildertrend and enterprise solutions like Procore. The recommended approach leverages proven multi-tenant patterns (PostgreSQL schema-per-company isolation), modern TypeScript stack (Next.js + Fastify + Drizzle), and strategic differentiation through AI-assisted document drafting and JV bid sharing capabilities.

The core architecture must prioritize tenant isolation from day one, as retrofitting multi-tenancy is catastrophic. The PostgreSQL schema-per-company pattern provides strong isolation while remaining manageable at scale (1000+ tenants), with clear migration path to Citus if needed. Cloud-agnostic infrastructure (Kubernetes, S3-compatible storage, open-source tooling) prevents vendor lock-in while maintaining deployment flexibility across AWS, GCP, Azure, or DigitalOcean.

Critical risks center on data integrity in financial workflows (budget/change order/payment cascades), AI context isolation preventing cross-tenant data leakage, and connection pool exhaustion as tenant count scales. These require architectural decisions in Phase 1 (foundation) that cannot be changed later. The recommended phased approach builds authentication and tenant isolation first, then core financial workflows, followed by differentiating features (AI, JV collaboration), and finally external integrations.

## Key Findings

### Recommended Stack

The stack prioritizes cloud-agnostic deployment, multi-tenant isolation, and rapid iteration velocity. Node.js/TypeScript provides the ecosystem needed for construction integrations (QuickBooks, calendar APIs), while PostgreSQL schema isolation delivers the exact tenant separation pattern required.

**Core technologies:**
- **PostgreSQL 16+ with schema-per-tenant**: Native schema support provides strong isolation, JSONB for flexible construction data, proven at 1000+ tenant scale
- **Fastify + TypeScript**: 3-4x faster than Express, built-in schema validation, excellent plugin architecture for tenant middleware
- **Next.js 14 App Router**: Server components for performance, built-in API routes, optimal for SaaS marketing pages and application UI
- **Drizzle ORM**: Lightweight with excellent TypeScript inference, supports dynamic schema switching crucial for multi-tenancy
- **Clerk**: Zero Trust authentication with MFA out-of-box, handles multi-tenant organization/user relationships natively
- **tRPC**: End-to-end type safety eliminates API drift, critical for fast iteration in monorepo structure
- **Kubernetes + Terraform + Helm**: Cloud-agnostic orchestration works across all major clouds and on-prem, avoids vendor lock-in
- **OpenAI API + Vercel AI SDK**: Best-in-class for business document generation, streaming responses, structured outputs for construction templates

**Critical version requirements:**
- Node.js 20 LTS (stability through April 2026)
- PostgreSQL 16+ (improved schema management)
- Next.js 14.x (stable App Router with server components)

### Expected Features

Research reveals a clear split between table stakes (features users expect from any construction SaaS), competitive differentiators, and anti-features to explicitly avoid.

**Must have (table stakes):**
- Project creation and budget tracking with cost codes (CSI divisions)
- Change order management with approval workflows
- Commitment tracking (subcontracts and POs against budget)
- Pay application (G702/G703) with retainage and lien waivers
- RFQ creation, distribution, and bid comparison
- Document management with version control
- User permissions (company-level, project-level, role-based)
- Audit trails for financial transactions

**Should have (competitive differentiators):**
- AI-assisted document drafting (RFQs, emails, reports) - saves hours, context-aware
- JV bid sharing - enables formal partnerships, unique collaboration model
- Freemium subcontractor accounts - network effects, viral growth
- QuickBooks bidirectional sync - eliminate double entry
- Calendar integration (Google/Outlook) - centralize meeting coordination

**Defer (v2+ or avoid):**
- CPM scheduling/Gantt charts - Procore owns this, extreme complexity
- Native mobile apps - responsive PWA sufficient for v1
- Time tracking/payroll - feature bloat, compliance minefield
- Equipment tracking - niche need, hardware dependencies
- BIM/3D model viewing - extreme complexity, specialized tools exist
- Bid parsing AI - accuracy challenges, over-promising risk for v1

### Architecture Approach

The architecture uses layered services with strict tenant isolation enforced at multiple levels: API Gateway for rate limiting, Shared Services for authentication/authorization/tenant context, Application Services for business logic, and Data Layer with PostgreSQL schema isolation.

**Major components:**
1. **Tenant Context Service** - Maps company_id from JWT to schema name, validates user access, sets database search_path. Every request flows through this middleware before any business logic.
2. **Authorization Service (PBAC)** - Permission-based access control evaluates "can user X perform action Y on resource Z in company A?" Cached with invalidation on policy changes.
3. **AI Drafting Engine** - Document generation with strict per-company context isolation. Vector embeddings filtered by company_id to prevent cross-tenant data leakage.
4. **Connection Pool Manager** - Shared pool with dynamic search_path switching, avoids per-schema pool explosion. Critical for scaling past 100 tenants.
5. **JV Collaboration Service** - Mediates cross-company access via explicit relationships stored in shared schema. No direct cross-schema joins.
6. **Integration Service** - Async job queue for QuickBooks/calendar sync, OAuth tokens stored per company (encrypted in tenant schema).

**Key patterns:**
- Schema-per-tenant (not DB-per-tenant, not shared-tables-with-tenant-id)
- Tenant Context middleware on every request (validates JWT, sets search_path)
- Authorization-first service methods (check permissions before querying data)
- Service-layer mediation for cross-company features (no direct schema joins)

### Critical Pitfalls

Research identified pitfalls that cause rewrites, security breaches, or major business disruption. These must be addressed in architectural decisions during foundation phases.

1. **Schema-per-tenant connection pool exhaustion** - At scale, hundreds of active tenants exhaust connection pools causing cascading failures. Prevention: PgBouncer from start, connection limits per tenant, monitor from day one. Must be designed in Phase 1.

2. **AI training data contamination across tenants** - AI models trained on cross-tenant data leak Company A's bid strategies into Company B's suggestions. Prevention: Tenant_id filtering at data layer (not application), separate vector stores or strict namespaces, audit with red team tests. Must be designed in Phase 2 (AI foundation).

3. **Change order cascade breaking budget integrity** - Change orders affect budgets → commitments → payment apps → QuickBooks sync. One failed update causes permanent inconsistency. Prevention: Database transactions spanning workflow, event sourcing for budget history, idempotent operations. Must be designed in Phase 3 (financial workflows).

4. **RFQ/Bid data model assuming linear workflows** - Real bidding is messy: amendments, re-bids, withdrawals, JV ownership. Rigid model breaks. Prevention: Immutable RFQs with versioning, bid states (draft/submitted/withdrawn/awarded), many-to-many JV ownership. Must be correct in Phase 4 (bidding workflows).

5. **Cost code configuration rigidity** - Hardcoding CSI MasterFormat breaks for different trades. Prevention: Configurable per company, hierarchical structure, trade-specific templates. Must be designed in Phase 1 (data model foundation).

6. **Pay app approval workflow assuming single approver** - Real workflows require multi-party approval (PM, superintendent, owner, architect). Prevention: Configurable approval chains, parallel approvals, conditional states, role-based rules per project. Must be designed in Phase 3 (payment workflows).

7. **Free tier becoming backdoor to paid data** - Free users invited as collaborators export paid company data. Prevention: Export restrictions by tier, JV sharing requires compatible tiers, audit cross-company access. Must be designed in Phase 5 (subscription management).

## Implications for Roadmap

Based on combined research, the roadmap should follow dependency order: Foundation (auth/tenant isolation) → Core Financial Workflows → Bidding Workflows → AI Enhancement → Integration & Polish. This order prevents costly refactoring and ensures security/data integrity from the start.

### Phase 1: Foundation & Multi-Tenant Infrastructure
**Rationale:** All application features depend on authentication and tenant isolation. No point building Project API if it can't route to correct schema securely. Connection pooling strategy must be decided before first tenant, as retrofitting is catastrophic.

**Delivers:**
- User authentication with MFA (Clerk)
- Tenant Context Service (JWT → schema mapping and validation)
- Database schema structure (shared + per-company schemas)
- Connection Pool Manager with search_path switching
- Audit Service (basic event logging)
- Authorization Service foundations (PBAC engine)

**Addresses features:**
- User permissions/roles (table stakes)
- Audit trails (table stakes)

**Avoids pitfalls:**
- Connection pool exhaustion (design pooling strategy upfront)
- Cost code configuration rigidity (design configurable from start)
- Row-level security not enforced (implement database RLS policies)

**Needs research:** No - multi-tenant patterns are well-documented

---

### Phase 2: Core Financial Lifecycle
**Rationale:** Smallest feature set delivering "full project financial lifecycle" value. Establishes data integrity patterns before adding complexity. Financial workflows must use transactions and event sourcing from start, as retrofitting is extremely high-risk.

**Delivers:**
- Project creation and setup (name, location, dates, team)
- Budget tracking with configurable cost codes
- Change order management with approval workflows
- Commitment tracking (subcontracts and POs against budget)
- Basic document management (contracts, invoices)
- Financial reports (budget vs actual)

**Uses stack:**
- Drizzle ORM for type-safe queries
- Fastify with tenant middleware
- PostgreSQL with schema isolation

**Implements architecture:**
- Project API with authorization-first methods
- Document Management API (metadata in schema, files in S3)

**Addresses features:**
- Project management core (table stakes)
- Budget tracking (table stakes)
- Change order management (table stakes)
- Commitment tracking (table stakes)

**Avoids pitfalls:**
- Change order cascade breaking budget integrity (transactions spanning workflow)
- Budget modifications after payment apps (lock with version history)
- Hard-deletes instead of soft-deletes (implement deleted_at)
- Inadequate search for large project counts (typeahead from start)

**Needs research:** Moderate - validate CSI MasterFormat usage patterns among target contractors

---

### Phase 3: Payment Applications & Billing
**Rationale:** Completes core financial cycle (budget → commitment → billing). Requires change order foundation from Phase 2. Pay app approval workflows are complex and cannot be simplified without breaking real-world usage.

**Delivers:**
- Pay application (G702/G703 forms)
- Multi-party approval workflows (configurable chains)
- Retainage tracking
- Lien waiver collection
- Invoice tracking (AP/AR)
- QuickBooks sync foundation (data model mapping)

**Uses stack:**
- BullMQ for async job queue (QB sync)
- Redis for cache and queue backing
- Zod for validating payment data

**Implements architecture:**
- Billing Service with async QB integration
- Approval workflow engine (configurable stages)

**Addresses features:**
- Pay application (table stakes)
- Lien waiver collection (table stakes)
- Invoice tracking (table stakes)

**Avoids pitfalls:**
- Pay app approval assuming single approver (configurable chains from start)
- QuickBooks sync as real-time operation (async queue with retry)
- Missing audit trail for financial changes (immutable audit log)

**Needs research:** Yes - QuickBooks Online API details (rate limits, OAuth flow, webhook reliability, data model mapping)

---

### Phase 4: Bidding & Procurement Workflows
**Rationale:** Pre-construction workflows depend on project and budget foundations. RFQ data model must support real-world messiness (amendments, re-bids, JV ownership) from start, as migrating bid data is high-risk.

**Delivers:**
- RFQ creation and distribution
- Bid collection and comparison (side-by-side)
- Subcontractor directory with qualified trades
- Bid package management (drawings, specs, addenda)
- JV bid sharing (cross-company collaboration)
- Freemium subcontractor accounts

**Uses stack:**
- tRPC for type-safe bid submission API
- Email integration (SendGrid for RFQ distribution)

**Implements architecture:**
- JV Collaboration Service (scoped cross-company access)
- Billing integration (freemium vs paid tier controls)

**Addresses features:**
- RFQ creation and distribution (table stakes)
- Bid collection and comparison (table stakes)
- Subcontractor directory (table stakes)
- JV bid sharing (differentiator)
- Freemium sub accounts (differentiator)

**Avoids pitfalls:**
- RFQ/Bid data model assuming linear workflows (immutable RFQs with versioning)
- Not supporting re-bidding after no award (clone with amendments)
- Bid deadline timezone confusion (UTC storage, display in project timezone)
- Change order numbering conflicts (separate sequences for PCO/CO)

**Needs research:** Moderate - validate JV bid sharing workflows with target users (is this need real or assumed?)

---

### Phase 5: AI-Enhanced Productivity
**Rationale:** AI features require stable document and project APIs for context. Tenant isolation must be proven before AI accesses data, as cross-tenant contamination is catastrophic. Building AI foundation after core workflows are proven reduces risk.

**Delivers:**
- AI-assisted RFQ drafting (context-aware, learns project specifics)
- AI-assisted email writing (communication efficiency)
- AI-assisted report generation (executive summaries)
- Template library for standardization

**Uses stack:**
- OpenAI API (GPT-4 Turbo)
- Vercel AI SDK (streaming, retries)
- Zod for validating AI outputs against required fields

**Implements architecture:**
- AI Drafting Engine with per-company context isolation
- Vector DB with tenant-namespaced embeddings

**Addresses features:**
- AI-assisted document drafting (differentiator)
- Template library (differentiator)

**Avoids pitfalls:**
- AI training data contamination across tenants (tenant_id filtering at data layer)
- Hallucinated financial amounts (never let AI generate amounts without source)
- Prompt injection via document content (separate system prompt from user content)
- Caching AI responses across tenants (tenant_id in cache keys)

**Needs research:** Yes - AI model selection (cost/latency tradeoffs, data residency requirements, fine-tuning feasibility)

---

### Phase 6: Communication & Collaboration
**Rationale:** Communication features enhance existing workflows but aren't blocking. Can be built once core financial and bidding workflows are stable.

**Delivers:**
- RFI management (numbered tracking, response workflow, closeout)
- Submittal management (spec section tracking, review workflow)
- Email integration (two-way sync, associate to projects)
- Team directory with roles

**Uses stack:**
- Microsoft Graph API (Outlook/365 calendar)
- Google Calendar API
- Email webhooks for inbound processing

**Addresses features:**
- RFI management (table stakes)
- Submittal management (table stakes)
- Email integration (table stakes)
- Team directory (table stakes)

**Avoids pitfalls:**
- Email notifications becoming spam (digest by default, configurable)
- Timezone confusion (UTC storage, display in user timezone)

**Needs research:** Moderate - calendar bi-directional sync patterns (conflict resolution, timezone handling)

---

### Phase 7: QuickBooks Integration & Drawing Management
**Rationale:** Rounds out table stakes features. QuickBooks sync foundation built in Phase 3, this phase completes bi-directional sync. Drawing management deferred as it's complex and not blocking core workflows.

**Delivers:**
- QuickBooks bidirectional sync (projects, invoices, bills)
- Calendar integration (read/write events)
- Drawing management (plans, versions, sheet navigation)
- Integration health monitoring

**Uses stack:**
- QuickBooks Online API (OAuth 2.0, webhooks)
- BullMQ for integration jobs
- S3 for drawing storage

**Implements architecture:**
- Integration Service OAuth token management
- Webhook handlers with signature validation

**Addresses features:**
- QuickBooks integration (differentiator)
- Calendar integration (differentiator)
- Drawing management (table stakes)

**Avoids pitfalls:**
- QuickBooks token expiration handling (refresh before expiration, alert on failure)
- Assuming QB data model matches internal (flexible mapping layer)
- Document storage unlimited/cheap (presigned URLs, storage quotas by tier)

**Needs research:** Yes - QuickBooks Online API details (already flagged in Phase 3)

---

### Phase Ordering Rationale

**Dependency-driven order:**
- Phases 1-2 are foundation: cannot build features without auth/tenant isolation and core data models
- Phase 3 completes financial cycle started in Phase 2
- Phase 4 (bidding) depends on budget foundation but can proceed in parallel with Phase 3 after Phase 2
- Phase 5 (AI) depends on document and project APIs from Phases 2-4
- Phases 6-7 enhance core workflows but aren't blocking

**Pitfall avoidance:**
- Multi-tenant isolation decisions in Phase 1 cannot be changed later (connection pooling, schema structure)
- Financial workflow integrity in Phases 2-3 requires transactions and event sourcing from start
- AI context isolation in Phase 5 must be designed before implementation, cannot be retrofitted
- RFQ data model flexibility in Phase 4 critical before collecting real bid data

**Risk mitigation:**
- Build authentication/security first (Phases 1-2)
- Establish data integrity patterns early (Phase 2-3) before complexity grows
- Prove tenant isolation before AI accesses data (Phase 5 after Phases 1-4)
- External integrations last (Phase 7) to minimize dependency on third-party API stability

### Research Flags

**Phases needing deeper research during planning:**

- **Phase 3:** QuickBooks Online API - OAuth flows, webhook reliability, rate limits, data model mapping between internal projects and QB customers/jobs. Complex integration with limited documentation.

- **Phase 4:** JV collaboration workflows - Need user validation that "JV bid sharing" solves real pain point. What does "scoped access" mean to users? Define data visibility rules with product/UX team before building.

- **Phase 5:** AI model selection - Cost/latency tradeoffs between OpenAI API vs self-hosted LLMs. Data residency requirements for construction companies. Fine-tuning feasibility after collecting document corpus.

- **Phase 6:** Calendar bi-directional sync - Conflict resolution patterns when multiple systems modify same event. Timezone handling for construction projects spanning time zones. Microsoft Graph API permissions for commercial tenants.

- **Phase 7:** Drawing management - Construction-specific requirements for plan versioning, sheet navigation, markup workflows. Consider integration with existing tools (Bluebeam, PlanGrid) vs building native.

**Phases with standard patterns (skip research-phase):**

- **Phase 1:** Multi-tenant auth and database patterns are well-documented. Clerk documentation comprehensive. PostgreSQL schema isolation is proven approach.

- **Phase 2:** CRUD APIs with authorization checks follow standard patterns. Financial transactions and audit logging are well-understood database patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Fastify/Next.js/PostgreSQL are solid choices, but specific version features and Drizzle multi-tenant support unverified without web access. Clerk pricing for expected user counts unknown. |
| Features | MEDIUM | Table stakes list aligns with construction SaaS standards (AIA forms, cost codes, RFQs). JV bid sharing differentiation needs user validation. Competitive landscape (Procore, Buildertrend) based on training data, not 2026 current state. |
| Architecture | MEDIUM | Multi-tenant schema-per-tenant pattern is proven for this use case (HIGH confidence). Construction-specific workflows and data models have LOW confidence without domain expert validation. JV collaboration UX unclear. |
| Pitfalls | HIGH | Multi-tenant isolation pitfalls (connection pooling, AI contamination, tenant_id filtering) are well-documented risks with proven prevention strategies. Financial workflow integrity patterns are standard. Construction-specific pitfalls (RFQ amendments, cost code flexibility) based on general understanding. |

**Overall confidence:** MEDIUM

### Gaps to Address

Research was conducted without access to Context7 or WebSearch tools. All recommendations based on training data current through January 2025.

**Critical gaps requiring verification:**

- **Stack versions:** All version numbers (Node.js 20, PostgreSQL 16, Next.js 14, Drizzle 0.29+) should be verified against official registries before implementation. Drizzle dynamic schema switching support needs confirmation.

- **Clerk pricing:** Current pricing model and costs for expected user counts (100-1000 MAUs) unknown. Could significantly impact unit economics.

- **QuickBooks API:** 2026 rate limits, webhook reliability, OAuth refresh flows unverified. This impacts Phase 3 design decisions.

- **Construction workflows:** Data models for RFIs, submittals, change orders, and payment applications should be validated with 3-5 target users (GCs and subs) before locking schema design. AIA contract document requirements may have updated.

- **CSI MasterFormat adoption:** Assumed as standard, but actual usage patterns among small-mid contractors unknown. Survey needed before deciding cost code structure.

**Non-blocking gaps (verify during phase planning):**

- AI model hosting costs and latency at scale (Phase 5)
- Calendar API permissions for commercial Microsoft 365 tenants (Phase 6)
- Drawing management feature depth vs integration approach (Phase 7)
- Citus sharding threshold (estimate: 1K companies, needs load testing)

**Actionable without verification:**

- Multi-tenant isolation patterns (PostgreSQL RLS, tenant_id validation, schema-per-tenant)
- Financial workflow integrity (database transactions, audit logging, event sourcing)
- Authorization patterns (PBAC, JWT with short expiry, MFA)
- AI context isolation (vector store namespacing, tenant_id filtering)
- Cloud-agnostic infrastructure (Kubernetes, Terraform, S3-compatible storage)

## Sources

### Primary (HIGH confidence)
- Multi-tenant SaaS architecture patterns (schema-per-tenant, connection pooling, tenant isolation)
- PostgreSQL documentation (schema management, search_path, row-level security)
- Authorization patterns (PBAC, Zero Trust, JWT best practices)
- AI integration security (RAG patterns, context isolation, prompt injection prevention)
- Database transaction patterns (event sourcing, audit logging, idempotency)

### Secondary (MEDIUM confidence)
- Construction industry workflows (based on general construction software knowledge, not 2026-specific)
- AIA contract documents (G702/G703 payment applications, standard forms)
- CSI MasterFormat cost code standards
- Technology stack recommendations (Node.js, TypeScript, Fastify, Next.js, Drizzle, Clerk)
- Competitive landscape (Procore, Buildertrend, CoConstruct) - training data, not current state

### Tertiary (LOW confidence)
- QuickBooks Online API specifics (rate limits, webhook reliability) - needs verification
- Clerk pricing model (2026 current pricing unknown)
- Construction-specific data model details (RFIs, submittals, change orders) - needs domain expert validation
- JV collaboration UX patterns (needs product/UX research)
- Drizzle ORM multi-tenant support (version 0.29+ capabilities unverified)

**Verification recommended before implementation:**
1. All version numbers against official npm/package registries
2. Drizzle ORM schema-per-tenant support in version 0.29+
3. Clerk current pricing for expected user scale
4. QuickBooks Online API documentation (OAuth, webhooks, rate limits)
5. Construction workflow validation with 3-5 target users (GCs and subs)
6. CSI MasterFormat adoption patterns among small-mid contractors
7. Competitive feature analysis (demo Procore, Buildertrend, BuilderTrend Bidding)

---

*Research completed: 2026-02-10*
*Ready for roadmap: Yes*
