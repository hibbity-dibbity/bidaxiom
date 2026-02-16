# Architecture Documentation

This document provides an overview of the Construction Management SaaS architecture, patterns, and design decisions.

## System Overview

**Monorepo structure:**
- `apps/api` - Fastify + tRPC + Drizzle ORM (port 3001)
- `apps/web` - Next.js 14 + React Query + tRPC client (port 3000)
- `packages/shared` - Shared types, schemas, utilities

**Key technologies:**
- Authentication: Custom JWT-based auth (migrated from Clerk)
- Database: PostgreSQL with schema-per-tenant isolation
- API: tRPC for type-safe client-server communication
- ORM: Drizzle for SQL query building
- State: React Query for server state, Zustand for client state
- UI: Tailwind CSS + shadcn/ui components

## Component Architecture

Component organization follows extraction threshold pattern documented in `apps/web/COMPONENT-ORGANIZATION.md`.

**Key patterns:**
- 3+ use threshold for extraction to shared/
- CVA variants for design system consistency
- Direct imports only (no barrel exports)
- Domain components stay in feature folders until proven reusable

**Directory structure:**
```
apps/web/components/
├── ui/                    # shadcn/ui base components
├── shared/                # Extracted reusable components (3+ uses)
│   ├── status-badge.tsx   # CVA-based status indicators
│   ├── currency-display.tsx  # Consistent currency formatting
│   └── ...
├── [domain]/              # Domain-specific components
│   ├── project/
│   ├── budget/
│   ├── estimates/
│   └── ...
└── layout/                # App-wide layout components
```

**See:** `apps/web/COMPONENT-ORGANIZATION.md` for extraction decision tree and real-world examples.

## Routing Architecture

All user-facing entity URLs use slug-based routing for bookmarkability and SEO:
- Projects: `/projects/[jobNumber]-[name]` (e.g., `/projects/24001-main-street-renovation`)
- Customers: `/customers/cust-[id]-[name]` (e.g., `/customers/cust-12345678-abc-construction`)
- Estimates: `/estimates/est-[jobNumber]-[name]` (e.g., `/estimates/est-24001-option-1`)
- Subcontractors: `/subcontractors/sub-[id]-[name]` (e.g., `/subcontractors/sub-87654321-acme-hvac`)

**Persistent headers pattern:**
- Layout.tsx queries entity via `getBySlug` once
- Header and tabs stay mounted during navigation
- Only page content re-renders on tab changes

**Prefetching strategy:**
- Hover prefetch for instant perceived navigation
- `onMouseEnter` triggers tRPC prefetch 200-500ms before click
- Avoids viewport prefetch waste for data-heavy apps

**See:** `apps/web/ROUTING-CONVENTIONS.md` for slug generation, scroll restoration, and migration patterns.

## Validation Architecture

All Zod schemas centralized in `packages/shared/src/` for client-server sharing:
- `schemas/` - Reusable primitives (phoneSchema, addressSchema)
- `types/` - Entity CRUD schemas (createProjectSchema, updateProjectSchema)

**Pattern:**
- Create schema: All required fields
- Update schema: `.partial()` of create schema
- Filter schema: Optional fields for list queries

Client and server import same schema to prevent validation drift.

**See:** `packages/shared/SCHEMA-CONVENTIONS.md` for schema patterns, multi-step validation, and anti-patterns.

## Database Architecture

**Multi-tenant isolation:**
- Schema-per-tenant pattern (e.g., `tenant_vpa_g9edvkmrj3ao2oebusov`)
- Public schema contains `organizations`, `users`, `organization_memberships`
- Tenant schemas contain all domain data (projects, customers, budgets, etc.)

**Schema management:**
- Drizzle schema definitions in `apps/api/src/db/schema/`
- Migrations in `apps/api/src/db/migrations/`
- Provisioning script creates tenant schema from template
- Retroactive migrations iterate over all tenant schemas

**Connection pooling:**
- Lazy pool initialization (ESM hoisting issue)
- Pool created after dotenv loads environment variables
- Per-request schema switching via `SET search_path`

## Authentication & Authorization

**Authentication (Phase 12):**
- Custom JWT-based system (migrated from Clerk)
- Argon2id for password hashing (OWASP recommended)
- jose library for JWT signing/verification
- Iron-session for encrypted stateless cookies
- 15-minute access tokens, 7-day refresh tokens

**Authorization:**
- CASL for role-based access control (RBAC)
- Abilities loaded per-request based on user role and org membership
- Project-level permissions use team membership context
- Document-level permissions support explicit grants

**Security patterns:**
- Rate limiting with Redis (fail-open when unavailable)
- MFA support with TOTP (otpauth library)
- Email verification and password reset flows
- Session management with proactive token refresh

## API Architecture

**tRPC routers:**
- Type-safe end-to-end from client to database
- Procedures use protectedProcedure for auth checks
- authorizedProcedure loads CASL abilities for permission checks
- Input validation via Zod schemas from shared package

**Middleware:**
- Context building: Extract JWT, resolve tenant, load abilities
- Error handling: Custom error codes, user-friendly messages
- Audit logging: Automatic tracking of mutations

**Background jobs:**
- BullMQ for async task processing
- QBO sync worker (Phase 8)
- Calendar sync worker (Phase 11)
- Report generation worker (Phase 10)
- Non-fatal worker startup (API runs without Redis)

## Frontend Architecture

**Next.js App Router:**
- Server Components for initial data loading
- Client Components for interactivity
- Route groups for layout organization: `(dashboard)`, `(auth)`
- Parallel routes for modals and overlays

**State management:**
- React Query for server state (tRPC integration)
- Zustand for complex client state (estimate workflow)
- URL state with nuqs for shareable filters
- localStorage persistence for user preferences

**Form handling:**
- React Hook Form with Zod resolver
- Shared schemas from packages/shared
- Multi-step forms use `.pick()` for subset validation
- Auto-save with debouncing (500ms) for workflows

**Styling:**
- Tailwind CSS utility classes
- CVA for component variants
- Dark mode with next-themes (cookie-based)
- Responsive design with mobile-first approach

## Integration Architecture

**QuickBooks Online (Phase 8):**
- OAuth 2.0 integration with encrypted refresh tokens
- BullMQ workers for bidirectional sync
- Entity mappings (projects, customers, invoices)
- CDC for incremental sync with change detection
- Conflict resolution via user review UI

**Calendar Sync (Phase 11):**
- Google Calendar and Microsoft Graph API support
- Per-user OAuth connections (not per-company)
- Webhook subscriptions for real-time updates
- Delta queries for incremental sync
- Automatic webhook renewal before expiry

## Document Management Architecture

**Storage:**
- MinIO for local S3-compatible storage (dev)
- S3-compatible providers for production
- Tenant-prefixed keys: `tenants/{tenantId}/projects/{projectId}/{uuid}/{fileName}`
- Pre-signed URLs for secure uploads/downloads

**Metadata:**
- documents table stores metadata (name, size, category, tags)
- document_versions table tracks version history
- Soft delete: DB records removed, S3 objects remain
- Access logs in separate table for high-volume events

**Permissions:**
- Project-level permissions via CASL
- Document-level explicit grants (optional)
- Folder-level cascading permissions
- Time-limited shares with expiration

## Workflow Architecture

**Approval workflows:**
- Multi-step approval chains
- Three requirement types: specific_user, any_with_role, all_with_role
- Sequential step processing with approval tracking
- History tracking for audit trail

**Document workflows:**
- RFIs (Requests for Information)
- Submittals (material/equipment approvals)
- Change order approvals (Phase 5)
- Reusable workflow patterns across domains

## Reporting Architecture

**Report generation:**
- Dynamic query builder with Drizzle operators
- Materialized views with 1-hour TTL for performance
- Puppeteer for PDF generation
- ExcelJS for Excel exports
- Temporary storage with 24-hour expiry

**Scheduled reports:**
- Cron-style scheduling with BullMQ
- Email delivery via Resend (nodemailer)
- Retry with exponential backoff
- Report templates (system-wide in public schema)

## Performance Patterns

**Database optimization:**
- Partial indexes on active records
- JSONB operators for flexible queries
- Aggregation at database level (SQL SUM/COUNT)
- Materialized data for expensive calculations

**Frontend optimization:**
- React Query staleTime: 5 minutes
- Placeholder data for stale-while-revalidate
- Hover-based prefetching for instant navigation
- Progressive loading with inline skeletons

**Bundle optimization:**
- Direct imports (no barrel exports)
- Tree-shaking friendly module structure
- Code splitting via dynamic imports
- Lazy loading for heavy dependencies

## References

- Component patterns: `apps/web/COMPONENT-ORGANIZATION.md`
- Routing patterns: `apps/web/ROUTING-CONVENTIONS.md`
- Schema patterns: `packages/shared/SCHEMA-CONVENTIONS.md`
- Conventions: `.planning/codebase/CONVENTIONS.md`
- Project overview: `.planning/PROJECT.md`
- Roadmap: `.planning/ROADMAP.md`
