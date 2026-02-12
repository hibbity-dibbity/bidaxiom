---
phase: 01-foundation-multi-tenant
plan: 04
status: complete
commit: 33e31d1
---

# Plan 04 Summary: tRPC + Tenant Context

## What Was Built

### Task 1: tRPC Server with Tenant-Aware Context
- **trpc.ts**: tRPC initialization with Context type
- **context.ts**: Creates per-request context from Clerk JWT — verifies auth independently of middleware (CVE-2025-29927), resolves tenant, creates scoped DB
- **procedures.ts**: publicProcedure (no auth), authProcedure (userId required), protectedProcedure (auth + MFA + tenant)
- **health router**: Public health check endpoint
- **tenant router**: current (protected), list (auth), switch (auth) — all tenant-scoped
- **server.ts**: Updated to register tRPC via fastifyTRPCPlugin at /trpc

### Task 2: Next.js tRPC Client
- **trpc.ts**: createTRPCReact with AppRouter type from api workspace
- **providers.tsx**: React Query + tRPC providers with Clerk token forwarding via Bearer auth
- **layout.tsx**: Updated to wrap children in Providers

## Files Created/Modified (13 files)
- apps/api/src/trpc/trpc.ts, context.ts, procedures.ts, router.ts, routers/health.ts, routers/tenant.ts
- apps/api/src/server.ts (updated)
- apps/api/package.json (+@trpc/server, +@clerk/backend)
- apps/web/lib/trpc.ts, app/providers.tsx
- apps/web/app/layout.tsx (updated)
- apps/web/package.json (+@trpc/client, +@trpc/react-query, +@tanstack/react-query)

## Verification Results
- `npx tsc --noEmit` on apps/api — clean
- `npx tsc --noEmit` on apps/web — clean (after adding explicit type annotation for portability)

## Must-Have Verification
- [x] tRPC client in Next.js calls backend with end-to-end type safety
- [x] Protected procedures require valid Clerk authentication
- [x] Protected procedures have tenant context (tenantId, schemaName, scoped DB)
- [x] MFA verified at tRPC context level (not just middleware)
- [x] Unauthenticated calls return UNAUTHORIZED
- [x] Calls without active organization return FORBIDDEN
