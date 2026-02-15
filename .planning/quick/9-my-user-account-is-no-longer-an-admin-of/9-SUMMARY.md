---
phase: quick-9
plan: 01
subsystem: auth
tags: [database, user-roles, admin, organization-memberships]

# Dependency graph
requires:
  - phase: 12-custom-authentication-migration
    provides: Custom user/org tables, JWT auth system
provides:
  - Admin role restoration script for account recreation scenarios
affects: [auth, organization-management]

# Tech tracking
tech-stack:
  added: []
  patterns: [Database role synchronization across multiple tables]

key-files:
  created: [apps/api/src/fix-admin-role.ts]
  modified: []

key-decisions:
  - "Script updates three tables for role consistency: organization_memberships, user_company_mappings, and tenant user_profiles"
  - "Cleanup of orphaned memberships from deleted user accounts"

patterns-established:
  - "Multi-table role update pattern: Ensure consistency across public schema and tenant schema user roles"

# Metrics
duration: 1min
completed: 2026-02-14
---

# Quick Task 9: User Admin Role Restoration Summary

**Database script to restore org:admin role after account deletion and recreation, updating organization_memberships, user_company_mappings, and tenant user_profiles**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-14T21:23:52Z
- **Completed:** 2026-02-14T21:25:19Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created fix-admin-role.ts script to restore admin role after user account recreation
- Script updates all three role-related tables for consistency
- Includes cleanup of orphaned memberships from deleted user accounts
- Successfully restored org:admin role for current user

## Task Commits

Each task was committed atomically:

1. **Task 1: Create and run admin role fix script** - `2645d7d` (fix)

## Files Created/Modified
- `apps/api/src/fix-admin-role.ts` - Script to restore admin role across all tables and clean up orphaned memberships

## Decisions Made

**1. Multi-table update approach**
- Updated three tables for role consistency: organization_memberships (used for JWT orgRole), user_company_mappings (legacy multi-org mapping), and tenant schema user_profiles (tenant-level permissions)
- Ensures user has admin access at all levels of the system

**2. Orphaned membership cleanup**
- Script deletes organization_memberships rows where user_id no longer exists in users table
- Prevents data integrity issues from deleted/recreated accounts

**3. UPSERT pattern for idempotency**
- Script uses INSERT...ON CONFLICT for organization_memberships
- Allows script to be run multiple times without errors

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - script ran successfully on first execution.

## Root Cause Analysis

The issue occurred because when the user deleted and recreated their account:
1. The new user record received a new UUID (9088e97a-24ee-4000-9ce0-f707523a9d36)
2. The old organization_memberships row (linked to the old UUID) became orphaned
3. On login, the auth.ts router reads membership.role to populate JWT orgRole (line 273)
4. With no membership or a default org:member role, the JWT contained org:member
5. CASL abilities use orgRole from JWT, so org:member had read-only permissions everywhere

The fix restored org:admin in all three tables, ensuring consistent admin access.

## User Action Required

After running the script:
1. Log out of the application
2. Log back in
3. The JWT will be refreshed with the updated org:admin role
4. Company Profile should now show full edit access (no "Read-only access" banner)

## Next Phase Readiness

This was a standalone fix. No impact on ongoing development.

## Self-Check: PASSED

All claims verified:
- File exists: apps/api/src/fix-admin-role.ts
- Commit exists: 2645d7d

---
*Phase: quick-9*
*Completed: 2026-02-14*
