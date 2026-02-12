# Plan 05 Summary: CASL Authorization

**Commit:** ef7ee20
**Status:** Complete

## What was built
- CASL 6.x isomorphic authorization on both server (API) and client (web)
- Role definitions in `apps/api/src/auth/roles.ts` mapping Clerk org roles to permission levels
- `defineAbilitiesFor(role, userId)` in `apps/api/src/auth/abilities.ts` with per-role CASL rules
- `withAbilities` tRPC middleware injecting CASL abilities into context
- `requirePermission(action, subject)` middleware factory for route-level guards
- `authorizedProcedure` in procedures.ts combining auth + tenant + abilities
- Client-side abilities in `apps/web/lib/abilities.ts` with `useAbilities()` hook and `Can` component
- Shared types: `AppActions` and `AppSubjects` in `packages/shared/src/types/auth.ts`

## Role hierarchy
- `org:admin` — manage all resources
- `org:project_manager` — manage projects, bids, financials; read settings
- `org:member` — read-only access to projects, bids, financials
