---
phase: quick-25-restore-logo-and-favicon-sizes-shrunk-du
plan: 01
subsystem: ui
tags: [next-image, tailwind, branding, logo]

requires: []
provides:
  - "Sign-in logo rendered at 320x74 (up from 240x56)"
  - "Sidebar logo at h-10 w-auto (up from h-8 w-auto)"
  - "Top-bar logo at h-10 w-auto (up from h-8 w-auto)"
affects: [branding, sign-in, sidebar, top-bar]

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - apps/web/app/(auth)/sign-in/[[...sign-in]]/sign-in-form.tsx
    - apps/web/components/layout/sidebar.tsx
    - apps/web/components/layout/top-bar.tsx

key-decisions:
  - "Sign-in logo width/height props increased (240x56 -> 320x74) to compensate for tighter-cropped committed PNG (1511x1023, 1.47:1 ratio)"
  - "Sidebar and top-bar logo h-8 -> h-10 increases displayed height from ~32px to ~40px, width from ~47px to ~59px given the 1.47:1 ratio"

patterns-established: []

requirements-completed: [QUICK-25]

duration: 4min
completed: 2026-02-18
---

# Quick Task 25: Restore Logo Display Sizes Summary

**Sign-in logo increased to 320x74 and sidebar/top-bar logos increased to h-10 w-auto after git reset --hard destroyed the wider-ratio PNG files**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-18T00:00:00Z
- **Completed:** 2026-02-18T00:04:00Z
- **Tasks:** 2 auto tasks complete + 1 human-verify checkpoint pending
- **Files modified:** 3

## Accomplishments

- Both logo `<Image>` components in sign-in-form.tsx updated from `width={240} height={56}` to `width={320} height={74}` (MFA screen and main login screen)
- Sidebar logo className updated from `h-8 w-auto` to `h-10 w-auto` — logo ~47px wide -> ~59px wide
- Top-bar logo className updated from `h-8 w-auto` to `h-10 w-auto` — consistent with sidebar

## Task Commits

1. **Tasks 1+2: Restore sign-in, sidebar, and top-bar logo sizes** - `cdaeae8` (fix)

## Files Created/Modified

- `apps/web/app/(auth)/sign-in/[[...sign-in]]/sign-in-form.tsx` - Both logo Image props: width 240->320, height 56->74
- `apps/web/components/layout/sidebar.tsx` - Logo className h-8->h-10
- `apps/web/components/layout/top-bar.tsx` - Logo className h-8->h-10

## Decisions Made

- Increased CSS display sizes rather than replacing the PNG — the committed `bidaxiom-logo.png` is 1511x1023 (nearly square, 1.47:1 ratio), which Next.js will render within the given container. If the user later provides a wider-ratio PNG (horizontal banner format), the larger CSS containers will display it correctly without further code changes.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Logo sizes restored to pre-Phase-30 dimensions across all three locations
- If the user provides a wider horizontal PNG to replace `apps/web/public/bidaxiom-logo.png`, no code changes are needed — the CSS containers are now correctly sized
- Human verification checkpoint pending (visit /sign-in and check sidebar/top-bar logos)

---
*Phase: quick-25*
*Completed: 2026-02-18*
