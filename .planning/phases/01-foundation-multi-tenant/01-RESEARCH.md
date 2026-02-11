# Phase 1: Foundation & Multi-Tenant Infrastructure - Research

**Researched:** 2026-02-10
**Domain:** Multi-tenant SaaS infrastructure with authentication, authorization, and schema-isolated data
**Confidence:** MEDIUM-HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Auth & Onboarding Flow
- Signup creates an account AND a company (user becomes company admin)
- Users do NOT self-join companies — they are invited by the company admin
- Invited users accept email invite → account created → auto-joined to company (skip company creation)
- Admin-initiated invitations only; no self-service "join company" flow
- MFA is required for ALL users, no exceptions (not role-based, not configurable)
- Password reset via standard email link flow
- No social login (OAuth Google/GitHub) in v1 — email/password + MFA only

#### Multi-Company Switching
- Slack-style company switcher: dropdown in header bar
- User can switch between companies they belong to without logging out
- Each company switch changes the data context (schema) but preserves session

#### App Shell & Navigation
- Collapsible left sidebar for main navigation (projects, bidding, financials, etc.)
- Sidebar collapses to icon-only mode for more workspace
- Top bar contains: company switcher dropdown, user menu, notifications area
- Landing page after login: Company dashboard (overview of projects, activity, key metrics)
- Responsive: sidebar becomes hamburger menu on tablet/mobile, content goes full-width

#### Project Navigation (within a project)
- Entering a project reveals project-specific sub-navigation tabs (Dashboard, Budget, Change Orders, Documents, etc.)
- Sub-nav sits below the top bar, within the project context
- Breadcrumbs show: Company → Project → [Current Section]

### Claude's Discretion (RESEARCH THESE)
- Org/company hierarchy implementation details (how parent org maps to companies in auth provider)
- Schema provisioning timing and mechanism (eager vs lazy, migration tooling)
- Connection pooling strategy (PgBouncer config, pool sizes)
- Tenant routing middleware implementation
- Specific sidebar navigation items and icons
- Dashboard widget layout and content (will evolve as features ship)
- Exact responsive breakpoints (standard Tailwind breakpoints likely fine)
- Loading states and skeleton designs
- Error page designs (404, 403, 500)
- Toast/notification patterns

### Deferred Ideas (OUT OF SCOPE)
- Passkeys / WebAuthn — Consider for future version as modern auth alternative to passwords
- Social login (Google/GitHub OAuth) — Not in v1, could reduce signup friction in future

</user_constraints>

## Summary

Phase 1 establishes the security and infrastructure foundation for a multi-tenant construction management SaaS. The architecture uses **schema-per-tenant isolation** in PostgreSQL, **Clerk for authentication** with mandatory MFA, **CASL for policy-based authorization**, and **Next.js 14 App Router** for the responsive web shell. This pattern provides strong tenant isolation while maintaining operational efficiency for hundreds to thousands of companies.

The stack (Clerk + Drizzle + PostgreSQL schemas + PgBouncer + tRPC) is well-established for B2B SaaS applications. Key implementation challenges include: tenant context propagation through the request lifecycle, schema provisioning automation, connection pool management, and middleware-based authentication that complements (but doesn't replace) data-layer verification.

**Primary recommendation:** Implement tenant routing at the tRPC context layer, use transaction-mode pooling in PgBouncer with conservative pool sizes initially, provision schemas eagerly on company creation, enforce authentication at both middleware AND data access layers, and use trigger-based audit logging with immutable append-only tables.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Clerk | Latest (2026) | Authentication, MFA, invitations, org management | Industry-leading B2B auth with native organizations, MFA enforcement, invitation flows, and org switching UI components. Handles complex multi-org patterns. |
| Next.js | 14.x App Router | Frontend framework, SSR, routing | Current stable version with App Router (layouts, middleware, Server Components). Mature middleware patterns for auth. |
| Fastify | 4.x | Backend API framework | High-performance Node.js framework with plugin ecosystem, excellent TypeScript support, faster than Express. |
| PostgreSQL | 16.x | Primary database | Schema-per-tenant support, mature RLS capabilities, excellent JSON support (audit logs), proven at scale. |
| Drizzle ORM | Latest | Type-safe database access | Best-in-class TypeScript ORM, schema-first migrations, supports PostgreSQL schemas via pgSchema(), prepared statements for performance. |
| tRPC | 10.x | End-to-end type safety | Eliminates API contracts, shares types between frontend/backend, excellent App Router integration, context injection for tenant routing. |
| CASL | 6.x | Policy-based authorization | Isomorphic authorization (works client + server), RBAC + ABAC support, integrates with tRPC procedures, field-level permissions. |
| PgBouncer | 1.22+ | Connection pooling | Industry standard for PostgreSQL pooling, transaction-mode pooling for multi-tenant, reduces connection overhead. |
| Redis | 7.x | Session cache, distributed cache | Fast session storage, key prefixing for tenant isolation, ACL support for multi-tenancy, essential for distributed sessions. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui | 2.x | UI component library | All UI components - built on Radix UI primitives, includes sidebar, collapsible, toast, responsive patterns. Tailwind-based. |
| Tailwind CSS | 3.x | Utility-first CSS | Styling, responsive design. Standard breakpoints (sm: 640px, md: 768px, lg: 1024px, xl: 1280px). |
| @tanstack/react-query | 5.x | Client-side data fetching | Required by tRPC client, handles caching, optimistic updates, background refetch. |
| Zod | Latest | Schema validation | Runtime validation for tRPC inputs, type inference, error messages. Integrates with Drizzle for schema validation. |
| @clerk/nextjs | Latest | Clerk Next.js SDK | Provides clerkMiddleware(), auth(), currentUser(), and UI components (SignIn, UserButton, OrganizationSwitcher). |
| node-postgres (pg) | Latest | PostgreSQL driver | Drizzle's recommended driver, connection pooling support, prepared statements. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Clerk | Auth0, WorkOS, Supabase Auth | Clerk has better organizations/invitations UX, native multi-org switching. Auth0 is more enterprise-focused. WorkOS similar capabilities but smaller ecosystem. |
| Schema-per-tenant | Row-level tenant_id, database-per-tenant | Tenant_id requires extreme discipline (easy to leak data). Database-per-tenant has massive operational overhead at scale. Schemas balance isolation + efficiency. |
| PgBouncer | Supavisor, application-level pooling | Supavisor is newer, cloud-native, handles HTTP (good for serverless). PgBouncer is battle-tested and simpler for traditional deployments. |
| Drizzle ORM | Prisma, TypeORM | Prisma has better migration UI but worse multi-schema support. TypeORM is older, less type-safe. Drizzle excels at PostgreSQL schemas. |

**Installation:**

```bash
# Backend (Fastify)
npm install fastify @fastify/cors @fastify/helmet
npm install drizzle-orm pg @types/pg
npm install @trpc/server @clerk/backend
npm install @casl/ability
npm install redis ioredis
npm install zod

# Frontend (Next.js)
npm install next@14 react react-dom
npm install @trpc/client @trpc/react-query @trpc/server
npm install @tanstack/react-query
npm install @clerk/nextjs
npm install @casl/ability @casl/react
npm install tailwindcss postcss autoprefixer
npm install zod

# Dev dependencies
npm install -D drizzle-kit typescript @types/node @types/react
npm install -D tsx nodemon
```

## Architecture Patterns

### Recommended Project Structure

```
apps/
├── web/                          # Next.js 14 frontend
│   ├── app/
│   │   ├── (auth)/              # Auth routes (sign-in, sign-up)
│   │   ├── (dashboard)/         # Protected dashboard routes
│   │   │   ├── layout.tsx       # Shell with sidebar + topbar
│   │   │   ├── page.tsx         # Company dashboard landing
│   │   │   └── [companyId]/     # Company-scoped routes
│   │   ├── api/
│   │   │   └── trpc/[trpc]/route.ts  # tRPC endpoint
│   │   ├── layout.tsx           # Root layout (Clerk provider)
│   │   └── middleware.ts        # Clerk authentication middleware
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── sidebar.tsx          # Collapsible sidebar
│   │   ├── company-switcher.tsx # Org switcher dropdown
│   │   └── breadcrumbs.tsx      # Navigation breadcrumbs
│   └── lib/
│       ├── trpc.tsx             # tRPC React provider
│       └── abilities.ts         # CASL abilities client-side
├── api/                          # Fastify backend
│   ├── src/
│   │   ├── server.ts            # Fastify app entry point
│   │   ├── trpc/
│   │   │   ├── context.ts       # Tenant context creation
│   │   │   ├── router.ts        # Root tRPC router
│   │   │   └── procedures/      # Protected procedures
│   │   ├── db/
│   │   │   ├── client.ts        # Drizzle client factory
│   │   │   ├── schema/          # Drizzle schemas
│   │   │   │   ├── public.ts    # Public schema (tenants table)
│   │   │   │   └── tenant.ts    # Tenant schema template
│   │   │   └── migrations/      # SQL migrations
│   │   ├── auth/
│   │   │   ├── clerk.ts         # Clerk webhook handlers
│   │   │   └── abilities.ts     # CASL ability definitions
│   │   ├── cache/
│   │   │   └── redis.ts         # Redis client with tenant prefixing
│   │   └── middleware/
│   │       ├── tenant.ts        # Tenant resolution middleware
│   │       └── auth.ts          # Clerk auth verification
│   └── drizzle.config.ts        # Drizzle migration config
└── packages/
    └── shared/
        └── types/               # Shared TypeScript types
```

### Pattern 1: Tenant Context Propagation (tRPC)

**What:** Extract tenant ID from Clerk organization context, validate access, inject into tRPC context for all procedures.

**When to use:** Every protected tRPC procedure that accesses tenant data.

**Example:**
```typescript
// Source: https://brockherion.dev/blog/posts/how-to-use-trpc-with-nextjs-app-router/
// Adapted for multi-tenancy

// api/src/trpc/context.ts
import { clerkClient } from '@clerk/backend';
import { db } from '../db/client';

export async function createContext({ req }: { req: Request }) {
  // Extract Clerk session token from Authorization header
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return { db: null, userId: null, tenantId: null };
  }

  // Verify token and get session
  const session = await clerkClient.sessions.verifySession(token);
  const userId = session.userId;

  // Get active organization from session
  const user = await clerkClient.users.getUser(userId);
  const activeOrgId = user.publicMetadata?.activeOrgId as string;

  if (!activeOrgId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'No active organization'
    });
  }

  // Verify user membership in org
  const orgMembership = await clerkClient.organizations.getOrganizationMembership({
    organizationId: activeOrgId,
    userId,
  });

  if (!orgMembership) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Not a member of this organization'
    });
  }

  // Get tenant schema name from database
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.clerkOrgId, activeOrgId),
  });

  if (!tenant) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Tenant not found'
    });
  }

  // Create Drizzle client scoped to tenant schema
  const tenantDb = createTenantDb(tenant.schemaName);

  return {
    db: tenantDb,
    userId,
    tenantId: tenant.id,
    tenantSchema: tenant.schemaName,
    orgRole: orgMembership.role,
  };
}

// Protected procedure example
export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.tenantId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx });
});
```

### Pattern 2: Schema-Per-Tenant with Drizzle

**What:** Use PostgreSQL schemas to isolate tenant data. Public schema holds tenant registry. Each tenant gets dedicated schema.

**When to use:** All tenant data tables (projects, budgets, bids, etc.).

**Example:**
```typescript
// Source: https://medium.com/@vimulatus/schema-based-multi-tenancy-with-drizzle-orm-6562483c9b03
// Source: https://orm.drizzle.team/docs/sql-schema-declaration

// db/schema/public.ts - Tenant registry in public schema
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  schemaName: text('schema_name').notNull().unique(),
  clerkOrgId: text('clerk_org_id').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// db/schema/tenant.ts - Template for tenant schemas
import { pgSchema } from 'drizzle-orm/pg-core';

export function createTenantSchema(schemaName: string) {
  const schema = pgSchema(schemaName);

  // Projects table in tenant schema
  const projects = schema.table('projects', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull(),
    createdBy: text('created_by').notNull(), // Clerk user ID
    createdAt: timestamp('created_at').defaultNow().notNull(),
  });

  // Audit log in tenant schema (immutable)
  const auditLogs = schema.table('audit_logs', {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    action: text('action').notNull(), // CREATE, UPDATE, DELETE
    actorId: text('actor_id').notNull(), // Clerk user ID
    changes: jsonb('changes').notNull(), // JSONB for flexibility
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  });

  return { projects, auditLogs };
}

// db/client.ts - Dynamic tenant client creation
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // PgBouncer handles actual pooling
});

export function createTenantDb(schemaName: string) {
  return drizzle(pool, {
    schema: createTenantSchema(schemaName),
    logger: process.env.NODE_ENV === 'development',
  });
}

// Schema provisioning (run on org creation via Clerk webhook)
export async function provisionTenantSchema(schemaName: string) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create schema
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    // Run migrations for tenant schema
    // This would apply all tenant table definitions
    await client.query(`
      CREATE TABLE "${schemaName}".projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE "${schemaName}".audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type TEXT NOT NULL,
        entity_id UUID NOT NULL,
        action TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        changes JSONB NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // Revoke write access on audit_logs (immutable)
    await client.query(`
      REVOKE UPDATE, DELETE ON TABLE "${schemaName}".audit_logs FROM PUBLIC
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### Pattern 3: Clerk Organizations with Invitations

**What:** Admin users invite teammates via email. Clerk handles invitation emails and signup flow.

**When to use:** User onboarding after initial company signup.

**Example:**
```typescript
// Source: https://clerk.com/docs/guides/organizations/add-members/invitations
// Source: https://clerk.com/docs/guides/development/custom-flows/organizations/manage-organization-invitations

// Frontend - Company settings page
'use client';
import { useOrganization } from '@clerk/nextjs';

export function InviteUserForm() {
  const { organization } = useOrganization();

  async function handleInvite(email: string, role: 'admin' | 'member') {
    if (!organization) return;

    // Clerk sends email invitation automatically
    await organization.inviteMember({
      emailAddress: email,
      role, // 'admin' or 'basic_member'
    });
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      handleInvite(
        formData.get('email') as string,
        formData.get('role') as 'admin' | 'member'
      );
    }}>
      <input name="email" type="email" required />
      <select name="role">
        <option value="member">Member</option>
        <option value="admin">Admin</option>
      </select>
      <button type="submit">Send Invitation</button>
    </form>
  );
}

// Backend - Clerk webhook handler for member.created event
// api/src/auth/clerk.ts
import { Webhook } from 'svix';
import { WebhookEvent } from '@clerk/backend';

export async function handleClerkWebhook(req: Request) {
  const svix = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  const payload = await req.text();
  const headers = req.headers;

  const evt = svix.verify(payload, {
    'svix-id': headers.get('svix-id')!,
    'svix-timestamp': headers.get('svix-timestamp')!,
    'svix-signature': headers.get('svix-signature')!,
  }) as WebhookEvent;

  // When user accepts invitation and joins org
  if (evt.type === 'organizationMembership.created') {
    const { organization, public_user_data } = evt.data;

    // Grant user access to tenant schema
    // No action needed - access controlled by Clerk org membership
    // But you might want to create user profile in tenant schema

    console.log(`User ${public_user_data.user_id} joined org ${organization.id}`);
  }

  // When organization is created
  if (evt.type === 'organization.created') {
    const { id, name } = evt.data;

    // Provision tenant schema
    const schemaName = `tenant_${id.replace('org_', '')}`;
    await provisionTenantSchema(schemaName);

    // Store in tenants registry
    await db.insert(tenants).values({
      clerkOrgId: id,
      schemaName,
      name,
    });

    console.log(`Provisioned schema ${schemaName} for org ${id}`);
  }
}
```

### Pattern 4: Mandatory MFA Enforcement

**What:** Force all users to enable MFA before accessing the application.

**When to use:** All users, all routes (per requirements).

**Example:**
```typescript
// Source: https://clerk.com/docs/guides/secure/force-mfa

// web/app/middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);
const isMfaRoute = createRouteMatcher(['/mfa-setup(.*)']);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();

  // Allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Require authentication
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  // Check if user has MFA enabled (from custom session claims)
  const hasMfa = sessionClaims?.isMfa === true;

  // Redirect to MFA setup if not enabled
  if (!hasMfa && !isMfaRoute(req)) {
    return NextResponse.redirect(new URL('/mfa-setup', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};

// Clerk Dashboard Configuration:
// 1. Navigate to Configure → Sessions
// 2. Add custom claim "isMfa" with value: {{user.two_factor_enabled}}
// 3. Enable MFA strategies: Authenticator app (TOTP)
```

### Pattern 5: CASL Authorization with tRPC

**What:** Define abilities (permissions) based on user role within organization, enforce in tRPC procedures.

**When to use:** Authorization checks for actions on resources (projects, budgets, etc.).

**Example:**
```typescript
// Source: https://casl.js.org/
// Source: https://medium.com/yavar/casl-roles-with-persisted-permissions-in-nestjs-152129f4a6fb

// api/src/auth/abilities.ts
import { AbilityBuilder, PureAbility } from '@casl/ability';

type Actions = 'create' | 'read' | 'update' | 'delete' | 'manage';
type Subjects = 'Project' | 'Budget' | 'Bid' | 'User' | 'all';
type AppAbility = PureAbility<[Actions, Subjects]>;

export function defineAbilitiesFor(role: string, userId: string) {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(PureAbility);

  if (role === 'admin') {
    // Admins can do everything in their org
    can('manage', 'all');
  } else if (role === 'basic_member') {
    // Members can read projects
    can('read', 'Project');
    can('read', 'Budget');

    // Members can update projects they created
    can('update', 'Project', { createdBy: userId });

    // Members cannot delete anything
    cannot('delete', 'all');
  }

  return build();
}

// tRPC procedure with CASL check
import { ForbiddenError } from '@casl/ability';

export const projectRouter = router({
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ability = defineAbilitiesFor(ctx.orgRole, ctx.userId);

      // Check permission
      ForbiddenError.from(ability).throwUnlessCan('delete', 'Project');

      // Proceed with deletion
      await ctx.db.delete(projects).where(eq(projects.id, input.id));

      return { success: true };
    }),
});
```

### Pattern 6: Responsive Sidebar with shadcn/ui

**What:** Collapsible sidebar that becomes hamburger menu on mobile.

**When to use:** Main application shell layout.

**Example:**
```typescript
// Source: https://ui.shadcn.com/docs/components/radix/sidebar

// web/components/app-shell.tsx
'use client';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { CompanySwitcher } from './company-switcher';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <Sidebar className="border-r">
          <SidebarHeader>
            <CompanySwitcher />
          </SidebarHeader>

          <SidebarContent>
            <nav className="space-y-2 p-4">
              <a href="/dashboard" className="block px-4 py-2 rounded hover:bg-accent">
                Dashboard
              </a>
              <a href="/projects" className="block px-4 py-2 rounded hover:bg-accent">
                Projects
              </a>
              <a href="/bids" className="block px-4 py-2 rounded hover:bg-accent">
                Bidding
              </a>
              <a href="/financials" className="block px-4 py-2 rounded hover:bg-accent">
                Financials
              </a>
            </nav>
          </SidebarContent>

          <SidebarFooter>
            <UserButton />
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col">
          {/* Top bar */}
          <header className="border-b px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <Breadcrumbs />
            <div className="ml-auto flex items-center gap-4">
              <NotificationBell />
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

// Responsive behavior handled by shadcn/ui Sidebar component:
// - Desktop (lg+): Full sidebar, collapsible to icon-only
// - Tablet/Mobile: Hamburger menu overlay
```

### Anti-Patterns to Avoid

- **Middleware-only authentication:** CVE-2025-29927 shows middleware can be bypassed. ALWAYS verify auth at data access layer too.
- **Shared connection without search_path:** Forgetting to set search_path before queries will hit wrong schema. Use Drizzle's schema parameter.
- **tenant_id in application code:** Don't pass tenant ID from frontend - always derive from authenticated session to prevent tampering.
- **Eager connection creation:** Don't create database connection per request. Use connection pooling (PgBouncer) and reuse clients.
- **Custom session management:** Don't build your own sessions. Use Clerk's session tokens and Redis for server-side caching only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Authentication | Custom JWT auth, password hashing, MFA | Clerk | Handles MFA enforcement, invitation emails, org switching UI, session management, webhooks. Security is hard to get right. |
| Authorization | Custom permission system | CASL | Field-level permissions, conditions, isomorphic (client + server), battle-tested. Authorization logic is deceptively complex. |
| Email invitations | Custom email service + templates | Clerk invitations | Handles email delivery, invitation acceptance flow, org membership, retry logic, email templates. |
| Connection pooling | Application-level pooling | PgBouncer | Transaction-mode pooling, handles thousands of connections, battle-tested at scale, separates app from DB connection management. |
| Audit logging | Manual change tracking | Trigger-based audit logs | Triggers fire even if app code bypasses, immutable by design, captures all changes including direct SQL. |
| UI components | Custom sidebar/dropdown | shadcn/ui | Accessible, responsive out-of-box, maintains state, keyboard navigation, mobile patterns. |
| Multi-tenant data isolation | Application-layer filtering | PostgreSQL schemas | Database-enforced isolation, can't accidentally query wrong tenant, backup/restore per tenant, performance isolation. |

**Key insight:** Multi-tenancy has subtle edge cases (connection pooling per schema, tenant context leakage, invitation flows, org switching). Use libraries that have solved these problems at scale rather than discovering each pitfall through production incidents.

## Common Pitfalls

### Pitfall 1: Middleware Authentication Bypass (CVE-2025-29927)

**What goes wrong:** Relying solely on Next.js middleware for authentication. Attackers can bypass middleware using x-middleware-subrequest header, gaining unauthorized access to protected routes and data.

**Why it happens:** Middleware runs at edge/routing layer but can be circumvented. Developers assume middleware guarantees are absolute.

**How to avoid:**
- ALWAYS verify authentication at data access layer (tRPC context, API routes)
- Treat middleware as first-line defense, not sole protection
- Use Clerk's auth() or currentUser() in Server Components and API routes
- Upgrade Next.js to patched versions (14.2.25+, 15.2.3+)

**Warning signs:**
- No auth checks in tRPC procedures
- Relying on headers passed from middleware
- Skipping auth verification in API routes

**Sources:**
- https://zhero-web-sec.github.io/research-and-things/nextjs-and-the-corrupt-middleware
- https://clerk.com/articles/complete-authentication-guide-for-nextjs-app-router

### Pitfall 2: Tenant Context Leakage Between Requests

**What goes wrong:** Using global variables or module-scoped state to store tenant context. In Node.js event loop, requests can interleave, causing User A to see User B's data.

**Why it happens:** Developers assume synchronous execution or use singleton patterns inappropriate for async environments.

**How to avoid:**
- NEVER use global variables for tenant context
- Always pass tenant context through function parameters or request-scoped context (tRPC context)
- Use connection pooling that sets search_path per query, not per connection
- For Redis, always prefix keys with tenant ID

**Warning signs:**
- Global tenant variables
- Setting search_path once per connection
- Caching tenant context outside request lifecycle

**Sources:**
- https://www.crunchydata.com/blog/designing-your-postgres-database-for-multi-tenancy
- https://medium.com/@anurag.ydv36/the-multi-tenant-system-design-question-that-changed-how-i-build-backends-forever-312ebd6399ca

### Pitfall 3: Schema Provisioning Race Conditions

**What goes wrong:** Multiple requests try to provision schema simultaneously (webhook retries, concurrent signups). Creates duplicate schemas or migration failures.

**Why it happens:** Asynchronous webhook processing without coordination.

**How to avoid:**
- Use database-level locks (advisory locks) during schema provisioning
- Implement idempotent schema creation (CREATE SCHEMA IF NOT EXISTS)
- Process Clerk webhooks synchronously or use distributed lock (Redis)
- Store provisioning state in tenants table (pending/complete)

**Warning signs:**
- Schema provisioning errors in logs
- Duplicate schema names
- Webhook retry storms

**Code example:**
```typescript
// Use PostgreSQL advisory lock
await client.query('SELECT pg_advisory_lock($1)', [hashOrgId(orgId)]);
try {
  // Check if already provisioned
  const existing = await db.query.tenants.findFirst({
    where: eq(tenants.clerkOrgId, orgId),
  });

  if (!existing) {
    await provisionTenantSchema(schemaName);
    await db.insert(tenants).values({...});
  }
} finally {
  await client.query('SELECT pg_advisory_unlock($1)', [hashOrgId(orgId)]);
}
```

### Pitfall 4: PgBouncer Pool Exhaustion with Session Mode

**What goes wrong:** Using session-mode pooling (default) with schema-per-tenant. Each schema needs separate session, pool exhausts quickly with many tenants.

**Why it happens:** Session mode holds connections for entire client session. Can't share across tenants if using SET search_path.

**How to avoid:**
- Use **transaction mode** pooling in PgBouncer
- Set search_path in every query (Drizzle schema parameter handles this)
- Start with conservative pool size (20-50 connections)
- Monitor pool usage and queue depth

**Warning signs:**
- "Sorry, too many clients already" errors
- High connection wait times
- Pool size approaching max_connections

**Configuration:**
```ini
[pgbouncer]
pool_mode = transaction  # NOT session
default_pool_size = 25
max_client_conn = 1000
```

**Sources:**
- https://oneuptime.com/blog/post/2026-01-26-pgbouncer-connection-pooling/view
- https://www.pgbouncer.org/config.html

### Pitfall 5: Forgetting to Enforce MFA for All Users

**What goes wrong:** MFA enforcement implemented only in middleware, users bypass by directly accessing API routes or server components.

**Why it happens:** Developers assume middleware covers all routes.

**How to avoid:**
- Add MFA check to tRPC context creation (throw error if !user.two_factor_enabled)
- Verify in API routes using auth() helper
- Use Clerk's custom session claims: {{user.two_factor_enabled}}
- Block access at multiple layers (middleware + context + UI)

**Warning signs:**
- Users accessing app without MFA
- MFA setup page can be skipped
- API routes work without MFA

**Sources:**
- https://clerk.com/docs/guides/secure/force-mfa

### Pitfall 6: Mutable Audit Logs

**What goes wrong:** Audit logs stored as normal tables with UPDATE/DELETE permissions. Logs can be tampered with or deleted.

**Why it happens:** Treating audit logs like regular data.

**How to avoid:**
- REVOKE UPDATE and DELETE permissions on audit tables
- Use trigger-based logging (captures all changes, even direct SQL)
- Store changes in JSONB for flexible schema
- Implement append-only pattern with no update logic

**Code example:**
```sql
-- Make audit_logs immutable
REVOKE UPDATE, DELETE ON TABLE tenant_123.audit_logs FROM PUBLIC;
REVOKE UPDATE, DELETE ON TABLE tenant_123.audit_logs FROM app_user;
GRANT INSERT, SELECT ON TABLE tenant_123.audit_logs TO app_user;

-- Trigger for automatic audit logging
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, changes)
  VALUES (
    TG_TABLE_NAME,
    NEW.id,
    TG_OP,
    current_setting('app.current_user_id'),
    jsonb_build_object('before', row_to_json(OLD), 'after', row_to_json(NEW))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Sources:**
- https://oneuptime.com/blog/post/2026-01-21-postgresql-audit-logging/view
- https://medium.com/@sehban.alam/lets-build-production-ready-audit-logs-in-postgresql-7125481713d8

### Pitfall 7: Hard-Coded Organization Assumptions

**What goes wrong:** Code assumes user belongs to only one organization, breaking when users switch orgs.

**Why it happens:** Single-tenant mindset during development.

**How to avoid:**
- Always use Clerk's active organization from session
- Never cache organization ID globally
- Test with user who belongs to multiple orgs
- Update activeOrgId in Clerk when user switches via OrganizationSwitcher

**Warning signs:**
- Data from wrong organization appears after switching
- Errors when switching organizations
- Stale organization context

## Code Examples

Verified patterns from official sources:

### Next.js App Router Layout with Clerk

```typescript
// Source: https://clerk.com/docs/nextjs/getting-started/quickstart
// web/app/layout.tsx

import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

### tRPC App Router Setup

```typescript
// Source: https://brockherion.dev/blog/posts/how-to-use-trpc-with-nextjs-app-router/

// web/app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/trpc/router';
import { createContext } from '@/server/trpc/context';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };

// web/lib/trpc.tsx (client provider)
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { useState } from 'react';
import type { AppRouter } from '@/server/trpc/router';

export const trpc = createTRPCReact<AppRouter>();

export function TrpcProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          headers: () => ({
            Authorization: `Bearer ${getClerkToken()}`,
          }),
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

### Drizzle Schema with Multi-Schema Support

```typescript
// Source: https://orm.drizzle.team/docs/sql-schema-declaration

import { pgSchema, uuid, text, timestamp } from 'drizzle-orm/pg-core';

// Create schema instance
const tenantSchema = pgSchema('tenant_abc123');

// Define tables within schema
export const projects = tenantSchema.table('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Query usage
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';

const db = drizzle(pool, { schema: { projects } });

// Drizzle automatically includes schema in queries:
// SELECT * FROM "tenant_abc123"."projects" WHERE id = $1
await db.select().from(projects).where(eq(projects.id, projectId));
```

### PgBouncer Configuration for Multi-Tenant

```ini
# Source: https://www.pgbouncer.org/config.html

[databases]
* = host=postgres port=5432 dbname=construction_mgmt

[pgbouncer]
# Use transaction mode for schema-per-tenant
pool_mode = transaction

# Connection limits
default_pool_size = 25
max_client_conn = 1000
max_db_connections = 100

# Timeouts
server_idle_timeout = 600
query_timeout = 300

# Auth
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt

# Networking
listen_addr = 0.0.0.0
listen_port = 6432

# Logging
log_connections = 1
log_disconnections = 1
```

### Redis Tenant Key Prefixing

```typescript
// Source: https://medium.com/@okan.yurt/multi-tenant-caching-strategies-why-redis-alone-isnt-enough-hybrid-pattern-f404877632e5

import { Redis } from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
});

// Always prefix keys with tenant ID
export class TenantCache {
  constructor(private tenantId: string) {}

  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(`tenant:${this.tenantId}:${key}`);
    return data ? JSON.parse(data) : null;
  }

  async set<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
    await redis.setex(
      `tenant:${this.tenantId}:${key}`,
      ttlSeconds,
      JSON.stringify(value)
    );
  }

  async delete(key: string): Promise<void> {
    await redis.del(`tenant:${this.tenantId}:${key}`);
  }

  // Clear all keys for this tenant
  async clearAll(): Promise<void> {
    const keys = await redis.keys(`tenant:${this.tenantId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

// Usage in tRPC context
export async function createContext({ req }: { req: Request }) {
  // ... auth and tenant resolution ...

  return {
    cache: new TenantCache(tenantId),
    // ... other context
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router | App Router with Server Components | Next.js 13-14 (2023-2024) | Layouts, middleware, streaming SSR. Requires fetchRequestHandler for tRPC instead of Next adapter. |
| Custom auth | Clerk Organizations | 2023-2024 | Native multi-org support, invitation flows, org switching UI. Reduces auth code by 80%. |
| Prisma | Drizzle ORM | 2023-2025 | Better multi-schema support (pgSchema), faster queries, simpler migrations, smaller bundle. |
| Row-level security (RLS) | Schema-per-tenant | Ongoing trend | Better isolation, easier backup/restore, performance isolation. RLS still valid for simpler cases. |
| Custom permission systems | CASL | 2020-present | Standardized, isomorphic, community patterns. Don't reinvent authorization. |
| Application pooling | PgBouncer transaction mode | Standard practice | Essential for serverless/multi-tenant. Can't rely on persistent connections. |

**Deprecated/outdated:**
- **Next.js Pages Router with tRPC**: Still works but App Router is current standard. Use fetchRequestHandler, not tRPC's Next.js adapter.
- **Session-mode pooling for multi-tenant**: Doesn't scale with schema-per-tenant. Use transaction mode.
- **Manual MFA implementation**: Clerk handles this natively. Don't build custom TOTP/SMS flows.
- **Row-level security as primary isolation**: Good for simple cases, but schema isolation is more robust for SaaS.

## Open Questions

### 1. Schema Migration Strategy for Tenant Schemas

**What we know:** Drizzle Kit can generate migrations, but schema-per-tenant means running migrations across all tenant schemas.

**What's unclear:**
- Should migrations run eagerly (on deploy) or lazily (on first tenant access)?
- How to handle migration failures for individual tenants?
- Should migration status be tracked per-tenant?

**Recommendation:**
- Implement eager migration on deploy with transaction rollback per tenant
- Store migration version in each tenant schema (migration_version table)
- Log failures but continue with other tenants
- Provide admin UI to retry failed migrations
- Test migration strategy with at least 2 local schemas during development

**Complexity:** MEDIUM - Requires custom migration runner but straightforward logic.

### 2. Clerk Organization Hierarchy Mapping

**What we know:** Clerk supports organizations. Requirements mention companies. Unclear if there's parent/child relationship (org → company).

**What's unclear:**
- Do we need organization hierarchy (e.g., enterprise customer → multiple companies)?
- Or is it flat: one Clerk org = one company = one schema?

**Recommendation:**
- Start with flat mapping (1 Clerk org = 1 company = 1 schema)
- If hierarchy needed later, use Clerk's public metadata to store parent org ID
- Current requirements don't mention org hierarchy, so YAGNI applies

**Complexity:** LOW - Use flat mapping for v1.

### 3. PgBouncer Pool Size Tuning

**What we know:** Transaction mode pooling recommended. Conservative starting point: 20-50 connections.

**What's unclear:**
- What's optimal pool size for expected load (requirements don't specify concurrent user count)?
- Should pool size scale dynamically?

**Recommendation:**
- Start with default_pool_size = 25, max_db_connections = 100
- Monitor pool usage (PgBouncer SHOW POOLS command)
- Tune based on metrics: if avg_query_count stays high, increase pool size
- Document tuning process for production

**Complexity:** LOW - Standard monitoring and tuning approach.

### 4. Error Handling for Tenant Context Failures

**What we know:** If tenant context resolution fails (org not found, schema missing), requests should fail gracefully.

**What's unclear:**
- Should users get redirected to org setup page?
- Should admins get notification of schema provisioning failures?
- How to handle partial failures (schema exists but migrations incomplete)?

**Recommendation:**
- Return 403 Forbidden with clear error message
- Log errors to monitoring system (Sentry, DataDog)
- Provide admin dashboard showing tenant health status
- Implement health check endpoint: GET /api/health/tenant/:id

**Complexity:** MEDIUM - Requires admin tooling.

## Sources

### Primary (HIGH confidence)

- **Clerk Official Docs** - Organizations, MFA, Invitations
  - https://clerk.com/docs/guides/organizations/overview
  - https://clerk.com/docs/guides/secure/force-mfa
  - https://clerk.com/docs/guides/organizations/add-members/invitations
  - https://clerk.com/docs/reference/nextjs/clerk-middleware

- **Next.js 14 Official Docs** - App Router, Layouts, Middleware
  - https://nextjs.org/docs/app/building-your-application/routing/layouts-and-templates

- **Drizzle ORM Official Docs** - Migrations, Schema Support
  - https://orm.drizzle.team/docs/migrations
  - https://orm.drizzle.team/docs/sql-schema-declaration

- **PgBouncer Official Docs** - Configuration, Pooling Modes
  - https://www.pgbouncer.org/config.html

- **CASL Official Docs** - Authorization, Abilities
  - https://casl.js.org/

- **shadcn/ui Official Docs** - Sidebar Component
  - https://ui.shadcn.com/docs/components/radix/sidebar

### Secondary (MEDIUM confidence)

- **Multi-Tenancy Patterns** - PostgreSQL schema-per-tenant
  - https://www.crunchydata.com/blog/designing-your-postgres-database-for-multi-tenancy
  - https://medium.com/@anurag.ydv36/the-multi-tenant-system-design-question-that-changed-how-i-build-backends-forever-312ebd6399ca

- **Drizzle Multi-Schema Implementation**
  - https://medium.com/@vimulatus/schema-based-multi-tenancy-with-drizzle-orm-6562483c9b03

- **tRPC with Next.js App Router**
  - https://brockherion.dev/blog/posts/how-to-use-trpc-with-nextjs-app-router/
  - https://itsrakesh.com/blog/lets-build-a-full-stack-app-with-trpc-and-nextjs-14

- **Redis Multi-Tenant Caching**
  - https://medium.com/@okan.yurt/multi-tenant-caching-strategies-why-redis-alone-isnt-enough-hybrid-pattern-f404877632e5
  - https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/service/cache-redis

- **PgBouncer Multi-Tenant Configuration** (2026)
  - https://oneuptime.com/blog/post/2026-01-26-pgbouncer-connection-pooling/view

- **Audit Logging Patterns** (2026)
  - https://oneuptime.com/blog/post/2026-01-21-postgresql-audit-logging/view
  - https://medium.com/@sehban.alam/lets-build-production-ready-audit-logs-in-postgresql-7125481713d8

- **Next.js Middleware Security** (CVE-2025-29927)
  - https://zhero-web-sec.github.io/research-and-things/nextjs-and-the-corrupt-middleware
  - https://clerk.com/articles/complete-authentication-guide-for-nextjs-app-router

### Tertiary (LOW confidence - requires validation)

- **CASL Multi-Tenant Examples**
  - https://github.com/stalniy/casl (verified repo, but implementation patterns need testing)

- **Fastify + Drizzle Integration**
  - https://github.com/josephgodwinkimani/tRPC-fastify-starter (starter template, not production-verified)

## Metadata

**Confidence breakdown:**
- **Standard stack:** HIGH - All libraries have official 2026 documentation and active maintenance
- **Architecture patterns:** MEDIUM-HIGH - Patterns verified across multiple sources but need implementation testing
- **Multi-tenancy implementation:** MEDIUM - Schema-per-tenant is proven pattern but Drizzle-specific implementation has limited production examples
- **Security patterns:** HIGH - Clerk MFA, CVE documentation, and auth patterns well-documented
- **Pitfalls:** MEDIUM-HIGH - Based on recent security research (CVE-2025-29927) and community experiences

**Research date:** 2026-02-10
**Valid until:** ~30 days (2026-03-10) - Stack is relatively stable, but Next.js and Clerk update frequently. Re-verify before major releases.

**Notes for planner:**
- Clerk Organizations feature is current and well-documented (Feb 2026 updates)
- Next.js 14 App Router is stable; Next.js 15 exists but 14 is LTS-supported
- CVE-2025-29927 is critical context for middleware patterns
- Drizzle multi-schema support confirmed but migration tooling requires custom implementation
- PgBouncer transaction mode is essential for this architecture
