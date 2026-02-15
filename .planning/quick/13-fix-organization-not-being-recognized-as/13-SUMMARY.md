---
phase: quick-13
plan: 01
subsystem: auth
tags: [bugfix, session-management, iron-session, cookie-persistence]
dependency_graph:
  requires: []
  provides:
    - "Reliable organization context persistence after creation"
    - "Explicit session cookie setting via iron-session sealData"
    - "Dashboard safety net with user-visible error handling"
  affects:
    - apps/web/lib/session.ts
    - apps/web/app/api/auth/switch-org/route.ts
    - apps/web/app/(dashboard)/onboarding/page.tsx
    - apps/web/app/(dashboard)/page.tsx
tech_stack:
  added: []
  patterns:
    - "Manual cookie sealing/unsealing with iron-session"
    - "Explicit NextResponse cookie setting for Route Handlers"
    - "Safety net with user-visible error feedback"
key_files:
  created: []
  modified:
    - path: apps/web/lib/session.ts
      purpose: "Add getSessionFromRequest/setSessionCookie helpers for Route Handlers"
    - path: apps/web/app/api/auth/switch-org/route.ts
      purpose: "Use explicit cookie setting to ensure persistence"
    - path: apps/web/app/(dashboard)/onboarding/page.tsx
      purpose: "Remove debug logging"
    - path: apps/web/app/(dashboard)/page.tsx
      purpose: "Improve safety net with error handling"
    - path: apps/web/lib/auth-context.tsx
      purpose: "Remove debug logging"
    - path: apps/web/app/layout.tsx
      purpose: "Remove debug logging"
    - path: apps/web/lib/auth.ts
      purpose: "Remove debug logging"
decisions: []
metrics:
  duration: 3 min
  tasks_completed: 2
  files_modified: 7
  commits: 2
completed_date: 2026-02-15
---

# Quick Task 13: Fix Organization Not Being Recognized After Signup

**One-liner:** Explicit iron-session cookie sealing and setting on NextResponse fixes org context persistence after signup

## Problem

After creating an organization during onboarding, the session cookie with orgId/orgName/orgRole was not persisting across the redirect to the dashboard. This caused:
- Top bar showing "Select organization" instead of the company name
- Company Profile being read-only instead of editable with admin permissions
- Users needing to manually switch organizations after creating their first one

## Root Cause

iron-session v8's `session.save()` calls `cookies().set()` from `next/headers`, which does not reliably propagate Set-Cookie headers to the actual HTTP response in Next.js 14.x Route Handlers. The login route worked because it runs during initial auth where the session is established and subsequent requests pick up the cookie through separate API calls. The switch-org route failed because it needed the cookie to be immediately available on the very next full page navigation.

## Solution

### Task 1: Explicit Session Cookie Persistence

Added two new helpers to `apps/web/lib/session.ts`:

1. **`getSessionFromRequest(request: Request)`**: Reads and unseals the session cookie directly from the request headers using iron-session's `unsealData`, bypassing the `cookies()` API entirely.

2. **`setSessionCookie(response: NextResponse, data: SessionData)`**: Seals the session data using iron-session's `sealData` and explicitly sets the cookie on the NextResponse object via `response.cookies.set()`.

Updated `apps/web/app/api/auth/switch-org/route.ts` to:
- Read the current session using `getSessionFromRequest(request)` to get the access token
- Build complete updated session data (preserving existing fields, updating org fields)
- Create NextResponse and call `setSessionCookie(res, updatedSession)` to set the cookie explicitly
- Remove all debug logging

### Task 2: Clean Up Debug Logging and Improve Safety Net

Removed all `[DEBUG ORG-FLOW]` console.log statements from:
- `apps/web/app/(dashboard)/onboarding/page.tsx`
- `apps/web/app/(dashboard)/page.tsx`
- `apps/web/lib/auth-context.tsx`
- `apps/web/app/layout.tsx`
- `apps/web/lib/auth.ts`

Improved dashboard safety net in `apps/web/app/(dashboard)/page.tsx`:
- Replaced `useRef` guard with `useState` for `isActivating` flag
- Added explicit error handling for switch-org failures
- Added user-visible error messages via toast when safety net fails
- Direct fetch to `/api/auth/switch-org` followed by `window.location.reload()` on success

## Deviations from Plan

None - plan executed exactly as written.

## Commits

- `8b5704e`: fix(quick-13): explicit session cookie persistence in switch-org route
- `3fac31f`: fix(quick-13): improve dashboard safety net and remove debug logging

## Self-Check

Verified changes:

```bash
# Files exist and were modified
[FOUND] apps/web/lib/session.ts (modified with new helpers)
[FOUND] apps/web/app/api/auth/switch-org/route.ts (modified to use new helpers)
[FOUND] apps/web/app/(dashboard)/onboarding/page.tsx (debug logging removed)
[FOUND] apps/web/app/(dashboard)/page.tsx (safety net improved)
[FOUND] apps/web/lib/auth-context.tsx (debug logging removed)
[FOUND] apps/web/app/layout.tsx (debug logging removed)
[FOUND] apps/web/lib/auth.ts (debug logging removed)

# Commits exist
[FOUND] 8b5704e
[FOUND] 3fac31f

# Debug logging removed
[VERIFIED] grep -r "DEBUG ORG-FLOW" apps/web/ returns no results

# TypeScript compiles
[VERIFIED] No errors in modified files (pre-existing errors in other files unchanged)
```

## Self-Check: PASSED

All files modified as planned. Both commits exist. Debug logging completely removed. TypeScript compiles without new errors.
