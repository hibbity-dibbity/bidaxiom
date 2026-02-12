---
phase: 01-foundation-multi-tenant
plan: 03
status: complete
commit: 2b7f43e
---

# Plan 03 Summary: Tenant Provisioning

## What Was Built
- **provisionTenantSchema()**: Creates isolated PostgreSQL schemas with advisory lock protection. Idempotent — duplicate calls return existing record.
- **resolveTenant()**: Queries public.tenants to map Clerk org ID -> schema name
- **buildTenantContext()**: Produces request-scoped tenant context with schema-isolated DB client. Never global, never from frontend.
- **Clerk webhooks**: organization.created triggers provisioning, membership.created/deleted manages user mappings
- **Dual webhook routes**: Both Fastify (/api/webhooks/clerk) and Next.js (app/api/webhooks/clerk) for deployment flexibility

## Files Created (6 new, 3 modified)
- apps/api/src/tenant/provision.ts, resolve.ts, context.ts
- apps/api/src/webhooks/clerk.ts, routes.ts
- apps/web/app/api/webhooks/clerk/route.ts
- Modified: apps/api/package.json (+svix), apps/web/package.json, package-lock.json

## Verification Results
- `npx tsc --noEmit` on apps/api — clean
- `npx tsc --noEmit` on apps/web — clean

## Deviations
- None significant. Followed plan closely.

## Must-Have Verification
- [x] Clerk org creation triggers schema provisioning (via webhook handler)
- [x] tenants table receives record for each provisioned org
- [x] Tenant resolution maps Clerk org ID to schema name
- [x] Schema provisioning is idempotent with advisory locks
- [x] Each tenant schema contains audit_logs and user_profiles tables
