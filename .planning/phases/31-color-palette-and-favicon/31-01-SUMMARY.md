---
phase: 31-color-palette-and-favicon
plan: 01
subsystem: ui
tags: [css-variables, color-palette, branding, hsl, tailwind, design-tokens]

# Dependency graph
requires:
  - phase: 30-brand-identity-and-sidebar-cleanup
    provides: brand assets (bidaxiom-logo.png, bidaxiom-icon.png) finalized in place
provides:
  - Approved HSL palette table (all CSS variable values confirmed by user)
  - Decision record: cyan-teal as primary action color, slate-blue as body text
  - Ready-to-apply values for Plan 31-02
affects:
  - 31-02 (applies these approved values to globals.css and button.tsx)
  - Any future phase that touches --primary, --ring, or --sidebar-primary

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Palette approval gate: extract colors visually, present table, require explicit user approval before any CSS change"
    - "HSL color tokens stored in globals.css :root and .dark blocks; Tailwind reads via CSS variable passthrough"

key-files:
  created:
    - .planning/phases/31-color-palette-and-favicon/31-01-SUMMARY.md
  modified: []

key-decisions:
  - "Primary action color (buttons) = cyan-teal (H=188 S=80% L=45% light / L=50% dark), NOT slate-blue — user changed from original proposal"
  - "Foreground body text = slate-blue (H=210 S=25% L=25%) in light mode — user added this; dark mode foreground stays near-white"
  - "Outline/secondary buttons need button.tsx update (border-input text-foreground → border-primary text-primary) — deferred to Plan 31-02"
  - "Dark mode primary lightness = 50% (vivid), not 65% (lighter) as originally proposed — user corrected"

patterns-established:
  - "Color approval gate: read-only analysis plan followed by human checkpoint before any codebase change"

requirements-completed:
  - BRAND-03

# Metrics
duration: ~20min (incl. human review)
completed: 2026-02-18
---

# Phase 31 Plan 01: Color Palette Extraction and Approval Summary

**Visual extraction of BIDAXIOM brand colors from logo/icon, mapped to CSS variable roles, and user-approved palette with cyan-teal primary buttons and slate-blue body text.**

## Performance

- **Duration:** ~20 min (including human review checkpoint)
- **Started:** 2026-02-18
- **Completed:** 2026-02-18
- **Tasks:** 2 (Task 1: extraction + proposal; Task 2: human approval checkpoint)
- **Files modified:** 0 (read-only plan — no codebase changes)

## Accomplishments

- Visually extracted two brand colors from `bidaxiom-logo.png` and `bidaxiom-icon.png`: cyan-teal circle (H=188) and slate-blue wordmark/checkmark (H=210)
- Mapped colors to CSS variable roles and presented full proposed palette table to user
- Received user approval with specific adjustments: primary = cyan-teal (not slate-blue), foreground = slate-blue in light mode, dark mode primary lightness = 50%
- Recorded approved HSL values in this SUMMARY for Plan 31-02 to consume directly

## Task Commits

Plan 31-01 was read-only. No per-task commits were made (plan frontmatter `files_modified: []`).

**Plan metadata:** see final commit below.

## Files Created/Modified

- `.planning/phases/31-color-palette-and-favicon/31-01-SUMMARY.md` — this file (approved palette record)

No production files were created or modified.

---

## APPROVED VALUES

Plan 31-02 reads this section to get exact HSL values. Do not edit manually.

### Light Mode (`:root` block in `globals.css`)

| Variable                    | Approved HSL Value | Notes                                     |
| --------------------------- | ------------------ | ----------------------------------------- |
| `--primary`                 | `188 80% 45%`      | Cyan-teal buttons (user changed from slate-blue) |
| `--primary-foreground`      | `0 0% 100%`        | White text on cyan buttons                |
| `--ring`                    | `188 80% 45%`      | Cyan-teal focus rings — follows primary   |
| `--foreground`              | `210 25% 25%`      | Slate-blue body text (user added; replaces near-black) |
| `--card-foreground`         | `210 25% 25%`      | Slate-blue text in cards                  |
| `--popover-foreground`      | `210 25% 25%`      | Slate-blue text in dropdowns              |
| `--sidebar-primary`         | `210 25% 25%`      | Slate-blue active nav item (unchanged from original proposal) |

### Dark Mode (`.dark` block in `globals.css`)

| Variable                    | Approved HSL Value | Notes                                     |
| --------------------------- | ------------------ | ----------------------------------------- |
| `--primary`                 | `188 80% 50%`      | Vivid cyan-teal (user changed from 70% L lightness) |
| `--primary-foreground`      | `0 0% 100%`        | White text on cyan buttons                |
| `--ring`                    | `188 80% 50%`      | Cyan-teal focus rings (unchanged from original proposal) |
| `--sidebar-primary`         | `188 80% 50%`      | Cyan active nav in dark mode (unchanged from original proposal) |

> Dark mode `--foreground` stays near-white — user only requested the light mode font change.

### Variables NOT Changed (intentionally excluded)

| Variable                   | Reason                                                      |
| -------------------------- | ----------------------------------------------------------- |
| `--accent-construction`    | Pre-existing orange; not from BIDAXIOM logo; must remain    |
| `--background`             | Neutral — intentionally unchanged                           |
| `--secondary`              | Neutral — intentionally unchanged                           |
| `--muted`                  | Neutral — intentionally unchanged                           |
| `--destructive`            | Red/error — intentionally unchanged                         |
| `--sidebar-primary-foreground` | White on dark — no change needed                        |
| `tailwind.config.ts`       | Pure CSS variable passthrough — never modified              |

---

## Button Component Change (Plan 31-02)

The following change to `apps/web/components/ui/button.tsx` is required alongside the CSS variable updates.

**File:** `apps/web/components/ui/button.tsx`
**Location:** `outline` variant class string
**Change:** Replace `border-input text-foreground` with `border-primary text-primary`

This gives outline/secondary buttons a cyan-teal border and cyan-teal label, consistent with the primary brand color. Without this change, outline buttons would render with the default input border color (grey) rather than the approved brand cyan-teal.

---

## Decisions Made

- **Primary action color is cyan-teal, not slate-blue.** Original proposal mapped slate-blue (H=210) to `--primary`. User corrected: cyan-teal (H=188) is the brand's action color (the circle behind the checkmark), not the wordmark color. Slate-blue moves to `--foreground`/`--sidebar-primary`.
- **Body text becomes slate-blue in light mode.** User added `--foreground`, `--card-foreground`, and `--popover-foreground` at `210 25% 25%` — this brings the slate-blue wordmark color into body text for brand cohesion in light mode.
- **Dark mode primary stays vivid (L=50%), not lighter (L=65%).** Original proposal used `188 70% 65%` to keep dark-mode primary readable on dark backgrounds. User prefers the vivid `188 80% 50%` to maintain brand intensity.
- **Outline button variant needs `button.tsx` update.** Since `--primary` is now cyan-teal, the `outline` variant's `border-input text-foreground` classes must become `border-primary text-primary` so secondary buttons display in brand color.

## Deviations from Plan

None — plan executed exactly as written. The palette table was presented, the human checkpoint fired, and the user responded with approved values. No files were modified.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Plan 31-02 is ready to execute. It should:

1. Read the **APPROVED VALUES** section above for exact HSL numbers
2. Apply all `:root` variable changes to `apps/web/app/globals.css`
3. Apply all `.dark` variable changes to `apps/web/app/globals.css`
4. Update `apps/web/components/ui/button.tsx` outline variant: `border-input text-foreground` → `border-primary text-primary`
5. Verify visually that buttons, focus rings, active nav items, and body text match brand colors

No blockers. All values are approved and recorded.

---
*Phase: 31-color-palette-and-favicon*
*Completed: 2026-02-18*
