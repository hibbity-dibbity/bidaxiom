# Quick Task 26 Summary: Restore Theme Toggle to Account Settings

**Status:** Complete
**Date:** 2026-02-18
**Commit:** (see git log)

## What Was Done

Added `ThemeToggle` (Light / Dark / System radio buttons) back to `/settings/account`.

The component already existed at `apps/web/components/settings/theme-toggle.tsx` — it just wasn't wired into the account settings page after Phase 26 consolidated the settings UI.

## Changes

| File | Change |
|------|--------|
| `apps/web/app/(dashboard)/settings/account/page.tsx` | Import `ThemeToggle`; add as Section 3 (Appearance) before MFA; update subtitle |

## No Regressions

- Password change (Section 2) and MFA management (Section 4) untouched
- Profile display (Section 1) untouched
- `ThemeToggle` uses `useTheme` from `next-themes` — no new dependencies
