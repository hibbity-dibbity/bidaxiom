---
phase: 12-custom-authentication-migration
plan: 02
subsystem: auth
tags: [auth, jwt, email, rate-limiting, mfa, resend, argon2id]

# Dependency graph
requires:
  - phase: 12-01
    provides: JWT utilities, password hashing, MFA, tokens, rate limiting
provides:
  - Complete auth API with 9 procedures covering registration, login, refresh, email verification, password reset, MFA setup, and org switching
  - Email service for transactional emails (verification, password reset, invitations)
  - Rate-limited auth endpoints to prevent brute-force attacks
  - Refresh token rotation with family-based reuse detection
affects: [12-03, 12-04, 12-05]

# Tech tracking
tech-stack:
  added: [resend]
  patterns: [email service with dev fallback, auth router with manual token verification for protected endpoints]

key-files:
  created:
    - apps/api/src/services/email.ts
    - apps/api/src/trpc/routers/auth.ts
  modified:
    - apps/api/src/trpc/router.ts

key-decisions:
  - "Resend for email delivery with console fallback in dev mode (allows development without email service)"
  - "Manual access token verification for setupMfa/verifyMfaSetup/switchOrganization (existing protectedProcedure uses Clerk)"
  - "Email enumeration prevention in requestPasswordReset (always return success message)"
  - "Force re-login after password reset (revoke all refresh tokens for security)"
  - "Organization invitation acceptance during registration (seamless onboarding flow)"

patterns-established:
  - "Email service pattern: Lazy Resend client initialization with dev fallback logging"
  - "Auth procedure pattern: Manual token verification until Clerk is fully replaced"
  - "Rate limiting pattern: Fail-open when Redis unavailable (logs warning, allows request)"

# Metrics
duration: 3 min
completed: 2026-02-14
---

# Phase 12 Plan 02: Auth API and Email Service Summary

**Complete authentication API with 9 tRPC procedures covering registration, login, token refresh, email verification, password reset, MFA setup, and organization switching, plus Resend-based email service with dev fallback**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-14T06:02:49Z
- **Completed:** 2026-02-14T06:06:35Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Auth router with complete authentication lifecycle (register, login, refresh, verify email, reset password, MFA setup/verify, org switch)
- Email service using Resend for transactional emails (verification, password reset, invitations)
- Rate limiting on sensitive endpoints (login 5/15min, registration 3/hr, refresh 10/min)
- Refresh token rotation with family-based reuse detection (prevents token replay attacks)
- Bcrypt to Argon2id password migration on login
- Organization invitation acceptance flow integrated with registration

## Task Commits

Each task was committed atomically:

1. **Task 1: Create email service and auth tRPC router** - `4a35458` (feat)
2. **Task 2: Register auth router in app router** - `0a899b7` (feat)

## Files Created/Modified

- `apps/api/src/services/email.ts` - Email service with Resend integration and dev fallback
- `apps/api/src/trpc/routers/auth.ts` - Auth router with 9 procedures covering complete auth lifecycle
- `apps/api/src/trpc/router.ts` - Registered auth router in app router

## Decisions Made

1. **Resend for email delivery:** Industry-standard email service with generous free tier. Dev fallback logs to console when RESEND_API_KEY not configured (allows development without email service).

2. **Manual token verification for protected auth endpoints:** setupMfa, verifyMfaSetup, and switchOrganization manually verify access token from Authorization header since existing protectedProcedure uses Clerk (will be replaced in Plan 03).

3. **Email enumeration prevention:** requestPasswordReset always returns success message even if user doesn't exist (prevents attackers from discovering valid email addresses).

4. **Force re-login after password reset:** Revoke all refresh tokens for user when password is reset (security best practice - ensures compromised session tokens can't be used after password change).

5. **Organization invitation acceptance during registration:** If invitationToken provided at registration, automatically accept the invitation and create organization membership (seamless onboarding flow).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all procedures implemented and registered successfully.

## User Setup Required

**External services require manual configuration.** The following environment variables should be configured:

- `RESEND_API_KEY` - Resend API key for email delivery (optional in dev - falls back to console logging)
- `EMAIL_FROM` - From email address for transactional emails (defaults to noreply@constructionmgmt.app)
- `NEXT_PUBLIC_APP_URL` - Application URL for email links (defaults to http://localhost:3000)

## Next Phase Readiness

Ready for Plan 03 (Protected Procedure Migration). Auth router is complete and registered. Next step: Replace Clerk-based protectedProcedure with custom JWT verification using the auth foundation from Plans 01-02.

## Self-Check: PASSED

All created files verified on disk:
- ✓ apps/api/src/services/email.ts
- ✓ apps/api/src/trpc/routers/auth.ts

All commits verified in git history:
- ✓ 4a35458 (Task 1)
- ✓ 0a899b7 (Task 2)

---
*Phase: 12-custom-authentication-migration*
*Completed: 2026-02-14*
