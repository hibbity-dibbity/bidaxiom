---
phase: 26-account-settings-and-shell-cleanup
plan: 03
subsystem: ui
tags: [react, trpc, zod, react-hook-form, mfa, auth, settings, bearer-token]

# Dependency graph
requires:
  - phase: 26-account-settings-and-shell-cleanup
    provides: auth.changePassword and auth.disableMfa mutations (plan 01)
  - phase: 26-account-settings-and-shell-cleanup
    provides: consolidated user dropdown linking to /settings/account (plan 02)
provides:
  - Full /settings/account page with Profile, Password Change, and MFA sections
  - Password change form with zod validation and Bearer token API call
  - MFA status display with enable link and disable form with password confirmation
affects: [account, auth, settings, navigation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side tRPC fetch via fetch() with Bearer token: GET /api/auth/token then POST /${API_URL}/trpc/${procedure}"
    - "No superjson transformer = raw input body: JSON.stringify({ currentPassword, newPassword }) not JSON.stringify({ json: {...} })"
    - "Auth via ctx.userId (JWT already verified by createContext) not (ctx as any).req?.headers"
    - "zod + react-hook-form for password change: .refine() cross-field validation for confirmPassword match"

key-files:
  created: []
  modified:
    - apps/web/app/(dashboard)/settings/account/page.tsx
    - apps/web/components/layout/sidebar-nav.tsx

key-decisions:
  - "Use fetch() directly to tRPC endpoints (same pattern as mfa-setup/page.tsx) rather than tRPC client hooks — keeps auth token retrieval explicit"
  - "MFA state reflects login-time mfaEnabled from auth context; page notes user will see change after refresh/re-login"
  - "sidebar-nav.tsx: always render mainNav (global nav) — remove projectNav context-switching that was the root NAV-01 issue"
  - "collapsible reverted from 'none' back to 'icon' — 'none' prevented the sidebar from collapsing at all, breaking the intended icon-only collapse mode"

patterns-established:
  - "Account settings page pattern: three Card sections stacked — Profile (display), Password Change (form), MFA (status-aware)"
  - "tRPC fetch without transformer: send { currentPassword, newPassword } directly, not wrapped in { json: {...} }"

requirements-completed:
  - ACCT-01
  - ACCT-02
  - ACCT-03

# Metrics
duration: 30min
completed: 2026-02-17
---

# Phase 26 Plan 03: Account Settings Page Summary

**Full /settings/account page with Profile (display-only), Password Change (zod-validated form), and MFA (status-aware enable/disable) — five bugs fixed during implementation including tRPC fetch body format, error message path, auth context access, and sidebar nav context-switching**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-02-17T22:35:00Z
- **Completed:** 2026-02-17T23:10:00Z
- **Tasks:** 2 (+ human verify checkpoint passed)
- **Files modified:** 2

## Accomplishments

- Built full `apps/web/app/(dashboard)/settings/account/page.tsx` replacing the stub — three Card sections, all on one page, no separate routes
- Password Change form uses `useForm` + zod schema with cross-field `confirmPassword` validation; calls `auth.changePassword` via Bearer token fetch; success/error toasts
- MFA section is status-aware: disabled users see "Set Up MFA" button linking to `/mfa-setup?redirect_url=/settings/account`; enabled users see green "Enabled" badge + inline password field + "Disable MFA" destructive button
- Fixed sidebar-nav.tsx to always show global `mainNav` — removed project-context switching that was the actual NAV-01 root cause
- Reverted `collapsible` prop from `"none"` back to `"icon"` — the static sidebar requirement meant always-visible, not disabling collapse entirely
- Human UAT: all 7 verification points passed

## Task Commits

Each task was committed atomically:

1. **Tasks 1 & 2: Build account settings page** - `42cf81e` (feat)
2. **Fix tRPC error message path** - `08ffa67` (fix) — `result.error.message` not `result.error.json.message`
3. **Fix tRPC fetch body format** - `7737dd5` (fix) — raw input, no `{ json: {...} }` wrapper
4. **Fix sidebar revert + nav context-switching** - `36beb13` (fix) — `collapsible="icon"`, remove projectNav switching
5. **Fix auth context access in mutations** - `4b21bf5` (fix) — `ctx.userId` not `(ctx as any).req?.headers`

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/web/app/(dashboard)/settings/account/page.tsx` - Complete account settings page: Profile (display-only name/email), Password Change (react-hook-form + zod, Bearer token fetch), MFA (status-aware enable link or disable form with password confirmation)
- `apps/web/components/layout/sidebar-nav.tsx` - Removed projectNav context-switching; always renders global mainNav

## Decisions Made

- Used `fetch()` directly to tRPC REST endpoints (same pattern as `mfa-setup/page.tsx`) rather than typed tRPC client hooks — this keeps Bearer token retrieval explicit and consistent with the auth-required pattern established in Phase 26-01.
- MFA enabled/disabled state comes from `useAuth()` hook (`user?.mfaEnabled`), which reflects login-time state. The page does not re-fetch after disable — user sees the change after next re-login or page refresh. This is acceptable UX for a low-frequency operation.
- `sidebar-nav.tsx` fix: the NAV-01 requirement was "sidebar always shows global navigation" — the root cause was `sidebar-nav.tsx` switching to `projectNav` when inside a project context. Removing that switch is the real fix; the `collapsible` prop was a separate misunderstanding.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] result.error.json.message → result.error.message**
- **Found during:** Task 1 (build account settings page) — error handling code
- **Issue:** Plan specified `result.error?.json?.message` as the error path; but tRPC without superjson transformer returns errors at `result.error.message`, not nested under `.json`
- **Fix:** Changed all three error toast calls to use `result.error?.message`
- **Files modified:** `apps/web/app/(dashboard)/settings/account/page.tsx`
- **Verification:** Error toasts display server message correctly
- **Committed in:** `08ffa67`

**2. [Rule 1 - Bug] Removed { json: {...} } wrapper from fetch body**
- **Found during:** Task 1 (build account settings page) — request body format
- **Issue:** Plan specified `JSON.stringify({ json: { currentPassword, newPassword } })`; but without a superjson transformer the tRPC REST handler expects the raw input object directly, not wrapped in `{ json: {...} }`
- **Fix:** Changed both POST bodies to `JSON.stringify({ currentPassword, newPassword })` and `JSON.stringify({ currentPassword: disableMfaPassword })`
- **Files modified:** `apps/web/app/(dashboard)/settings/account/page.tsx`
- **Verification:** Password change and MFA disable calls succeed with correct input shape
- **Committed in:** `7737dd5`

**3. [Rule 1 - Bug] (ctx as any).req?.headers → ctx.userId in changePassword/disableMfa**
- **Found during:** Task 1 — traced through API failures; found the mutations in auth.ts were using `(ctx as any).req` pattern instead of `ctx.userId`
- **Issue:** `createContext` already verifies the JWT and sets `ctx.userId`; `ctx` has no `req` property, so `(ctx as any).req?.headers` always returned undefined and auth always failed
- **Fix:** Rewrote both mutations to check `if (!ctx.userId) throw new TRPCError({ code: 'UNAUTHORIZED' })` then use `ctx.userId` for DB lookups
- **Files modified:** `apps/api/src/trpc/routers/auth.ts`
- **Verification:** Mutations authenticate correctly via ctx.userId
- **Committed in:** `4b21bf5`

**4. [Rule 1 - Bug] Reverted collapsible="none" → collapsible="icon"**
- **Found during:** Task 2 (sidebar verification) — sidebar had no collapse behavior at all
- **Issue:** Plan 26-02 set `collapsible="none"` intending "always visible" but this disables icon-only collapse mode entirely; the actual requirement was icon-only collapse (sidebar collapses to icon strip, not hidden)
- **Fix:** Changed `collapsible="none"` back to `collapsible="icon"` in sidebar.tsx
- **Files modified:** `apps/web/components/layout/sidebar.tsx`
- **Verification:** Sidebar collapses to icon-only mode correctly
- **Committed in:** `36beb13`

**5. [Rule 1 - Bug] sidebar-nav.tsx: removed projectNav context-switching**
- **Found during:** Task 2 (NAV-01 root cause investigation)
- **Issue:** `sidebar-nav.tsx` switched to `projectNav` when detecting a project context, replacing global navigation items. This was the actual cause of NAV-01 ("sidebar should always show global nav"). The Plan 26-02 fix addressed the toggle/collapsible behavior but missed this logic.
- **Fix:** Removed the project-context detection branch; `sidebar-nav.tsx` now always renders `mainNav` regardless of route context
- **Files modified:** `apps/web/components/layout/sidebar-nav.tsx`
- **Verification:** Sidebar nav shows global items on project pages
- **Committed in:** `36beb13`

---

**Total deviations:** 5 auto-fixed (all Rule 1 — bugs)
**Impact on plan:** All fixes necessary for correctness. Three were caused by plan instructions not matching the actual API/framework behavior (no superjson transformer, ctx shape). Two were carry-over bugs from Plan 26-02's NAV-01 fix being incomplete.

## Issues Encountered

The three fetch-related bugs (error path, body format, ctx auth) all stemmed from the plan being written with an assumption that the tRPC setup uses superjson transformer and that `ctx` has a `req` property. The actual setup uses neither. Each was straightforward to diagnose and fix once the API responses were inspected.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 26 complete: all account management consolidated at /settings/account
- Password change and MFA disable work end-to-end via Bearer token
- Sidebar always shows global nav; user dropdown has single Account Settings entry
- Human UAT: 7/7 points approved (sidebar, user dropdown, profile display, password change success/error, MFA section, settings landing card)

---
*Phase: 26-account-settings-and-shell-cleanup*
*Completed: 2026-02-17*

## Self-Check: PASSED
- `apps/web/app/(dashboard)/settings/account/page.tsx` — exists, contains changePassword, disableMfa, three CardTitle elements
- `apps/web/components/layout/sidebar-nav.tsx` — exists, no projectNav context-switching
- Commit `42cf81e` — feat: implement consolidated account settings page
- Commit `08ffa67` — fix: tRPC error message path
- Commit `7737dd5` — fix: tRPC fetch body format
- Commit `36beb13` — fix: sidebar revert + nav context-switching
- Commit `4b21bf5` — fix: ctx.userId auth pattern
