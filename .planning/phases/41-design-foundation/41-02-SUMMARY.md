---
phase: 41-design-foundation
plan: 02
subsystem: ui
tags: [tailwind, dark-mode, css-variables, tokens, design-system]

# Dependency graph
requires:
  - phase: 41-01
    provides: CSS variable tokens (financial-positive, bg-card, bg-muted, etc.) defined in tailwind.config.ts and globals.css
provides:
  - All 4 auth pages token-compliant (no hardcoded palette classes)
  - All 7 settings/integrations pages token-compliant (no hardcoded palette classes)
  - Amber callout pattern migrated to bg-muted + border-border + text-muted-foreground
affects: [41-03, 41-04, 41-05, 41-06, 42-design-dark-mode-audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Amber callout (read-only/warning) → bg-muted border-border text-muted-foreground (NOT amber-50/amber-200)"
    - "Password requirement met (checkmark) → text-financial-positive (NOT text-green-600)"
    - "Success state icon/text → text-financial-positive + bg-muted (NOT bg-green-100 + text-green-600)"
    - "dark: companion classes eliminated — token system handles dark mode automatically"

key-files:
  created: []
  modified:
    - apps/web/app/(auth)/mfa-setup/page.tsx
    - apps/web/app/(auth)/reset-password/page.tsx
    - apps/web/app/(auth)/sign-up/[[...sign-up]]/page.tsx
    - apps/web/app/(auth)/verify-email/page.tsx
    - apps/web/app/(dashboard)/settings/account/page.tsx
    - apps/web/app/(dashboard)/settings/company/page.tsx
    - apps/web/app/(dashboard)/settings/document-naming/page.tsx
    - apps/web/app/(dashboard)/settings/document-templates/page.tsx
    - apps/web/app/(dashboard)/settings/document-templates/[templateId]/field-mapping-client.tsx
    - apps/web/app/(dashboard)/settings/integrations/calendar/callback/page.tsx
    - apps/web/app/(dashboard)/settings/integrations/quickbooks/callback/page.tsx

key-decisions:
  - "field-mapping-client: mapped/unmapped field badges use bg-muted with text-financial-positive (mapped) and text-foreground (unmapped) — avoids bg-green-100/bg-amber-100 which don't token-invert"
  - "Amber callout (read-only warning) maps to bg-muted + border-border — neutral info surface, not a warning surface; this is the correct semantic since it's just a permissions note"
  - "BIDAXIOM field key display in reference sidebar migrated from text-amber-700 to text-muted-foreground — decorative amber not valid in token system"

patterns-established:
  - "Success state (connection confirmed, email verified): bg-muted icon wrapper + text-financial-positive icon + text-foreground message"
  - "Read-only callout: bg-muted border-border, icon text-muted-foreground, title text-foreground, body text-muted-foreground"

requirements-completed:
  - FOUND-01

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 41 Plan 02: Auth and Settings Pages Token Migration Summary

**11 auth/settings pages migrated from hardcoded Tailwind palette classes to CSS variable tokens, achieving dark mode compliance with zero layout or logic changes**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-21T21:46:31Z
- **Completed:** 2026-02-21T21:48:35Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Migrated all 4 auth pages (mfa-setup, reset-password, sign-up, verify-email): QR code surface, password requirement indicators, success icons all using token classes
- Migrated all 7 settings/integrations pages: amber callout pattern → bg-muted, success states → text-financial-positive, field mapping UI status indicators → token classes
- Eliminated all dark: companion class hacks across all 11 files — token system handles dark mode automatically

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate Group A — Auth pages (4 files)** - `bb2ebeb` (feat)
2. **Task 2: Migrate Group B — Settings and integrations pages (7 files)** - `51cf247` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/web/app/(auth)/mfa-setup/page.tsx` - bg-white → bg-card, text-green-500 → text-financial-positive
- `apps/web/app/(auth)/reset-password/page.tsx` - text-green-500/600 → text-financial-positive for checkmark and requirement indicators
- `apps/web/app/(auth)/sign-up/[[...sign-up]]/page.tsx` - text-green-500/600 → text-financial-positive
- `apps/web/app/(auth)/verify-email/page.tsx` - text-green-500 → text-financial-positive
- `apps/web/app/(dashboard)/settings/account/page.tsx` - MFA "Enabled" badge text-green-600 → text-financial-positive
- `apps/web/app/(dashboard)/settings/company/page.tsx` - amber callout → bg-muted border-border text-foreground/muted-foreground
- `apps/web/app/(dashboard)/settings/document-naming/page.tsx` - amber callout → bg-muted border-border text-foreground/muted-foreground
- `apps/web/app/(dashboard)/settings/document-templates/page.tsx` - field count text-green-600/amber-600 → text-financial-positive/muted-foreground
- `apps/web/app/(dashboard)/settings/document-templates/[templateId]/field-mapping-client.tsx` - removed all dark: companions; mapped/unmapped badges use bg-muted + text-financial-positive; amber-700 field labels → text-muted-foreground
- `apps/web/app/(dashboard)/settings/integrations/calendar/callback/page.tsx` - success state bg-green-100/text-green-600/green-900 → bg-muted/text-financial-positive/foreground
- `apps/web/app/(dashboard)/settings/integrations/quickbooks/callback/page.tsx` - success state bg-green-100/text-green-600/green-900 → bg-muted/text-financial-positive/foreground

## Decisions Made

- **field-mapping-client badge states:** The original green/amber badges used dark: companion hacks (bg-green-900/30 dark:text-green-300). Replaced with bg-muted + text-financial-positive (mapped) and bg-muted + text-foreground (unmapped) — cleaner semantic pairing that actually token-inverts correctly in dark mode.
- **Amber callout semantic:** Read-only warning callout uses bg-muted (neutral info surface) not a warning/amber semantic surface — appropriate since it's just a permissions notice, not an actionable warning.
- **BIDAXIOM field key display:** Changed from text-amber-700 (decorative amber for doc merge field syntax highlighting) to text-muted-foreground — the token system has no amber semantic, and code-display secondary text maps naturally to muted-foreground.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 11 files in Wave 2 scope are now dark mode compliant
- Pattern established: amber callouts → bg-muted, success states → text-financial-positive
- Ready for Wave 2 continuation (41-03 through 41-06 cover remaining file groups)

## Self-Check: PASSED

- All 11 modified files exist on disk
- Commits bb2ebeb (Task 1) and 51cf247 (Task 2) confirmed in git log

---
*Phase: 41-design-foundation*
*Completed: 2026-02-21*
