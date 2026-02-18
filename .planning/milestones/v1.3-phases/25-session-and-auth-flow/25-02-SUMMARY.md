---
phase: 25-session-and-auth-flow
plan: 02
subsystem: auth
tags: [session, jwt, trpc, redirect, expiry]
dependency_graph:
  requires: []
  provides: [SESS-01]
  affects: [apps/web/app/providers.tsx, apps/web/app/(dashboard)/layout.tsx]
tech_stack:
  added: []
  patterns: [visibility-change JWT polling, tRPC custom fetch interceptor]
key_files:
  created:
    - apps/web/hooks/use-session-watcher.ts
    - apps/web/components/session-watcher.tsx
  modified:
    - apps/web/app/(dashboard)/layout.tsx
    - apps/web/app/providers.tsx
decisions:
  - "Used window.location.href (not router.push) for redirects so middleware re-evaluates the iron-session cookie on full page reload"
  - "SessionWatcher client component pattern keeps dashboard layout a Server Component while mounting the hook"
  - "globalThis.fetch in tRPC custom fetch avoids infinite recursion when overriding the fetch function"
metrics:
  duration: 3 min
  completed: 2026-02-17
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 25 Plan 02: Session Watcher and tRPC 401 Interceptor Summary

**One-liner:** JWT expiry detection via visibilitychange polling + tRPC 401 reactive interceptor redirecting to sign-in with return URL.

## What Was Built

Two complementary layers of session expiry handling:

1. **Proactive layer (useSessionWatcher hook)** — checks JWT expiry on tab focus restore (`visibilitychange`) and every 5 minutes via `setInterval`. Redirects to `/sign-in?redirect_url={current_path}` via `window.location.href` when JWT is expired or within 60 seconds of expiry.

2. **Reactive layer (tRPC 401 interceptor)** — custom `fetch` in `httpBatchLink` catches HTTP 401 responses from any tRPC call and immediately redirects to sign-in with the return URL. Guards against redirect loops on the sign-in page itself.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create useSessionWatcher hook and mount in dashboard layout | ec8117d | hooks/use-session-watcher.ts, components/session-watcher.tsx, app/(dashboard)/layout.tsx |
| 2 | Add tRPC 401 reactive interceptor to providers.tsx | 75817f3 | app/providers.tsx |

## Decisions Made

- **`window.location.href` for redirects:** Full page reload ensures middleware re-evaluates the iron-session cookie. Client-side `router.push` would leave the broken session in place.
- **SessionWatcher component pattern:** Dashboard layout stays a Server Component. A tiny `SessionWatcher` client component (`return null`) is imported and rendered alongside `<AppShell>` to mount the hook without converting the layout itself.
- **`globalThis.fetch` in tRPC interceptor:** Prevents infinite recursion when the custom `fetch` property overrides the global `fetch` — inner call must reference `globalThis.fetch` explicitly.
- **60-second buffer on JWT expiry:** The hook marks the session invalid 60 seconds before actual `exp` timestamp, giving enough lead time to redirect before any in-flight requests fail.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

- [x] `apps/web/hooks/use-session-watcher.ts` — exists, exports `useSessionWatcher`, contains `visibilitychange` and `setInterval`
- [x] `apps/web/components/session-watcher.tsx` — "use client", mounts hook, returns null
- [x] `apps/web/app/(dashboard)/layout.tsx` — renders `<SessionWatcher />` for all authenticated pages
- [x] `apps/web/app/providers.tsx` — `httpBatchLink` has custom `fetch` with `response.status === 401` check
- [x] Sign-in page guarded: `window.location.pathname !== "/sign-in"`
- [x] No TypeScript errors in modified/created files

## Self-Check: PASSED
