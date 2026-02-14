# Phase 12: Custom Authentication Migration - Research

**Researched:** 2026-02-13
**Domain:** Custom JWT-based authentication system, session management, password hashing, MFA/TOTP, multi-tenant user management
**Confidence:** MEDIUM

## Summary

Replacing Clerk with a custom authentication system requires implementing multiple complex security subsystems: JWT token generation/verification, password hashing with Argon2id, TOTP-based MFA, refresh token rotation, email verification, password reset flows, session management, rate limiting, and multi-tenant organization/invitation management. The current codebase already has the multi-tenant infrastructure (schema-per-tenant PostgreSQL, CASL RBAC) and can reuse these patterns.

The migration is high-risk due to authentication security complexity. Success depends on following established security patterns (OWASP guidelines, proven libraries), comprehensive testing, and careful data migration from Clerk without losing existing user sessions or organization memberships.

**Primary recommendation:** Use battle-tested libraries (jose for JWT, @node-rs/argon2 for passwords, otpauth for TOTP) and implement defense-in-depth with rate limiting, refresh token rotation, and server-side verification at every layer.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jose | ^5.9.6 | JWT sign/verify, JWE encryption | OWASP-recommended, zero dependencies, modern ESM, supports all standard algorithms (RS256, ES256, EdDSA), works across all runtimes |
| @node-rs/argon2 | ^2.0.0 | Password hashing | OWASP top choice for 2026, winner of Password Hashing Competition, native bindings (faster than pure JS), configurable memory/CPU cost, resistant to GPU attacks |
| otpauth | ^9.3.7 | TOTP MFA generation/verification | Active maintenance (speakeasy is abandoned 7+ years), generates Google Authenticator-compatible QR codes, RFC 6238 compliant |
| iron-session | ^8.0.3 | Encrypted stateless sessions | Next.js official recommendation, encrypted cookies (no DB lookups), works with App Router and Server Actions, stateless (scales horizontally) |
| resend | ^4.2.3 | Transactional emails | Developer-focused API, React email templates, 3000 free emails/month, better DX than Nodemailer, SMTP fallback available |
| rate-limiter-flexible | ^6.0.0 | Rate limiting, brute-force protection | Redis-backed, progressive delays, reuse detection, proven in production, handles distributed systems |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| qrcode | ^1.5.4 | QR code generation for TOTP | MFA setup - generates scannable codes for authenticator apps |
| nanoid | ^5.0.9 | Secure token generation | Email verification tokens, password reset tokens - cryptographically random, URL-safe |
| zod | ^3.25.76 (existing) | Input validation | Already in use - extend for auth schemas (email format, password strength) |
| drizzle-orm | ^0.45.1 (existing) | Database queries | Already in use - extend schema for auth tables |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jose | jsonwebtoken | jsonwebtoken has known security issues (algorithm confusion), slower, larger bundle, not ESM-native |
| @node-rs/argon2 | bcrypt | bcrypt only uses 4KB memory (vulnerable to GPU attacks), 72-byte password truncation, OWASP recommends Argon2 for new systems |
| otpauth | speakeasy | speakeasy is unmaintained (7+ years old), otpauth is actively developed with better TypeScript support |
| iron-session | next-auth | next-auth adds OAuth complexity not needed, heavier dependency tree, iron-session is simpler for custom auth |
| resend | nodemailer + SMTP | nodemailer requires more boilerplate, inconsistent delivery with Gmail, resend has better DX and deliverability |

**Installation:**
```bash
# API dependencies
cd apps/api
npm install jose @node-rs/argon2 otpauth nanoid qrcode rate-limiter-flexible resend

# Web dependencies
cd apps/web
npm install iron-session
npm uninstall @clerk/nextjs @clerk/backend
```

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
├── auth/
│   ├── jwt.ts              # JWT sign/verify using jose
│   ├── password.ts         # Argon2 hash/verify
│   ├── mfa.ts              # TOTP generation/verification
│   ├── tokens.ts           # Verification/reset tokens (nanoid)
│   ├── sessions.ts         # Refresh token rotation logic
│   └── rate-limit.ts       # Rate limiters for auth endpoints
├── trpc/routers/
│   └── auth.ts             # Auth tRPC router
├── db/schema/
│   └── auth.sql            # Auth tables schema
└── services/
    └── email.ts            # Resend email service

apps/web/
├── app/(auth)/
│   ├── sign-in/
│   ├── sign-up/
│   ├── verify-email/
│   ├── reset-password/
│   └── mfa-setup/
├── lib/
│   └── session.ts          # iron-session config
└── middleware.ts           # Replace Clerk middleware
```

### Pattern 1: JWT Access + Refresh Token Rotation
**What:** Short-lived JWT access tokens (15 min) paired with long-lived refresh tokens (7 days) that rotate on each use.
**When to use:** All authenticated requests. Balances security (short access token lifespan) with UX (don't force re-login every 15 min).
**Example:**
```typescript
// Source: jose official docs + OWASP best practices
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const JWT_REFRESH_SECRET = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET);

export async function signAccessToken(payload: { userId: string; orgId: string; orgRole: string }) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(JWT_SECRET);
}

export async function signRefreshToken(payload: { userId: string; tokenFamily: string }) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_REFRESH_SECRET);
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as { userId: string; orgId: string; orgRole: string };
}
```

### Pattern 2: Argon2id Password Hashing with OWASP Parameters
**What:** Hash passwords with Argon2id using OWASP minimum configuration (19 MiB memory, 2 iterations, 1 parallelism).
**When to use:** User registration and password changes. Also implement gradual migration from Clerk's bcrypt hashes on first login.
**Example:**
```typescript
// Source: OWASP Password Storage Cheat Sheet + @node-rs/argon2 docs
import { hash, verify } from '@node-rs/argon2';

// OWASP minimum config: 19 MiB memory, 2 iterations, 1 parallelism
const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB in KiB
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return await hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return await verify(hash, password, ARGON2_OPTIONS);
}
```

### Pattern 3: TOTP MFA with Backup Codes
**What:** Generate TOTP secret, create otpauth:// URL for QR code, generate 10 single-use backup codes.
**When to use:** MFA setup flow and login verification.
**Example:**
```typescript
// Source: otpauth NPM docs + OWASP MFA guidelines
import { TOTP, Secret } from 'otpauth';
import QRCode from 'qrcode';
import { nanoid } from 'nanoid';
import { hash } from '@node-rs/argon2';

export async function generateMfaSecret(userEmail: string) {
  const secret = new Secret();
  const totp = new TOTP({
    issuer: 'ConstructionMgmt',
    label: userEmail,
    secret,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });

  const qrCodeDataUrl = await QRCode.toDataURL(totp.toString());

  // Generate 10 backup codes
  const backupCodes = Array.from({ length: 10 }, () => nanoid(10));
  const hashedBackupCodes = await Promise.all(
    backupCodes.map(code => hash(code))
  );

  return {
    secret: secret.base32,
    qrCodeDataUrl,
    backupCodes, // Show once, then discard
    hashedBackupCodes, // Store in DB
  };
}

export function verifyMfaToken(secret: string, token: string): boolean {
  const totp = new TOTP({ secret: Secret.fromBase32(secret) });
  const delta = totp.validate({ token, window: 1 }); // ±1 time step (30s)
  return delta !== null;
}
```

### Pattern 4: Refresh Token Rotation with Reuse Detection
**What:** Each refresh generates new access + refresh token pair, stores refresh token family in Redis, detects token reuse (= compromised).
**When to use:** Token refresh endpoint. Implements automatic breach detection.
**Example:**
```typescript
// Source: Auth0 refresh token rotation guide + rate-limiter-flexible examples
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

interface RefreshTokenMeta {
  userId: string;
  familyId: string;
  previousTokenHash?: string;
  issuedAt: number;
}

export async function rotateRefreshToken(oldRefreshToken: string) {
  const verified = await verifyRefreshToken(oldRefreshToken);
  const tokenHash = createHash('sha256').update(oldRefreshToken).digest('hex');

  // Check if token was already used (reuse detection)
  const used = await redis.get(`refresh:used:${tokenHash}`);
  if (used) {
    // Token reuse detected - revoke entire family
    await redis.del(`refresh:family:${verified.tokenFamily}`);
    throw new Error('Token reuse detected - possible breach');
  }

  // Mark token as used
  await redis.setex(`refresh:used:${tokenHash}`, 7 * 24 * 60 * 60, '1');

  // Generate new token pair
  const newAccessToken = await signAccessToken({
    userId: verified.userId,
    orgId: verified.orgId,
    orgRole: verified.orgRole,
  });

  const newRefreshToken = await signRefreshToken({
    userId: verified.userId,
    tokenFamily: verified.tokenFamily,
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}
```

### Pattern 5: Rate-Limited Auth Endpoints
**What:** Progressive delays on failed login attempts (5 attempts per 15 min), IP-based blocking (100 attempts per day), username+IP combination tracking.
**When to use:** All authentication endpoints (login, password reset, MFA verify).
**Example:**
```typescript
// Source: rate-limiter-flexible GitHub examples + OWASP guidelines
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Max 5 failed attempts per username+IP in 15 minutes
export const loginLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'login_fail',
  points: 5,
  duration: 15 * 60,
  blockDuration: 15 * 60,
});

// Max 100 attempts per IP per day (catches distributed attacks)
export const ipLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'login_ip',
  points: 100,
  duration: 24 * 60 * 60,
  blockDuration: 24 * 60 * 60,
});

export async function checkLoginRateLimit(username: string, ip: string) {
  const usernameIpKey = `${username}_${ip}`;

  try {
    await Promise.all([
      loginLimiter.consume(usernameIpKey),
      ipLimiter.consume(ip),
    ]);
  } catch (err) {
    throw new Error('Too many login attempts. Please try again later.');
  }
}
```

### Anti-Patterns to Avoid
- **Storing JWTs in localStorage:** Vulnerable to XSS attacks. Use httpOnly cookies for refresh tokens, memory for access tokens.
- **No token expiration:** Always set `exp` claim. Access tokens max 15-30 min, refresh tokens max 7-30 days.
- **Weak secrets:** JWT secrets must be 256+ bits random. Never hardcode or commit to git.
- **Timing attacks on password verification:** Always use constant-time comparison (Argon2's verify function handles this).
- **No rate limiting:** Exposes login to brute-force attacks. Must rate-limit by username+IP and IP alone.
- **Plaintext password reset tokens:** Always hash tokens before storing. Send plaintext via email, store hash in DB.
- **Missing CSRF protection:** Use SameSite=Strict cookies + CSRF tokens for state-changing operations.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT generation/verification | Custom crypto or Buffer manipulation | `jose` library | Algorithm confusion attacks, timing attacks, encoding edge cases, key management complexity |
| Password hashing | SHA256, MD5, or custom hashing | `@node-rs/argon2` | GPU brute-force vulnerability, salt management, timing attacks, parameter tuning for security vs performance |
| TOTP generation | Custom HMAC-SHA1 implementation | `otpauth` library | Clock drift handling, time step windows, secret encoding (base32), RFC 6238 compliance, backup code generation |
| Refresh token rotation | Manual token tracking in DB | Redis + `rate-limiter-flexible` + token family pattern | Race conditions, reuse detection, distributed locking, atomic operations, TTL management |
| Rate limiting | In-memory counters or custom DB queries | `rate-limiter-flexible` with Redis | Distributed system support, atomic increments, TTL cleanup, progressive delays, memory leaks in long-running processes |
| Email delivery | Direct SMTP with `nodemailer` | `resend` API | SPF/DKIM/DMARC configuration, deliverability issues, Gmail quota limits, bounce handling, template management |
| Session encryption | Custom AES encryption | `iron-session` | Key rotation, IV generation, authentication (encrypt-then-MAC), cookie size limits, constant-time comparison |
| QR code generation for TOTP | Canvas manipulation or SVG | `qrcode` library | Error correction levels, encoding optimization, data capacity limits, mobile scanner compatibility |

**Key insight:** Authentication is where "roll your own crypto" causes catastrophic failures. Every custom implementation introduces timing attacks, encoding bugs, or algorithm confusion vulnerabilities that attackers actively exploit. Use libraries audited by security researchers.

## Common Pitfalls

### Pitfall 1: Insecure JWT Secret Management
**What goes wrong:** Hardcoding secrets in code, using weak secrets (<32 chars), sharing secrets across environments, committing secrets to git.
**Why it happens:** Convenience during development, lack of awareness of attack surface.
**How to avoid:** Generate 256-bit random secrets (`openssl rand -base64 32`), store in environment variables, use different secrets per environment (dev/staging/prod), rotate secrets periodically.
**Warning signs:** `JWT_SECRET="mysecret"` in code, secrets in `.env` files committed to git, same secret in dev and production.

### Pitfall 2: Token Storage in localStorage
**What goes wrong:** XSS attacks can steal tokens from localStorage. Any injected script can read all localStorage values and exfiltrate to attacker.
**Why it happens:** Convenience (easier than cookie management), tutorials showing localStorage patterns, lack of XSS awareness.
**How to avoid:** Store refresh tokens in httpOnly, Secure, SameSite=Strict cookies. Access tokens can live in memory (lost on page reload) or httpOnly cookies.
**Warning signs:** `localStorage.setItem('token', ...)`, `sessionStorage` for auth tokens, client-side token management.

### Pitfall 3: Missing or Weak Rate Limiting
**What goes wrong:** Attackers brute-force passwords by trying millions of combinations. No rate limit = unlimited attempts.
**Why it happens:** Forgotten during initial implementation, assumed firewall/CDN handles it, complexity of distributed rate limiting.
**How to avoid:** Implement layered rate limiting: username+IP (5/15min), IP alone (100/day), global (10000/hour). Use Redis for distributed systems.
**Warning signs:** Login endpoint has no rate limiting, rate limiting only on frontend, 429 errors never seen in logs, single-threaded in-memory counters.

### Pitfall 4: Incomplete Password Migration from Clerk
**What goes wrong:** Clerk exports bcrypt password hashes, but migration script doesn't handle gradual rehashing. Users stuck with weaker bcrypt hashes forever.
**Why it happens:** Overlooking the "upgrade on next login" pattern, assuming one-time migration is sufficient.
**How to avoid:** Store Clerk bcrypt hashes with `hash_type='bcrypt'` flag. On login: verify with bcrypt, rehash with Argon2id, update DB with `hash_type='argon2id'`. Over time all active users upgrade.
**Warning signs:** All migrated users still have bcrypt hashes after 6 months, no hash type tracking in DB, password verification doesn't check hash type.

### Pitfall 5: TOTP Time Drift Not Handled
**What goes wrong:** User's phone clock is 45 seconds fast. TOTP codes generated don't match server verification. User locked out despite correct MFA setup.
**Why it happens:** Not using verification window, assuming perfect clock synchronization.
**How to avoid:** Use `window: 1` parameter in TOTP verification (accepts ±1 time step = ±30 seconds). For persistent drift, consider `window: 2` but document security tradeoff.
**Warning signs:** MFA verification fails for users with correct codes, no window parameter in verification, rigid 0-window verification.

### Pitfall 6: Refresh Token Reuse Not Detected
**What goes wrong:** Attacker steals refresh token, uses it to get new access token. Legitimate user also uses same token (race condition or attacker didn't revoke). System allows both, attacker maintains access indefinitely.
**Why it happens:** No tracking of used refresh tokens, treating refresh like stateless JWT.
**How to avoid:** Store refresh token hash in Redis with TTL. On use: check if already used (reuse = revoke entire token family), mark as used, issue new token.
**Warning signs:** Refresh tokens can be used multiple times, no Redis tracking, no token family concept, no automatic revocation on suspicious activity.

### Pitfall 7: Email Verification Tokens Stored Plaintext
**What goes wrong:** Database breach exposes verification tokens. Attacker can verify any unverified email, take over accounts.
**Why it happens:** Treating verification tokens like non-sensitive data, storing for debugging convenience.
**How to avoid:** Generate random token with `nanoid`, hash with Argon2id before storing in DB, send plaintext token in email. On verification: hash submitted token, compare with DB hash.
**Warning signs:** `email_verification_tokens` table has plaintext tokens, tokens are sequential/predictable, no hashing before DB insert.

### Pitfall 8: No Organization Invitation Expiration
**What goes wrong:** Invitation links sent 2 years ago still work. Former employees with old emails can join organization.
**Why it happens:** Infinite TTL for convenience, no cleanup job for expired invitations.
**How to avoid:** Set invitation TTL (e.g., 7 days), store `expires_at` timestamp, check on redemption, add cleanup job to delete expired invitations daily.
**Warning signs:** `invitations` table has no `expires_at` column, no cleanup job, invitations from 2020 still redeemable.

### Pitfall 9: CVE-2025-29927 Style Bypass (Middleware-Only Auth)
**What goes wrong:** Relying solely on Next.js middleware for auth. Attacker crafts request that bypasses middleware (trailing slash, URL encoding), directly accesses tRPC endpoints.
**Why it happens:** Trusting middleware as sole security layer, not defense-in-depth.
**How to avoid:** Verify JWT in tRPC context creation (apps/api/src/trpc/context.ts already does this). Middleware is first line, tRPC context is enforcement layer. Never trust client-side auth state.
**Warning signs:** Auth check only in middleware, tRPC procedures assume authenticated context without verification, API routes without independent auth.

## Code Examples

Verified patterns from official sources:

### tRPC Context Creation with JWT Verification
```typescript
// Source: Current codebase pattern (apps/api/src/trpc/context.ts) + jose library
import { jwtVerify } from 'jose';

export async function createContext(opts: CreateContextOpts): Promise<Context> {
  const authHeader = opts.req.headers['authorization'];
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return { userId: null, orgId: null, orgRole: null, hasMfa: false, tenant: null };
  }

  try {
    const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, JWT_SECRET);

    const userId = payload.sub as string;
    const orgId = payload.orgId as string;
    const orgRole = payload.orgRole as string;
    const hasMfa = payload.hasMfa as boolean;

    if (!orgId) {
      return { userId, orgId: null, orgRole: null, hasMfa, tenant: null };
    }

    const tenant = await buildTenantContext(orgId, userId);
    return { userId, orgId, orgRole, hasMfa, tenant };
  } catch (err) {
    console.warn('Token verification failed:', err);
    return { userId: null, orgId: null, orgRole: null, hasMfa: false, tenant: null };
  }
}
```

### Iron-Session Configuration for Next.js
```typescript
// Source: iron-session official docs + Next.js 14 App Router patterns
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  userId?: string;
  orgId?: string;
  orgRole?: string;
  hasMfa?: boolean;
}

export async function getSession() {
  return await getIronSession<SessionData>(await cookies(), {
    password: process.env.SESSION_SECRET!, // Min 32 chars
    cookieName: 'construction_session',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    },
  });
}
```

### Email Verification Flow
```typescript
// Source: Resend docs + OWASP secure token practices
import { Resend } from 'resend';
import { nanoid } from 'nanoid';
import { hash } from '@node-rs/argon2';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(email: string, userId: string) {
  const token = nanoid(32); // Cryptographically random
  const hashedToken = await hash(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Store hashed token in DB
  await db.insert(emailVerificationTokens).values({
    userId,
    tokenHash: hashedToken,
    expiresAt,
  });

  // Send plaintext token in email
  const verifyUrl = `${process.env.APP_URL}/verify-email?token=${token}`;

  await resend.emails.send({
    from: 'noreply@constructionmgmt.com',
    to: email,
    subject: 'Verify your email address',
    html: `<p>Click to verify: <a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| bcrypt password hashing | Argon2id password hashing | OWASP updated recommendations 2023 | Argon2id uses configurable memory (19+ MiB) making GPU attacks impractical. bcrypt stuck at 4KB memory. |
| jsonwebtoken library | jose library | jose v4 released 2021, v5 in 2024 | jose is ESM-native, zero dependencies, prevents algorithm confusion, faster verification, modern crypto APIs (Web Crypto). |
| speakeasy for TOTP | otpauth for TOTP | speakeasy abandoned ~2018 | otpauth has active maintenance, better TypeScript support, same RFC 6238 compliance but modern codebase. |
| Refresh tokens without rotation | Refresh token rotation with reuse detection | Auth0 guidance 2020+ | Rotation makes stolen tokens useless after next refresh. Reuse detection catches breaches automatically. |
| Rate limiting in application code | Redis-backed rate-limiter-flexible | Distributed systems became standard | In-memory counters don't work across multiple API instances. Redis provides atomic operations + TTL. |
| next-iron-session | iron-session v8+ | Renamed and updated for Next.js 14 App Router | App Router support, Server Actions compatibility, improved TypeScript, same encryption but better DX. |
| Nodemailer direct SMTP | Resend API or similar services | Developer-focused email services emerged 2022+ | Resend handles SPF/DKIM/DMARC, better deliverability, React email templates, simpler API than SMTP config. |

**Deprecated/outdated:**
- **@clerk/nextjs, @clerk/backend:** Will be completely removed. All Clerk SDK calls replaced with custom auth.
- **jsonwebtoken:** Use jose instead. jsonwebtoken has known CVEs and algorithm confusion risks.
- **speakeasy:** Unmaintained since ~2018. Use otpauth for TOTP.
- **bcrypt for new passwords:** OWASP recommends Argon2id. bcrypt only for verifying migrated hashes until users re-login.

## Open Questions

1. **How to handle Clerk organization metadata during migration?**
   - What we know: Clerk exports user data with org memberships. Current system has `tenants` table with `clerk_org_id`.
   - What's unclear: Does Clerk export include organization metadata (name, settings, created date)? Or only user memberships?
   - Recommendation: Test Clerk export CSV format. Likely need to fetch org metadata via Clerk API before sunset, store in migration manifest. Add `migrated_from_clerk_org_id` column for debugging.

2. **Should we implement "Sign in with Google/Microsoft" (OAuth)?**
   - What we know: Current Clerk setup may use OAuth providers. Removing Clerk removes OAuth.
   - What's unclear: Are users currently using OAuth to sign in? If yes, removing it breaks their login.
   - Recommendation: Check Clerk dashboard for OAuth usage stats. If <10% of users, require password reset during migration. If >10%, Phase 12 must include OAuth (using `next-auth` or `@auth/core`), significantly increasing scope.

3. **How to migrate existing sessions without forcing mass logout?**
   - What we know: Clerk session tokens are in client cookies. Our JWT tokens use different structure.
   - What's unclear: Can we dual-verify (check Clerk token OR custom token) during transition period?
   - Recommendation: Implement 30-day transition window where tRPC context accepts both Clerk tokens and custom JWTs. Mark Clerk tokens as "legacy" in context. After 30 days, reject Clerk tokens.

4. **What is the rollback plan if custom auth has critical bugs in production?**
   - What we know: Auth bugs can lock all users out. High risk migration.
   - What's unclear: Can we roll back to Clerk after removing dependencies? How long does Clerk keep inactive organizations?
   - Recommendation: Keep Clerk subscription active for 60 days post-migration. Maintain feature flag `USE_CLERK_AUTH` to toggle between Clerk and custom auth. Only cancel Clerk after 60 days of custom auth stability.

5. **How to handle MFA for users who already have Clerk MFA enabled?**
   - What we know: Clerk MFA secrets are not exportable (security by design).
   - What's unclear: Force all MFA users to re-setup TOTP?
   - Recommendation: Yes, force MFA re-setup. During migration, mark users with `clerk_had_mfa=true`. After first login, redirect to MFA setup with explanation. Provide 7-day grace period before enforcing MFA again.

## Sources

### Primary (HIGH confidence)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) - Argon2id recommendations, hashing parameters
- [OWASP Node.js Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html) - Authentication vulnerabilities, security patterns
- [jose NPM package](https://www.npmjs.com/package/jose) - JWT library documentation
- [GitHub panva/jose](https://github.com/panva/jose) - Official repository, security practices
- [@node-rs/argon2 NPM](https://www.npmjs.com/package/@node-rs/argon2) - Password hashing library
- [otpauth NPM](https://www.npmjs.com/package/otpauth) - TOTP implementation
- [iron-session GitHub](https://github.com/vvo/iron-session) - Session management
- [Clerk Migration Guide](https://clerk.com/docs/guides/development/migrating/overview) - User data export process
- [Clerk User Export](https://clerk.com/docs/deployments/exporting-users) - CSV export including password hashes

### Secondary (MEDIUM confidence)
- [Password Hashing Guide 2025: Argon2 vs Bcrypt](https://guptadeepak.com/the-complete-guide-to-password-hashing-argon2-vs-bcrypt-vs-scrypt-vs-pbkdf2-2026/) - Algorithm comparison
- [JWT Authentication Security Guide](https://jsschools.com/web_dev/jwt-authentication-security-guide-refresh-token/) - Refresh token rotation patterns
- [Refresh Token Rotation Best Practices](https://www.serverion.com/uncategorized/refresh-token-rotation-best-practices-for-developers/) - Implementation strategies
- [Auth0 Refresh Tokens Guide](https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/) - Industry standard practices
- [Implementing Secure Password Reset](https://blog.logrocket.com/implementing-secure-password-reset-node-js/) - Token generation patterns
- [Rate Limiting in Node.js](https://medium.com/@deval93/rate-limiting-in-node-js-how-to-protect-your-api-from-abuse-6761658abfa2) - Brute force protection
- [rate-limiter-flexible Examples](https://github.com/animir/node-rate-limiter-flexible/wiki/Overall-example) - Redis-backed rate limiting
- [Resend vs Nodemailer Comparison](https://devdiwan.medium.com/goodbye-nodemailer-why-i-switched-to-resend-for-sending-emails-in-node-js-55e5a0dba899) - Email service selection
- [Better Auth PostgreSQL Adapter](https://www.better-auth.com/docs/adapters/postgresql) - Database schema patterns
- [Next.js 14 Auth with Iron Session](https://blog.lama.dev/next-js-14-auth-with-iron-session/) - Implementation guide

### Tertiary (LOW confidence - flagged for validation)
- Multi-tenant invite flow patterns - need to validate with current codebase tenant provisioning
- OAuth integration complexity - need to assess if OAuth providers are currently used
- Clerk-to-custom auth transition strategies - limited documentation, need pilot testing

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - Libraries are well-established, but version compatibility with existing monorepo needs validation
- Architecture: MEDIUM - Patterns are proven (OWASP-backed), but integration with existing tRPC/Drizzle/multi-tenant setup needs design review
- Pitfalls: HIGH - Well-documented attack vectors and common mistakes from security research
- Migration strategy: LOW - Limited documentation on Clerk export format, OAuth usage, session transition

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (30 days - security landscape and library versions change frequently)
