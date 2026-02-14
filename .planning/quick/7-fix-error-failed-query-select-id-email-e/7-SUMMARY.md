---
phase: quick-7
plan: 1
subsystem: auth
tags:
  - quick-fix
  - auth
  - database
  - provisioning
dependency_graph:
  requires:
    - Phase 12 custom auth migration (provisionAuthTables function)
  provides:
    - Auto-provisioned auth tables on server startup
  affects:
    - Sign-in flow
    - User registration
    - All auth operations
tech_stack:
  added: []
  patterns:
    - Fatal error handling for critical infrastructure
    - Auto-provisioning pattern matching S3 bucket initialization
key_files:
  created: []
  modified:
    - apps/api/src/server.ts
    - apps/api/src/trpc/routers/auth.ts
decisions:
  - "Fatal exit on auth provisioning failure: Unlike S3 bucket init (warn-only), auth table provisioning is fatal because the entire auth system depends on these tables"
  - "Removed debug logging from auth router: Console.log statements were left over from debugging and created noise in production logs"
metrics:
  duration: 3 min
  tasks_completed: 1
  files_modified: 2
  completed_date: 2026-02-14
---

# Quick Task 7: Fix "Failed query: select ... from users" Error

**One-liner:** Auto-provision auth tables on server startup to prevent SQL errors at sign-in.

## Problem

The Phase 12 custom auth migration created a `provisionAuthTables()` function that creates users, organizations, refresh_tokens, and other auth tables in the public schema. However, this function was only callable via a standalone script (`provision-auth.ts`) that must be run manually. If the tables didn't exist, every auth query (login, register, etc.) failed with "Failed query: select ... from users" error.

## Solution

Added auth table provisioning to server startup sequence, immediately after S3 bucket initialization and before QBO sync worker startup.

### Changes Made

**apps/api/src/server.ts:**
- Imported `provisionAuthTables` from `./tenant/provision.js`
- Added try/catch block after S3 bucket initialization that calls `provisionAuthTables(pool)`
- Fatal exit (`process.exit(1)`) on provisioning failure since auth won't work without these tables

**apps/api/src/trpc/routers/auth.ts:**
- Removed debug `console.log` and `console.error` statements from register mutation (lines 82-93)
- Simplified email existence check by removing unnecessary try/catch wrapper
- tRPC handles errors globally, so verbose logging around database queries was redundant

## Verification

Tested by:
1. Starting server with `cd apps/api && npx tsx src/server.ts`
2. Confirmed "Auth tables provisioned successfully" appears in startup logs
3. Verified auth tables exist in database: `docker exec construction-db psql -U construction -d construction_mgmt -c "\dt" | grep users`
4. Confirmed no "Failed query: select ... from users" errors when attempting auth operations

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

### Created Files
None required.

### Modified Files
- ✅ apps/api/src/server.ts (imports provisionAuthTables, calls it on startup)
- ✅ apps/api/src/trpc/routers/auth.ts (debug logging removed)

### Commits
- ✅ 2b307df: fix(quick-7): auto-provision auth tables on server startup

### Database Verification
```bash
$ docker exec construction-db psql -U construction -d construction_mgmt -c "\dt" | grep -E "users|organizations|refresh_tokens"
 public | organizations             | table | construction
 public | refresh_tokens            | table | construction
 public | users                     | table | construction
```

All auth tables exist and are ready for use.

## Impact

- ✅ Sign-in and registration now work without manual migration steps
- ✅ Auth tables are idempotent (CREATE IF NOT EXISTS) - safe to run on every startup
- ✅ Server logs are cleaner (removed debug spam from auth router)
- ✅ Fatal error handling ensures auth infrastructure is always ready before server accepts connections

## Next Steps

None - quick fix complete. Sign-in flow should now work end-to-end.
