---
phase: 22-validation-and-duplicate-prevention
plan: "02"
subsystem: ui
tags: [react-hook-form, trpc, validation, job-numbers, blur-handler, lucide-react]

# Dependency graph
requires:
  - phase: 22-01
    provides: checkJobNumberAvailability with ilike and excludeProjectId, validateJobNumberFormat from @construction/shared
  - phase: 20-configuration-foundation
    provides: jobNumberSettings schema with template and enabled flag
  - phase: 21-assignment-and-auto-generation
    provides: manualJobNumber toggle pattern in project-form
provides:
  - handleJobNumberBlur two-step validation (format check then async duplicate check)
  - Loading spinner during in-flight duplicate check
  - Inline duplicate error with clickable link to existing project
  - Submit button disabled while checking or duplicate detected
  - onSubmit safety net re-validates before submitting
  - Use Auto-generated clears all validation state
affects: [22-03, project-form, project creation flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Two-step blur validation: format first (sync), then async duplicate check
    - utils.company.checkJobNumberAvailability.fetch() for imperative tRPC call
    - duplicateProject state for rendering error UI independent of RHF error state
    - onBlur overrides RHF field.onBlur() then calls custom async handler

key-files:
  created: []
  modified:
    - apps/web/components/project/project-form.tsx

key-decisions:
  - "Format check runs before duplicate check — prevents unnecessary network calls for invalid formats; matches JOBVAL-03 requirement"
  - "duplicateProject state separate from RHF errors — enables rich UI (clickable link) that FormMessage cannot render; form.setError with space character keeps FormMessage height stable"
  - "onSubmit safety net re-runs handleJobNumberBlur — prevents race condition where user submits before blur fires"

patterns-established:
  - "Two-step async validation: sync format gate → async availability check, abort if sync fails"
  - "Rich inline error UI: duplicateProject state renders link alongside RHF FormMessage"

requirements-completed: [JOBVAL-01, JOBVAL-02, JOBVAL-03]

# Metrics
duration: 2min
completed: 2026-02-17
---

# Phase 22 Plan 02: Blur Validation for Job Number Field Summary

**Two-step blur validation on the job number input: format check (format gate only when auto-gen enabled) then async duplicate check via tRPC, with inline error showing taken project as a clickable link**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-17T04:17:11Z
- **Completed:** 2026-02-17T04:19:02Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `handleJobNumberBlur` async function with two-step validation: format check (only when auto-gen enabled) then async duplicate check
- Loading spinner (`Loader2`) shows while `checkJobNumberAvailability` fetch is in-flight
- Inline duplicate error renders job number and clickable project link with `ExternalLink` icon
- Submit button disabled while check is in-flight or duplicate detected
- `onSubmit` safety net re-runs blur validation before mutating, aborts if errors exist
- "Use Auto-generated" button clears all errors and `duplicateProject` state

## Task Commits

Each task was committed atomically:

1. **Task 1: Add blur validation handler and state to project-form.tsx** - `d59da8a` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `apps/web/components/project/project-form.tsx` - Added `validateJobNumberFormat` import, `Loader2`/`ExternalLink` icons, `isCheckingDuplicate`/`duplicateProject` state, `handleJobNumberBlur` handler, `onSubmit` made async with safety net, `onBlur` on Input, loading/duplicate UI below FormMessage, disabled submit button, cleared state on Use Auto-generated

## Decisions Made
- Format check runs before duplicate check — prevents unnecessary network calls for invalid formats; matches JOBVAL-03 requirement ("Format is checked first; if it fails, duplicate check does not fire")
- `duplicateProject` state is separate from RHF errors — enables rich UI (clickable link) that `FormMessage` cannot render; `form.setError` with a space character keeps `FormMessage` height stable for layout
- `onSubmit` safety net re-runs `handleJobNumberBlur` — prevents race condition where user submits before blur fires on the field

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors exist in `apps/api/src/` files (bid.ts, bidGeneration.ts, estimateLifecycle.ts, quickbooks oauth.ts) — all out of scope. Pre-existing TS2353 error in customerForm defaultValues (line 191) also pre-exists and is out of scope. No new errors introduced by this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `project-form.tsx` now has full blur validation for the create flow
- Plan 22-03 (edit form validation) can use the same `handleJobNumberBlur` pattern but with `excludeProjectId` passed to `checkJobNumberAvailability`
- All JOBVAL requirements (01, 02, 03) are now implemented end-to-end for the create flow

## Self-Check: PASSED

- FOUND: apps/web/components/project/project-form.tsx
- FOUND: .planning/phases/22-validation-and-duplicate-prevention/22-02-SUMMARY.md
- Commit d59da8a verified: feat(22-02): add blur validation to job number field in project-form
- grep "handleJobNumberBlur": lines 249, 289, 525
- grep "validateJobNumberFormat": lines 7, 258
- grep "isCheckingDuplicate": lines 171, 537, 792
- grep "duplicateProject": lines 172, 291, 543, 548, 553, 792

---
*Phase: 22-validation-and-duplicate-prevention*
*Completed: 2026-02-17*
