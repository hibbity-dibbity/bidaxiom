# Technology Stack

**Project:** Construction Management SaaS
**Domain:** Multi-tenant commercial/industrial construction platform
**Researched:** 2026-02-10
**Research Limitations:** Created from training data (Jan 2025 cutoff) without ability to verify current versions via Context7/official docs

## CONFIDENCE WARNING

**Overall Confidence: LOW-MEDIUM**

This research was conducted without access to Context7 or WebSearch tools. All recommendations are based on training data current through January 2025. Version numbers and specific library choices should be verified against official documentation before implementation.

**Required Verification:**
- All version numbers against official npm/package registries
- Current best practices for multi-tenancy patterns
- Latest AI SDK capabilities and pricing
- Current Kubernetes/container platform features

---

## Recommended Stack

### Backend Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Node.js** | 20 LTS | Runtime | Mature LTS with native ESM, superior async I/O for API-heavy workload, largest ecosystem for integrations |
| **TypeScript** | 5.3+ | Type safety | Essential for large codebase, catches tenant isolation bugs at compile time, better IDE support |
| **Fastify** | 4.x | HTTP framework | 3-4x faster than Express, built-in schema validation, excellent TypeScript support, plugin architecture ideal for multi-tenancy middleware |

**Rationale:**
- Node.js 20 LTS provides stability through April 2026, with built-in fetch and improved performance
- Fastify over Express for performance and type safety — construction SaaS will handle document uploads, AI processing, and real-time updates
- TypeScript is non-negotiable for multi-tenant systems where data isolation bugs are catastrophic

**Alternatives Considered:**
| Choice | Alternative | Why Not |
|--------|-------------|---------|
| Fastify | Express | No built-in validation, slower, requires more middleware for type safety |
| Fastify | NestJS | Over-engineered for this use case, steeper learning curve, slower iteration |
| Node.js | Go | Smaller ecosystem for integrations (QuickBooks, calendar), longer dev time |

### Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **PostgreSQL** | 16.x | Primary database | Best-in-class schema isolation, JSONB for flexible construction data, proven at scale for multi-tenant SaaS |
| **Drizzle ORM** | 0.29+ | Type-safe ORM | Lightweight, excellent TypeScript inference, supports schema-per-tenant patterns, migration control |
| **pgBouncer** | 1.21+ | Connection pooling | Essential for schema-per-company isolation, handles connection multiplexing |

**Rationale:**
- PostgreSQL schema isolation provides the exact pattern needed: shared infrastructure, isolated data, manageable at scale
- Drizzle over Prisma for schema-per-tenant: Prisma struggles with dynamic schema switching, Drizzle gives full SQL control
- pgBouncer is critical: each tenant schema needs connection pooling without connection explosion

**Schema-Per-Tenant Pattern:**
```typescript
// Example approach
const tenantDb = drizzle(pgPool, {
  schema: companySchemas[tenantId]
});
// SET search_path = company_123
```

**Alternatives Considered:**
| Choice | Alternative | Why Not |
|--------|-------------|---------|
| PostgreSQL | MongoDB | No native schema isolation, weaker consistency for financial data, complex multi-document transactions |
| Drizzle | Prisma | Poor dynamic schema support, connection pooling issues with multi-tenancy |
| Drizzle | TypeORM | Less type-safe, heavier runtime overhead |

### Frontend Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Next.js** | 14.x (App Router) | Full-stack React framework | Server components for performance, built-in API routes, best SEO for marketing pages, industry standard for React SaaS |
| **React** | 18.x | UI library | Component model ideal for construction forms, largest ecosystem, proven for enterprise apps |
| **TypeScript** | 5.3+ | Type safety | Shared types with backend, catches API contract mismatches |
| **Tailwind CSS** | 3.4+ | Styling | Rapid UI development, excellent mobile-first responsive design, smaller bundle than component libraries |
| **shadcn/ui** | Latest | Component library | Unstyled, accessible components you own (no dependency), Tailwind-based, ideal for custom construction UI |
| **React Query (TanStack Query)** | 5.x | Server state | Handles caching/optimistic updates for project data, reduces backend load, offline-first capabilities |
| **Zustand** | 4.x | Client state | Lightweight, TypeScript-first, handles UI state (modals, filters) without Redux complexity |

**Rationale:**
- Next.js 14 App Router for server components (critical for initial page loads with large project data)
- shadcn/ui over Material-UI/Ant Design: you need custom construction workflows (Gantt charts, bid comparisons, RFQ builders) — pre-built component libraries fight you
- React Query essential for optimistic updates (mark RFQ sent, update project status) and cache invalidation across tenants
- Zustand for simple client state (form wizards, modal state) without Redux boilerplate

**Alternatives Considered:**
| Choice | Alternative | Why Not |
|--------|-------------|---------|
| Next.js | Remix | Smaller ecosystem, less mature, Next.js is industry standard |
| Next.js | Vite + React | No server components, manual API routing, slower initial loads |
| shadcn/ui | Material-UI | Heavy bundle, fights custom construction UI patterns |
| shadcn/ui | Chakra UI | Less active development, switching to paid model |

### AI Integration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **OpenAI API** | Latest | AI drafting engine | Best-in-class for long-form business writing (RFQs, emails), structured output for construction templates |
| **Vercel AI SDK** | 3.x | AI framework | Streaming responses, prompt management, handles rate limiting, integrates with Next.js |
| **Zod** | 3.x | Schema validation | Define construction document schemas, validate AI outputs against required fields |

**Rationale:**
- OpenAI GPT-4 Turbo for drafting: proven for business writing, structured outputs (JSON mode) for template filling
- Vercel AI SDK handles streaming (show RFQ generation in real-time), retries, and provider abstraction
- Zod critical for validating AI-generated construction documents against required fields (project #, scope, dates)

**Alternative Considered:**
| Choice | Alternative | Why Not |
|--------|-------------|---------|
| OpenAI | Anthropic Claude | Excellent but less ecosystem tooling, Vercel AI SDK supports both (keep option open) |
| OpenAI | Open-source LLMs | Not reliable enough for customer-facing business documents in v1 |
| Vercel AI SDK | LangChain | Over-engineered for drafting use case, slower to iterate |

### Authentication & Authorization

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Clerk** | Latest | Auth platform | Zero Trust by default (MFA, short-lived tokens, session management), excellent DX, handles multi-tenant user assignment |
| **CASL** | 6.x | Authorization (PBAC) | Define permissions-based access control, integrates with TypeScript for type-safe policies |

**Rationale:**
- Clerk over Auth0/Cognito: built for multi-tenant SaaS, handles organization/user relationships, NextJS integration, MFA out-of-box
- Clerk provides JWT with short expiry, automatic token refresh, WebAuthn support
- CASL for PBAC: define "Project Manager can edit RFQs on assigned projects" in type-safe code, not scattered conditionals

**Alternatives Considered:**
| Choice | Alternative | Why Not |
|--------|-------------|---------|
| Clerk | Auth0 | More expensive at scale, complex multi-tenant setup |
| Clerk | AWS Cognito | Poor DX, manual MFA implementation, no org management |
| Clerk | NextAuth | Manual MFA, session management, no built-in org/tenant handling |
| CASL | Roll your own | High risk for security bugs, complex to maintain |

### API & Integration Layer

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **tRPC** | 10.x | Type-safe API | End-to-end type safety from backend to frontend, auto-complete API calls, catch breaking changes at compile time |
| **Zod** | 3.x | Runtime validation | Validate API inputs, construction form data, integration payloads |
| **Bull/BullMQ** | Latest | Job queue | Background jobs for AI generation, QuickBooks sync, email sending, long-running reports |
| **Redis** | 7.x | Cache + Queue backing | Session cache, API rate limiting, job queue backing store |

**Rationale:**
- tRPC for internal APIs: shared types between Next.js and backend eliminate API drift, critical for fast iteration
- BullMQ over AWS SQS: cloud-agnostic, better local dev experience, built-in retry/scheduling, Redis required anyway for caching
- Redis essential for: rate limiting AI calls per company, caching company settings, session storage, job queue

**Alternatives Considered:**
| Choice | Alternative | Why Not |
|--------|-------------|---------|
| tRPC | REST | No type safety, manual API contracts, slower iteration |
| tRPC | GraphQL | Over-engineered for this use case, complex caching |
| BullMQ | AWS SQS | Cloud lock-in, complex local dev, less visibility |

### External Integrations

| Technology | Purpose | Why |
|------------|---------|-----|
| **QuickBooks Online API** | ERP bi-directional sync | Industry standard for construction accounting, OAuth 2.0, webhooks for real-time updates |
| **Microsoft Graph API** | Calendar integration | Covers Outlook + Microsoft 365 (dominant in commercial construction) |
| **Google Calendar API** | Calendar integration | Coverage for Google Workspace users |
| **Twilio SendGrid** | Transactional email | Reliable delivery, email templates, tracking/analytics |
| **Stripe** | Subscription billing | Industry standard, handles tiered pricing + add-on modules, excellent docs |

**Rationale:**
- QuickBooks Online (not Desktop): cloud-first, real-time sync, used by 80%+ of small-mid contractors
- Microsoft Graph prioritized over Google: commercial construction heavily uses Microsoft 365
- Stripe over homegrown billing: handles SCA, tax, prorations, subscription management — critical for add-on module control

### File Storage

| Technology | Purpose | Why |
|------------|---------|-----|
| **S3-compatible storage** | Document storage | Cloud-agnostic (AWS S3, MinIO, Cloudflare R2), presigned URLs for secure direct upload |
| **@aws-sdk/client-s3** | S3 client | Standard interface, works with any S3-compatible provider |

**Rationale:**
- S3-compatible API is industry standard, enables cloud-agnostic deployment (AWS, DigitalOcean Spaces, MinIO on-prem)
- Presigned URLs critical for construction documents: clients upload directly, no backend bandwidth, tenant-isolated buckets

### Container Orchestration & Deployment

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Docker** | 24.x | Containerization | Industry standard, consistent dev/prod, enables cloud-agnostic deployment |
| **Kubernetes** | 1.28+ | Orchestration | Cloud-agnostic, handles multi-tenancy isolation, horizontal scaling, standard across GCP/AWS/Azure/DigitalOcean |
| **Helm** | 3.x | Package management | Templated deployments, environment-specific configs, rollback support |
| **Terraform** | 1.6+ | Infrastructure as Code | Cloud-agnostic provisioning, version-controlled infrastructure |

**Rationale:**
- Kubernetes for cloud-agnostic: works on GKE, EKS, AKS, DigitalOcean, even on-prem
- Helm for environment management: same chart for dev/staging/prod with value overrides
- Terraform over CloudFormation/ARM: works across all clouds, large module ecosystem

**Alternatives Considered:**
| Choice | Alternative | Why Not |
|--------|-------------|---------|
| Kubernetes | Docker Swarm | Dying ecosystem, less cloud support |
| Kubernetes | ECS/Fargate | AWS lock-in, defeats cloud-agnostic goal |
| Kubernetes | Platform.sh/Render | Vendor lock-in, less control over multi-tenancy |

### Observability & Monitoring

| Technology | Purpose | Why |
|------------|---------|-----|
| **OpenTelemetry** | Distributed tracing | Vendor-agnostic observability, trace requests across services |
| **Prometheus** | Metrics | Cloud-agnostic, Kubernetes-native, standard for container metrics |
| **Grafana** | Visualization | Open-source, works with Prometheus, customizable dashboards |
| **Sentry** | Error tracking | Excellent Next.js/Node.js integration, source maps, release tracking |

**Rationale:**
- OpenTelemetry for vendor-agnostic tracing (can send to any backend: Jaeger, Grafana Tempo, Datadog)
- Prometheus + Grafana for cost-effective monitoring (avoid CloudWatch/Stackdriver lock-in)
- Sentry for application errors: critical for catching tenant isolation bugs

### Development & Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **pnpm** | 8.x | Package manager | Faster than npm/yarn, saves disk space with shared dependencies, strict dependency resolution |
| **Vitest** | 1.x | Unit testing | Fast, Vite-powered, better TypeScript support than Jest |
| **Playwright** | 1.40+ | E2E testing | Multi-browser, excellent debugging, test multi-tenant isolation |
| **ESLint** | 8.x | Linting | Catch bugs, enforce code style |
| **Prettier** | 3.x | Code formatting | Consistent formatting across team |
| **Husky** | 8.x | Git hooks | Pre-commit linting, prevent broken commits |

**Rationale:**
- pnpm over npm: monorepo-friendly if you split frontend/backend, 2x faster installs
- Vitest over Jest: native ESM support, faster, better watch mode for rapid iteration
- Playwright over Cypress: better for testing multi-tenant scenarios (parallel isolated sessions)

---

## Complete Installation Guide

### Backend Dependencies

```bash
# Core framework
pnpm add fastify @fastify/cors @fastify/helmet @fastify/rate-limit

# Database
pnpm add drizzle-orm postgres pg
pnpm add -D drizzle-kit

# Validation
pnpm add zod

# Job queue
pnpm add bullmq ioredis

# Auth
pnpm add @clerk/fastify

# AI
pnpm add openai ai

# S3
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# Utilities
pnpm add dayjs nanoid

# Dev dependencies
pnpm add -D typescript @types/node tsx vitest
```

### Frontend Dependencies

```bash
# Framework
pnpm create next-app@latest --typescript --tailwind --app

# UI
pnpm add @radix-ui/react-* class-variance-authority clsx tailwind-merge
# (Install shadcn/ui components as needed via CLI)

# State management
pnpm add @tanstack/react-query zustand

# API
pnpm add @trpc/client @trpc/server @trpc/react-query @trpc/next

# Auth
pnpm add @clerk/nextjs

# Forms
pnpm add react-hook-form @hookform/resolvers

# AI
pnpm add ai

# Utilities
pnpm add date-fns zod

# Dev dependencies
pnpm add -D @playwright/test
```

---

## Architecture Decisions

### Why Schema-Per-Tenant (Not DB-Per-Tenant)

**Chosen:** PostgreSQL schemas with `SET search_path`

**Why:**
- Manageable at scale: 1000 companies = 1000 schemas in 1 DB, not 1000 DB instances
- Backup/restore simplicity: single database dump
- Cross-tenant queries for admin/analytics (with care)
- Connection pooling via pgBouncer
- Lower infrastructure cost

**Not DB-per-tenant because:** Unmanageable past 50-100 tenants, expensive, complex migrations

**Not shared tables with tenant_id because:** Risk of data leakage, complex queries, not true isolation for sensitive construction/financial data

### Why tRPC Over REST/GraphQL

**Chosen:** tRPC for internal Next.js ↔ backend APIs

**Why:**
- Type safety: API changes break at compile time, not runtime
- Developer velocity: autocomplete for all API calls, no manual API client code
- Refactor confidence: rename backend function → TypeScript finds all frontend usages
- Perfect for monorepo or collocated Next.js + API routes

**REST for:** External integrations (QuickBooks, calendar) — tRPC is internal-only

### Why Next.js Server Components

**Chosen:** Next.js 14 App Router with server components

**Why:**
- Performance: Large project data fetched on server, send HTML not JSON
- Security: Database queries in server components, no API exposure
- SEO: Marketing pages (pricing, features) are server-rendered
- Streaming: Show project list while RFQs load

**Risk:** New paradigm (App Router stabilized in 13.4, now mature in 14.x)

### Why Fastify Over NestJS

**Chosen:** Fastify with manual structure

**Why:**
- Speed: 3-4x faster than Express, 2x faster than NestJS
- Simplicity: No DI container, no decorators, easier to debug
- Plugin system: Clean tenant middleware injection
- TypeScript: Excellent inference without decorators

**Not NestJS because:** Over-engineered for this project, slower iteration, steeper learning curve for team

---

## Cloud-Agnostic Strategy

### Abstraction Points

| Layer | Abstraction | Implementation |
|-------|-------------|----------------|
| **Compute** | Kubernetes | Works on GKE, EKS, AKS, DOKS |
| **Database** | PostgreSQL | Managed on all clouds (RDS, CloudSQL, Azure DB) |
| **Storage** | S3 API | AWS S3, MinIO, Cloudflare R2, DigitalOcean Spaces |
| **Queue** | BullMQ + Redis | Self-hosted or managed Redis anywhere |
| **Observability** | OpenTelemetry | Send to any backend (Jaeger, Grafana, Datadog) |

**Avoid:**
- AWS Lambda (use Kubernetes)
- DynamoDB (use PostgreSQL)
- CloudFormation (use Terraform)
- AWS-specific services (SES → SendGrid, SQS → BullMQ)

### Deployment Pattern

```
Terraform provisions:
  → Kubernetes cluster (GKE/EKS/AKS/DOKS)
  → Managed PostgreSQL
  → Managed Redis
  → S3-compatible storage

Helm deploys to Kubernetes:
  → Next.js app (stateless pods)
  → Fastify API (stateless pods)
  → BullMQ workers (stateless pods)
  → pgBouncer (connection pooling)
  → Prometheus + Grafana (monitoring)
```

---

## Security Considerations

### Multi-Tenant Isolation

| Layer | Mechanism |
|-------|-----------|
| **Auth** | Clerk organizations map to companies |
| **Database** | PostgreSQL schemas, SET search_path per request |
| **Middleware** | Fastify hooks validate company_id from JWT → set schema |
| **Storage** | S3 bucket folders per company, presigned URLs with tenant check |
| **API** | CASL checks: user.company_id matches resource.company_id |

### Zero Trust Implementation

```typescript
// Every API request:
1. Clerk validates JWT (MFA, short-lived token)
2. Extract user_id + company_id from token
3. Fastify middleware: SET search_path = company_{id}
4. CASL checks: user has permission for action on resource
5. Execute query (automatically scoped to company schema)
```

---

## Performance Optimizations

### Database

- **Indexes:** Company-specific indexes in each schema (project dates, RFQ status)
- **Connection pooling:** pgBouncer in transaction mode
- **Read replicas:** For reporting/analytics (not in v1)

### Caching

- **Redis layers:**
  - Company settings (rarely change)
  - User permissions (invalidate on role change)
  - API rate limits (per company, per user)

### Frontend

- **React Query:** Stale-while-revalidate for project lists
- **Optimistic updates:** Mark RFQ sent immediately, rollback if fails
- **Server components:** Project dashboard data fetched on server

---

## Cost Optimization

### Infrastructure Costs

| Service | Provider | Est. Cost (100 companies) |
|---------|----------|---------------------------|
| Kubernetes | DigitalOcean | $200/mo (3 nodes) |
| PostgreSQL | DO Managed DB | $60/mo (4GB) |
| Redis | DO Managed | $15/mo (1GB) |
| S3 Storage | Cloudflare R2 | ~$15/mo (100GB) |
| **Total** | | **~$290/mo** |

**vs AWS:** ~$500-700/mo for equivalent (EKS more expensive than DOKS)

### SaaS Costs

| Service | Cost |
|---------|------|
| Clerk | $25/mo (free tier → 10k MAUs, then $0.02/MAU) |
| OpenAI | ~$100-300/mo (depends on AI usage) |
| Stripe | 2.9% + $0.30 per transaction |
| SendGrid | Free tier → $20/mo (40k emails) |

---

## Migration Paths

### If You Outgrow This Stack

**PostgreSQL schemas → Separate databases:**
- At 5000+ companies, consider sharding by company_id ranges
- Tooling exists: Citus Data, PostgreSQL partitioning

**Kubernetes → Serverless:**
- If workload becomes unpredictable, consider cloud functions for specific endpoints
- Keep core on Kubernetes for cost predictability

**OpenAI → Fine-tuned model:**
- After collecting construction document corpus, fine-tune for cost savings
- Estimate: 6-12 months of data needed

---

## Anti-Patterns to Avoid

### Database

**DON'T:** Use MongoDB for financial/project data
- **WHY:** No schema isolation, weak consistency for money calculations, complex transactions

**DON'T:** Premature database sharding
- **WHY:** PostgreSQL schemas scale to thousands of tenants, sharding adds massive complexity

### API Design

**DON'T:** Mix tRPC and REST for internal APIs
- **WHY:** Loses type safety benefits, confusing for team

**DON'T:** Put business logic in Next.js API routes
- **WHY:** Hard to test, hard to reuse, couples to Next.js

### Multi-Tenancy

**DON'T:** Trust client-provided company_id
- **WHY:** Catastrophic data leakage, always derive from authenticated JWT

**DON'T:** Share connection pools without SET search_path
- **WHY:** Query in wrong schema = data leak

### AI

**DON'T:** Let AI generate SQL or database queries in v1
- **WHY:** SQL injection risk, hard to validate, not needed for drafting

**DON'T:** Stream AI responses without validation
- **WHY:** AI can hallucinate incorrect project numbers, dates, amounts

---

## Confidence Assessment

| Category | Confidence | Notes |
|----------|------------|-------|
| **Backend framework** | MEDIUM | Fastify is solid choice but version/latest features unverified |
| **Database** | HIGH | PostgreSQL schema isolation is proven pattern for this use case |
| **Frontend** | MEDIUM | Next.js 14 is current but specific version features unverified |
| **AI integration** | MEDIUM | OpenAI API is stable but Vercel AI SDK v3 details unverified |
| **Auth** | MEDIUM | Clerk excellent for SaaS but pricing/current features unverified |
| **Container stack** | MEDIUM | K8s + Helm + Terraform is standard but version specifics unverified |
| **Integration APIs** | LOW | QuickBooks/Microsoft Graph API versions and features unverified |

---

## Required Verification Before Implementation

### High Priority (Verify First)

1. **Drizzle ORM schema-per-tenant support:** Verify 0.29+ supports dynamic schema switching
2. **Clerk multi-tenant pricing:** Check current pricing for expected user counts
3. **Next.js 14 App Router stability:** Verify server components are production-ready
4. **Vercel AI SDK:** Confirm streaming + OpenAI integration status
5. **QuickBooks Online API:** Verify OAuth flow, webhook support, rate limits

### Medium Priority (Verify During Phase Planning)

1. PostgreSQL 16 schema limits (should handle 10k+ schemas but verify)
2. BullMQ Redis requirements (connection pooling, cluster support)
3. Kubernetes version compatibility with cloud providers
4. Microsoft Graph API calendar write permissions (commercial tenant requirements)

### Low Priority (Verify During Implementation)

1. Specific library versions (update to latest stable at implementation time)
2. Tailwind CSS v4 status (major version in progress as of Jan 2025)
3. Testing library specifics (Vitest/Playwright latest features)

---

## Next Steps for Roadmap

### Phase 1 Should Include

- **Backend:** Fastify + PostgreSQL schema setup + Clerk auth
- **Frontend:** Next.js + shadcn/ui + basic multi-tenant UI
- **Infrastructure:** Local Docker Compose (PostgreSQL + Redis)
- **Proof of concept:** Schema isolation working, user can't see other company data

### Phase 2 Should Add

- **AI:** OpenAI integration for basic RFQ drafting
- **Queue:** BullMQ for background jobs
- **Storage:** S3-compatible document upload

### Phase 3+ Should Add

- **Integrations:** QuickBooks, calendar APIs
- **Production infra:** Kubernetes + Terraform
- **Monitoring:** Full observability stack

### Deep Research Flags

**Phases needing deeper research:**
- QuickBooks integration (OAuth, webhooks, data model mapping)
- Calendar bi-directional sync (conflict resolution, timezone handling)
- Kubernetes security (network policies, pod security, secrets management)

**Phases unlikely to need research:**
- Basic CRUD APIs (standard patterns)
- User auth (Clerk handles it)
- Frontend forms (React Hook Form is straightforward)

---

## Sources

**LIMITATION:** This research was conducted without access to verification tools. All recommendations are based on training data current through January 2025.

**Required verification sources:**
- npm registry for current versions: https://www.npmjs.com
- PostgreSQL documentation: https://www.postgresql.org/docs/
- Next.js documentation: https://nextjs.org/docs
- Drizzle ORM documentation: https://orm.drizzle.team/docs/overview
- Clerk documentation: https://clerk.com/docs
- OpenAI API documentation: https://platform.openai.com/docs
- QuickBooks Online API: https://developer.intuit.com/app/developer/qbo/docs/get-started
- Microsoft Graph API: https://learn.microsoft.com/en-us/graph/

**Recommended validation approach:**
1. Verify all version numbers against official registries
2. Check official documentation for current best practices
3. Review recent GitHub issues for multi-tenant patterns
4. Validate cloud provider managed service offerings
5. Confirm integration API capabilities and pricing

---

**End of Stack Research**
