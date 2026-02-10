# Architecture Patterns: Multi-Tenant Construction SaaS

**Domain:** Construction Management SaaS (Commercial/Industrial)
**Isolation Model:** Schema-per-company (shared database server)
**Researched:** 2026-02-10
**Overall Confidence:** MEDIUM (based on training data for multi-tenant patterns; construction-specific patterns LOW confidence without web verification)

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Web Frontend │  │ Mobile Apps  │  │ 3rd Party API│          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────────┐
│                      API Gateway Layer                            │
│  ┌────────────────────────┴───────────────────────────┐          │
│  │  API Gateway (Kong/Tyk/AWS API Gateway)            │          │
│  │  - Rate limiting                                    │          │
│  │  - Request routing                                  │          │
│  │  - Initial token validation                         │          │
│  └────────────────────────┬───────────────────────────┘          │
└────────────────────────────┼─────────────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────────┐
│                     Shared Services Layer                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │  Auth Service    │  │  Authz Service   │  │  Audit Service │ │
│  │  - MFA           │  │  - PBAC engine   │  │  - Event log   │ │
│  │  - Token issue   │  │  - Permission    │  │  - Compliance  │ │
│  │  - Session mgmt  │  │    resolution    │  │    tracking    │ │
│  └────────┬─────────┘  └─────────┬────────┘  └────────┬───────┘ │
│           │                      │                     │          │
│  ┌────────┴──────────────────────┴─────────────────────┴───────┐ │
│  │              Tenant Context Service                          │ │
│  │  - Company resolution (JWT → schema)                         │ │
│  │  - Schema routing                                            │ │
│  │  - Cross-company access validation                           │ │
│  └────────────────────────────┬─────────────────────────────────┘ │
└────────────────────────────────┼─────────────────────────────────┘
                                 │
┌────────────────────────────────┼─────────────────────────────────┐
│                    Application Services Layer                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Project API │  │  Document    │  │  Scheduling API      │   │
│  │              │  │  Management  │  │                      │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────────────┘   │
│         │                 │                  │                    │
│  ┌──────┴─────────────────┴──────────────────┴───────────────┐   │
│  │  AI Drafting Engine                                        │   │
│  │  - Per-company training context                            │   │
│  │  - Document generation                                     │   │
│  │  - Data boundary enforcement                               │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Integration │  │  Billing     │  │  JV Collaboration    │   │
│  │  Service     │  │  Service     │  │  Service             │   │
│  │  - QuickBooks│  │              │  │  - Cross-company     │   │
│  │  - Calendar  │  │              │  │    scoped access     │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────────────┘   │
└─────────┼──────────────────┼──────────────────┼───────────────────┘
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼───────────────────┐
│                      Data Layer                                   │
│  ┌──────┴──────────────────┴──────────────────┴───────────────┐  │
│  │  Connection Pool Manager                                    │  │
│  │  - Schema routing (company_id → schema_name)                │  │
│  │  - SET search_path = company_schema                         │  │
│  │  - Connection reuse per schema                              │  │
│  └─────────────────────────────┬───────────────────────────────┘  │
│                                │                                   │
│  ┌─────────────────────────────┴───────────────────────────────┐  │
│  │         PostgreSQL Database Server                           │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │  │
│  │  │ shared       │  │ company_001  │  │ company_002  │ ...  │  │
│  │  │ (auth, org)  │  │ (tenant data)│  │ (tenant data)│      │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Cache Layer (Redis/Valkey)                                  │  │
│  │  - Session storage (namespaced by company)                   │  │
│  │  - Permission cache                                          │  │
│  │  - Rate limit counters                                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

## Component Boundaries

### 1. API Gateway Layer

| Component | Responsibility | Communicates With | Data Owned |
|-----------|---------------|-------------------|------------|
| API Gateway | Request routing, rate limiting, initial auth token validation, SSL termination | Auth Service (token validation), Application Services (routing) | Rate limit state, request logs |

**Boundary Enforcement:**
- No business logic
- No tenant context resolution
- Stateless (rate limits in Redis)
- Does NOT make authorization decisions beyond token validity

**Anti-pattern:** Embedding tenant routing logic in gateway. Gateway routes by service, not by tenant.

---

### 2. Shared Services Layer

#### 2.1 Auth Service (Identity)

| Component | Responsibility | Communicates With | Data Owned |
|-----------|---------------|-------------------|------------|
| Auth Service | MFA, token issuance (JWT), session management, identity verification | Audit Service (events), Tenant Context (org/company lookup) | User credentials, MFA secrets, refresh tokens (in `shared` schema) |

**Boundary Enforcement:**
- Manages authentication, NOT authorization
- Issues JWT with claims: `user_id`, `org_id`, `company_ids[]`, `roles[]`
- NO access to tenant schemas
- Token lifespan: Access token 15 min, refresh token 7 days

**Data Flow:**
```
1. User → Login (email/pass + MFA)
2. Auth validates credentials (shared.users)
3. Auth queries orgs/companies user belongs to (shared.user_companies)
4. Auth issues JWT with claims
5. Auth logs event → Audit Service
```

#### 2.2 Authorization Service (PBAC)

| Component | Responsibility | Communicates With | Data Owned |
|-----------|---------------|-------------------|------------|
| Authz Service | Permission resolution, PBAC policy evaluation, role → permission mapping | Cache (Redis), Tenant Context (company validation) | Policies, roles, permissions (in `shared` schema) |

**Boundary Enforcement:**
- Receives: JWT claims + requested resource + action
- Returns: ALLOW/DENY decision + filtered permissions
- Caches permission resolution (invalidated on policy change)
- NO direct database access to tenant schemas

**PBAC Decision Flow:**
```
1. Application service extracts JWT
2. Service calls Authz: CanUserPerform(user_id, company_id, "project:read", project_id)
3. Authz validates user belongs to company (JWT claim check)
4. Authz evaluates policy (role + resource ownership + conditions)
5. Authz returns decision
```

**Anti-pattern:** Application services making authorization decisions. All authz MUST go through this service.

#### 2.3 Audit Service

| Component | Responsibility | Communicates With | Data Owned |
|-----------|---------------|-------------------|------------|
| Audit Service | Immutable event log, compliance tracking, anomaly detection | All services (receives events) | Audit events (append-only, in `shared.audit_log` or separate DB) |

**Boundary Enforcement:**
- Write-only interface for most services
- Events include: `timestamp`, `user_id`, `company_id`, `action`, `resource_type`, `resource_id`, `result`, `ip_address`, `metadata`
- NO cross-schema joins (denormalizes company context in event)

**Event Types:**
- Authentication: login, logout, MFA, token refresh
- Authorization: permission denied
- Data: create, update, delete (critical resources)
- System: schema provisioning, integration events

#### 2.4 Tenant Context Service

| Component | Responsibility | Communicates With | Data Owned |
|-----------|---------------|-------------------|------------|
| Tenant Context Service | Company resolution (JWT → schema), schema routing, cross-company access validation (JVs) | All application services, Connection Pool Manager | Org/company mappings, JV relationships (in `shared` schema) |

**Boundary Enforcement:**
- Middleware for all application services
- Extracts `company_id` from JWT or request context
- Maps `company_id` → `schema_name` (e.g., `company_123` → `company_123`)
- Validates user has access to requested company (via JWT claims)
- Sets database connection search_path

**Multi-Company Access (JV):**
```
1. User JWT has company_ids: [101, 102]
2. Request specifies company_id=102
3. Tenant Context validates 102 in JWT claims
4. Tenant Context sets search_path = company_102
5. Application service proceeds with company_102 context
```

**Anti-pattern:** Application services directly reading company_id from request. MUST go through Tenant Context validation.

---

### 3. Application Services Layer

#### 3.1 Project API

| Component | Responsibility | Communicates With | Data Owned |
|-----------|---------------|-------------------|------------|
| Project API | Project CRUD, cost tracking, phase management, RFI/submittal workflows | Authz (permissions), Tenant Context (schema routing), Document API, Audit | Projects, phases, costs, RFIs, submittals (in company schema) |

**Boundary Enforcement:**
- Every request validated through Authz Service
- All DB queries scoped to single schema (via search_path)
- NO cross-schema joins
- Uses Tenant Context middleware to set schema

**Typical Request Flow:**
```
1. Client → GET /api/projects/456 (JWT in header, company_id=101 in JWT)
2. API Gateway → Project API
3. Project API extracts JWT
4. Project API → Tenant Context validates company_id
5. Tenant Context sets DB connection search_path = company_101
6. Project API → Authz Service: CanUserPerform(user_id, 101, "project:read", 456)
7. Authz → ALLOW
8. Project API queries DB (search_path ensures company_101.projects)
9. Project API → Audit Service logs access
10. Project API → Client (response)
```

#### 3.2 Document Management API

| Component | Responsibility | Communicates With | Data Owned |
|-----------|---------------|-------------------|------------|
| Document Management | File upload/download, versioning, OCR, metadata, access control | Authz, Tenant Context, Object Storage (S3), AI Drafting Engine | Document metadata (in company schema), files (S3 with company_id prefix) |

**Boundary Enforcement:**
- S3 bucket structure: `s3://bucket/{company_id}/{project_id}/{file_id}`
- Signed URLs with 15-minute expiry
- Document metadata in tenant schema
- File storage isolated by company_id prefix

**Anti-pattern:** Shared S3 paths without company_id prefix. Risk of cross-company access via URL manipulation.

#### 3.3 AI Drafting Engine

| Component | Responsibility | Communicates With | Data Owned |
|-----------|---------------|-------------------|------------|
| AI Drafting Engine | Document generation, template application, context-aware suggestions | Project API (context), Document API (templates), Tenant Context | AI model state per company, training data pointers (in company schema) |

**Boundary Enforcement (CRITICAL):**
- **Per-company context isolation:** AI retrieval-augmented generation (RAG) MUST only access documents from active company schema
- **No cross-company training:** Each company's data contributes ONLY to their context, not global model
- **Embedding namespace:** Vector embeddings stored with `company_id` prefix
- **Context verification:** Every AI request validates `company_id` in JWT matches `company_id` in retrieved documents

**Data Flow:**
```
1. User requests AI draft (company_id=101)
2. AI Engine → Tenant Context validates company
3. AI Engine retrieves embeddings filtered by company_id=101
4. AI Engine generates draft using ONLY company 101 context
5. AI Engine → Document API saves draft (in company_101 schema)
```

**Anti-pattern:** Global vector store without company_id partitioning. Risk of cross-company data leakage.

#### 3.4 Integration Service

| Component | Responsibility | Communicates With | Data Owned |
|-----------|---------------|-------------------|------------|
| Integration Service | Bi-directional sync with QuickBooks, calendar systems; webhook management | Authz, Tenant Context, external APIs | OAuth tokens, sync state, mapping config (in company schema) |

**Boundary Enforcement:**
- OAuth tokens stored per company (encrypted in tenant schema)
- Webhook signatures validated before processing
- Sync jobs scoped to single company
- Rate limits per company (prevents noisy neighbor)

**QuickBooks Sync Pattern:**
```
1. Cron triggers sync job for company_id=101
2. Integration Service → Tenant Context sets company_101 schema
3. Integration Service retrieves OAuth token (company_101.integration_config)
4. Integration Service → QuickBooks API (fetch invoices)
5. Integration Service transforms data
6. Integration Service → Project API (update costs in company_101 schema)
7. Integration Service logs → Audit Service
```

**Anti-pattern:** Storing OAuth tokens in shared schema. Risk of cross-company token access.

#### 3.5 JV Collaboration Service

| Component | Responsibility | Communicates With | Data Owned |
|-----------|---------------|-------------------|------------|
| JV Collaboration | Cross-company project sharing, scoped data access, permission delegation | Authz, Tenant Context (multi-company validation), Project API | JV relationships, shared project mappings (in `shared.jv_relationships`) |

**Boundary Enforcement (CRITICAL):**
- JV relationship stored in shared schema: `company_a`, `company_b`, `shared_projects[]`
- Scoped access rules: Company A can read Company B's project X (specific project, not all data)
- NO direct cross-schema queries
- Service layer mediates: reads from both schemas, merges results

**JV Access Flow:**
```
1. User from Company A requests Project X (owned by Company B)
2. JV Service checks shared.jv_relationships: A has access to B's Project X
3. JV Service → Tenant Context sets company_b schema
4. JV Service → Authz validates Company A's permission level for Project X (read-only)
5. JV Service queries company_b.projects WHERE id=X
6. JV Service returns filtered data to Company A user
7. JV Service → Audit logs cross-company access
```

**Anti-pattern:** Direct cross-schema joins (e.g., `company_a.projects JOIN company_b.projects`). Violates isolation model.

---

### 4. Data Layer

#### 4.1 Connection Pool Manager

| Component | Responsibility | Communicates With | Data Owned |
|-----------|---------------|-------------------|------------|
| Connection Pool Manager | Schema routing, connection reuse, search_path management | PostgreSQL, Tenant Context | Connection pools (in-memory state) |

**Implementation Pattern:**
```sql
-- On connection checkout (triggered by Tenant Context)
SET search_path = company_123, public;

-- All subsequent queries use company_123 schema
SELECT * FROM projects; -- Resolves to company_123.projects
```

**Pool Strategy:**
- Separate pool per schema? NO (too many pools for 100+ companies)
- Shared pool with SET search_path? YES (PostgreSQL supports fast search_path switching)
- Pool size: 10-50 connections per app service instance
- Connection reset: `DISCARD ALL` between tenant switches (paranoid mode)

**Anti-pattern:** Embedding schema name in queries (e.g., `SELECT * FROM company_123.projects`). Hard to audit, risky if interpolated.

#### 4.2 Database Schema Structure

**Shared Schema (`shared`):**
```
- users (id, email, password_hash, mfa_secret)
- organizations (id, name)
- companies (id, org_id, name, schema_name)
- user_companies (user_id, company_id, roles[])
- jv_relationships (company_a_id, company_b_id, shared_project_ids[])
- audit_log (append-only)
- policies (authz rules)
```

**Per-Company Schema (`company_{id}`):**
```
- projects
- phases
- costs
- documents (metadata)
- tasks
- schedules
- rfis
- submittals
- integration_config (OAuth tokens)
- ai_context (embeddings, training metadata)
```

**Schema Provisioning:**
1. New company signup → Billing Service triggers
2. Billing Service → Schema Provisioner (separate service)
3. Schema Provisioner creates new schema: `CREATE SCHEMA company_456`
4. Schema Provisioner applies migration: `pg_dump base_schema | psql -f - company_456`
5. Schema Provisioner updates `shared.companies` with schema_name
6. Schema Provisioner → Audit logs provisioning event

**Anti-pattern:** Lazy schema creation on first request. Provision during signup (predictable, auditable).

#### 4.3 Cache Layer (Redis/Valkey)

**Namespacing:**
```
- sessions:{company_id}:{user_id}
- permissions:{user_id}:{company_id}
- rate_limit:{company_id}:{endpoint}
```

**Invalidation:**
- Permission cache: TTL 5 minutes OR policy change event
- Session cache: Sliding expiration (15 min access token lifetime)

---

## Data Flow Patterns

### 1. Authenticated Request Flow

```
┌────────┐
│ Client │
└───┬────┘
    │ 1. Request (JWT in header)
    ▼
┌──────────────┐
│ API Gateway  │ 2. Validate JWT signature (public key)
└───┬──────────┘
    │ 3. Route to service
    ▼
┌──────────────────┐
│ Application API  │ 4. Extract JWT claims
└───┬──────────────┘
    │ 5. company_id → Tenant Context
    ▼
┌──────────────────┐
│ Tenant Context   │ 6. Validate user in company, set search_path
└───┬──────────────┘
    │ 7. Check permission
    ▼
┌──────────────────┐
│ Authz Service    │ 8. Evaluate PBAC policy → ALLOW/DENY
└───┬──────────────┘
    │ 9. If ALLOW, query data
    ▼
┌──────────────────┐
│ Database (schema)│ 10. Return company-scoped data
└───┬──────────────┘
    │ 11. Log event
    ▼
┌──────────────────┐
│ Audit Service    │ 12. Append event
└───┬──────────────┘
    │ 13. Return response
    ▼
┌────────┐
│ Client │
└────────┘
```

### 2. AI Document Generation Flow

```
┌────────┐
│ User   │ 1. Request AI draft for Project 456 (company_id=101)
└───┬────┘
    ▼
┌──────────────────┐
│ Project API      │ 2. Validate authz, fetch project context
└───┬──────────────┘
    │ 3. Call AI Engine with company context
    ▼
┌──────────────────┐
│ AI Engine        │ 4. Retrieve embeddings (filtered by company_id=101)
└───┬──────────────┘
    │ 5. Query vector store: WHERE company_id=101
    ▼
┌──────────────────┐
│ Vector DB        │ 6. Return embeddings (company 101 only)
└───┬──────────────┘
    │ 7. Generate draft with LLM (using company context)
    ▼
┌──────────────────┐
│ AI Engine        │ 8. Return generated document
└───┬──────────────┘
    │ 9. Save to Document API
    ▼
┌──────────────────┐
│ Document API     │ 10. Store metadata (company_101 schema), file (S3)
└───┬──────────────┘
    │ 11. Return document to user
    ▼
┌────────┐
│ User   │
└────────┘
```

### 3. Cross-Company JV Access Flow

```
┌────────────┐
│ User (Co A)│ 1. Request Project X (owned by Company B)
└───┬────────┘
    ▼
┌──────────────────┐
│ JV Service       │ 2. Check shared.jv_relationships
└───┬──────────────┘
    │ 3. Validate Company A has scoped access to Project X
    ▼
┌──────────────────┐
│ Authz Service    │ 4. Check permission level (read-only?)
└───┬──────────────┘
    │ 5. Set search_path = company_b
    ▼
┌──────────────────┐
│ Connection Pool  │ 6. Query company_b.projects WHERE id=X
└───┬──────────────┘
    │ 7. Return data (filtered: no sensitive fields)
    ▼
┌──────────────────┐
│ JV Service       │ 8. Merge with Company A context (if needed)
└───┬──────────────┘
    │ 9. Log cross-company access
    ▼
┌──────────────────┐
│ Audit Service    │ 10. Append: Co A accessed Co B's Project X
└───┬──────────────┘
    │ 11. Return to user
    ▼
┌────────────┐
│ User (Co A)│
└────────────┘
```

---

## Technology Stack Recommendations

| Layer | Technology | Why |
|-------|-----------|-----|
| API Gateway | Kong or Tyk | Open-source, plugin ecosystem, high performance |
| Application Services | Node.js (NestJS) or Go | Node: fast dev, strong ecosystem; Go: performance, low memory |
| Database | PostgreSQL 15+ | Native schema support, row-level security (defense-in-depth), JSON support |
| Cache | Redis or Valkey | Redis: mature; Valkey: OSS fork, no license concerns |
| Object Storage | S3-compatible (AWS S3, MinIO) | Industry standard, cloud-agnostic with MinIO |
| Vector DB | Pinecone or Weaviate | Pinecone: managed; Weaviate: self-hosted, namespacing support |
| Message Queue | RabbitMQ or AWS SQS | RabbitMQ: self-hosted; SQS: managed, integrates with AWS |
| Container Orchestration | Kubernetes | Cloud-agnostic, standard deployment model |

---

## Suggested Build Order

### Phase 1: Foundation (0 → Auth + Tenant Routing)
**Goal:** Establish shared services and tenant isolation before any business logic.

**Components:**
1. Database setup (shared schema, migration framework)
2. Auth Service (JWT issuance, MFA)
3. Tenant Context Service (company resolution, schema routing)
4. Connection Pool Manager (search_path switching)
5. Audit Service (basic event logging)

**Why first:** All application services depend on auth and tenant context. No point building Project API if it can't route to correct schema.

**Validation:** Can a user log in, receive JWT, and a test service can resolve company → schema.

---

### Phase 2: Authorization + API Gateway (Auth → Authz)
**Goal:** Lock down access control before exposing any data.

**Components:**
1. Authz Service (PBAC engine)
2. API Gateway (Kong/Tyk setup)
3. Basic permission policies (admin, user roles)

**Why second:** Application services need authz before exposing data. Gateway provides single entry point for rate limiting.

**Validation:** Can a user with role "project_viewer" read but not write projects?

---

### Phase 3: Core Business APIs (Authz → Application)
**Goal:** Build primary business logic with tenant isolation baked in.

**Components:**
1. Project API (CRUD, cost tracking)
2. Document Management API (file upload, metadata)
3. Scheduling API (basic timeline)

**Why third:** Now that auth, authz, and tenant context are stable, business logic can be built safely.

**Validation:** User can create project, upload document, view schedule (all scoped to their company).

---

### Phase 4: AI Integration (Application → AI)
**Goal:** Add AI features with strict data boundaries.

**Components:**
1. AI Drafting Engine (with per-company context isolation)
2. Vector DB setup (namespaced by company_id)
3. Document generation workflows

**Why fourth:** AI requires stable document and project APIs for context. Tenant isolation must be proven before AI accesses data.

**Validation:** AI generates document using only Company A's data, cannot access Company B's data.

---

### Phase 5: Cross-Company Features (AI → JV)
**Goal:** Enable controlled cross-company collaboration.

**Components:**
1. JV Collaboration Service
2. Scoped access rules
3. Cross-company audit trails

**Why fifth:** JV requires mature authz and audit. Most complex data access pattern, so build last.

**Validation:** Company A can view specific projects from Company B (scoped), cannot access other Company B data.

---

### Phase 6: External Integrations (Application + JV → External)
**Goal:** Bi-directional sync with external systems.

**Components:**
1. Integration Service (QuickBooks, calendar)
2. Webhook handlers
3. OAuth token management

**Why sixth:** Integrations depend on stable Project and Document APIs. Can be parallelized with Phase 5 if needed.

**Validation:** Project cost syncs to QuickBooks, calendar events sync to scheduling.

---

## Build Order Dependencies

```
Phase 1 (Foundation)
  ├─ Auth Service
  ├─ Tenant Context Service
  ├─ Connection Pool Manager
  └─ Audit Service
      │
      ▼
Phase 2 (Authorization)
  ├─ Authz Service (depends on Auth, Tenant Context)
  └─ API Gateway (depends on Auth)
      │
      ▼
Phase 3 (Core Business APIs)
  ├─ Project API (depends on Authz, Tenant Context)
  ├─ Document API (depends on Authz, Tenant Context)
  └─ Scheduling API (depends on Authz, Tenant Context)
      │
      ├─────────────────┐
      ▼                 ▼
Phase 4 (AI)      Phase 6 (Integrations)
  AI Engine         Integration Service
  (depends on       (depends on Project API)
   Document API)
      │
      ▼
Phase 5 (JV Collaboration)
  JV Service (depends on Authz, Project API, AI Engine)
```

---

## Scalability Considerations

| Concern | At 100 companies | At 1K companies | At 10K companies |
|---------|------------------|-----------------|------------------|
| **Schema count** | Manageable (100 schemas in single PG instance) | Monitor connection pool exhaustion | Consider PG cluster (Citus) or connection pooler (PgBouncer) |
| **Database size** | Single PG instance (RDS, managed) | Vertical scaling (larger instance) | Horizontal scaling: Citus for sharding, or migrate large tenants to dedicated instances |
| **Connection pooling** | Shared pool with search_path switching | Shared pool with connection reset between tenants | PgBouncer for external pooling, reduce per-service pool size |
| **AI vector storage** | Single Pinecone index with company_id metadata filter | Partition index by company_id ranges | Separate indexes per large tenant, shared index for small tenants |
| **Cache hit rate** | Redis single instance | Redis cluster (read replicas) | Redis cluster with sharding by company_id hash |
| **Audit log growth** | Append-only table, partitioned by month | Archive old partitions to S3 | Stream to data warehouse (Snowflake, BigQuery), retain 90 days hot |

**Critical Threshold:** 1K+ companies → introduce PgBouncer and consider Citus for sharding.

---

## Patterns to Follow

### Pattern 1: Tenant Context Middleware
**What:** Every application service uses middleware to validate company_id and set DB search_path.

**When:** On every request, before any business logic.

**Example (Node.js/NestJS):**
```typescript
// tenant-context.middleware.ts
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    private tenantService: TenantContextService,
    private dataSource: DataSource,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const jwt = extractJWT(req.headers.authorization);
    const companyId = req.headers['x-company-id'] || jwt.claims.company_ids[0];

    // Validate user has access to company
    if (!jwt.claims.company_ids.includes(companyId)) {
      throw new ForbiddenException('User does not belong to this company');
    }

    // Resolve company → schema
    const schemaName = await this.tenantService.resolveSchema(companyId);

    // Set search_path for this request's DB connection
    await this.dataSource.query(`SET search_path = ${schemaName}, public`);

    // Attach to request for downstream use
    req.tenantContext = { companyId, schemaName };

    next();
  }
}
```

### Pattern 2: Authorization-First Service Methods
**What:** Every service method checks authorization before querying data.

**When:** At the start of every CRUD operation.

**Example:**
```typescript
// project.service.ts
async getProject(userId: string, companyId: string, projectId: string) {
  // 1. Check authorization FIRST
  const allowed = await this.authzService.canUserPerform(
    userId,
    companyId,
    'project:read',
    projectId,
  );
  if (!allowed) {
    throw new ForbiddenException();
  }

  // 2. Query data (search_path already set by middleware)
  const project = await this.projectRepo.findOne({ where: { id: projectId } });

  // 3. Log access
  await this.auditService.log({
    userId,
    companyId,
    action: 'project:read',
    resourceId: projectId,
    result: 'success',
  });

  return project;
}
```

### Pattern 3: AI Context Filtering
**What:** AI retrieval MUST filter embeddings by company_id before sending to LLM.

**When:** Every AI generation request.

**Example:**
```typescript
// ai-drafting.service.ts
async generateDraft(userId: string, companyId: string, projectId: string) {
  // 1. Fetch project context (already scoped to company via search_path)
  const project = await this.projectService.getProject(userId, companyId, projectId);

  // 2. Retrieve embeddings (filtered by company_id)
  const embeddings = await this.vectorDB.query({
    filter: { company_id: companyId }, // CRITICAL: prevents cross-company leakage
    topK: 10,
    query: project.description,
  });

  // 3. Generate draft
  const draft = await this.llm.generate({
    context: embeddings,
    prompt: `Generate RFI for project: ${project.name}`,
  });

  // 4. Save draft (in company schema)
  return this.documentService.createDraft(userId, companyId, draft);
}
```

### Pattern 4: JV Scoped Access
**What:** Cross-company access via explicit JV relationship, not direct schema access.

**When:** User from Company A requests data owned by Company B.

**Example:**
```typescript
// jv.service.ts
async getSharedProject(userId: string, requestingCompanyId: string, projectId: string) {
  // 1. Determine which company owns the project
  const owningCompanyId = await this.getProjectOwner(projectId);

  // 2. If requesting own company, route normally
  if (requestingCompanyId === owningCompanyId) {
    return this.projectService.getProject(userId, requestingCompanyId, projectId);
  }

  // 3. Check JV relationship (stored in shared schema)
  const jvAllowed = await this.dataSource.query(
    `SELECT 1 FROM shared.jv_relationships
     WHERE (company_a_id = $1 AND company_b_id = $2 AND $3 = ANY(shared_project_ids))
        OR (company_a_id = $2 AND company_b_id = $1 AND $3 = ANY(shared_project_ids))`,
    [requestingCompanyId, owningCompanyId, projectId]
  );

  if (!jvAllowed) {
    throw new ForbiddenException('No JV relationship for this project');
  }

  // 4. Fetch from owning company's schema (switch context)
  const owningSchema = await this.tenantService.resolveSchema(owningCompanyId);
  await this.dataSource.query(`SET search_path = ${owningSchema}, public`);

  const project = await this.projectRepo.findOne({ where: { id: projectId } });

  // 5. Filter sensitive fields (e.g., internal notes)
  const filtered = this.filterSensitiveFields(project);

  // 6. Audit cross-company access
  await this.auditService.log({
    userId,
    companyId: requestingCompanyId,
    action: 'jv:project:read',
    resourceId: projectId,
    metadata: { owning_company_id: owningCompanyId },
  });

  return filtered;
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Cross-Schema Joins
**What:** Writing SQL that joins tables across schemas.

**Example (BAD):**
```sql
SELECT p.* FROM company_a.projects p
JOIN company_b.projects pb ON p.jv_partner_project_id = pb.id;
```

**Why bad:**
- Breaks isolation model
- Can't enforce PBAC at query level
- Hard to audit (which company's data was accessed?)
- Difficult to scale (can't shard schemas independently)

**Instead:** Use service layer to mediate. Fetch from Company A schema, then fetch from Company B schema, merge in application code.

---

### Anti-Pattern 2: Shared OAuth Tokens
**What:** Storing integration OAuth tokens (QuickBooks, calendar) in shared schema instead of per-company schema.

**Why bad:**
- Cross-company access risk: bug in integration service could leak tokens
- Harder to revoke per-company
- Violates tenant isolation principle

**Instead:** Store OAuth tokens in each company's schema. Encrypt at rest.

---

### Anti-Pattern 3: Global AI Context
**What:** Training AI model on all companies' data without partitioning.

**Why bad:**
- Data leakage: Company A's sensitive documents could influence Company B's drafts
- Compliance violation: Some industries prohibit cross-company data mixing (ITAR, HIPAA)

**Instead:** Use per-company context isolation (namespaced vector embeddings, filtered retrieval).

---

### Anti-Pattern 4: Lazy Schema Provisioning
**What:** Creating tenant schema on first user request instead of during signup.

**Why bad:**
- User experiences slow first request (schema creation takes 5-10 seconds)
- Hard to audit when schema was created
- Difficult to pre-populate with default data

**Instead:** Provision schema synchronously during company signup (or async with status polling).

---

### Anti-Pattern 5: Embedding company_id in SQL
**What:** Writing queries like `SELECT * FROM company_123.projects`.

**Example (BAD):**
```typescript
const query = `SELECT * FROM company_${companyId}.projects WHERE id = $1`;
```

**Why bad:**
- SQL injection risk if companyId not validated
- Harder to audit (schema name embedded in query strings)
- Doesn't work with ORM abstractions

**Instead:** Use `SET search_path` and reference tables without schema prefix.

---

## Security Considerations

### 1. Defense-in-Depth

**Layer 1:** API Gateway (rate limiting, IP allowlist)
**Layer 2:** Auth Service (JWT signature validation, MFA)
**Layer 3:** Authz Service (PBAC evaluation)
**Layer 4:** Tenant Context (company access validation)
**Layer 5:** Database (search_path isolation, optional row-level security)
**Layer 6:** Audit (immutable log of all access)

**Philosophy:** If one layer fails, others prevent breach. E.g., if authz bug allows wrong permission, audit trail enables detection.

### 2. Principle of Least Privilege

- Application services use DB user with NO cross-schema permissions
- DB user cannot `SET search_path` to arbitrary schema (validated list)
- OAuth tokens readable only by Integration Service
- AI Engine cannot access raw DB, only via Project/Document APIs

### 3. Token Lifespan

| Token Type | Lifespan | Renewal |
|------------|----------|---------|
| Access token (JWT) | 15 minutes | Via refresh token |
| Refresh token | 7 days | Re-authenticate after expiry |
| MFA session | 30 days | Re-verify after expiry |
| OAuth (external) | 60 minutes (QuickBooks) | Auto-refresh via Integration Service |

### 4. Audit Log Immutability

- Audit table: append-only (no UPDATE or DELETE)
- Database-level trigger prevents modification
- Partitioned by month, old partitions archived to S3 (write-once, glacier storage)
- Integrity hash: each event includes hash of previous event (tamper detection)

---

## Monitoring and Observability

### Key Metrics

| Metric | Threshold | Alert |
|--------|-----------|-------|
| **Cross-schema query attempts** | > 0 | CRITICAL (indicates isolation breach attempt) |
| **Authz denials** | > 100/min for single user | WARNING (possible attack) |
| **Failed login attempts** | > 5 for single user in 5 min | WARNING (credential stuffing) |
| **AI context filter miss** | > 0 | CRITICAL (data leakage risk) |
| **Schema connection pool exhaustion** | > 90% utilization | WARNING (scale up) |
| **Audit log write failures** | > 0 | CRITICAL (compliance risk) |

### Distributed Tracing

- Trace ID propagated through all services (OpenTelemetry)
- Trace includes: `user_id`, `company_id`, `schema_name`, `permissions_checked`
- Enables debugging: "Why did user X's request fail?" → follow trace through authz, tenant context, DB

---

## Migration and Rollback Strategy

### Schema Version Management

```
shared.schema_versions
  - company_id
  - current_version (e.g., "2.5.0")
  - migration_status (pending, in_progress, complete, failed)
```

### Migration Workflow

1. New schema version released (e.g., 2.6.0: add "submittals" table)
2. Migration service iterates companies
3. For each company:
   - Lock schema (prevent writes)
   - Apply migration: `psql -d db -c "SET search_path = company_123; CREATE TABLE submittals (...);"`
   - Update `schema_versions.current_version`
   - Unlock schema
4. If migration fails: rollback via pre-migration snapshot (pg_dump before migration)

**Zero-downtime:** Migrations must be backward-compatible (e.g., add column with DEFAULT, don't drop columns). Old code works during rollout.

---

## Open Questions and Research Gaps

| Area | Confidence | Gap |
|------|------------|-----|
| **Construction-specific workflows** | LOW | Need to verify typical construction SaaS data models (RFIs, submittals, change orders) via web research or competitor analysis |
| **AI model hosting** | MEDIUM | Assumed self-hosted LLM (e.g., Llama) or API (OpenAI). Verify cost/latency tradeoffs at scale |
| **QuickBooks API limits** | LOW | Need to verify QuickBooks Online API rate limits, webhook reliability (impacts sync design) |
| **Citus sharding threshold** | MEDIUM | "1K companies" is estimate. Needs load testing to confirm when to introduce sharding |
| **JV collaboration UX** | LOW | Unclear what "scoped access" means to users. Needs product/UX research to define data visibility rules |

**Recommendation:** Phase-specific research during:
- **Phase 3:** Deep dive on construction workflows (RFI, submittal schemas)
- **Phase 4:** AI model selection (cost, latency, data residency)
- **Phase 6:** QuickBooks API research (rate limits, OAuth refresh flows)

---

## Sources

**Confidence Level:** MEDIUM overall

- **Multi-tenant patterns:** Training data on schema-per-tenant isolation, connection pooling (HIGH confidence for general patterns)
- **PostgreSQL search_path:** Training data on PostgreSQL documentation (HIGH confidence)
- **PBAC, Zero Trust:** Training data on authorization patterns (MEDIUM confidence, no 2026 updates verified)
- **Construction SaaS specifics:** Training data on general SaaS patterns, not construction-specific (LOW confidence)
- **AI context isolation:** Training data on RAG patterns (MEDIUM confidence, no 2026 research verified)

**Limitations:**
- Web search unavailable: Could not verify 2026 best practices or construction SaaS architecture examples
- Context7 unavailable: Could not verify library-specific patterns (NestJS multi-tenancy, Kong plugins)
- Recommendations based on general multi-tenant SaaS patterns (proven), not construction-specific validation

**Next Steps for Roadmap:**
- Use this architecture as foundation
- Flag Phase 3 (construction workflows) and Phase 4 (AI) for deeper research when those phases begin
- Validate JV collaboration patterns with product/UX team before Phase 5
