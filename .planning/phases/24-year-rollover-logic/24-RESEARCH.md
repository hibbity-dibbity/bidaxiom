# Phase 24: Year Rollover Logic - Research

**Researched:** 2026-02-17
**Domain:** Job number sequence reset on year boundary
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| JOBROLL-01 | When new year starts, sequence counter resets to configured starting number | The `generateJobNumber` utility already detects format change and resets to `sequenceNumber = 1`. The gap is that it resets to 1, not a configurable starting number. Phase 24 must wire in a `startingSequenceNumber` field or reuse `nextSequenceNumber` correctly. |
| JOBROLL-02 | Year component in job number (YY or YYYY) updates automatically for new projects | Already implemented: `generateJobNumber` replaces `{YY}` and `{YYYY}` tokens with `now.getFullYear()` at generation time. The `lastGeneratedFormat` comparison catches when the year prefix changes. No code change needed for this requirement — it works today by design. |
| JOBROLL-03 | Existing projects retain their original job numbers after year rollover (no retroactive changes) | Already guaranteed: `projects.job_number` is a plain `TEXT` column. The rollover logic only updates `company_profiles.job_number_settings.nextSequenceNumber`. Existing project rows are never touched. |
</phase_requirements>

---

## Summary

Phase 24 is almost entirely already implemented. The `generateJobNumber` utility in `apps/api/src/utils/job-number.ts` already contains the core rollover detection mechanism: it compares `lastGeneratedFormat` (the template with date tokens rendered, but the `{N+}` placeholder stripped) against the freshly-rendered format. When the year changes, the format string changes (e.g., `"26-"` becomes `"27-"`), which triggers `formatChanged = true` and resets `sequenceNumber` to `1` before generating the next number.

The mechanism is correct but has one gap: it resets to `1` (hardcoded), not to a configurable starting number. The prior phase context references a `startingSequence` field, but the current `JobNumberSettings` schema has no such field — only `nextSequenceNumber`, `lastGeneratedFormat`, `enabled`, and `template`. If the business requirement is that rollover resets to 1 (the default for any new year), the current implementation already satisfies JOBROLL-01 as written. If there is a desire to reset to a configured number (e.g., 1001), a `startingSequenceNumber` field would need to be added to the schema and wired into the reset branch.

The existing project safety concern (JOBROLL-03) is already handled: `projects.job_number` is stored as a plain immutable `TEXT` column. No rollover mechanism touches existing rows.

**Primary recommendation:** Phase 24 scope is primarily: (1) add a `startingSequenceNumber` field to `JobNumberSettings` schema, (2) update the reset branch in `generateJobNumber` to use it, (3) add a test that confirms rollover produces the right number, and (4) surface `startingSequenceNumber` in the company settings UI. No new DB columns or migration infra are required — all state lives in the `job_number_settings` JSONB column already present on `company_profiles`.

---

## Standard Stack

### Core (already in place — no new dependencies needed)

| File | Purpose | Status |
|------|---------|--------|
| `apps/api/src/utils/job-number.ts` | `generateJobNumber()` — generates next number, detects format change, resets counter | EXISTS — needs one logic change |
| `packages/shared/src/types/company.ts` | `JobNumberSettings` Zod schema, `jobNumberSettingsSchema` | EXISTS — needs `startingSequenceNumber` field |
| `apps/api/src/db/schema/tenant.ts` | `companyProfiles` table with `jobNumberSettings` JSONB column | EXISTS — no migration needed |
| `apps/api/src/trpc/routers/project.ts` | `project.create` mutation — calls `generateJobNumber` and persists `updatedSettings` | EXISTS — no change needed |
| `apps/api/src/trpc/routers/company.ts` | `company.update` — persists job number config including `startingSequenceNumber` | EXISTS — handles new field transparently via JSONB |

### No New Libraries Required

The rollover logic is pure date arithmetic. No cron infrastructure, no BullMQ, no scheduled jobs. The reset is triggered lazily on the first project creation of the new year, which is the correct approach for this codebase.

---

## Architecture Patterns

### Current `generateJobNumber` Flow (fully verified)

```
apps/api/src/utils/job-number.ts

generateJobNumber(settings: JobNumberSettings):
  1. Render date tokens in template → format string (e.g., "27-")
  2. Strip {N+} placeholder → currentFormat (e.g., "27-")
  3. Compare settings.lastGeneratedFormat vs currentFormat
     - if NULL: first ever run → no reset
     - if DIFFERENT: year (or month/day) changed → formatChanged = true
  4. sequenceNumber = formatChanged ? 1 : settings.nextSequenceNumber
                       ^^^
                       Gap: should be startingSequenceNumber, not hardcoded 1
  5. Generate job number with paddedSequence
  6. Return { jobNumber, updatedSettings: { nextSequenceNumber: sequenceNumber + 1,
                                            lastGeneratedFormat: currentFormat } }
```

### Where State Persists

```
company_profiles.job_number_settings (JSONB):
{
  "enabled": true,
  "template": "{YY}-{NNNN}",
  "nextSequenceNumber": 42,      ← current counter
  "lastGeneratedFormat": "26-"   ← last rendered format without {N+}
}
```

`lastGeneratedFormat` is the rollover sentinel. When the year flips to 2027, the next call renders `"27-"` which does not match `"26-"`, triggering the reset. This is already persisted back into the JSONB column inside the `db.transaction` in `project.create`.

### Recommended Project Structure Change

Only two files need modification plus one optional UI file:

```
apps/api/src/utils/
└── job-number.ts           ← change reset branch: 1 → startingSequenceNumber

packages/shared/src/types/
└── company.ts              ← add startingSequenceNumber to jobNumberSettingsSchema

apps/web/app/(dashboard)/
└── settings/company/       ← (optional) expose startingSequenceNumber in UI
```

### Pattern: Lazy Reset on First Use

**What:** The sequence resets the first time `generateJobNumber` is called after the year boundary, not at midnight Jan 1.

**When to use:** Always — this is the only correct pattern for this architecture. There is no always-on server process to run at midnight. Lazy reset is deterministic, transactional (happens inside `db.transaction`), and requires zero infrastructure.

**Why not cron:** No scheduler infrastructure is deployed. BullMQ is used in the codebase (Phase 8 QuickBooks) but setting up a cron job for this would be overengineering. The lazy approach is simpler and more reliable.

**Example (current code — no changes needed here):**
```typescript
// Source: apps/api/src/utils/job-number.ts
const formatChanged =
  settings.lastGeneratedFormat !== null &&
  settings.lastGeneratedFormat !== format.replace(/\{N+\}/, "");

// Reset sequence if format changed (e.g., year changed from 26 to 27)
const sequenceNumber = formatChanged ? 1 : settings.nextSequenceNumber;
//                                    ^
//                  Phase 24: change to settings.startingSequenceNumber ?? 1
```

**After Phase 24 fix:**
```typescript
const sequenceNumber = formatChanged
  ? (settings.startingSequenceNumber ?? 1)
  : settings.nextSequenceNumber;
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Year detection | Custom cron job or year-check middleware | `lastGeneratedFormat` comparison already in `generateJobNumber` | Already implemented correctly |
| Reset atomicity | Separate reset endpoint or admin action | Existing `db.transaction` in `project.create` | Reset and project creation are already atomic |
| Reset migration | ALTER TABLE to add `lastResetYear` column | Nothing — `lastGeneratedFormat` covers it | No new DB column needed |
| Starting number config | New table or separate config key | Add `startingSequenceNumber` to existing `JobNumberSettings` JSONB | Same JSONB column, zero migration |

**Key insight:** The rollover detection is already in place and correct. Phase 24 is narrowly scoped to wiring in a configurable starting number and verifying the mechanism works end-to-end.

---

## Common Pitfalls

### Pitfall 1: Confusing `startingSequence` (prior docs) with actual schema field
**What goes wrong:** Prior phase context mentions a `startingSequence` field. This field does NOT exist in the current schema. The actual fields are `nextSequenceNumber` and `lastGeneratedFormat`.
**Why it happens:** Prior decisions were written before the schema was finalized.
**How to avoid:** Use `startingSequenceNumber` (to match the existing `nextSequenceNumber` naming convention) as the new field name. Do NOT use `startingSequence`.
**Warning signs:** TypeScript compile errors if you reference a field that doesn't exist on `JobNumberSettings`.

### Pitfall 2: Forgetting that `lastGeneratedFormat` may be null on first run
**What goes wrong:** If `lastGeneratedFormat` is null (never generated before), `formatChanged` evaluates to `false`, and the counter is NOT reset — which is correct behavior. But if someone sets `lastGeneratedFormat` to a non-null value during testing or migration, they could accidentally suppress a legitimate reset.
**Why it happens:** Null handling in the sentinel.
**How to avoid:** The current check `settings.lastGeneratedFormat !== null && settings.lastGeneratedFormat !== format` is correct. Never set `lastGeneratedFormat` to an old year's format value unless you want a forced reset.

### Pitfall 3: company.update creates a new versioned company_profiles row
**What goes wrong:** `company.update` uses effective dating — it closes the current row and inserts a new one. This means the `jobNumberSettings` JSONB (including `nextSequenceNumber` and `lastGeneratedFormat`) is copied into the new row. If someone saves company settings mid-year, the counter is preserved correctly because the copy is explicit.
**Why it happens:** The effective-dating pattern closes the old row and creates a new one with all current values.
**How to avoid:** When persisting the incremented counter in `project.create`, the code updates the active row via `WHERE valid_to IS NULL`. This is correct and already works.

### Pitfall 4: Template-only rollover vs. Year-specific rollover
**What goes wrong:** The `lastGeneratedFormat` mechanism resets the counter whenever ANY token in the template prefix changes — not just year. If the template includes `{MM}`, the counter resets monthly. If it includes `{DD}`, it resets daily. This is by design, but a user who changes their template from `{YYYY}-{NNN}` to `{YY}-{NNN}` mid-year will also trigger a reset on the next project creation.
**Why it happens:** The format comparison is template-aware, not year-aware specifically.
**How to avoid:** Document this behavior. Phase 24 scope does not need to change this — it is the intended behavior and satisfies JOBROLL-01 and JOBROLL-02.

---

## Code Examples

### Current `generateJobNumber` (exact source)
```typescript
// Source: apps/api/src/utils/job-number.ts (lines 17-67)
export function generateJobNumber(settings: JobNumberSettings): {
  jobNumber: string;
  updatedSettings: JobNumberSettings;
} {
  if (!settings.enabled) {
    throw new Error("Job numbers are not enabled");
  }

  const now = new Date();

  // Replace date tokens with current values
  let format = settings.template
    .replace(/{YYYY}/g, now.getFullYear().toString())
    .replace(/{YY}/g, now.getFullYear().toString().slice(-2))
    .replace(/{MM}/g, (now.getMonth() + 1).toString().padStart(2, "0"))
    .replace(/{DD}/g, now.getDate().toString().padStart(2, "0"));

  // Extract sequence pattern {NNN...}
  const sequenceMatch = format.match(/\{(N+)\}/);
  if (!sequenceMatch) {
    throw new Error("Template must contain at least one {N} sequence pattern");
  }

  const sequenceLength = sequenceMatch[1].length;

  // Check if format has changed (indicates reset needed)
  const formatChanged =
    settings.lastGeneratedFormat !== null &&
    settings.lastGeneratedFormat !== format.replace(/\{N+\}/, "");

  // Reset sequence if format changed (e.g., year changed from 26 to 27)
  const sequenceNumber = formatChanged ? 1 : settings.nextSequenceNumber;

  // Pad sequence number with zeros
  const paddedSequence = sequenceNumber.toString().padStart(sequenceLength, "0");

  // Replace sequence pattern with actual number
  const jobNumber = format.replace(/\{N+\}/, paddedSequence);

  // Store the format (without {N}) for next comparison
  const currentFormat = format.replace(/\{N+\}/, "");

  return {
    jobNumber,
    updatedSettings: {
      ...settings,
      nextSequenceNumber: sequenceNumber + 1,
      lastGeneratedFormat: currentFormat,
    },
  };
}
```

### Required Change in `generateJobNumber`
```typescript
// Change ONLY this line (line 48 in current file):
// BEFORE:
const sequenceNumber = formatChanged ? 1 : settings.nextSequenceNumber;

// AFTER:
const sequenceNumber = formatChanged
  ? (settings.startingSequenceNumber ?? 1)
  : settings.nextSequenceNumber;
```

### Required Change to `JobNumberSettings` Schema
```typescript
// Source: packages/shared/src/types/company.ts — jobNumberSettingsSchema

// BEFORE:
export const jobNumberSettingsSchema = z.object({
  enabled: z.boolean(),
  template: z.string().min(1).max(50).refine(...),
  nextSequenceNumber: z.number().int().min(1).default(1),
  lastGeneratedFormat: z.string().nullable().optional(),
});

// AFTER: add startingSequenceNumber field
export const jobNumberSettingsSchema = z.object({
  enabled: z.boolean(),
  template: z.string().min(1).max(50).refine(...),
  startingSequenceNumber: z.number().int().min(1).default(1), // ← NEW
  nextSequenceNumber: z.number().int().min(1).default(1),
  lastGeneratedFormat: z.string().nullable().optional(),
});
```

### Default in DB Schema (no migration needed — JSONB)
```typescript
// Source: apps/api/src/db/schema/tenant.ts — companyProfiles.jobNumberSettings default
// AFTER adding startingSequenceNumber:
.default({
  enabled: false,
  template: "{YYYY}-{NNN}",
  startingSequenceNumber: 1,   // ← add to default
  nextSequenceNumber: 1,
  lastGeneratedFormat: null,
})
```

Note: existing rows without `startingSequenceNumber` will return `undefined` when read from JSONB, which is why `?? 1` fallback in `generateJobNumber` is required.

### Project `job_number` Column (existing — no change)
```typescript
// Source: apps/api/src/db/schema/tenant.ts — projects table (line 142)
jobNumber: text("job_number"), // Nullable, unique constraint via partial index
```
This column is a plain TEXT string. It is never modified after project creation. Rollover has zero effect on existing project rows.

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| `lastResetYear` integer field | `lastGeneratedFormat` string sentinel | More general — handles month/day resets too |
| Cron job to reset at midnight | Lazy reset on first project creation | Simpler, zero infrastructure |
| `startingSequence` (prior doc name) | `startingSequenceNumber` (actual naming) | Match `nextSequenceNumber` naming convention |

---

## Open Questions

1. **Should rollover reset to 1 or to a configurable starting number?**
   - What we know: Current code hardcodes reset to `1`. Prior phase context mentions `startingSequence`.
   - What's unclear: Whether any existing tenants expect rollover to reset to a non-1 value.
   - Recommendation: Add `startingSequenceNumber` field (defaults to 1). This satisfies both cases with no breaking change to existing tenants.

2. **Does the company settings UI need a `startingSequenceNumber` input?**
   - What we know: The UI exists at `apps/web/app/(dashboard)/settings/company/` but was built in Phase 20. It likely does not expose `startingSequenceNumber` yet.
   - What's unclear: Whether Phase 24 scope includes the UI input or just the backend logic.
   - Recommendation: Include a simple number input in the company settings UI for `startingSequenceNumber`. Without it, the feature has no user-accessible control surface.

3. **Manual job number entry at year boundary — does counter reset apply?**
   - What we know: In `project.create`, when a manual job number is entered, the code extracts the sequence digits and sets `nextSequenceNumber = manual + 1`. This does NOT update `lastGeneratedFormat`, so the next auto-generation will correctly detect the year change and reset.
   - What's unclear: Nothing — this is already correct.
   - Recommendation: No change needed.

---

## Sources

### Primary (HIGH confidence)
- Direct code read: `apps/api/src/utils/job-number.ts` — complete rollover detection and reset logic
- Direct code read: `packages/shared/src/types/company.ts` — `JobNumberSettings` Zod schema, current fields
- Direct code read: `apps/api/src/db/schema/tenant.ts` — `companyProfiles` JSONB column definition and default, `projects` TEXT column
- Direct code read: `apps/api/src/trpc/routers/project.ts` — `project.create` mutation with `generateJobNumber` call and transaction
- Direct code read: `apps/api/src/trpc/routers/company.ts` — `company.update` effective-dating pattern
- Direct code read: `apps/api/src/db/migrations/add-job-numbers.ts` — confirms JSONB schema in DB
- Direct code read: `apps/api/src/tenant/provision.ts` via grep — confirms provision default matches schema

### Secondary (MEDIUM confidence)
- Direct code read: `.planning/phases/21-assignment-and-auto-generation/21-01-PLAN.md` — confirms Phase 21 implemented the counter increment correctly

---

## Metadata

**Confidence breakdown:**
- Schema shape: HIGH — read directly from source files
- Rollover mechanism: HIGH — read directly from `job-number.ts`; mechanism is already implemented
- Existing project safety: HIGH — `projects.job_number` is immutable TEXT, rollover touches only `company_profiles`
- Required changes: HIGH — two-file change (schema + utility), well-understood
- UI changes: MEDIUM — UI file location not fully explored; known to exist from Phase 20

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable domain — only relevant if additional phases modify job number schema)
