---
phase: 12-custom-authentication-migration
plan: 08
subsystem: authentication
tags: [cleanup, migration, dependencies, clerk-removal]
dependency_graph:
  requires: [12-01, 12-02, 12-03, 12-04, 12-05, 12-06, 12-07]
  provides: [zero-clerk-dependencies, auth-migration-script]
  affects: [authentication, organization-management, webhooks]
tech_stack:
  added: []
  patterns: [idempotent-migration, transaction-rollback, placeholder-passwords]
key_files:
  created:
    - apps/api/src/migrate-auth.ts
  modified:
    - apps/api/package.json
    - apps/web/package.json
    - package-lock.json
    - apps/api/src/webhooks/clerk.ts
    - apps/api/src/webhooks/routes.ts
    - apps/api/src/integrations/calendar/shared/workers.ts
    - apps/api/src/trpc/routers/calendar.ts
    - apps/api/src/trpc/routers/document.ts
    - apps/api/src/trpc/routers/project.ts
  deleted:
    - apps/web/app/api/webhooks/clerk/route.ts
    - apps/web/app/api/webhooks/clerk/
decisions: []
metrics:
  duration: 10.1 min
  tasks_completed: 2
  files_created: 1
  files_modified: 9
  files_deleted: 2
  commits: 2
completed_date: 2026-02-14
---

# Phase 12 Plan 08: Clerk Dependency Cleanup and Data Migration

**One-liner:** Complete Clerk removal with zero dependencies remaining, plus idempotent migration script for existing user data

## What Was Built

Completed the final cleanup of all Clerk dependencies and created a migration path for existing data:

**Dependency Cleanup:**
- Uninstalled `@clerk/backend` and `@clerk/nextjs` from package.json
- Removed `svix` package (only used for Clerk webhook verification)
- Replaced Clerk webhook handler with deprecation comment
- Removed Clerk webhook routes from API and web app
- Verified zero `@clerk/` imports remain in source code

**Migration Script:**
- Created `apps/api/src/migrate-auth.ts` for one-time data migration
- Migrates organizations from `tenants` table to `organizations` table
- Migrates users from `user_company_mappings` + `user_profiles` to `users` table
- Migrates memberships to `organizationMemberships` table
- Idempotent design (safe to run multiple times)
- Transaction-wrapped (all-or-nothing)
- Sets placeholder password hashes (users must reset via "Forgot Password")
- Disables MFA (users must re-setup after migration)
- Outputs detailed migration report

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed calendar router ctx.abilities access after Phase 12-04 context refactor**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** Calendar router tried to access `ctx.abilities` directly, but Phase 12-04 moved abilities out of context into middleware
- **Fix:** Changed calendar router from `protectedProcedure` to `authorizedProcedure` for procedures that check permissions
- **Files modified:** apps/api/src/trpc/routers/calendar.ts
- **Commit:** a8e70fb

**2. [Rule 1 - Bug] Fixed calendar workers discriminated union type narrowing**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** TypeScript couldn't narrow `GoogleSyncResult | MicrosoftSyncResult` union type inside if blocks
- **Fix:** Used separate variables (`googleResult`, `msResult`) for proper type narrowing
- **Files modified:** apps/api/src/integrations/calendar/shared/workers.ts
- **Commit:** a8e70fb

**3. [Rule 1 - Bug] Fixed document router presigned URL call signature**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** `generateDownloadUrl()` called with 3 arguments but only accepts 2
- **Fix:** Removed third `contentType` parameter from function call
- **Files modified:** apps/api/src/trpc/routers/document.ts
- **Commit:** a8e70fb

**4. [Rule 1 - Bug] Fixed project creation to include required customerId**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** Project schema requires `customerId` but creation mutation didn't pass it
- **Fix:** Added `customerId: input.customerId` to project insert values
- **Files modified:** apps/api/src/trpc/routers/project.ts
- **Commit:** a8e70fb

## Architecture & Implementation Notes

**Dependency Cleanup Pattern:**
- npm uninstall removed packages from package.json
- Webhook handler replaced with comment referencing new location
- Webhook routes removed while preserving QBO/calendar webhooks
- Comprehensive grep search ensured zero `@clerk/` imports remain

**Migration Script Design:**
- Transaction-wrapped for atomicity
- Uses `ON CONFLICT DO NOTHING` for idempotency
- Queries tenant-specific user_profiles tables for user data
- Generates slugs from organization names
- Assigns placeholder password hash with `hashType = 'none'`
- Documents password reset requirement in output

**Known Limitations:**
- Clerk password hashes cannot be exported in development
- In production, Clerk provides CSV export with bcrypt hashes
- Migration script can be extended to import those hashes when available
- MFA secrets are not exportable (security limitation)

## Testing & Verification

**TypeScript Compilation:**
- API compiles with only pre-existing QuickBooks type definition warnings
- Web compiles with pre-existing customer/project schema errors (unrelated)
- Migration script compiles without errors

**Dependency Verification:**
- Searched entire codebase for `@clerk/` imports: 0 results
- Confirmed svix removed from both apps
- package-lock.json regenerated successfully

**Migration Script:**
- Compiles without TypeScript errors
- Ready for execution with `cd apps/api && npx tsx src/migrate-auth.ts`
- Not executed during plan (designed for one-time production use)

## Phase 12 Success Criteria Met

All 8 success criteria from Phase 12 are now complete:

1. ✅ Custom JWT-based auth replaces all Clerk flows (Plan 12-01)
2. ✅ Custom MFA (TOTP) replaces Clerk MFA (Plan 12-01)
3. ✅ Custom org/company management replaces Clerk Organizations (Plan 12-03)
4. ✅ Custom invitation system replaces Clerk invitations (Plan 12-03)
5. ✅ Migration script handles existing users (Plan 12-08 - password reset required)
6. ✅ CASL RBAC continues to work identically (Plans 12-04, 12-05, 12-06, 12-07)
7. ✅ Direct provisioning replaces webhook-based provisioning (Plan 12-03)
8. ✅ Zero Clerk dependencies remain (Plan 12-08)

**Phase 12 Complete:** The application now has fully custom authentication with zero third-party auth dependencies.

## Commits

- `a8e70fb` - feat(12-08): remove Clerk dependencies and webhook handlers
- `01735e2` - feat(12-08): create Clerk to custom auth migration script

## Self-Check

Verifying claimed files exist and commits are in git history:

**Created files:**
```bash
[ -f "apps/api/src/migrate-auth.ts" ] && echo "FOUND" || echo "MISSING"
```
Result: FOUND

**Modified files:**
```bash
[ -f "apps/api/package.json" ] && echo "FOUND" || echo "MISSING"
[ -f "apps/web/package.json" ] && echo "FOUND" || echo "MISSING"
[ -f "apps/api/src/webhooks/clerk.ts" ] && echo "FOUND" || echo "MISSING"
```
Result: All FOUND

**Deleted files:**
```bash
[ ! -f "apps/web/app/api/webhooks/clerk/route.ts" ] && echo "DELETED" || echo "STILL EXISTS"
```
Result: DELETED

**Commits:**
```bash
git log --oneline --all | grep -E "(a8e70fb|01735e2)"
```
Result:
- a8e70fb feat(12-08): remove Clerk dependencies and webhook handlers
- 01735e2 feat(12-08): create Clerk to custom auth migration script

## Self-Check: PASSED

All claimed files, modifications, and commits verified.
