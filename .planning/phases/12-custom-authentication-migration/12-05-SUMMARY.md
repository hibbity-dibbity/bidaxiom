---
phase: 12-custom-authentication-migration
plan: 05
subsystem: auth
tags: [iron-session, custom-auth, jwt, session-management, middleware]

# Dependency graph
requires:
  - phase: 12-custom-authentication-migration
    provides: Custom JWT auth backend with user/org management
provides:
  - Iron-session encrypted cookie management for Next.js frontend
  - AuthContext provider replacing Clerk's useAuth/useOrganization hooks
  - Custom middleware for route protection and MFA enforcement
  - JWT-based tRPC client with automatic token refresh
  - API routes for token retrieval and org switching
affects: [12-06, 12-07]

# Tech tracking
tech-stack:
  added: [iron-session]
  patterns: [server-actions-for-auth, async-server-component-layout, api-route-token-bridge]

key-files:
  created:
    - apps/web/lib/session.ts
    - apps/web/lib/auth.ts
    - apps/web/lib/auth-context.tsx
    - apps/web/app/api/auth/token/route.ts
    - apps/web/app/api/auth/switch-org/route.ts
  modified:
    - apps/web/middleware.ts
    - apps/web/app/providers.tsx
    - apps/web/app/layout.tsx

key-decisions:
  - "Iron-session for encrypted stateless cookies (7-day maxAge matching refresh token TTL)"
  - "Server actions pattern for auth operations (login, logout, token refresh, org switching)"
  - "Proactive token refresh when access token within 2 minutes of expiry"
  - "API route bridge pattern for client-side token access (tRPC headers can't call server actions)"
  - "Root layout changed to async Server Component (no ClerkProvider needed)"
  - "AuthContext mirrors Clerk's API surface (useAuth, switchOrg) for easier migration"

patterns-established:
  - "Session management: iron-session with encrypted cookies, no server-side storage"
  - "Token lifecycle: access token auto-refresh, refresh token rotation on auth.refresh call"
  - "Middleware pattern: iron-session in Edge middleware for route protection"
  - "Provider hierarchy: AuthProvider → TrpcAndAbilityProvider → children"

# Metrics
duration: 2 min
completed: 2026-02-14
---

# Phase 12 Plan 05: Frontend Custom Auth Infrastructure Summary

**Iron-session encrypted cookies, custom AuthContext, JWT-based tRPC client, and custom middleware replace all Clerk frontend dependencies**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-14T06:12:02Z
- **Completed:** 2026-02-14T06:14:53Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Replaced ClerkProvider with iron-session based AuthProvider
- Custom middleware using iron-session replaces clerkMiddleware
- JWT-based tRPC client with automatic token refresh
- Server actions for login, logout, token refresh, org switching
- API route bridge for client-side token access

## Task Commits

Each task was committed atomically:

1. **Task 1: Create session management and auth utilities** - `d306f98` (feat)
2. **Task 2: Replace Clerk middleware, providers, and root layout** - `23e7622` (feat)

## Files Created/Modified

### Created
- `apps/web/lib/session.ts` - Iron-session configuration and helpers (getSession, SessionData interface)
- `apps/web/lib/auth.ts` - Server actions for auth operations (login, logout, getAccessToken, refreshAccessToken, setActiveOrg)
- `apps/web/lib/auth-context.tsx` - React context providing auth state to client components (useAuth hook)
- `apps/web/app/api/auth/token/route.ts` - API route for tRPC client to fetch access token
- `apps/web/app/api/auth/switch-org/route.ts` - API route for organization switching

### Modified
- `apps/web/middleware.ts` - Custom iron-session middleware replaces clerkMiddleware
- `apps/web/app/providers.tsx` - AuthProvider wraps app, tRPC client fetches token via API route
- `apps/web/app/layout.tsx` - Removed ClerkProvider, changed to async Server Component passing session data

## Decisions Made

1. **Iron-session for cookie management** - Encrypted stateless cookies with 7-day maxAge matching refresh token TTL; secure in production, httpOnly, sameSite: lax for OAuth compatibility
2. **Server actions pattern** - Auth operations (login, logout, token refresh, org switching) use Next.js server actions marked with "use server"
3. **Proactive token refresh** - Access token automatically refreshed when within 2 minutes of expiry to prevent mid-request expiration
4. **API route bridge pattern** - tRPC client headers can't call server actions directly, so API routes provide bridge for token access
5. **Async Server Component layout** - Root layout is now async to call getSessionData(); no "use client" needed without ClerkProvider
6. **Mirror Clerk API surface** - AuthContext provides useAuth() hook with same shape as Clerk's (userId, orgId, orgRole, user object) for easier migration in Plans 06-07

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - iron-session integration worked as expected. TypeScript compilation shows expected errors in files still using Clerk (sign-in, sign-up, onboarding, members pages) which will be fixed in Plans 06-07.

## User Setup Required

None - no external service configuration required. Session encryption uses existing SESSION_SECRET env var.

## Next Phase Readiness

Frontend auth infrastructure ready. Next steps:
- **Plan 12-06**: Migrate sign-in, sign-up, onboarding, MFA setup pages to custom auth
- **Plan 12-07**: Update dashboard components to use custom useAuth hook

---
*Phase: 12-custom-authentication-migration*
*Completed: 2026-02-14*

## Self-Check: PASSED

All created files verified on disk:
- apps/web/lib/session.ts
- apps/web/lib/auth.ts
- apps/web/lib/auth-context.tsx
- apps/web/app/api/auth/token/route.ts
- apps/web/app/api/auth/switch-org/route.ts

All commits present in git history:
- d306f98 (Task 1)
- 23e7622 (Task 2)
