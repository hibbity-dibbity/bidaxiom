---
phase: 31-color-palette-and-favicon
plan: 02
subsystem: ui
tags: [css-variables, color-palette, branding, hsl, tailwind, favicon, next-js, button]

# Dependency graph
requires:
  - phase: 31-color-palette-and-favicon
    plan: 01
    provides: Approved HSL palette table (all CSS variable values confirmed by user)
provides:
  - globals.css updated with BIDAXIOM brand colors in :root and .dark blocks
  - button.tsx outline variant updated to use brand primary color
  - Favicon wired via both Next.js file-based detection (app/icon.png) and metadata API
  - Fully rebranded UI — buttons, active nav, focus rings, body text all in BIDAXIOM colors
affects:
  - Any future phase touching --primary, --ring, --foreground, or --sidebar-primary
  - Any future phase adding new button variants (outline pattern now uses border-primary text-primary)
  - PWA / bookmark icon behavior

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual favicon mechanism: file-based (app/icon.png) for most browsers + metadata.icons for PWA/bookmarks/edge cases"
    - "CSS variable palette: 10 variables updated surgically across :root and .dark blocks; all others preserved"
    - "Outline button variant: border-primary text-primary pattern (not border-input text-foreground)"

key-files:
  created:
    - apps/web/app/icon.png
  modified:
    - apps/web/app/globals.css
    - apps/web/components/ui/button.tsx
    - apps/web/app/layout.tsx

key-decisions:
  - "Cyan-teal (188 80% 45%/50%) is the primary button color — user preference; slate-blue is for body text and light-mode active nav"
  - "Slate-blue (210 25% 25%) applied to --foreground, --card-foreground, --popover-foreground in light mode — gives brand cohesion to all body text"
  - "Dark mode primary stays vivid at L=50% (188 80% 50%), not the originally proposed lighter L=65%"
  - "Outline buttons use border-primary text-primary so secondary actions also display in brand cyan-teal"
  - "Both Next.js favicon mechanisms used: file-based (app/icon.png) and metadata.icons — belt-and-suspenders for browser compatibility"

patterns-established:
  - "Dual favicon: app/icon.png (file-based auto-detection) + layout.tsx metadata.icons (belt-and-suspenders)"
  - "Outline button variant: border-primary text-primary — secondary actions match brand primary"

requirements-completed:
  - BRAND-03
  - BRAND-05

# Metrics
duration: ~15min (incl. human visual verification)
completed: 2026-02-18
---

# Phase 31 Plan 02: Color Palette Application and Favicon Setup Summary

**10 CSS variables updated across :root and .dark for cyan-teal buttons and slate-blue body text, outline button variant repointed to brand primary, and BIDAXIOM icon wired as favicon via dual Next.js mechanisms — all visually verified by user.**

## Performance

- **Duration:** ~15 min (including human visual verification checkpoint)
- **Started:** 2026-02-18
- **Completed:** 2026-02-18
- **Tasks:** 3 (Task 1: palette + button; Task 2: favicon; Task 3: human visual verification)
- **Files modified:** 4 (globals.css, button.tsx, layout.tsx, icon.png created)

## Accomplishments

- Applied approved BIDAXIOM palette to globals.css: 7 variables updated in :root block (--foreground, --card-foreground, --popover-foreground, --primary, --ring, --sidebar-primary) and 3 in .dark block (--primary, --ring, --sidebar-primary); --accent-construction orange left unchanged in both blocks
- Updated button.tsx outline variant from `border-input text-foreground` to `border-primary text-primary` so secondary/outline buttons display in brand cyan-teal
- Created apps/web/app/icon.png (366418 bytes — binary copy of public/bidaxiom-icon.png) for Next.js file-based favicon auto-detection
- Added `icons` field to layout.tsx metadata object with icon/shortcut/apple entries pointing to /bidaxiom-icon.png for PWA, bookmark, and edge-case browser coverage
- User visually verified all checks: favicon in tab, cyan-teal primary buttons, cyan-teal outline borders, slate-blue active sidebar (light), vivid cyan active sidebar (dark), slate-blue body text (light), vivid cyan dark-mode buttons — no regressions reported

## Task Commits

Each task was committed atomically:

1. **Task 1: Apply approved palette to globals.css + button.tsx outline variant** - `8d13ddf` (feat)
2. **Task 2: Set BIDAXIOM icon as favicon** - `96f5a46` (feat)
3. **Task 3: Human visual verification** - no commit (visual-only checkpoint; user typed "verified")

**Plan metadata:** see final docs commit below.

## Files Created/Modified

- `apps/web/app/globals.css` - 10 CSS variables updated: :root gets cyan-teal primary (188 80% 45%) and slate-blue foreground/sidebar (210 25% 25%); .dark gets vivid cyan across primary/ring/sidebar-primary (188 80% 50%)
- `apps/web/components/ui/button.tsx` - Outline variant: `border border-input bg-background` → `border border-primary bg-background text-primary` (cyan-teal border and label)
- `apps/web/app/icon.png` - Created: 366418-byte binary copy of public/bidaxiom-icon.png; Next.js App Router auto-detects this as favicon
- `apps/web/app/layout.tsx` - Added `icons: { icon, shortcut, apple }` all pointing to `/bidaxiom-icon.png` in metadata export

## Exact HSL Values Applied

### :root block (light mode)

| Variable               | Before              | After           |
|------------------------|---------------------|-----------------|
| `--foreground`         | `240 10% 3.9%`      | `210 25% 25%`   |
| `--card-foreground`    | `240 10% 3.9%`      | `210 25% 25%`   |
| `--popover-foreground` | `240 10% 3.9%`      | `210 25% 25%`   |
| `--primary`            | `240 5.9% 10%`      | `188 80% 45%`   |
| `--ring`               | `240 5.9% 10%`      | `188 80% 45%`   |
| `--sidebar-primary`    | `240 5.9% 10%`      | `210 25% 25%`   |

### .dark block (dark mode)

| Variable               | Before              | After           |
|------------------------|---------------------|-----------------|
| `--primary`            | `0 0% 98%`          | `188 80% 50%`   |
| `--primary-foreground` | `240 5.9% 10%`      | `0 0% 100%`     |
| `--ring`               | `240 4.9% 83.9%`    | `188 80% 50%`   |
| `--sidebar-primary`    | `224.3 76.3% 48%`   | `188 80% 50%`   |

**Unchanged (confirmed):** `--accent-construction` remains `25 95% 53%` in :root and `25 95% 58%` in .dark.

## Decisions Made

- **Cyan-teal as primary button color.** Carried forward from Plan 31-01 user decision: H=188 (the cyan circle color from the BIDAXIOM icon) is the action color; slate-blue H=210 (the wordmark color) is the text/nav-indicator color.
- **Slate-blue body text in light mode.** `--foreground`, `--card-foreground`, and `--popover-foreground` all set to `210 25% 25%` so the slate-blue wordmark color permeates all body text in light mode for brand cohesion.
- **Outline buttons use border-primary/text-primary.** Since `--primary` is now cyan-teal, outline buttons needed a matching update; keeping `border-input text-foreground` would render them grey/slate and visually inconsistent with the primary brand action color.
- **Both Next.js favicon mechanisms used.** File-based (`app/icon.png`) covers most browsers automatically; metadata `icons` field covers PWA shortcuts, bookmarks, and any browsers that need explicit `<link rel="icon">` — belt-and-suspenders approach for maximum compatibility.

## Deviations from Plan

None — plan executed exactly as written. Both auto tasks completed with the expected files, and the human visual verification checkpoint passed cleanly with user typing "verified".

## Issues Encountered

None. All 7 visual checks passed without any regressions reported.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 31 is now complete. Both plans (31-01 palette approval, 31-02 palette application) are done.
- The BIDAXIOM brand palette is live in the running application; any future phase that adds UI components can use standard Tailwind classes (`bg-primary`, `text-primary`, `border-primary`, `ring-primary`) and will automatically inherit the brand colors.
- No blockers. The `--accent-construction` orange, destructive red, and neutral backgrounds are all untouched and confirmed working.

---
*Phase: 31-color-palette-and-favicon*
*Completed: 2026-02-18*
