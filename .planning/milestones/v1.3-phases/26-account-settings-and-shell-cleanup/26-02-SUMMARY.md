---
phase: 26-account-settings-and-shell-cleanup
plan: 02
subsystem: ui
tags: [sidebar, top-bar, user-menu, mfa, settings, navigation]

# Dependency graph
requires:
  - phase: 19-component-library-architecture
    provides: shadcn sidebar components (ShadcnSidebar, SidebarProvider, SidebarInset)
  - phase: 26-account-settings-and-shell-cleanup
    provides: account settings route at /settings/account (plan 01)
provides:
  - Static sidebar with collapsible=none (no toggle, no localStorage)
  - Consolidated user dropdown with single Account Settings link
  - Fixed MFA setup that sends hashedBackupCodes to API
  - Settings landing page with Account Settings card
affects: [shell, layout, navigation, auth]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static sidebar pattern: collapsible=none removes all toggle complexity; sidebar is pure presentational"
    - "Consolidated account navigation: single entry point /settings/account replaces Settings + MFA links"

key-files:
  created: []
  modified:
    - apps/web/components/layout/sidebar.tsx
    - apps/web/components/layout/top-bar.tsx
    - apps/web/components/layout/user-menu.tsx
    - apps/web/app/(auth)/mfa-setup/page.tsx
    - apps/web/app/(dashboard)/settings/page.tsx

key-decisions:
  - "collapsible=none on ShadcnSidebar removes icon-only mode entirely — sidebar is always fully expanded"
  - "Removed 'use client' from sidebar.tsx since all hooks (useSidebar, useState, useEffect, useRef) were eliminated"
  - "User dropdown consolidates Settings + MFA Settings into one Account Settings item at /settings/account"
  - "MFA bug: API expects hashedBackupCodes not backupCodes — SetupData type updated to include both fields"

patterns-established:
  - "Static sidebar pattern: no localStorage, no toggle, no state — sidebar is a pure server component layout"
  - "Account Settings as single nav entry point for all personal/security settings"

requirements-completed:
  - NAV-01
  - ACCT-04
  - ACCT-02

# Metrics
duration: 8min
completed: 2026-02-17
---

# Phase 26 Plan 02: Account Settings and Shell Cleanup Summary

**Static sidebar (collapsible=none, no localStorage), consolidated user dropdown to single Account Settings link at /settings/account, MFA backup codes bug fixed (sends hashedBackupCodes), and Account Settings card added to settings landing page**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-17T22:23:00Z
- **Completed:** 2026-02-17T22:31:27Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Sidebar made fully static: removed localStorage persist/restore, useSidebar, useState, useEffect, useRef, and SidebarTrigger; changed collapsible="icon" to collapsible="none"; removed "use client" directive
- Top-bar cleaned up: removed SidebarTrigger, useSidebar import, and conditional logo rendering — left div is now a static empty placeholder
- User dropdown consolidated from two links (Settings + MFA Settings) to one "Account Settings" link pointing to /settings/account; removed Shield icon import
- MFA setup bug fixed: SetupData type now includes hashedBackupCodes field, and onVerifySubmit sends hashedBackupCodes to auth.verifyMfaSetup instead of backupCodes
- Settings landing page gains an "Account Settings" card (User icon, /settings/account, description) as the first card in the grid

## Task Commits

All tasks committed atomically in a single commit (plan specified one atomic commit):

1. **Task 1: Static sidebar + top-bar cleanup** - `87d46df`
2. **Task 2: User menu, MFA fix, settings card** - `87d46df`

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `apps/web/components/layout/sidebar.tsx` - Removed all state/effects/toggle logic; collapsible=none; pure presentational; no "use client"
- `apps/web/components/layout/top-bar.tsx` - Removed SidebarTrigger, useSidebar, conditional logo; static empty left div
- `apps/web/components/layout/user-menu.tsx` - Single Account Settings item → /settings/account; removed Shield import
- `apps/web/app/(auth)/mfa-setup/page.tsx` - Added hashedBackupCodes to SetupData type; fixed API call to send hashedBackupCodes
- `apps/web/app/(dashboard)/settings/page.tsx` - Added Account Settings card as first item in settings grid

## Decisions Made
- Removed `"use client"` from sidebar.tsx entirely since removing all three hooks (useState, useEffect, useRef) plus useSidebar left no client-side code — the component is now a pure server component
- Did not remove SidebarProvider from app-shell.tsx (as instructed — required for SidebarInset layout)
- Removed the `group-data-[collapsible=icon]:hidden` version text class from sidebar footer since collapsible=icon mode no longer exists
- All five files edited in one atomic commit as specified by the plan

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript compilation check showed pre-existing errors in `apps/api/src/` files (intuit-oauth types, bidGeneration.ts, estimateLifecycle.ts, bid.ts). These are pre-existing and entirely unrelated to this plan's changes. No errors exist in the five web files modified by this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Shell cleanup complete: sidebar is static, user dropdown consolidated, MFA fixed
- Account Settings page at /settings/account is ready to receive the profile/password/MFA UI from the remaining plans in phase 26
- Settings landing page now surfaces Account Settings prominently

---
*Phase: 26-account-settings-and-shell-cleanup*
*Completed: 2026-02-17*

## Self-Check: PASSED
- `apps/web/components/layout/sidebar.tsx` — exists, contains `collapsible="none"`, no localStorage
- `apps/web/components/layout/top-bar.tsx` — exists, no SidebarTrigger, no useSidebar
- `apps/web/components/layout/user-menu.tsx` — exists, contains `/settings/account`
- `apps/web/app/(auth)/mfa-setup/page.tsx` — exists, contains `hashedBackupCodes`
- `apps/web/app/(dashboard)/settings/page.tsx` — exists, contains "Account Settings" card
- Commit `87d46df` verified in git log
