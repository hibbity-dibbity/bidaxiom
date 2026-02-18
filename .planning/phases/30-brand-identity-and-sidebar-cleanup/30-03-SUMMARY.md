---
phase: 30-brand-identity-and-sidebar-cleanup
plan: 03
subsystem: ui
tags: [next.js, metadata, branding, logo, tailwind]

# Dependency graph
requires:
  - phase: 30-brand-identity-and-sidebar-cleanup
    provides: "30-01 root layout metadata template; 30-02 sign-in metadata title"
provides:
  - "Sign-in logo resized to 240x56px with 25px bottom padding in both render paths (normal + MFA)"
  - "Dashboard tabs show plain 'BIDAXIOM' (root layout default) — not 'Dashboard | BIDAXIOM'"
affects: [30-brand-identity-and-sidebar-cleanup, 31-color-palette]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Next.js metadata inheritance: remove layout-level title to fall back to root default"
    - "Dashboard (use client) pages cannot export metadata — use layout-level or root default"

key-files:
  created: []
  modified:
    - apps/web/app/(auth)/sign-in/[[...sign-in]]/sign-in-form.tsx
    - apps/web/app/(dashboard)/layout.tsx

key-decisions:
  - "Sign-in logo resized to 75% of original (320x74 -> 240x56) with 25px bottom padding per BRAND-04"
  - "User prefers plain 'BIDAXIOM' in dashboard tab over 'Dashboard | BIDAXIOM' — removed layout-level title, root default applies"
  - "Both MFA and normal sign-in render paths updated identically — missing one would cause inconsistent logo sizes"

patterns-established:
  - "Both render paths pattern: sign-in-form.tsx has MFA path (~line 168) and normal path (~line 232) — always update both"

requirements-completed: [BRAND-04]

# Metrics
duration: ~10min (including checkpoint + user-requested fix)
completed: 2026-02-18
---

# Phase 30 Plan 03: Sign-in Logo Resize + UAT Verification Summary

**Sign-in logo resized to 240x56px with 25px bottom padding in both MFA and normal render paths; dashboard tab title simplified to plain 'BIDAXIOM' by removing layout-level metadata override**

## Performance

- **Duration:** ~10 min (including human checkpoint and user-requested post-approval fix)
- **Started:** 2026-02-18
- **Completed:** 2026-02-18
- **Tasks:** 2 (Task 1 per plan + 1 user-requested fix)
- **Files modified:** 2

## Accomplishments

- Resized BIDAXIOM logo from 320x74 to 240x56 (75% scale) in both sign-in form render paths
- Added 25px bottom padding between logo and sign-in card in both paths
- Updated alt text from "BidAxiom" to "BIDAXIOM" (all-caps per BRAND-01 copy standard)
- Removed misleading "Dashboard" layout-level title — dashboard tabs now show plain "BIDAXIOM"
- User verified all 4 phase success criteria (BRAND-01, BRAND-02, BRAND-04, CLEAN-01) and approved

## Task Commits

Each task was committed atomically:

1. **Task 1: Resize logo in both sign-in form render paths** - `ed76fbd` (feat)
2. **Fix: Remove dashboard layout title** - `b48fe14` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/web/app/(auth)/sign-in/[[...sign-in]]/sign-in-form.tsx` — Both logo blocks updated: width 320->240, height 74->56, pb-[25px] on wrapper, alt "BIDAXIOM"
- `apps/web/app/(dashboard)/layout.tsx` — Removed metadata export entirely; root layout default "BIDAXIOM" now applies to all dashboard pages

## Decisions Made

- Sign-in logo resized to 240x56 (75% of 320x74) as specified by BRAND-04; both MFA path and normal path updated identically
- User explicitly requested plain "BIDAXIOM" over "Dashboard | BIDAXIOM" after checkpoint approval — architectural constraint acknowledged (all dashboard pages are "use client" and cannot export per-route metadata)
- Removed the entire metadata export block from `(dashboard)/layout.tsx` rather than just the title key — cleaner, no dead import

## Deviations from Plan

### User-Requested Post-Approval Fix

**[User Decision] Remove dashboard layout title to show plain "BIDAXIOM" in dashboard tabs**
- **Found during:** Checkpoint (human-verify)
- **Context:** User approved all 4 success criteria but noted that every dashboard page showing "Dashboard | BIDAXIOM" was misleading since no tab is individually titled
- **Decision:** User prefers "BIDAXIOM" (root layout default) over a generic "Dashboard" prefix applied to all dashboard pages
- **Fix:** Removed `export const metadata: Metadata = { title: "Dashboard" }` from `apps/web/app/(dashboard)/layout.tsx`
- **Files modified:** `apps/web/app/(dashboard)/layout.tsx`
- **Commit:** `b48fe14`

---

**Total deviations:** 1 user-requested post-approval fix
**Impact on plan:** Minor — user-directed simplification, not a bug or oversight. All plan success criteria already passed before this change.

## Issues Encountered

None — plan executed cleanly. The architectural constraint (dashboard "use client" pages cannot export metadata) was acknowledged in 30-02 decisions; the user's preferred resolution was to use the root default rather than a misleading layout-level title.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 30 (Brand Identity & Sidebar Cleanup) is fully complete — all 3 plans executed, all 4 requirements met (BRAND-01, BRAND-02, BRAND-04, CLEAN-01)
- Phase 31 (Color Palette) is next; mandatory human checkpoint required before applying any colors — palette must be extracted and presented to user for approval first
- Sign-in shows "Sign In | BIDAXIOM", all dashboard pages show "BIDAXIOM", no "ConstructionSaaS" anywhere

---
*Phase: 30-brand-identity-and-sidebar-cleanup*
*Completed: 2026-02-18*
