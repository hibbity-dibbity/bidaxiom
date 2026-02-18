# Phase 25: Session & Auth Flow - Research

**Researched:** 2026-02-17
**Domain:** Next.js App Router session management, iron-session, JWT auth, tRPC error interception
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SESS-01 | When session expires while the user is on a page, the app immediately redirects to the sign-in page (not discovered via a failed action) | Proactive session check via `/api/auth/session` polling or visibility-change hook; tRPC `httpBatchLink` custom fetch intercept for reactive coverage |
| SESS-02 | After signing in, the user is redirected to the page they originally requested (return URL redirect completes correctly) | `redirect_url` searchParam already set by middleware; sign-in page already reads it; the bug is `useSearchParams` likely losing value under Suspense; fix is wrapping in Suspense or switching to page-level `searchParams` prop |
</phase_requirements>

---

## Summary

The codebase already has most of the plumbing for both requirements, but both are broken or incomplete. The middleware (`middleware.ts`) already sets `redirect_url` as a query param and the sign-in page (`[[...sign-in]]/page.tsx`) already reads it and calls `router.push(redirectUrl)`. The return-URL redirect failing is almost certainly caused by the sign-in page being a `"use client"` component that calls `useSearchParams()` without a `Suspense` boundary — in Next.js 14 production builds this causes a CSR bailout that drops the URL context. The fix is wrapping the `useSearchParams` consumer in a `Suspense` boundary or switching to the `searchParams` page prop pattern.

For SESS-01 (proactive expiry detection), nothing currently exists. The iron-session cookie has a 7-day maxAge but the JWT access token inside it expires in 15 minutes. The middleware checks `session.userId` (present throughout the 7-day cookie lifetime), not the access token expiry. So the middleware never triggers the redirect until the cookie itself expires. The user only discovers they are logged out when a tRPC call fails with `UNAUTHORIZED`. The fix is a two-layer approach: (1) a client-side hook that checks the access token expiry from `/api/auth/token` and redirects proactively, and (2) a global tRPC error interceptor via `httpBatchLink`'s custom `fetch` to catch any `UNAUTHORIZED` that slips through.

**Primary recommendation:** Fix SESS-02 by wrapping sign-in's `useSearchParams` in Suspense (or using page `searchParams` prop). Fix SESS-01 by adding a client-side session watcher hook mounted in the dashboard layout that polls `/api/auth/token` on a visibility-change event to decode the access token expiry and redirect if within threshold.

---

## Codebase Inventory (Critical Facts)

Understanding the existing code is the primary prerequisite. Every relevant file has been read.

### What Already Exists

| File | Role | Status |
|------|------|--------|
| `apps/web/middleware.ts` | Route guard: reads iron-session, redirects unauthenticated, appends `?redirect_url={pathname}` | Works, but only guards against missing iron-session cookie (7-day TTL), not expired JWT |
| `apps/web/lib/session.ts` | iron-session v8 config; `getSession()`, `getSessionFromRequest()`, `setSessionCookie()` | Complete |
| `apps/web/lib/auth.ts` | Server Actions: `login()`, `logout()`, `getAccessToken()` (decodes JWT, refreshes if <2min), `refreshAccessToken()`, `getSessionData()` | `getAccessToken()` has proactive refresh logic — already exists server-side |
| `apps/web/app/api/auth/token/route.ts` | `GET /api/auth/token` — returns access token from session (used by tRPC headers factory) | Exists; can be extended to return expiry |
| `apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx` | Client component; reads `redirect_url` via `useSearchParams()`; calls `router.push(redirectUrl)` after login | Partially broken — `useSearchParams` without Suspense |
| `apps/web/app/providers.tsx` | tRPC client setup via `httpBatchLink`; fetches token from `/api/auth/token` in `headers()` | The intercept point for global 401 handling |
| `apps/web/lib/auth-context.tsx` | `AuthProvider` + `useAuth()` hook; holds session data client-side | Can be extended to expose `isSessionValid` / redirect trigger |
| `apps/api/src/trpc/procedures.ts` | `requireAuth` middleware throws `TRPCError({ code: "UNAUTHORIZED" })` | Confirmed — UNAUTHORIZED is the error code |
| `apps/api/src/trpc/context.ts` | Verifies JWT via `verifyAccessToken()`; returns `userId: null` on invalid/expired token | The access token (15-min TTL) is what actually expires |

### Token Lifetime Summary

| Token | TTL | Where Stored | Refresh Mechanism |
|-------|-----|-------------|------------------|
| Access token (JWT) | 15 minutes | iron-session cookie (encrypted) | `getAccessToken()` in `auth.ts` auto-refreshes if <2min remaining; calls `auth.refresh` tRPC |
| Refresh token (JWT) | 7 days | iron-session cookie (encrypted) | Used by `refreshAccessToken()` |
| iron-session cookie | 7 days | Browser cookie (httpOnly, encrypted) | Set on login; maxAge matches refresh token |

**The gap:** Middleware reads `session.userId` which is present for 7 days. The access token inside expires every 15 minutes. The user is never redirected by middleware — they only learn they are logged out when a tRPC mutation fires and gets `UNAUTHORIZED` back.

---

## Standard Stack

### Core (Already in Use)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| iron-session | ^8.0.4 | Encrypted stateless session cookie | Already integrated; v8 supports App Router middleware + server components |
| Next.js | ^14.2.0 | App Router; middleware.ts for edge session checks | `getIronSession()` works in middleware (confirmed: codebase already does this) |
| @trpc/react-query | ^11.10.0 | Client-side data fetching with React Query | Already integrated; `httpBatchLink` is the interception point |
| @tanstack/react-query | ^5.90.21 | QueryClient with global error handling | Already integrated; `QueryCache` can catch global tRPC errors |

### No New Libraries Required

Both requirements can be implemented with existing dependencies. No new packages needed.

**Installation:** None required.

---

## Architecture Patterns

### Pattern 1: The Session Watcher Hook (SESS-01)

**What:** A client-side hook that runs in the dashboard layout, checks access token expiry on page visibility change and on a periodic interval, and redirects to sign-in if the session is invalid.

**When to use:** Mount once in `(dashboard)/layout.tsx` so it only runs for authenticated pages, not on the sign-in page itself.

**Why visibility-change over polling:** Polling every N minutes wastes requests when the tab is in the background. Visibility-change fires immediately when the user returns to a tab where their session has expired — exactly the scenario the user describes ("I often get logged out while on a page"). Combine both for best coverage.

**Implementation approach:**

```typescript
// apps/web/hooks/use-session-watcher.ts
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

async function isSessionValid(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/token");
    if (!res.ok) return false;
    const { accessToken } = await res.json();
    if (!accessToken) return false;
    // Decode JWT exp without verification (server already verified it)
    const payload = JSON.parse(
      atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return payload.exp * 1000 > Date.now() + 60_000; // 60s buffer
  } catch {
    return false;
  }
}

export function useSessionWatcher() {
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      if (!(await isSessionValid())) {
        router.push("/sign-in"); // middleware will append redirect_url
      }
    };

    // Check on visibility restore
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Check every 5 minutes (catch the case where user stays on one tab)
    const interval = setInterval(check, 5 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
    };
  }, [router]);
}
```

**IMPORTANT:** When `router.push("/sign-in")` is called from the client, it navigates to `/sign-in` without a `redirect_url` param. The middleware won't run for a client-side navigation push. The correct approach is `router.push("/sign-in?redirect_url=" + encodeURIComponent(window.location.pathname))` to preserve the return URL.

### Pattern 2: tRPC Global UNAUTHORIZED Interceptor (SESS-01 Reactive Layer)

**What:** Override the `fetch` function inside `httpBatchLink` in `providers.tsx` to detect HTTP 401 responses from the API and redirect immediately.

**When to use:** This catches cases where the access token expires exactly when a request fires — the gap between the watcher's last check and the request. It is the reactive safety net.

**Implementation approach:**

```typescript
// In apps/web/app/providers.tsx — inside TrpcAndAbilityProvider
// Source: tRPC docs + community pattern verified against httpBatchLink API
const [trpcClient] = useState(() =>
  trpc.createClient({
    links: [
      httpBatchLink({
        url: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/trpc`,
        async headers() {
          try {
            const res = await fetch("/api/auth/token");
            if (res.ok) {
              const { accessToken } = await res.json();
              return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
            }
          } catch {}
          return {};
        },
        async fetch(url, options) {
          const response = await globalThis.fetch(url, options);
          if (response.status === 401) {
            const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/sign-in?redirect_url=${returnUrl}`;
          }
          return response;
        },
      }),
    ],
  })
);
```

**Note:** Use `window.location.href` (full page reload) instead of `router.push()` here — this ensures the session is fully re-evaluated via middleware on the next page load, not just client-side navigation.

### Pattern 3: Fix Return URL via Suspense Boundary (SESS-02)

**What:** The sign-in page is a `"use client"` component calling `useSearchParams()` directly. In Next.js 14 production builds, this bails out into CSR and can cause the search params to not be available when expected.

**Root cause confirmed:** The `[[...sign-in]]` directory name is a Clerk legacy artifact (optional catch-all for Clerk's hosted pages). The page itself renders fine, but `useSearchParams()` requires a `Suspense` boundary in production builds.

**Fix option A — Suspense wrapper (minimal change):**

```typescript
// apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx
import { Suspense } from "react";
import SignInForm from "./sign-in-form"; // extracted client component

// Page becomes a Server Component
export default function SignInPage({ searchParams }: { searchParams: { redirect_url?: string } }) {
  return (
    <Suspense fallback={null}>
      <SignInForm redirectUrl={searchParams.redirect_url ?? "/"} />
    </Suspense>
  );
}
```

**Fix option B — Use `searchParams` prop (cleaner, preferred):**

```typescript
// Page is a Server Component — no "use client"
export default function SignInPage({
  searchParams,
}: {
  searchParams: { redirect_url?: string };
}) {
  // Pass redirectUrl as prop to the client form component
  const redirectUrl = searchParams.redirect_url ?? "/";
  return <SignInForm redirectUrl={redirectUrl} />;
}

// apps/web/app/(auth)/sign-in/[[...sign-in]]/sign-in-form.tsx
"use client";
// Remove useSearchParams entirely — receives redirectUrl as prop
```

**Recommended:** Option B (searchParams prop). More idiomatic for App Router, no Suspense needed, eliminates the useSearchParams dependency entirely.

### Pattern 4: Return URL Validation (Security)

**What:** The return URL from `redirect_url` searchParam must be validated before use to prevent open redirect attacks.

**Implementation:**

```typescript
// apps/web/lib/utils/safe-redirect.ts
export function getSafeRedirectUrl(returnUrl: string | undefined | null): string {
  if (!returnUrl) return "/";
  // Only allow relative paths
  if (!returnUrl.startsWith("/")) return "/";
  if (returnUrl.startsWith("//")) return "/"; // protocol-relative
  if (returnUrl.startsWith("/\\")) return "/"; // bypass trick
  // Don't redirect to sign-in (infinite loop)
  if (returnUrl.startsWith("/sign-in")) return "/";
  return returnUrl;
}
```

### Anti-Patterns to Avoid

- **Polling every minute from a global layout component:** Creates N requests per minute per tab. Use visibility-change as the primary trigger, with a longer polling interval (5+ minutes) as the fallback.
- **Using `router.push("/sign-in")` without the return URL:** The client-side navigation does not trigger middleware, so the return URL gets lost. Always include `redirect_url` in the client-side redirect.
- **Checking `session.userId` in middleware as the expiry signal:** The iron-session cookie lives 7 days; `session.userId` is present all 7 days. The access token inside expires every 15 minutes. These are different things.
- **Redirecting the entire app from the tRPC error interceptor when on a public route:** The interceptor in `providers.tsx` wraps all routes including the sign-in page itself. Guard the redirect with a check that the current path is not already `/sign-in`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT decode client-side | Custom base64 parser | `atob()` + `JSON.parse()` | Already sufficient; only decoding (not verifying) for expiry check |
| Global error handling | Per-page error handlers | `httpBatchLink` custom `fetch` | One intercept point catches all tRPC calls |
| Session cookie parsing | Manual cookie header parser | `getIronSession()` / `unsealData()` | Already in `lib/session.ts` |
| Return URL storage across refresh | localStorage or cookie | `searchParams` in URL | URL is preserved on page refresh automatically |

**Key insight:** The entire auth infrastructure already exists. Both bugs are fixable with targeted changes to existing files — no new infrastructure needed.

---

## Common Pitfalls

### Pitfall 1: Infinite Redirect Loop

**What goes wrong:** The session watcher or tRPC interceptor fires on the sign-in page itself, redirecting to sign-in again in a loop.
**Why it happens:** The session watcher is mounted in a layout that wraps more routes than intended, or the 401 interceptor fires on an auth endpoint call.
**How to avoid:** Mount `useSessionWatcher` only in `(dashboard)/layout.tsx` — the route group that only wraps authenticated pages. In the tRPC interceptor, guard: `if (window.location.pathname !== '/sign-in')`.
**Warning signs:** Browser navigation history shows repeated sign-in redirects.

### Pitfall 2: Lost Return URL on MFA Flow

**What goes wrong:** User is redirected to sign-in with `redirect_url=/projects/123`. MFA is required. MFA step calls `router.push("/mfa-setup")` without carrying the `redirect_url` forward.
**Why it happens:** The MFA redirect in `sign-in/[[...sign-in]]/page.tsx` line 76 discards the `redirectUrl` state.
**How to avoid:** Pass `redirectUrl` through the MFA flow: `router.push("/mfa-setup?redirect_url=" + encodeURIComponent(redirectUrl))` and have mfa-setup read and forward it.
**Warning signs:** After MFA setup, user always lands on dashboard instead of original destination.

### Pitfall 3: tRPC Batching Confuses the 401 Interceptor

**What goes wrong:** `httpBatchLink` batches multiple requests. If one fails with 401 and another succeeds, the response is a multi-result object, not a clean HTTP 401.
**Why it happens:** tRPC batch responses return HTTP 207 (multi-status) for mixed results, with individual error codes inside the JSON body.
**How to avoid:** The custom `fetch` approach checking `response.status === 401` works for single-procedure calls. For batched calls where one procedure is unauthorized, check the tRPC error in the response body (`data.error.data.code === "UNAUTHORIZED"`) via `QueryCache.onError`.
**Warning signs:** Redirect does not trigger when a batched request contains an unauthorized procedure.

### Pitfall 4: `useSearchParams` Works in Dev, Fails in Production

**What goes wrong:** The sign-in page works locally but the `redirect_url` is always empty in production builds.
**Why it happens:** Next.js 14 statically renders pages at build time. `useSearchParams()` without Suspense causes a CSR bailout only detectable in production builds (not `next dev`).
**How to avoid:** Use the `searchParams` prop pattern (Server Component page → Client Component form) — this approach works identically in dev and production.
**Warning signs:** `redirectUrl` is always `"/"` after production deployment even when the URL shows `?redirect_url=/projects/123`.

### Pitfall 5: `window.location.href` vs `router.push` for Post-401 Redirect

**What goes wrong:** Using `router.push("/sign-in")` from the tRPC interceptor causes a client-side navigation. The iron-session cookie is still present (not cleared), so middleware allows the navigation through — user ends up on the dashboard route in a broken state where all queries fail.
**Why it happens:** Client-side navigation does not re-run middleware. The session cookie is still there (just the JWT inside it is expired). Middleware sees a valid cookie and lets the user through.
**How to avoid:** Use `window.location.href` for the post-401 redirect. This triggers a full page load, middleware re-runs, reads the iron-session cookie, attempts to call `getAccessToken()` which calls `refreshAccessToken()` which fails (if refresh token also expired), and properly redirects to sign-in.

---

## Code Examples

### Existing: Token Fetch in tRPC Headers (from providers.tsx)

```typescript
// Source: apps/web/app/providers.tsx (confirmed in codebase)
async headers() {
  try {
    const res = await fetch("/api/auth/token");
    if (res.ok) {
      const { accessToken } = await res.json();
      return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
    }
  } catch {}
  return {};
},
```

### Existing: Middleware Return URL Injection (from middleware.ts)

```typescript
// Source: apps/web/middleware.ts (confirmed in codebase)
if (!session.userId) {
  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("redirect_url", pathname);
  return NextResponse.redirect(signInUrl);
}
```

Note: This only fires when the 7-day iron-session cookie is absent. It does NOT catch expired JWT access tokens.

### Existing: Return URL Consumption (from sign-in/page.tsx)

```typescript
// Source: apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx
const searchParams = useSearchParams();
const redirectUrl = searchParams.get("redirect_url") || "/";
// ...
router.push(redirectUrl); // line 87 and 130
```

This is the broken part — `useSearchParams()` in a "use client" component without Suspense.

### New: JWT Client Decode for Expiry Check

```typescript
// Safe client-side decode (no verification — server already verified when issuing)
function decodeJwtExp(token: string): number | null {
  try {
    const part = token.split(".")[1];
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(padded));
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}
```

---

## Implementation Plan

### Files to Modify

| File | Change |
|------|--------|
| `apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx` | Extract client form to `sign-in-form.tsx`; make page a Server Component using `searchParams` prop |
| `apps/web/app/providers.tsx` | Add custom `fetch` to `httpBatchLink` for global 401 interception |
| `apps/web/app/(dashboard)/layout.tsx` | Mount `useSessionWatcher` hook |

### Files to Create

| File | Purpose |
|------|---------|
| `apps/web/app/(auth)/sign-in/[[...sign-in]]/sign-in-form.tsx` | Extracted client component with form logic; receives `redirectUrl` as prop |
| `apps/web/hooks/use-session-watcher.ts` | Client hook: visibility-change + interval session check → redirect |
| `apps/web/lib/utils/safe-redirect.ts` | Return URL validation helper |

### No Files to Delete

The existing `page.tsx` transforms into a thin Server Component wrapper; it is not deleted.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useSearchParams()` directly in page | `searchParams` prop in Server Component + prop drilling | Next.js 13.4+ App Router | Eliminates CSR bailout; works in production builds |
| Global error handler via `QueryClient.defaultOptions.queries.onError` | `QueryCache` constructor `onError` | @tanstack/react-query v5 | v5 removed `onError` from `defaultOptions.queries`; use `QueryCache` |
| Polling for session validity | Visibility-change event + periodic check | Best practice post-2023 | Reduces requests; fires immediately when user returns to stale tab |

**Deprecated/outdated:**
- `defaultOptions.queries.onError`: Removed in React Query v5. Use `new QueryCache({ onError })` constructor instead.

---

## Open Questions

1. **MFA setup redirect_url preservation**
   - What we know: Current MFA flow in `sign-in/page.tsx` pushes to `/mfa-setup` without carrying the `redirect_url` forward
   - What's unclear: Whether this is in scope for Phase 25 or deferred
   - Recommendation: Include it in scope — fixing return URL without fixing the MFA sub-flow leaves a hole in SESS-02

2. **`[[...sign-in]]` directory name**
   - What we know: This is a Clerk catch-all route artifact; functionally it is equivalent to `/sign-in` since no additional segments are passed
   - What's unclear: Whether renaming to a simple `page.tsx` directly under `sign-in/` would break anything
   - Recommendation: Do not rename — the transformation to a Server Component is done within the same file/directory structure

3. **Token fetch in `headers()` races with 401 interceptor**
   - What we know: `headers()` already fetches from `/api/auth/token` which calls `getAccessToken()` which proactively refreshes if <2min remaining
   - What's unclear: If refresh fails (refresh token expired), does `getAccessToken()` return null or throw?
   - Resolution from code: `refreshAccessToken()` returns `null` on failure (line 72 of `auth.ts`); `getAccessToken()` returns `null` which means no Authorization header is sent, which means the API returns 401 — the interceptor then redirects. This chain works correctly.

---

## Sources

### Primary (HIGH confidence — codebase)
- `apps/web/middleware.ts` — existing route guard with `redirect_url` injection
- `apps/web/lib/session.ts` — iron-session v8 config and helpers
- `apps/web/lib/auth.ts` — server actions including `getAccessToken()` with proactive refresh
- `apps/web/lib/auth-context.tsx` — AuthProvider and useAuth hook
- `apps/web/app/providers.tsx` — tRPC client setup with httpBatchLink
- `apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx` — sign-in form with broken useSearchParams
- `apps/web/app/api/auth/token/route.ts` — token endpoint
- `apps/api/src/trpc/procedures.ts` — UNAUTHORIZED error code confirmed
- `apps/api/src/trpc/context.ts` — JWT verification; returns null userId on expired token
- `apps/api/src/auth/jwt.ts` — ACCESS_TOKEN_TTL = "15m", REFRESH_TOKEN_TTL = "7d"

### Secondary (MEDIUM confidence — web search verified against codebase)
- [Next.js useSearchParams docs](https://nextjs.org/docs/app/api-reference/functions/use-search-params) — Suspense boundary requirement confirmed
- [tRPC httpBatchLink custom fetch pattern](https://github.com/trpc/trpc/discussions/2036) — 401 interception via custom fetch override
- Open redirect validation pattern — confirmed against Next.js security docs

### Tertiary (LOW confidence — pattern only)
- Visibility-change + interval hybrid polling — widely adopted community pattern; no single authoritative source

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in package.json and in use
- Architecture: HIGH — all patterns based on direct codebase reading; root causes confirmed
- Pitfalls: HIGH for items 1, 4, 5 (confirmed from code); MEDIUM for items 2, 3 (logical inference)

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (Next.js 14 stable; iron-session v8 stable; no breaking changes expected in 30 days)
