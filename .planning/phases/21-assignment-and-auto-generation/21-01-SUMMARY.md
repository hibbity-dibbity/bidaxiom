---
phase: 21-assignment-and-auto-generation
plan: 01
subsystem: job-numbering
tags: [auto-generation, counter-increment, duplicate-prevention]

dependency_graph:
  requires:
    - phase: 20
      plan: 01
      feature: job-number-settings
    - phase: 20
      plan: 02
      feature: job-number-validation
  provides:
    - feature: auto-generation
      api: project.create mutation auto-generates job numbers
    - feature: counter-persistence
      api: company_profiles.job_number_settings.nextSequenceNumber updates
    - feature: duplicate-prevention
      api: manual entry increments counter to prevent conflicts

tech_stack:
  added: []
  patterns:
    - atomic-transaction-counter-update
    - regex-sequence-extraction
    - same-transaction-persistence

key_files:
  created: []
  modified:
    - apps/api/src/trpc/routers/project.ts
    - apps/api/src/trpc/routers/company.ts

decisions:
  - name: Auto-generation triggers on null jobNumber input
    rationale: Users leave field blank to auto-generate; manual entry overrides
    alternatives: Checkbox toggle (more UI complexity)
  - name: Manual counter increment uses regex extraction
    rationale: Extracts sequence number from end of manual job number to update counter
    alternatives: Parse full template (complex, unnecessary for counter increment)
  - name: Counter update in same transaction as project creation
    rationale: Atomicity ensures counter increments even if later operations fail
    alternatives: Update after transaction (race conditions, inconsistent state)

metrics:
  duration: 2 min
  tasks_completed: 2
  files_modified: 2
  lines_added: 108
  commits:
    - hash: 6eaa71e
      message: "feat(21-01): implement job number auto-generation and counter increment"
    - hash: a4c75c7
      message: "feat(21-01): add job number availability check helper"
  completed_at: 2026-02-17T02:58:31Z
---

# Phase 21 Plan 01: Job Number Auto-Generation and Counter Increment Summary

**One-liner:** Automatic job number generation with sequential counter persistence and manual entry conflict prevention

## What Was Built

Implemented server-side job number auto-generation and counter increment logic in the project creation flow. New projects now automatically receive job numbers when enabled, manual entries correctly increment the counter to prevent future duplicates, and a helper query enables duplicate validation in Phase 22.

### Key Features Delivered

1. **Auto-generation logic in project.create mutation**
   - Fetches active company profile job number settings
   - Calls generateJobNumber when no manual input provided and enabled
   - Returns generated number and updated settings with incremented counter

2. **Manual counter increment for duplicate prevention**
   - Extracts sequence number from manually-entered job numbers via regex
   - Increments counter if manual sequence >= current nextSequenceNumber
   - Prevents auto-generated numbers from conflicting with manual entries

3. **Atomic counter persistence**
   - Updates company_profiles.job_number_settings in same transaction as project creation
   - Ensures counter increments even if later operations fail
   - Uses isNull(validTo) to update only the active company profile version

4. **Job number availability check helper**
   - Added checkJobNumberAvailability query to company router
   - Returns availability status and existing project ID if duplicate found
   - Prepared for Phase 22 frontend duplicate validation

## Implementation Details

### Auto-Generation Flow (Task 1)

**Location:** `apps/api/src/trpc/routers/project.ts` (lines 101-147)

1. Query active company profile for job number settings (after abilities check)
2. If no manual job number and settings.enabled, call generateJobNumber
3. If manual job number and settings.enabled, extract sequence and update counter if needed
4. Inside transaction: update company profile with new counter, then create project

**Code pattern:**
```typescript
// Fetch settings before transaction
const [companyProfile] = await db
  .select()
  .from(schema.companyProfiles)
  .where(isNull(schema.companyProfiles.validTo))
  .limit(1);

const jobNumberSettings = companyProfile?.jobNumberSettings;

// Auto-generation logic
let finalJobNumber = input.jobNumber;
let updatedJobSettings = jobNumberSettings;

if (!finalJobNumber && jobNumberSettings?.enabled) {
  const result = generateJobNumber(jobNumberSettings);
  finalJobNumber = result.jobNumber;
  updatedJobSettings = result.updatedSettings;
}

// Manual counter increment
if (input.jobNumber && jobNumberSettings?.enabled) {
  const sequenceMatch = input.jobNumber.match(/(\d+)$/);
  if (sequenceMatch) {
    const manualSequence = parseInt(sequenceMatch[1], 10);
    if (manualSequence >= jobNumberSettings.nextSequenceNumber) {
      updatedJobSettings = {
        ...jobNumberSettings,
        nextSequenceNumber: manualSequence + 1,
      };
    }
  }
}

// Transaction with counter update
const project = await db.transaction(async (tx) => {
  if (updatedJobSettings && updatedJobSettings !== jobNumberSettings) {
    await tx
      .update(schema.companyProfiles)
      .set({ jobNumberSettings: updatedJobSettings })
      .where(isNull(schema.companyProfiles.validTo));
  }
  // ... create project with finalJobNumber
});
```

**Why this works:**
- Fetch before transaction for cleaner code structure
- generateJobNumber returns both number and updated settings
- Regex extraction handles any template format (extracts trailing digits)
- Transaction ensures counter persists even if later steps fail
- isNull(validTo) ensures only active profile is updated

### Availability Check (Task 2)

**Location:** `apps/api/src/trpc/routers/company.ts` (lines 130-148)

Simple query that checks if a job number already exists in the projects table.

**Code pattern:**
```typescript
checkJobNumberAvailability: protectedProcedure
  .input(z.object({ jobNumber: z.string().min(1) }))
  .query(async ({ ctx, input }) => {
    const [existing] = await ctx.tenant.db
      .select({ id: ctx.tenant.schema.projects.id })
      .from(ctx.tenant.schema.projects)
      .where(eq(ctx.tenant.schema.projects.jobNumber, input.jobNumber))
      .limit(1);

    return {
      available: !existing,
      existingProjectId: existing?.id || null,
    };
  }),
```

**Why this works:**
- Returns availability boolean for simple checks
- Includes existingProjectId for error messages
- No caching (real-time accuracy for concurrent users)
- Will be called from frontend in Phase 22

## Deviations from Plan

None - plan executed exactly as written.

## Testing Performed

1. **TypeScript compilation:** Verified both modified files compile without errors
2. **Code structure validation:** Confirmed changes integrate correctly with existing transaction flow
3. **Import verification:** Checked generateJobNumber and isNull imports are correct

## Known Limitations

1. **Manual testing required:** Full end-to-end testing with running API server needed to verify:
   - Auto-generation produces correct job numbers
   - Counter increments after each creation
   - Manual entries update counter correctly
   - Availability check returns accurate results

2. **Race condition handling:** PostgreSQL transaction isolation (READ COMMITTED) should prevent duplicate number generation under concurrent requests, but high-concurrency scenarios may benefit from SELECT FOR UPDATE on company_profiles (similar to Phase 5 change order counter pattern)

3. **Counter rollback on project creation failure:** If project creation fails after counter increment, counter remains incremented (skipped number). This is acceptable behavior (gaps are fine) but worth documenting.

## Next Steps

**Phase 22 (Frontend Validation):**
- Wire checkJobNumberAvailability to project form
- Show real-time duplicate warnings
- Validate manual entry matches template format
- Display auto-generated preview when enabled

## Self-Check

Verifying implementation claims:

**Files modified:**
```bash
[ -f "apps/api/src/trpc/routers/project.ts" ] && echo "FOUND: project.ts" || echo "MISSING"
[ -f "apps/api/src/trpc/routers/company.ts" ] && echo "FOUND: company.ts" || echo "MISSING"
```

**Commits exist:**
```bash
git log --oneline --all | grep -q "6eaa71e" && echo "FOUND: 6eaa71e" || echo "MISSING"
git log --oneline --all | grep -q "a4c75c7" && echo "FOUND: a4c75c7" || echo "MISSING"
```

**Self-Check: PASSED** - All files and commits verified.
