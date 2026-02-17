---
phase: 24-year-rollover-logic
verified: 2026-02-17T20:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "Year rollover triggers at midnight on Jan 1 with live traffic"
    expected: "First project created in new year receives a job number starting at startingSequenceNumber, not 1 or the previous nextSequenceNumber"
    why_human: "Cannot simulate real-time year boundary crossing programmatically; requires a live app at the moment the year changes or a DB-simulated test as documented in plan 24-02 (which was executed and passed)"
---

# Phase 24: Year Rollover Logic — Verification Report

**Phase Goal:** Job number sequence resets correctly when year changes, preserving existing project job numbers.
**Verified:** 2026-02-17T20:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When the year changes, the first new project of the new year receives a job number starting at the configured startingSequenceNumber (not hardcoded 1) | VERIFIED | `apps/api/src/utils/job-number.ts` line 49–51: `const sequenceNumber = formatChanged ? (settings.startingSequenceNumber ?? 1) : settings.nextSequenceNumber;` — confirmed substantive, not a stub |
| 2 | New projects always get the current year in their job number (YY or YYYY tokens update automatically) | VERIFIED | `generateJobNumber` replaces `{YY}` and `{YYYY}` with `now.getFullYear()` at call time (lines 29–30); `lastGeneratedFormat` comparison catches year change without any additional code change needed (pre-existing behavior confirmed in research) |
| 3 | Existing project job numbers are never modified by rollover logic | VERIFIED | Rollover logic only modifies `jobNumberSettings.nextSequenceNumber` in `company_profiles` JSONB; `projects.job_number` is a plain `TEXT` column with no trigger or update path; confirmed by schema inspection of `tenant.ts` |
| 4 | Admin can set a starting sequence number in the company settings UI | VERIFIED | `apps/web/app/(dashboard)/settings/company/page.tsx` lines 328–346: "Starting Sequence Number" `<Input>` field with label, help text, form.watch/setValue wiring, and defaultValues entry — fully substantive, not a placeholder |
| 5 | startingSequenceNumber defaults to 1 for tenants that do not set it (backward compatible) | VERIFIED | `?? 1` fallback in `generateJobNumber` (line 50) handles JSONB rows where field is `undefined`; Zod schema `.default(1)` on `jobNumberSettingsSchema` (line 76 of `company.ts`); JSONB column default in `tenant.ts` lines 85–91 includes `startingSequenceNumber: 1` |

**Score:** 5/5 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/shared/src/types/company.ts` | JobNumberSettings Zod schema with startingSequenceNumber field | VERIFIED | Line 76: `startingSequenceNumber: z.number().int().min(1).default(1)` — field present, substantive (has validation constraints and JSDoc documentation), wired into `companyConfigSchema` (line 350) |
| `apps/api/src/utils/job-number.ts` | generateJobNumber reset branch uses startingSequenceNumber | VERIFIED | Lines 49–51: ternary uses `settings.startingSequenceNumber ?? 1` in the `formatChanged` branch; import of `JobNumberSettings` from `@construction/shared` confirmed at line 1 |
| `apps/web/app/(dashboard)/settings/company/page.tsx` | Starting Sequence Number input field in Job Numbering card | VERIFIED | Lines 328–346: fully wired input with label, `form.watch`, `form.setValue`, `parseInt` parse, `disabled={!canManage}` guard, and help text; also present in `defaultValues` (line 63) and `useEffect` reset (line 76) |
| `apps/api/src/db/schema/tenant.ts` | JSONB column default includes startingSequenceNumber (auto-fix from plan deviation) | VERIFIED | Lines 85–91: `.default({ enabled: false, template: "{YYYY}-{NNN}", startingSequenceNumber: 1, nextSequenceNumber: 1, lastGeneratedFormat: null })` — field present in column default |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/shared/src/types/company.ts` | `apps/api/src/utils/job-number.ts` | `JobNumberSettings` type import | WIRED | `import { JobNumberSettings } from "@construction/shared"` at line 1 of `job-number.ts`; `startingSequenceNumber` accessed as `settings.startingSequenceNumber` at line 50 |
| `apps/web/app/(dashboard)/settings/company/page.tsx` | `jobNumberSettings.startingSequenceNumber` in form | `form.watch / form.setValue` | WIRED | `form.watch("jobNumberSettings.startingSequenceNumber")` at line 333; `form.setValue("jobNumberSettings.startingSequenceNumber", ...)` at lines 335–337; field is in both `defaultValues` and `useEffect` reset block |
| Company settings UI | JSONB `job_number_settings` column | `company.update` tRPC mutation | WIRED | `updateMutation.mutate(values)` in `onSubmit` (line 111); router `update` mutation at `company.ts` line 105 passes `input.jobNumberSettings` directly to the insert |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| JOBROLL-01 | 24-01, 24-02 | When year changes, sequence counter resets to starting number | SATISFIED | `generateJobNumber` reset branch wired to `settings.startingSequenceNumber ?? 1`; UI field allows admin control; human-verified in live app (startingSequenceNumber=1002, generated `261002`) |
| JOBROLL-02 | 24-01, 24-02 | Year rollover respects configured format (YY updates automatically) | SATISFIED | Pre-existing behavior confirmed in research: `{YY}`/`{YYYY}` tokens resolved at call time via `now.getFullYear()`; `lastGeneratedFormat` comparison detects year change; human-verified (26- prefix confirmed on 2026-02-17) |
| JOBROLL-03 | 24-01, 24-02 | Projects retain their assigned job numbers after year rollover | SATISFIED | `projects.job_number` is a plain `TEXT` column; rollover logic only updates `company_profiles.job_number_settings`; no UPDATE/trigger path to existing project rows; human-verified (existing job numbers confirmed unchanged after rollover simulation) |

**Orphaned requirements:** None. All three JOBROLL IDs appear in plan frontmatter and are accounted for.

**Note — REQUIREMENTS.md status field:** JOBROLL-01, JOBROLL-02, and JOBROLL-03 still show `[ ]` (unchecked) and "Pending" in the tracker table in `.planning/REQUIREMENTS.md`. This is documentation staleness — the implementation is complete and human-verified. The REQUIREMENTS.md file was not updated to mark these complete after phase execution. This is a minor administrative gap only; it has no impact on code correctness.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/shared/src/types/company.ts` | 298, 337 | `return null` | Info | Both are inside `parseSequenceFromJobNumber` — legitimate null returns for parse failure cases, not stub implementations |
| `apps/web/app/(dashboard)/settings/company/page.tsx` | 305 | `placeholder="{YYYY}-{NNN}"` | Info | HTML input `placeholder` attribute on the template field, not a placeholder implementation — correct use of the word |
| `apps/api/src/trpc/routers/company.ts` | 68 | `console.log("[DEBUG company.update]...")` | Warning | Debug log left in production path; logs full `jobNumberSettings` JSON on every company save. Not a blocker for rollover correctness but should be removed before production |

No blocker anti-patterns found.

---

## Human Verification Required

### 1. Real-time year boundary (edge case only)

**Test:** Let the system run across a real Jan 1 midnight boundary with job numbering enabled and observe the first project created in the new year.
**Expected:** Job number starts at `startingSequenceNumber`, year token updates to new year.
**Why human:** Cannot simulate true midnight year-crossing without time manipulation; the DB simulation approach in plan 24-02 (using `lastGeneratedFormat` injection) is an effective proxy and was already executed and passed.

---

## Gaps Summary

No gaps. All five observable truths are verified by direct code inspection. All three required artifacts exist, are substantive (not stubs), and are wired into the execution path. All three key links are confirmed present. Human UAT was completed on 2026-02-17 with all 4 tests passing (documented in `24-02-SUMMARY.md`).

The only administrative item is that `.planning/REQUIREMENTS.md` still marks JOBROLL-01/02/03 as "Pending" — this does not affect code correctness and can be updated separately.

The debug `console.log` in `company.ts` line 68 is a minor warning but does not affect rollover behavior.

---

_Verified: 2026-02-17T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
