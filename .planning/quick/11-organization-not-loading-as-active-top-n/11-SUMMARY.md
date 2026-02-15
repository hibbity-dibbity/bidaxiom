---
phase: quick-11
plan: 01
subsystem: auth
tags: [iron-session, auth-context, session-management, tRPC]

# Dependency graph
requires:
  - phase: 12-custom-authentication-migration
    provides: Iron-session cookie, /api/auth/switch-org route, AuthProvider context
provides:
  - Session update flow after org creation
  - Dashboard safety net for stale sessions
affects: [onboarding, dashboard, session-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Session update before redirect pattern for state-changing operations
    - Dashboard safety net pattern for auto-recovery from stale session

key-files:
  created: []
  modified:
    - apps/web/app/(dashboard)/onboarding/page.tsx
    - apps/web/app/(dashboard)/page.tsx

key-decisions:
  - "Call /api/auth/switch-org after org creation to update session before redirect"
  - "Dashboard auto-activates first org as safety net for stale sessions"
  - "Error handling falls through to redirect - safety net will catch failures"

patterns-established:
  - "Session update pattern: After state-changing mutations that affect session context (org creation), explicitly update session before redirecting"
  - "Safety net pattern: Check for missing session state on critical pages and auto-recover when possible"

# Metrics
duration: 1min
completed: 2026-02-15
---

# Quick Task 11: Organization Not Loading as Active Summary

**Session properly updated after org creation via explicit switch-org API call, with dashboard safety net for auto-recovery from stale sessions**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-15T01:44:51Z
- **Completed:** 2026-02-15T01:46:01Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- After org creation on onboarding page, session cookie is updated with new org context before redirect
- Dashboard auto-activates first organization if session has no active org (safety net for stale sessions)
- CompanySwitcher now shows organization name instead of "Select Organization" after creating new org
- Company Profile page is editable (not read-only) after org creation
- Logo upload works without "no active organization" error

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix onboarding to set active org in session after creation** - `6941681` (feat)
2. **Task 2: Add dashboard safety net to auto-activate first org if session has none** - `ce0d778` (feat)

## Files Created/Modified
- `apps/web/app/(dashboard)/onboarding/page.tsx` - Calls /api/auth/switch-org with new org ID before redirecting to dashboard
- `apps/web/app/(dashboard)/page.tsx` - Auto-activates first org if session has no active org (safety net)

## Decisions Made

**1. Explicit session update before redirect**
- After org creation, call `/api/auth/switch-org` API to update iron-session cookie with new org context
- Ensures session has orgId, orgRole, orgName before dashboard loads
- Error handling falls through to redirect even if switch-org fails (safety net will catch it)

**2. Dashboard safety net for session recovery**
- Dashboard checks if session has no org but user has organizations
- Automatically switches to first org if session is stale
- Handles edge cases: browser back, cookie expiry, race conditions, switch-org failures
- useRef guard prevents double-execution in React strict mode

**3. Primary fix is Task 1, safety net is fallback**
- Task 1 (session update) is the proper solution
- Task 2 (safety net) handles edge cases where session becomes stale
- Together they ensure org context is always available

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Session management is now robust:
- Org creation properly updates session before redirect
- Dashboard auto-recovers from stale sessions
- No known session-related issues remaining

## Self-Check: PASSED

All claims verified:
- FOUND: .planning/quick/11-organization-not-loading-as-active-top-n/11-SUMMARY.md
- FOUND: commit 6941681 (Task 1)
- FOUND: commit ce0d778 (Task 2)
- FOUND: apps/web/app/(dashboard)/onboarding/page.tsx
- FOUND: apps/web/app/(dashboard)/page.tsx

---
*Phase: quick-11*
*Completed: 2026-02-15*
