---
phase: 25-session-and-auth-flow
plan: 01
subsystem: auth
tags: [next.js, server-components, mfa, redirect, session]

# Dependency graph
requires:
  - phase: 12-custom-auth
    provides: Custom JWT auth system with MFA support
provides:
  - getSafeRedirectUrl() utility for validated relative-URL redirects
  - sign-in page as Server Component reading searchParams (no CSR bailout)
  - SignInForm client component receiving redirectUrl as prop
  - MFA setup page forwarding redirect_url through completion flow
affects: [26-session-expiry, auth, sign-in, mfa-setup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server Component wrapper + Client Component form extraction pattern
    - Suspense boundary for useSearchParams in client components
    - Discriminated union narrowing with `in` operator for TRPC response types

key-files:
  created:
    - apps/web/lib/utils/safe-redirect.ts
    - apps/web/app/(auth)/sign-in/[[...sign-in]]/sign-in-form.tsx
  modified:
    - apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx
    - apps/web/app/(auth)/mfa-setup/page.tsx

key-decisions:
  - "Thin Server Component page.tsx reads searchParams.redirect_url and passes as prop — eliminates useSearchParams CSR bailout in production"
  - "getSafeRedirectUrl blocks external URLs, protocol-relative attacks, backslash bypasses, and sign-in loopbacks"
  - "MFA setup wraps inner component in Suspense so useSearchParams works without production bailout"

patterns-established:
  - "Server Component wrapper + Client Component extraction: page.tsx reads searchParams, passes props to *-form.tsx"
  - "getSafeRedirectUrl gate: all router.push() calls for post-auth redirect use getSafeRedirectUrl()"
  - "TRPC union narrowing: use `in` operator to check discriminant key before accessing branch-specific fields"

requirements-completed: [SESS-02]

# Metrics
duration: 8min
completed: 2026-02-17
---

# Phase 25 Plan 01: Session and Auth Flow — Redirect Preservation Summary

**Sign-in page converted to Server Component with safe redirect validation; MFA flow now preserves the original destination URL through setup completion.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-17T21:45:30Z
- **Completed:** 2026-02-17T21:53:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Eliminated Next.js 14 production CSR bailout by extracting `useSearchParams` from `page.tsx` into a thin Server Component
- Created `getSafeRedirectUrl()` helper blocking open-redirect attacks (external URLs, protocol-relative, backslash bypass, sign-in loop)
- MFA enforcement flow now routes to `/mfa-setup?redirect_url=...` so users land at their original destination after MFA setup

## Task Commits

Each task was committed atomically:

1. **Task 1: Create getSafeRedirectUrl helper and extract SignInForm client component** - `080d9cc` (feat)
2. **Task 2: Convert sign-in page to Server Component and update mfa-setup to forward redirect_url** - `a672f71` (feat)

## Files Created/Modified
- `apps/web/lib/utils/safe-redirect.ts` - getSafeRedirectUrl() validates redirect URLs are safe relative paths
- `apps/web/app/(auth)/sign-in/[[...sign-in]]/sign-in-form.tsx` - Extracted "use client" form component, receives redirectUrl as prop
- `apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx` - Thin Server Component reading searchParams.redirect_url (no useSearchParams)
- `apps/web/app/(auth)/mfa-setup/page.tsx` - Reads redirect_url from search params, wrapped in Suspense, forwards through handleComplete

## Decisions Made
- Server Component + Client Component extraction pattern chosen over Suspense wrapper on the sign-in page itself — cleaner separation and avoids a loading flash on the sign-in form
- getSafeRedirectUrl allows only `/`-prefixed paths, blocking `//`, `/\`, and `/sign-in` prefixes specifically
- MFA setup page uses Suspense wrapper (inner function + outer wrapper export) since it is already fully client-side and adding Suspense keeps it in the same file

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TRPC discriminated union type narrowing in sign-in-form.tsx**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** The auth.login mutation returns a union `{ requiresMfa: boolean; userId: string } | { accessToken: string; ... }`. Accessing `result.requiresMfa`, `result.user`, and `result.org` without narrowing caused TypeScript errors. These errors pre-existed in `page.tsx` (confirmed) but would carry into the extracted component.
- **Fix:** Added `"requiresMfa" in result` check for the MFA branch and `"accessToken" in result` guard for the authenticated branch. Added `eslint-disable` comment for the `error.cause` cast on the TRPCClientErrorLike.
- **Files modified:** apps/web/app/(auth)/sign-in/[[...sign-in]]/sign-in-form.tsx
- **Verification:** `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep sign-in-form` — no output (clean)
- **Committed in:** 080d9cc (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type narrowing bug)
**Impact on plan:** Fix required for TypeScript correctness; aligns with plan's "No TypeScript errors in these files" done criterion. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in `apps/api/` files (intuit-oauth, bidGeneration, estimateLifecycle, bid.ts) — out of scope, logged to deferred-items per deviation rules.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SESS-02 complete: redirect preservation works end-to-end for sign-in and MFA setup flows
- Ready for Phase 25 plan 02 (session expiry detection or next requirement in phase)
- Middleware already injects `?redirect_url={pathname}` — no changes needed there

---
*Phase: 25-session-and-auth-flow*
*Completed: 2026-02-17*
