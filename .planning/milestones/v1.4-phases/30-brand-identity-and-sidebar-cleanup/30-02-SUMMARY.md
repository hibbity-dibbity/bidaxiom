---
phase: 30-brand-identity-and-sidebar-cleanup
plan: "02"
subsystem: ui
tags: [next.js, metadata, browser-title, seo]

# Dependency graph
requires:
  - phase: 30-01
    provides: Root layout title template "%s | BIDAXIOM" that child metadata titles plug into
provides:
  - Sign-in page exports metadata title "Sign In" — browser tab reads "Sign In | BIDAXIOM"
  - Auth layout exports fallback metadata title "Sign In" for all client-component auth pages
  - Dashboard layout exports fallback metadata title "Dashboard" — all dashboard tabs read "Dashboard | BIDAXIOM"
affects: [30-color-palette, any future pages added to (auth) or (dashboard) route groups]

# Tech tracking
tech-stack:
  added: []
  patterns: [Next.js Metadata export on server-component layouts for inherited tab titles]

key-files:
  created: []
  modified:
    - apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx
    - apps/web/app/(auth)/layout.tsx
    - apps/web/app/(dashboard)/layout.tsx

key-decisions:
  - "Added metadata at layout level (not just page level) so client-component pages in each route group inherit a meaningful BIDAXIOM title without being able to export their own metadata"
  - "Dashboard layout title set to 'Dashboard' rather than per-route titles because all dashboard page.tsx files are client components and cannot override metadata"

patterns-established:
  - "Server-component layouts are the correct metadata anchor point when child pages are client components"

requirements-completed: [BRAND-02]

# Metrics
duration: 1min
completed: 2026-02-18
---

# Phase 30 Plan 02: Per-page Metadata Titles Summary

**Next.js `metadata` exports added to the three eligible server-component files so every browser tab shows "BIDAXIOM" — sign-in reads "Sign In | BIDAXIOM", dashboard pages read "Dashboard | BIDAXIOM"**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-18T05:45:51Z
- **Completed:** 2026-02-18T05:46:42Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Sign-in page (`app/(auth)/sign-in/[[...sign-in]]/page.tsx`) now exports `metadata` with `title: "Sign In"`, producing "Sign In | BIDAXIOM" in the browser tab via the root layout template
- Auth layout now exports `metadata` with `title: "Sign In"` as a fallback for all client-component auth pages (sign-up, reset-password, verify-email, mfa-setup) that cannot export their own metadata
- Dashboard layout now exports `metadata` with `title: "Dashboard"` so all authenticated pages show "Dashboard | BIDAXIOM" in the browser tab

## Task Commits

Each task was committed atomically:

1. **Task 1: Add metadata to sign-in page** - `576d7f5` (feat)
2. **Task 2: Add fallback metadata to auth and dashboard layouts** - `ad9cea7` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx` - Added `Metadata` import and `metadata` export with `title: "Sign In"`
- `apps/web/app/(auth)/layout.tsx` - Added `Metadata` import and `metadata` export with `title: "Sign In"` (fallback for client-component auth pages)
- `apps/web/app/(dashboard)/layout.tsx` - Added `Metadata` import and `metadata` export with `title: "Dashboard"` (applies to all dashboard pages)

## Decisions Made
- Added metadata at layout level so client-component pages (which cannot export metadata themselves per Next.js 14 rules) still get meaningful tab titles through inheritance
- Set dashboard layout title to "Dashboard" because all dashboard `page.tsx` files are `"use client"` components — per-page granular titles are not achievable without converting them to server components

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Pre-existing TypeScript errors in `components/workflow/workflow-detail.tsx` and `lib/session.ts` were observed during the TypeScript verification step but are unrelated to these changes and are out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BRAND-02 requirement satisfied: BIDAXIOM appears in every browser tab
- Sign-in tab specifically shows "Sign In | BIDAXIOM"
- Dashboard tabs show "Dashboard | BIDAXIOM"
- Ready for Phase 31 (Color Palette) — note: Phase 31 requires a mandatory human checkpoint for palette approval before any color is applied

---
*Phase: 30-brand-identity-and-sidebar-cleanup*
*Completed: 2026-02-18*
