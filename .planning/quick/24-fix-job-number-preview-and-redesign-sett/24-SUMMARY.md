---
phase: 24-fix-job-number-preview-and-redesign-sett
plan: "01"
subsystem: job-numbering
tags: [job-numbers, settings-ui, rollover-detection, shared-utilities]
dependency_graph:
  requires: [24-01 startingSequenceNumber schema]
  provides: [computeNextSequenceNumber, parseSequenceFromJobNumber, redesigned-settings-ui]
  affects: [apps/web/app/(dashboard)/settings/company/page.tsx, packages/shared/src/types/company.ts]
tech_stack:
  added: []
  patterns: [shared-utility-mirroring-api-logic, form-watch-subscription-for-reactive-ui]
key_files:
  created: []
  modified:
    - packages/shared/src/types/company.ts
    - packages/shared/src/index.ts
    - apps/web/app/(dashboard)/settings/company/page.tsx
decisions:
  - computeNextSequenceNumber mirrors generateJobNumber rollover logic in shared package so UI can show true next number without server round-trip
  - parseSequenceFromJobNumber uses token-width offset scanning to extract sequence digits from a formatted job number string
  - useEffect form.watch subscription recomputes nextJobNumberInput on any template/startingSequenceNumber change
  - nextSequenceNumber remains in form state and is submitted normally; it is not exposed as a raw user-facing input
metrics:
  duration: "4.6 min"
  completed: "2026-02-17"
  tasks: 2
  files: 3
---

# Quick Task 24: Fix Job Number Preview and Redesign Settings Summary

**One-liner:** Rollover-aware `computeNextSequenceNumber` utility added to shared package; company settings redesigned with a single editable "Next Job Number" field replacing the raw sequence number input and three-number preview block.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add computeNextSequenceNumber() and parseSequenceFromJobNumber() to shared package | 1eaa36b | packages/shared/src/types/company.ts, packages/shared/src/index.ts |
| 2 | Redesign job numbering UX in company settings page | bf9ee03 | apps/web/app/(dashboard)/settings/company/page.tsx |

## What Was Built

### Task 1: Shared Utility Functions

Added two exported functions to `packages/shared/src/types/company.ts`:

**`computeNextSequenceNumber(settings: JobNumberSettings): number`**
- Mirrors the rollover detection in `generateJobNumber()` in `apps/api/src/utils/job-number.ts`
- Computes the current "format" string by replacing date tokens (resolving {YYYY}, {YY}, {MM}, {DD}) and stripping {N+}
- If `lastGeneratedFormat` is set and differs from the current format, returns `startingSequenceNumber ?? 1` (rollover)
- Otherwise returns `nextSequenceNumber`

**`parseSequenceFromJobNumber(jobNumber: string, template: string): number | null`**
- Scans the template left to right, accumulating character offset using known token widths ({YYYY}=4, {YY}=2, {MM}=2, {DD}=2) and literal chars=1
- Stops at the {N+} token to determine the offset and sequence length
- Extracts the substring from the job number at that position
- Returns `parseInt(digits, 10)` or `null` if extraction fails (wrong length or non-digits)
- Example: `parseSequenceFromJobNumber("261002", "{YY}{NNNN}")` returns `1002`

Both functions exported from `packages/shared/src/index.ts`.

### Task 2: Settings Page Redesign

Redesigned the Job Numbering card in `apps/web/app/(dashboard)/settings/company/page.tsx`:

**Removed:**
- "Next Sequence Number" raw number input (lines 298-314 of original)
- "Preview / Next 3 job numbers" block (lines 337-357 of original)

**Added:**
- `nextJobNumberInput` local state (string, formatted job number)
- Updated `useEffect` (data load) to call `computeNextSequenceNumber` and set `nextJobNumberInput` via `previewJobNumber`
- New `useEffect` with `form.watch` subscription to recompute `nextJobNumberInput` when template/startingSequenceNumber/etc. change
- "Next Job Number" text input field: shows formatted number, onChange updates state, onBlur calls `parseSequenceFromJobNumber` to update hidden `nextSequenceNumber` in form state (or resets and shows toast.error on invalid input)

**Updated:**
- "Starting Sequence Number" description: now reads "The sequence resets to this number at the start of each year (or when the job number format changes)"

**Preserved:**
- Job Number Template field (unchanged)
- `nextSequenceNumber` in form state — still submitted normally via `onSubmit`; just not shown as a raw input

## Verification

- `npx tsc --noEmit -p packages/shared/tsconfig.json` — clean (no errors)
- `computeNextSequenceNumber` and `parseSequenceFromJobNumber` confirmed exported from both `company.ts` and `index.ts`
- Settings page: 3 fields when enabled (Template + Starting Sequence Number + Next Job Number); no raw nextSequenceNumber input; no separate preview block
- All errors from web TypeScript check are pre-existing (in `apps/api`, workflow components, etc.) — not introduced by this plan

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `packages/shared/src/types/company.ts` — FOUND (contains computeNextSequenceNumber and parseSequenceFromJobNumber)
- `packages/shared/src/index.ts` — FOUND (exports both functions)
- `apps/web/app/(dashboard)/settings/company/page.tsx` — FOUND (contains "Next Job Number" label, uses computeNextSequenceNumber and parseSequenceFromJobNumber)
- Commit 1eaa36b — FOUND (Task 1)
- Commit bf9ee03 — FOUND (Task 2)
