---
phase: 24-year-rollover-logic
plan: 01
subsystem: api, ui
tags: [job-numbers, zod, drizzle, react-hook-form, typescript]

# Dependency graph
requires:
  - phase: 20-configuration-foundation
    provides: jobNumberSettings schema and JSONB storage in company config
  - phase: 21-assignment-and-auto-generation
    provides: generateJobNumber utility used in project creation
provides:
  - startingSequenceNumber field in JobNumberSettings Zod schema
  - generateJobNumber reset branch uses startingSequenceNumber ?? 1 instead of hardcoded 1
  - Company settings UI exposes Starting Sequence Number input in Job Numbering card
affects:
  - any phase that reads or writes jobNumberSettings JSONB
  - project creation flow (reads startingSequenceNumber on year rollover)

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - packages/shared/src/types/company.ts
    - apps/api/src/utils/job-number.ts
    - apps/api/src/db/schema/tenant.ts
    - apps/web/app/(dashboard)/settings/company/page.tsx

key-decisions:
  - "startingSequenceNumber ?? 1 fallback in generateJobNumber ensures backward compatibility with existing JSONB rows that predate this field"
  - "startingSequenceNumber positioned between template and nextSequenceNumber in schema to maintain logical grouping"

patterns-established: []

requirements-completed:
  - JOBROLL-01
  - JOBROLL-02
  - JOBROLL-03

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 24 Plan 01: Year Rollover Logic Summary

**Configurable year-rollover reset target: startingSequenceNumber field added to JobNumberSettings schema, wired into generateJobNumber reset branch, and surfaced in company settings UI with backward-compatible ?? 1 fallback**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-17T15:04:25Z
- **Completed:** 2026-02-17T15:08:30Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Added `startingSequenceNumber: z.number().int().min(1).default(1)` to `jobNumberSettingsSchema` in shared types with JSDoc documentation
- Changed `generateJobNumber` reset branch from hardcoded `1` to `settings.startingSequenceNumber ?? 1` — year rollover now resets to the configured value
- Added "Starting Sequence Number" input field to company settings Job Numbering card with descriptive help text

## Task Commits

Each task was committed atomically:

1. **Task 1: Add startingSequenceNumber to JobNumberSettings schema** - `1a20198` (feat)
2. **Task 2: Wire startingSequenceNumber into generateJobNumber reset branch** - `b4e7319` (feat)
3. **Task 3: Add Starting Sequence Number input to company settings UI** - `34bec19` (feat)

## Files Created/Modified

- `packages/shared/src/types/company.ts` - Added `startingSequenceNumber` field to `jobNumberSettingsSchema`, updated JSDoc
- `apps/api/src/utils/job-number.ts` - Updated reset branch to use `settings.startingSequenceNumber ?? 1`
- `apps/api/src/db/schema/tenant.ts` - Added `startingSequenceNumber: 1` to JSONB column default (auto-fix)
- `apps/web/app/(dashboard)/settings/company/page.tsx` - Added field to defaultValues, useEffect fallback, and UI input block

## Decisions Made

- `startingSequenceNumber ?? 1` fallback rather than just `startingSequenceNumber` — handles existing tenant JSONB rows that predate this field having `undefined` for the new property; fully backward compatible with no migration needed.
- Default value `1` matches prior hardcoded behavior so existing tenants that haven't configured this see no behavior change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added startingSequenceNumber to tenant schema JSONB default**
- **Found during:** Task 2 verification (TypeScript check of apps/api)
- **Issue:** `apps/api/src/db/schema/tenant.ts` line 85 defines the default JSONB object for `jobNumberSettings` column. After adding `startingSequenceNumber` to `JobNumberSettings` type (with Zod `.default(1)` making it required in the output type), the existing default object was missing the field, causing a TypeScript type error.
- **Fix:** Added `startingSequenceNumber: 1` to the `.default({...})` object in tenant.ts to match the updated type shape.
- **Files modified:** `apps/api/src/db/schema/tenant.ts`
- **Verification:** TypeScript error resolved; error was only on this one line directly caused by Task 1 schema change.
- **Committed in:** `b4e7319` (included in Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing required field in JSONB default)
**Impact on plan:** Necessary for type safety. No scope creep — directly caused by adding startingSequenceNumber to the Zod schema with a default value.

## Issues Encountered

- `apps/api` and `apps/web` both had numerous pre-existing TypeScript errors (unrelated to this plan: `bid.ts`, `workflow-detail.tsx`, `bidGeneration.ts`, `subcontractor.ts`, etc.). These were out of scope and not fixed. Only the one directly-caused error (`tenant.ts` missing field) was auto-fixed.

## User Setup Required

None - no external service configuration required. The `startingSequenceNumber` field is persisted via the existing `company.update` mutation and the JSONB column with no schema migrations needed (Drizzle/Postgres JSONB is schema-free; existing rows get `undefined` which the `?? 1` fallback handles).

## Next Phase Readiness

- Year rollover is now fully configurable via company settings
- Admin sets `startingSequenceNumber` (e.g., 1001) and on new year, first job number starts at 1001 not 1
- JOBROLL-01, JOBROLL-02, JOBROLL-03 all satisfied — Phase 24 plan 01 complete

## Self-Check: PASSED

All files verified present on disk:
- packages/shared/src/types/company.ts: FOUND
- apps/api/src/utils/job-number.ts: FOUND
- apps/api/src/db/schema/tenant.ts: FOUND
- apps/web/app/(dashboard)/settings/company/page.tsx: FOUND
- .planning/phases/24-year-rollover-logic/24-01-SUMMARY.md: FOUND

All commits verified in git log:
- 1a20198 (Task 1): FOUND
- b4e7319 (Task 2): FOUND
- 34bec19 (Task 3): FOUND

---
*Phase: 24-year-rollover-logic*
*Completed: 2026-02-17*
