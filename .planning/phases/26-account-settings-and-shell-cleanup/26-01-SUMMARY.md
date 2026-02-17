---
phase: 26-account-settings-and-shell-cleanup
plan: 01
subsystem: auth
tags: [trpc, jwt, argon2id, password, mfa, bearer-token]

# Dependency graph
requires:
  - phase: auth
    provides: verifyPassword, hashPassword, verifyAccessToken, users table, refreshTokens table
provides:
  - auth.changePassword mutation (Bearer token auth, verifies current password, revokes refresh tokens)
  - auth.disableMfa mutation (Bearer token auth, verifies password, nulls out MFA fields)
affects:
  - 26-02 (account settings UI that wires up these mutations)
  - 26-03 (any shell cleanup that touches auth routing)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Manual Bearer token extraction: authHeader?.replace('Bearer ', '') + verifyAccessToken"
    - "Password verification before sensitive mutation (changePassword, disableMfa)"
    - "Refresh token revocation on password change for multi-device security"

key-files:
  created: []
  modified:
    - apps/api/src/trpc/routers/auth.ts

key-decisions:
  - "Revoke all refresh tokens on password change (force re-login on other devices) but not on MFA disable — matches plan spec intentionally"
  - "Both mutations use manual Bearer token pattern (same as setupMfa/verifyMfaSetup) rather than ctx.userId — consistent with existing auth router conventions"
  - "newPassword uses same validation constraints as register/resetPassword (min 8, uppercase, lowercase, digit)"

patterns-established:
  - "Auth-required mutations in publicProcedure router: extract Authorization header, call verifyAccessToken, then operate"

requirements-completed:
  - ACCT-03
  - ACCT-02

# Metrics
duration: 2min
completed: 2026-02-17
---

# Phase 26 Plan 01: Account Settings Auth Mutations Summary

**auth.changePassword and auth.disableMfa mutations added to authRouter using manual Bearer token verification, password confirmation gates, and argon2id re-hashing**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-17T22:29:07Z
- **Completed:** 2026-02-17T22:30:37Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added `auth.changePassword` mutation: verifies current password before updating hash to argon2id, then revokes all refresh tokens so other devices are forced to re-authenticate
- Added `auth.disableMfa` mutation: checks MFA is enabled, requires password confirmation, sets `mfaEnabled=false` and nulls `mfaSecret`/`mfaBackupCodes`
- Both mutations follow the identical Bearer token extraction pattern already established by `setupMfa` and `verifyMfaSetup`
- TypeScript compiles cleanly in auth.ts — zero new errors introduced

## Task Commits

Each task was committed atomically:

1. **Tasks 1 & 2: changePassword and disableMfa mutations** - `aef3987` (feat) — both mutations implemented in a single atomic edit since they share the same file and pattern

**Plan metadata:** committed with SUMMARY below

_Tasks 1 and 2 were committed together as a single atomic change since both mutations were added to auth.ts in one coordinated edit._

## Files Created/Modified

- `apps/api/src/trpc/routers/auth.ts` - Added `changePassword` (lines 699-782) and `disableMfa` (lines 785-879) mutations to `authRouter`

## Decisions Made

- Revoke all refresh tokens on `changePassword` but not on `disableMfa` — matches the plan specification. Rationale: changing a password is a credential rotation event that invalidates all sessions; disabling MFA is a settings change that does not require forcing re-login.
- Used the same manual Bearer token extraction pattern (`authHeader?.replace("Bearer ", "")` + `verifyAccessToken`) as the existing `setupMfa`/`verifyMfaSetup` procedures, not the `ctx.userId` approach used by `switchOrganization` — for internal consistency within the auth router.
- `newPassword` validation mirrors the constraints in `register` and `resetPassword` exactly (min 8 chars, one uppercase, one lowercase, one digit).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors exist in other files (`bid.ts`, `bidGeneration.ts`, `estimateLifecycle.ts`, `check-search-data.ts`, `quickbooks/oauth.ts`) — all unrelated to auth.ts and out of scope per deviation rule scope boundary. No errors were introduced by this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `auth.changePassword` and `auth.disableMfa` are live in the API and ready for the account settings UI (Plan 26-02) to wire up
- No blockers — mutations follow established patterns, TypeScript clean

---
*Phase: 26-account-settings-and-shell-cleanup*
*Completed: 2026-02-17*
