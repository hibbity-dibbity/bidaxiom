---
phase: quick-5
plan: 01
type: summary
subsystem: company-settings
tags: [ui, configuration, job-numbering]
completed: 2026-02-14

dependency_graph:
  requires: []
  provides:
    - job-numbering-ui-configuration
  affects:
    - company-profile-settings

tech_stack:
  added: []
  patterns:
    - react-hook-form integration
    - live preview pattern
    - template validation

key_files:
  created: []
  modified:
    - apps/api/src/trpc/routers/company.ts
    - apps/web/app/(dashboard)/settings/company/page.tsx

decisions: []

metrics:
  duration_minutes: 4
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 5: Restore Custom Job Numbering Setup on Company Settings

**One-liner:** Restored job numbering configuration UI with enable/disable toggle, template input, and live preview to company settings page.

## Overview

The backend schema (`company_profiles.job_number_settings`), shared types (`JobNumberSettings`, `jobNumberSettingsSchema`), and utility functions (`previewJobNumber`, `validateJobNumberTemplate`) all existed from prior work. The project creation form already read and used these settings. However, the Company Profile settings page had no UI to configure job numbering, and the `company.update` mutation was overwriting job number settings on every save.

This quick task restored the missing configuration UI and fixed the API mutation to persist job number settings properly.

## Tasks Completed

### Task 1: Fix company.update mutation to persist jobNumberSettings

**Files:** `apps/api/src/trpc/routers/company.ts`

**What was done:**
- Added `jobNumberSettings: input.jobNumberSettings` to the insert values in the company update mutation
- The `companyConfigSchema` already validated this field, and the database schema already had the JSONB column
- This was a one-line fix to prevent job number settings from being lost on company profile saves

**Commit:** `9d31a75`

### Task 2: Add job numbering configuration UI to company settings page

**Files:** `apps/web/app/(dashboard)/settings/company/page.tsx`

**What was done:**
1. Added imports for `Switch`, `Input`, `previewJobNumber`, `validateJobNumberTemplate`, and `JobNumberSettings` type
2. Updated form `defaultValues` to include `jobNumberSettings` with sensible defaults
3. Updated the `useEffect` that populates form data to include `jobNumberSettings` from the loaded company profile (with fallback to defaults)
4. Added a new "Job Numbering" Card section between "Custom Specialty Trades" and the Submit button with:
   - Enable/disable toggle using the Switch component
   - Template input field with validation on blur (checks for {N+} pattern)
   - Next sequence number input (type="number", min=1)
   - Live preview showing what the next job number will look like using `previewJobNumber()`
   - Help text explaining available tokens ({YYYY}, {YY}, {MM}, {DD}, {NNN...})
   - Conditional rendering: when disabled, shows brief note about enabling
5. All fields respect the `canManage` permission (read-only for non-admins)

**Commit:** `0a9822a`

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- [x] Company settings page includes Job Numbering card
- [x] Enable/disable toggle functions
- [x] Template input validates on blur (requires {N+} pattern)
- [x] Live preview updates as template or sequence number changes
- [x] Settings persist after save (jobNumberSettings included in mutation)
- [x] Form loads existing settings from database on page load
- [x] Non-admin users see disabled state (respects `canManage` permission)

## Success Criteria Met

- [x] Job numbering configuration card visible on company settings page
- [x] Enable/disable toggle works
- [x] Template input with validation (must contain {N+} pattern)
- [x] Live preview updates as template or sequence number changes
- [x] Settings persist after save and page reload
- [x] Non-admin users see read-only state
- [x] No regression to existing company type and trades configuration

## Self-Check

Verifying claimed files and commits:

### Files Modified

```
apps/api/src/trpc/routers/company.ts - FOUND
apps/web/app/(dashboard)/settings/company/page.tsx - FOUND
```

### Commits

```
9d31a75 - FOUND (Task 1: fix company update mutation)
0a9822a - FOUND (Task 2: add job numbering UI)
```

## Self-Check: PASSED

All files exist and all commits are in git history.

## Impact

**User-facing changes:**
- Admins can now configure automatic job numbering settings from the Company Profile settings page
- Previously, this configuration was impossible through the UI (required direct database edits)
- Job number settings now survive company profile updates (previously were reset to defaults)

**Technical improvements:**
- Closed the gap between backend capabilities and frontend UI
- Settings UI follows established patterns (Card layout, permission checks, form validation)
- Live preview provides immediate feedback on template changes

**Dependencies resolved:**
- None (this was a missing UI for existing backend functionality)

**Next steps:**
- None required (job numbering is now fully functional end-to-end)
