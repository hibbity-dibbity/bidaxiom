---
phase: 12-custom-authentication-migration
plan: 01
subsystem: auth
tags: [jwt, jose, argon2, totp, bcrypt, rate-limiting, redis]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: PostgreSQL database, tenant schema pattern
  - phase: 08-quickbooks-integration
    provides: Redis connection pattern for BullMQ
provides:
  - Auth database tables in public schema (users, organizations, memberships, invitations, tokens)
  - JWT access/refresh token signing and verification
  - Argon2id password hashing with bcrypt migration support
  - TOTP MFA with QR codes and backup codes
  - Secure token generation for email verification and password reset
  - Redis-backed rate limiters for auth endpoints
affects: [13-authentication-api, 14-authentication-ui, 15-clerk-migration]

# Tech tracking
tech-stack:
  added: [jose, @node-rs/argon2, otpauth, qrcode, bcryptjs, rate-limiter-flexible, resend, iron-session]
  patterns: [JWT HS256, Argon2id OWASP config, TOTP SHA1, SHA-256 token hashing, Redis rate limiting]

key-files:
  created:
    - apps/api/src/auth/jwt.ts
    - apps/api/src/auth/password.ts
    - apps/api/src/auth/mfa.ts
    - apps/api/src/auth/tokens.ts
    - apps/api/src/auth/rate-limit.ts
  modified:
    - apps/api/src/db/schema/public.ts
    - apps/api/src/tenant/provision.ts
    - apps/api/package.json
    - apps/web/package.json

key-decisions:
  - "jose over jsonwebtoken: ESM-native, Edge-compatible, no algorithm confusion CVEs"
  - "Argon2id over bcrypt for new passwords: OWASP recommended, 19 MiB memory cost"
  - "bcrypt verification support: Migration path from Clerk bcrypt hashes, rehash to Argon2id on login"
  - "otpauth over speakeasy: Active maintenance (speakeasy unmaintained 7+ years)"
  - "SHA-256 for tokens, Argon2id for passwords: High-entropy tokens don't need slow hashing"
  - "Redis rate limiting with fail-open: Non-fatal fallback when Redis unavailable"

patterns-established:
  - "JWT payload: userId (sub), orgId, orgRole, hasMfa for access tokens"
  - "Refresh token families: familyId tracks token rotation chains for reuse detection"
  - "TOTP window: ±30 seconds (window=1) for clock drift tolerance"
  - "Backup codes: 10 codes, Argon2id hashed, one-time use"
  - "Token hashing: plaintext sent to user, SHA-256 hash stored in DB"
  - "Rate limiting: login (username+IP), registration (IP), refresh (userId)"

# Metrics
duration: 4 min
completed: 2026-02-14
---

# Phase 12 Plan 01: Custom Authentication Foundation Summary

**Complete auth foundation with JWT, Argon2id password hashing, TOTP MFA, secure tokens, and Redis rate limiting**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-14T05:54:53Z
- **Completed:** 2026-02-14T05:59:29Z
- **Tasks:** 2 completed
- **Files modified:** 12

## Accomplishments

- Installed 8 auth dependencies (jose, @node-rs/argon2, otpauth, nanoid, qrcode, rate-limiter-flexible, resend, bcryptjs)
- Created 7 auth tables in public schema with proper indexes and foreign keys
- Built 5 auth utility modules with OWASP-compliant security configurations
- Established migration path from Clerk (bcrypt verification, clerkUserId/clerkOrgId tracking columns)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install auth dependencies and create auth database schema** - `3f4b606` (feat)
   - Installed jose, @node-rs/argon2, otpauth, nanoid, qrcode, rate-limiter-flexible, resend, bcryptjs
   - Added 7 auth tables to public.ts (users, organizations, organization_memberships, organization_invitations, refresh_tokens, email_verification_tokens, password_reset_tokens)
   - Created provisionAuthTables() function for one-time setup

2. **Task 2: Create auth utility modules** - `c01c744` (feat)
   - jwt.ts: HS256 signing/verification with 15-min access and 7-day refresh tokens
   - password.ts: Argon2id hashing (19 MiB, 2 iterations, 1 thread) + bcrypt migration
   - mfa.ts: TOTP generation/verification with QR codes and 10 Argon2id-hashed backup codes
   - tokens.ts: nanoid token generation with SHA-256 hashing for DB storage
   - rate-limit.ts: Redis-backed limiters (5/15min login, 3/hour registration, 10/min refresh)

**Plan metadata:** (committed in final step)

## Files Created/Modified

### Created (5 files)
- `apps/api/src/auth/jwt.ts` - JWT access/refresh token signing and verification using jose
- `apps/api/src/auth/password.ts` - Argon2id password hashing with bcrypt migration support
- `apps/api/src/auth/mfa.ts` - TOTP MFA with QR code generation and backup codes
- `apps/api/src/auth/tokens.ts` - Secure random token generation with SHA-256 hashing
- `apps/api/src/auth/rate-limit.ts` - Redis-backed rate limiters with graceful fallback

### Modified (7 files)
- `apps/api/src/db/schema/public.ts` - Added 7 auth tables with indexes and foreign keys
- `apps/api/src/tenant/provision.ts` - Added provisionAuthTables() for one-time auth setup
- `apps/api/package.json` - Added auth dependencies
- `apps/web/package.json` - Added iron-session for future session management
- `package-lock.json` - Updated with new dependencies

## Decisions Made

1. **jose over jsonwebtoken**: ESM-native, no algorithm confusion CVEs (CVE-2022-23529), Edge-compatible for serverless deployment
2. **Argon2id over bcrypt**: OWASP recommended winner of Password Hashing Competition, 19 MiB memory cost prevents GPU attacks
3. **bcrypt verification support**: Clerk uses bcrypt - verify existing hashes, rehash to Argon2id on successful login
4. **otpauth over speakeasy**: Active maintenance (speakeasy unmaintained 7+ years), better TypeScript support
5. **SHA-256 for tokens, not Argon2id**: High-entropy random tokens (nanoid 32 chars = 191 bits entropy) don't need slow hashing; SHA-256 is fast for lookups
6. **Redis rate limiting with fail-open**: Non-fatal when Redis unavailable (logs warning, allows request) - availability over perfect security

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all dependencies installed successfully, TypeScript compiled cleanly (pre-existing drizzle-orm and Phase 11 calendar errors are unrelated).

## User Setup Required

None - no external service configuration required. Auth tables will be provisioned when provisionAuthTables() is called during server initialization (Plan 02).

## Next Phase Readiness

**Ready for 12-02-PLAN.md (Authentication tRPC Router)**

Foundation is complete:
- ✅ Auth tables defined in schema
- ✅ JWT signing/verification ready
- ✅ Password hashing ready (Argon2id + bcrypt migration)
- ✅ MFA generation/verification ready
- ✅ Token generation ready
- ✅ Rate limiters configured

Next plan will create tRPC procedures for:
- Registration with email verification
- Login with MFA support
- Password reset flow
- Organization invitation acceptance
- Session management with refresh token rotation

---
*Phase: 12-custom-authentication-migration*
*Completed: 2026-02-14*

## Self-Check: PASSED

**Files verified:**
- ✅ apps/api/src/auth/jwt.ts
- ✅ apps/api/src/auth/password.ts
- ✅ apps/api/src/auth/mfa.ts
- ✅ apps/api/src/auth/tokens.ts
- ✅ apps/api/src/auth/rate-limit.ts

**Commits verified:**
- ✅ 3f4b606 (Task 1: schema and dependencies)
- ✅ c01c744 (Task 2: auth utility modules)
