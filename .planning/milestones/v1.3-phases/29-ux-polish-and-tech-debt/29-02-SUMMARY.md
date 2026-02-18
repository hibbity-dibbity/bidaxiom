---
phase: 29-ux-polish-and-tech-debt
plan: "02"
subsystem: api
tags: [job-number, auto-generation, drizzle, trpc, transaction]

# Dependency graph
requires:
  - phase: 24-job-number-settings
    provides: "startingSequenceNumber and counter increment logic in project.create"
provides:
  - "project.update mutation with counter-advance logic matching project.create"
  - "db.transaction wrapping both project update and companyProfiles counter update"
affects: [job-number-settings, project-edit-page, estimating-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Counter-advance logic in update mutations mirrors create mutation pattern"
    - "db.transaction used to atomically update both resource and job number counter"

key-files:
  created: []
  modified:
    - apps/api/src/trpc/routers/project.ts

key-decisions:
  - "Counter only advances if manual sequence >= current nextSequenceNumber (same guard as project.create)"
  - "isNull import already available — no new imports required"
  - "updatedJobSettings !== jobNumberSettings reference check used to skip unnecessary DB write when no change"

patterns-established:
  - "update mutations that accept manual job numbers must load companyProfile and conditionally advance counter in a transaction"

requirements-completed:
  - JOBEDIT-01

# Metrics
duration: 3min
completed: 2026-02-18
---

# Phase 29 Plan 02: Job Number Counter-Advance in project.update Summary

**Counter-advance logic added to project.update mutation so manually editing a job number on the edit project page advances the auto-generation counter, preventing future conflicts**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-18T02:16:28Z
- **Completed:** 2026-02-18T02:19:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added company profile load and jobNumberSettings extraction to the `update` mutation
- Implemented sequence digit extraction using the template `{N+}` pattern (exact mirror of `project.create` logic)
- Wrapped the project update and optional counter update in a `db.transaction` for atomicity
- Closes tech debt gap: JOBEDIT-01 (edit page job number changes did not advance counter)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add job number counter-advance logic to project.update mutation** - `3ad1dd2` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `apps/api/src/trpc/routers/project.ts` - Added counter-advance logic and transaction wrapping to the `update` mutation (lines 624-669)

## Decisions Made
- Counter only advances if `manualSequence >= jobNumberSettings.nextSequenceNumber` — same guard as project.create, avoids regressing the counter
- Reference equality check (`updatedJobSettings !== jobNumberSettings`) skips the companyProfiles DB write when no advancement needed — avoids unnecessary write on every project update

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — TypeScript compiles cleanly. Pre-existing errors in other files (bid.ts, quickbooks, check-search-data.ts) are unrelated to this change and were present before.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- JOBEDIT-01 requirement satisfied: edit-page job number changes now advance the auto-generation counter
- Phase 29 continues with remaining UX polish and tech debt plans
