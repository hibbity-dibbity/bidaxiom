---
phase: 01-foundation-multi-tenant
plan: 02
status: complete
commit: 33dd3e8
---

# Plan 02 Summary: Auth + Database Setup

## What Was Built

### Task 1: Drizzle ORM Database Layer
- **Public schema**: `tenants` table (UUID PK, schema_name, clerk_org_id, name, status) and `user_company_mappings` table (clerk_user_id, tenant_id FK, role) with indexes
- **Tenant schema template**: `createTenantSchema()` function using `pgSchema()` — creates `audit_logs` (immutable) and `user_profiles` tables per tenant
- **DB client**: `db` for public queries, `createTenantDb()` for schema-scoped tenant queries with caching
- **Migration script**: Raw SQL migration with REVOKE UPDATE/DELETE on audit_logs, runnable via `npx tsx`
- **Drizzle config**: For schema generation and push commands

### Task 2: Clerk Authentication with MFA
- **ClerkProvider** wrapping root layout
- **Sign-in / Sign-up pages**: Using Clerk components at `/sign-in` and `/sign-up`
- **MFA enforcement middleware**: All users without MFA redirected to `/mfa-setup` (no exceptions)
- **MFA setup page**: Shows UserProfile component with instructions
- **Onboarding page**: Detects invited vs direct signup — creates org or redirects to dashboard
- **Public routes**: sign-in, sign-up, webhooks excluded from auth

## Files Created/Modified (15 files)
- apps/api/src/db/schema/public.ts, tenant.ts, index.ts
- apps/api/src/db/client.ts, migrate.ts
- apps/api/drizzle.config.ts
- apps/api/package.json (updated: +drizzle-orm, +pg, +drizzle-kit, +db scripts)
- apps/web/app/layout.tsx (updated: +ClerkProvider)
- apps/web/app/(auth)/layout.tsx, sign-in/page.tsx, sign-up/page.tsx, mfa-setup/page.tsx
- apps/web/app/(dashboard)/onboarding/page.tsx
- apps/web/middleware.ts
- apps/web/package.json (updated: +@clerk/nextjs)

## Verification Results
- `npx tsc --noEmit` on apps/api — clean
- `npx tsc --noEmit` on apps/web — clean

## Deviations
- Used `userMemberships` instead of `organizationList` in onboarding page (Clerk API uses paginated resources, not a flat list)
- MFA check uses `sessionClaims.isMfa` custom claim — requires Clerk Dashboard configuration (documented in user_setup)

## Must-Have Verification
- [x] User can visit sign-up page and create account (Clerk SignUp component)
- [x] User can visit sign-in page and log in (Clerk SignIn component)
- [x] ALL users without MFA redirected to MFA setup page (no exceptions)
- [x] Public schema contains tenants table ready for tenant registration
- [x] All code compiles with strict TypeScript
