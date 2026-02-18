---
phase: 29-ux-polish-and-tech-debt
plan: "04"
subsystem: ui
tags: [react, trpc, react-query, toast, job-numbers, uat]

# Dependency graph
requires:
  - phase: 29-01
    provides: QueryCache global error handler (UX-03)
  - phase: 29-02
    provides: project.update job number counter-advance logic (JOBEDIT-01)
  - phase: 29-03
    provides: empty state upgrades and skeleton loading (UX-01, UX-02)
provides:
  - Human UAT sign-off on all Phase 29 requirements (UX-01, UX-02, UX-03, JOBEDIT-01)
  - Six UAT hotfixes: toast deduplication, cache invalidation, job number uniqueness enforcement, startingSequenceNumber floor logic
affects: [phase-30, job-numbers, settings, project-create, project-edit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UAT-driven hotfix pattern: fix inline during UAT, commit immediately, continue verification"
    - "Cache invalidation on project create/edit ensures settings page reads fresh job sequence state"
    - "Server-side uniqueness inside transactions as last-resort guard against race conditions"

key-files:
  created: []
  modified:
    - apps/api/src/trpc/routers/project.ts
    - apps/api/src/trpc/routers/company.ts
    - apps/web/app/(dashboard)/settings/company/page.tsx
    - apps/web/app/providers.tsx

key-decisions:
  - "Toast deduplication via id on QueryCache.onError: one toast per error type, not one per re-render"
  - "Invalidate companyProfile cache on project create/edit so settings page always shows accurate nextSequenceNumber"
  - "startingSequenceNumber change floors nextSequenceNumber above highest used job number to prevent duplicate assignments"
  - "Hard server-side uniqueness check inside transaction (not just advisory) for both auto-generate and manual-edit paths"

patterns-established:
  - "Pattern: UAT hotfixes committed as standalone fix() commits before plan SUMMARY — traceable in git log"
  - "Pattern: invalidateQueries on write mutations should span all caches that read derived state"

requirements-completed:
  - UX-01
  - UX-02
  - UX-03
  - JOBEDIT-01

# Metrics
duration: UAT session (human-gated; 6 hotfix commits during verification)
completed: 2026-02-17
---

# Phase 29 Plan 04: UAT Verification Summary

**Human UAT sign-off on all four Phase 29 requirements, plus six hotfixes surfaced during verification: toast deduplication, company cache invalidation, job number uniqueness enforcement in transactions, and startingSequenceNumber floor logic**

## Performance

- **Duration:** Human-gated UAT session (6 hotfix commits before approval)
- **Started:** 2026-02-17
- **Completed:** 2026-02-17
- **Tasks:** 1 (human-verify checkpoint)
- **Files modified:** 4 (across UAT hotfixes)

## Accomplishments

- All four Phase 29 requirements verified in browser by human tester and approved
- Duplicate query error toasts eliminated — toast deduplication via id ensures one toast per error regardless of re-render count
- Company profile cache invalidated on project create/edit so Settings page always reflects accurate nextSequenceNumber
- startingSequenceNumber changes now floor nextSequenceNumber above the highest-ever-used sequence number, preventing duplicate job number assignments
- Hard server-side uniqueness check added inside database transactions for both auto-generate and manual-edit paths

## Task Commits

Plan 29-04 was a human-verify checkpoint; no automated task commits were made by the executor. UAT hotfixes were committed during verification:

1. **fix(29-uat): deduplicate query error toasts and invalidate company cache on project edit** - `f98f2fa`
2. **fix(settings): sync nextSequenceNumber when startingSequenceNumber changes** - `2602a8b`
3. **fix(job-numbers): enforce uniqueness on auto-generation and invalidate cache on create** - `9e59b52`
4. **fix(job-numbers): hard server-side uniqueness check inside transactions** - `a156731`
5. **fix(settings): floor nextSequenceNumber above highest used job number when startingSequenceNumber changes** - `354ec43`
6. **fix(settings): invalidate getMaxUsedJobSequence cache on project create/edit** - `38f4dc8`

## Files Created/Modified

- `apps/api/src/trpc/routers/project.ts` - Added hard uniqueness check in transaction; invalidate getMaxUsedJobSequence cache on create/edit
- `apps/api/src/trpc/routers/company.ts` - Floor nextSequenceNumber above highest used when startingSequenceNumber changes
- `apps/web/app/(dashboard)/settings/company/page.tsx` - Sync nextSequenceNumber display when startingSequenceNumber input changes
- `apps/web/app/providers.tsx` - Toast deduplication via id on QueryCache.onError; invalidate company cache on project edit

## Decisions Made

- **Toast deduplication via id**: QueryCache.onError was firing one toast per failed query re-render rather than once per error. Fixed by passing a stable `id` to `toast()` so React Hot Toast deduplicates naturally.
- **Invalidate companyProfile on project save**: project.create and project.update both advance nextSequenceNumber server-side; the settings page was reading a stale cache. Invalidating `companyProfile` after saves ensures the display reflects reality.
- **startingSequenceNumber floors nextSequenceNumber**: When a user lowers startingSequenceNumber, the system must not allow nextSequenceNumber to drop below the highest sequence number ever issued, or duplicate job numbers would be assigned. The floor is computed via getMaxUsedJobSequence.
- **Uniqueness inside transactions**: Advisory uniqueness checks (load, compare, write) have a race window. Moved the collision check inside the DB transaction so concurrent creates cannot both pass the same sequence value.

## Deviations from Plan

Plan 29-04 was a pure human-verify checkpoint — all implementation was in plans 29-01 through 29-03. The deviations below arose during UAT verification, not during automated execution.

### Issues Found During UAT (Hotfixes)

**1. [Rule 1 - Bug] Duplicate query error toasts**
- **Found during:** UX-03 verification
- **Issue:** QueryCache.onError fired a toast on every re-render of a failed query, not once per error
- **Fix:** Added stable `id` to toast call so deduplication prevents repeat toasts
- **Files modified:** `apps/web/app/providers.tsx`
- **Committed in:** `f98f2fa`

**2. [Rule 1 - Bug] Company cache not invalidated on project save**
- **Found during:** JOBEDIT-01 verification
- **Issue:** Settings page showed stale nextSequenceNumber after project create/edit because companyProfile cache was not invalidated
- **Fix:** Added `queryClient.invalidateQueries` for companyProfile in project create and update mutations
- **Files modified:** `apps/web/app/providers.tsx`, `apps/api/src/trpc/routers/project.ts`
- **Committed in:** `f98f2fa`, `38f4dc8`

**3. [Rule 1 - Bug] nextSequenceNumber not synced on startingSequenceNumber change**
- **Found during:** JOBEDIT-01 verification
- **Issue:** Changing startingSequenceNumber in settings form did not update nextSequenceNumber field in the same form session
- **Fix:** Added sync logic to update nextSequenceNumber display when startingSequenceNumber input changes
- **Files modified:** `apps/web/app/(dashboard)/settings/company/page.tsx`
- **Committed in:** `2602a8b`

**4. [Rule 2 - Missing Critical] Uniqueness not enforced for auto-generation path**
- **Found during:** JOBEDIT-01 verification (new project creation after manual edit)
- **Issue:** Auto-generation could issue a job number already used if cache was stale
- **Fix:** Added uniqueness enforcement and cache invalidation on project create path
- **Files modified:** `apps/api/src/trpc/routers/project.ts`
- **Committed in:** `9e59b52`

**5. [Rule 2 - Missing Critical] Race condition in uniqueness check**
- **Found during:** JOBEDIT-01 follow-on
- **Issue:** Load-compare-write pattern for uniqueness had a race window under concurrent creates
- **Fix:** Moved uniqueness check inside database transaction for both create and update paths
- **Files modified:** `apps/api/src/trpc/routers/project.ts`
- **Committed in:** `a156731`

**6. [Rule 1 - Bug] startingSequenceNumber change could allow duplicate job numbers**
- **Found during:** JOBEDIT-01 verification
- **Issue:** Lowering startingSequenceNumber could set nextSequenceNumber below highest already-issued sequence
- **Fix:** Floor nextSequenceNumber at (maxUsedSequence + 1) when startingSequenceNumber changes
- **Files modified:** `apps/api/src/trpc/routers/company.ts`
- **Committed in:** `354ec43`, `38f4dc8`

---

**Total deviations:** 6 hotfixes (4 bug fixes, 2 missing critical)
**Impact on plan:** All hotfixes essential for correctness of job number uniqueness guarantees and accurate settings display. No scope creep.

## Issues Encountered

- UX-03 toast deduplication was subtle — the global handler worked correctly but fired multiple times per error event due to React Query's retry/re-render behavior. Resolved by stable toast id.
- JOBEDIT-01 required a cascade of fixes: cache staleness, floor logic, and transaction-level uniqueness all had to be addressed together before the UAT scenario (edit → create → verify counter) passed cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 29 is complete. All four requirements (UX-01, UX-02, UX-03, JOBEDIT-01) verified and approved.
- v1.3 Polish & Gap Closure milestone is complete.
- Job number uniqueness is now enforced at the transaction level — safe for concurrent users.
- Empty states, skeleton loading, and global error toasts are production-ready.
- No blockers for next planning cycle.

---
*Phase: 29-ux-polish-and-tech-debt*
*Completed: 2026-02-17*

## Self-Check: PASSED

- FOUND: `.planning/phases/29-ux-polish-and-tech-debt/29-04-SUMMARY.md`
- FOUND: `f98f2fa` (fix: deduplicate toasts, invalidate company cache)
- FOUND: `2602a8b` (fix: sync nextSequenceNumber on startingSequenceNumber change)
- FOUND: `9e59b52` (fix: enforce uniqueness on auto-generation, invalidate cache on create)
- FOUND: `a156731` (fix: hard server-side uniqueness check inside transactions)
- FOUND: `354ec43` (fix: floor nextSequenceNumber above highest used job number)
- FOUND: `38f4dc8` (fix: invalidate getMaxUsedJobSequence cache on project create/edit)
