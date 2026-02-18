---
phase: 25-session-and-auth-flow
verified: 2026-02-17T00:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 25: Session and Auth Flow Verification Report

**Phase Goal:** Users are never silently stuck on a stale page — session expiry redirects immediately to sign-in, and users land back where they intended after signing in.
**Verified:** 2026-02-17
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After signing in, the user is taken to the page they originally tried to access | VERIFIED | `sign-in-form.tsx` L89: `router.push(getSafeRedirectUrl(redirectUrl))` after session stored; `page.tsx` passes `searchParams.redirect_url` prop |
| 2 | Return URL is preserved correctly on page refresh at the sign-in page | VERIFIED | `page.tsx` is a Server Component reading `searchParams.redirect_url` — no CSR bailout, survives hard refresh |
| 3 | The sign-in page's redirect_url is available in production builds, not just dev | VERIFIED | Server Component `page.tsx` reads `searchParams` synchronously; `useSearchParams` (which causes production CSR bailout) fully removed from sign-in page |
| 4 | MFA flow carries the redirect_url forward so users are not dropped on dashboard after MFA | VERIFIED | `sign-in-form.tsx` L78: `router.push("/mfa-setup?redirect_url=" + encodeURIComponent(getSafeRedirectUrl(redirectUrl)))`; `mfa-setup/page.tsx` L34 reads it; L155: `router.push(getSafeRedirectUrl(redirectUrl))` |
| 5 | An invalid or external redirect_url falls back to / (no open redirect vulnerability) | VERIFIED | `safe-redirect.ts`: guards falsy, non-`/` prefix, `//`, `/\`, and `/sign-in` prefix — all return `"/"` |
| 6 | When a user returns to a tab where their JWT has expired, they are immediately redirected to sign-in | VERIFIED | `use-session-watcher.ts` L40-44: `visibilitychange` listener calls `checkAndRedirect()` on `document.visibilityState === "visible"` |
| 7 | When any tRPC call returns 401 (expired JWT slipped through), the user is redirected to sign-in with the current page as return URL | VERIFIED | `providers.tsx` L52-65: custom `fetch` on `httpBatchLink` checks `response.status === 401`, sets `window.location.href = /sign-in?redirect_url=...` |
| 8 | The session watcher and 401 interceptor do not fire on the sign-in page itself | VERIFIED | `use-session-watcher.ts` mounted only in `(dashboard)/layout.tsx` — auth pages excluded; `providers.tsx` L57: `window.location.pathname !== "/sign-in"` guard |

**Score:** 8/8 truths verified

---

## Required Artifacts

### Plan 01 (SESS-02) Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/lib/utils/safe-redirect.ts` | `getSafeRedirectUrl()` helper validating relative paths | VERIFIED | 21 lines; exports `getSafeRedirectUrl`; all 5 guard conditions present |
| `apps/web/app/(auth)/sign-in/[[...sign-in]]/sign-in-form.tsx` | Client component with redirectUrl prop, min 150 lines | VERIFIED | 301 lines; `"use client"`; receives `redirectUrl` prop; no `useSearchParams`; imports `getSafeRedirectUrl` |
| `apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx` | Server Component reading searchParams | VERIFIED | 10 lines; no `"use client"` directive; reads `searchParams.redirect_url`; renders `<SignInForm redirectUrl={redirectUrl} />` |
| `apps/web/app/(auth)/mfa-setup/page.tsx` | Reads and forwards redirect_url | VERIFIED | 327 lines; `useSearchParams()` reads `redirect_url`; Suspense wrapper; `handleComplete` uses `getSafeRedirectUrl(redirectUrl)` |

### Plan 02 (SESS-01) Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/hooks/use-session-watcher.ts` | Hook checking JWT expiry on visibility-change and every 5min | VERIFIED | 54 lines; exports `useSessionWatcher`; `visibilitychange` listener; `setInterval(checkAndRedirect, 5 * 60 * 1000)`; redirects via `window.location.href` |
| `apps/web/components/session-watcher.tsx` | Null component mounting hook | VERIFIED | 8 lines; `"use client"`; imports and calls `useSessionWatcher()`; returns `null` |
| `apps/web/app/(dashboard)/layout.tsx` | Dashboard layout mounting SessionWatcher | VERIFIED | Imports `SessionWatcher` from `@/components/session-watcher`; renders `<SessionWatcher />` alongside `<AppShell>` |
| `apps/web/app/providers.tsx` | tRPC 401 interceptor | VERIFIED | Custom `fetch` in `httpBatchLink` checks `response.status === 401`; uses `globalThis.fetch` (no recursion); guards `/sign-in` pathname; uses `window.location.href` for full-page reload |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `sign-in/[[...sign-in]]/page.tsx` | `sign-in-form.tsx` | `redirectUrl` prop | WIRED | L9: `<SignInForm redirectUrl={redirectUrl} />`; L8: `const redirectUrl = searchParams.redirect_url ?? "/"` |
| `sign-in-form.tsx` | `lib/utils/safe-redirect.ts` | `getSafeRedirectUrl` import | WIRED | L16: `import { getSafeRedirectUrl } from "@/lib/utils/safe-redirect"`; used at L78, L89, L136 |
| `sign-in-form.tsx` | `mfa-setup/page.tsx` | `router.push` with `redirect_url` query param | WIRED | L78: `router.push("/mfa-setup?redirect_url=" + encodeURIComponent(getSafeRedirectUrl(redirectUrl)))` |

### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `(dashboard)/layout.tsx` | `hooks/use-session-watcher.ts` | `useSessionWatcher()` call via SessionWatcher | WIRED | `layout.tsx` imports `SessionWatcher`; `session-watcher.tsx` imports and calls `useSessionWatcher()` |
| `providers.tsx` | `/sign-in` | `window.location.href` on 401 | WIRED | L62: `window.location.href = /sign-in?redirect_url=${returnUrl}` inside custom `fetch` |
| `hooks/use-session-watcher.ts` | `/api/auth/token` | `fetch` to check token expiry | WIRED | L8: `const res = await fetch("/api/auth/token")` inside `isSessionValid()` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SESS-01 | 25-02, 25-03 | When session expires while user is on a page, app immediately redirects to sign-in | SATISFIED | `use-session-watcher.ts` handles proactive expiry (visibility-change + 5min interval); `providers.tsx` handles reactive 401; both verified in UAT 2026-02-17 |
| SESS-02 | 25-01, 25-03 | After signing in, user is redirected to originally requested page | SATISFIED | Server Component `page.tsx` reads `searchParams.redirect_url`; `sign-in-form.tsx` uses `getSafeRedirectUrl(redirectUrl)` on all post-login redirects; MFA flow preserves redirect_url; open redirect guard in `safe-redirect.ts`; UAT verified 2026-02-17 |

No orphaned requirements — both SESS-01 and SESS-02 are fully claimed and satisfied.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/hooks/use-session-watcher.ts` | 4, 28 | `useRouter` imported and instantiated but never used — all redirects use `window.location.href` | Warning | Dead code; no functional impact; correct behavior (window.location.href causes full-page reload so middleware re-runs) |

No blocker anti-patterns. No TODO/FIXME/placeholder stubs. No empty implementations.

---

## Human Verification

All 5 UAT flows verified and approved by user on 2026-02-17:

| Test | Result |
|------|--------|
| SESS-02: Return URL after sign-in — navigate to `/projects` while signed out, sign in, land on `/projects` (not dashboard) | PASSED |
| SESS-02: MFA flow tested | N/A (MFA not enforced in test environment) |
| SESS-01: Cookie deletion + tab switch triggers immediate redirect to sign-in | PASSED |
| SESS-01: tRPC 401 interceptor triggers full-page redirect to sign-in with return URL | PASSED |
| Open redirect guard: `/sign-in?redirect_url=https://evil.com` delivers user to `/` after sign-in | PASSED |

---

## Implementation Notes

### Architecture Decisions Verified

1. **Server Component + Client Component split** — `page.tsx` (Server, reads `searchParams`) + `sign-in-form.tsx` (Client, receives prop). This eliminates the Next.js 14 production CSR bailout that previously made `useSearchParams()` return empty values in production builds.

2. **`window.location.href` vs `router.push`** — Both `use-session-watcher.ts` and `providers.tsx` correctly use `window.location.href` (full page reload) rather than `router.push` (client-side navigation). This is intentional: a full reload re-runs Next.js middleware and iron-session evaluation, clearing stale client state.

3. **Middleware wiring confirmed** — `middleware.ts` line 41 injects `?redirect_url={pathname}` for unauthenticated requests, providing the entry point for the SESS-02 flow.

4. **MFA Suspense pattern** — `mfa-setup/page.tsx` wraps the inner `MfaSetupPage` function in `<Suspense fallback={null}>` to enable `useSearchParams()` without production CSR bailout.

### Minor Observation

`useRouter` is imported and instantiated in `use-session-watcher.ts` but the `router` variable is never used (all redirects use `window.location.href`). This is dead code but causes no functional regression and does not block the goal.

---

## Summary

Phase 25 goal is fully achieved. Both SESS-01 and SESS-02 are implemented, wired end-to-end, and human-verified. The architecture is sound: session expiry is caught proactively (tab visibility restore, 5-min polling) and reactively (tRPC 401 interceptor), return URLs are preserved through sign-in and MFA flows, and open redirect attacks are blocked at the `getSafeRedirectUrl` gate.

---

_Verified: 2026-02-17_
_Verifier: Claude (gsd-verifier)_
