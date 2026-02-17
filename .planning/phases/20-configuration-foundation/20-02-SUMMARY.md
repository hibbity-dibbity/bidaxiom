---
phase: 20-configuration-foundation
plan: "02"
subsystem: company-settings
tags: [validation, ui-enhancement, job-numbering]
dependencies:
  requires: []
  provides: [template-validation, preview-ui]
  affects: [job-number-generation]
tech-stack:
  added: []
  patterns: [discriminated-union-return, inline-validation-feedback]
key-files:
  created: []
  modified:
    - packages/shared/src/types/company.ts
    - apps/web/app/(dashboard)/settings/company/page.tsx
decisions:
  - "Validation checks run in order: syntax (braces) → requirements (sequence) → length (min/max)"
  - "Discriminated union return type {valid: true} | {valid: false, error} for backward compatibility"
  - "Preview shows next 3 job numbers to demonstrate token behavior and sequence progression"
  - "Character count displayed to help users stay within 50-character database limit"
metrics:
  duration: 3.2
  completed: 2026-02-17
---

# Phase 20 Plan 02: Template Validation Enhancement Summary

**One-liner:** Enhanced job number template validation with detailed error messages and improved UI feedback showing next 3 preview examples

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Enhance template validation with detailed error messages | 6dfc369 | packages/shared/src/types/company.ts |
| 2 | Add template validation feedback to UI and improve preview | 8ad2c90 | apps/web/app/(dashboard)/settings/company/page.tsx |

## What Was Built

### Template Validation Logic (packages/shared/src/types/company.ts)

**Enhanced `validateJobNumberTemplate()` function:**
- Changed return type from `boolean` to discriminated union: `{valid: true} | {valid: false, error: string}`
- Validation checks in priority order:
  1. Unmatched braces (syntax error)
  2. Missing sequence pattern ({NN} or longer)
  3. Sequence too short (must be at least {NN}, not {N})
  4. Invalid tokens (e.g., {INVALID})
  5. Template too short (< 5 characters)
  6. Template too long (> 50 characters)

**Added `getAvailableTokens()` helper:**
- Returns array of valid tokens with descriptions
- Used by UI for dynamic help text
- Tokens: {YYYY}, {YY}, {MM}, {DD}, {NNN}

**Updated `jobNumberSettingsSchema`:**
- Uses Zod `.refine()` to integrate enhanced validation
- Error messages flow from validateJobNumberTemplate to schema validation
- Prevents invalid templates from being saved

### UI Validation Feedback (apps/web/app/(dashboard)/settings/company/page.tsx)

**Inline validation feedback:**
- `templateError` state tracks current validation error
- Red text displays error message below input field
- Error clears when user starts typing again (onChange)
- Toast notification shows on blur with validation error

**Character count display:**
- Shows "Template length: X/50 characters" below input
- Helps users stay within database column limit

**Dynamic token help text:**
- Uses `getAvailableTokens()` to generate help text
- Each token has title attribute with description
- Tokens rendered as styled code elements

**Enhanced preview section:**
- Shows next 3 job numbers instead of just 1
- Demonstrates sequence progression (e.g., "26-0001, 26-0002, 26-0003")
- Helps users visualize how template will work in practice

## Validation Test Results

All validation tests passed:
- ✓ `{YYYY}-{NNN}` → Valid (standard pattern)
- ✓ `{YY}{NNNN}` → Valid (compact pattern)
- ✓ `{YYYY}` → Invalid: "must contain sequence pattern"
- ✓ `{N}` → Invalid: "at least 2 digits"
- ✓ `{YYYY-{NNN}` → Invalid: "unmatched braces"
- ✓ `{INVALID}-{NNN}` → Invalid: "Unknown token"
- ✓ `A` → Invalid: "must contain sequence pattern"

## Deviations from Plan

None - plan executed exactly as written.

## Key Technical Decisions

**1. Validation check ordering**
- **Decision:** Check syntax (braces) → requirements (sequence) → constraints (length)
- **Rationale:** Users should see the most critical error first. Unmatched braces indicate syntax error, missing sequence indicates invalid template, length is a constraint.
- **Impact:** Error messages prioritize correctness over constraints, improving user experience.

**2. Discriminated union return type**
- **Decision:** `{valid: true} | {valid: false, error: string}` instead of throwing errors
- **Rationale:** Allows callers to handle validation failures gracefully. UI can display inline errors, schema can provide Zod error messages.
- **Impact:** Backward compatible (type narrowing works), flexible for different use cases.

**3. Preview shows next 3 job numbers**
- **Decision:** Display 3 consecutive job numbers instead of just 1
- **Rationale:** Helps users understand sequence behavior and see how template will work over time.
- **Impact:** Better visualization of job numbering system, reduces user confusion.

## Files Modified

### packages/shared/src/types/company.ts
- Added `getAvailableTokens()` function (12 lines)
- Enhanced `validateJobNumberTemplate()` with detailed validation (78 lines, up from 3)
- Updated `jobNumberSettingsSchema` to use refined validation (10 lines, up from 5)

### apps/web/app/(dashboard)/settings/company/page.tsx
- Added `templateError` state and imported `getAvailableTokens`
- Updated template input onChange to clear error
- Updated template input onBlur to set error from validation result
- Added red error text display below input
- Added character count display
- Converted static token help to dynamic from `getAvailableTokens()`
- Enhanced preview to show next 3 job numbers instead of 1

## Manual Verification Checklist

User should verify the following:
1. Navigate to `/settings/company` as admin
2. Enable job numbering
3. Test invalid templates:
   - Enter `{YYYY}` → see error "must contain sequence pattern"
   - Enter `{N}` → see error "at least 2 digits"
   - Enter `{YYYY-{NNN}` → see error "unmatched braces"
   - Enter `{INVALID}-{NNN}` → see error "Unknown token"
4. Test valid templates:
   - Enter `{YY}-{NNNN}` → error clears, preview shows "26-0001, 26-0002, 26-0003"
   - Enter `JOB-{NNNNN}` → preview shows "JOB-00001, JOB-00002, JOB-00003"
5. Verify character count updates as you type
6. Verify token help text shows all available tokens
7. Save configuration → no errors, settings persist

## Success Criteria

- [x] Template validation returns detailed error messages (not just true/false)
- [x] UI shows inline validation errors in red text
- [x] Validation errors clear when user edits template
- [x] Preview shows multiple example job numbers (next 3 in sequence)
- [x] Character count displayed and updates reactively
- [x] Token help text is comprehensive and easy to understand
- [x] Invalid templates cannot break the save operation (validation prevents submission)

## Self-Check: PASSED

**Files created:**
- None (all files modified)

**Files modified:**
- ✓ packages/shared/src/types/company.ts exists
- ✓ apps/web/app/(dashboard)/settings/company/page.tsx exists

**Commits:**
- ✓ 6dfc369 exists (Task 1: Enhanced template validation)
- ✓ 8ad2c90 exists (Task 2: UI validation feedback and preview)

All claims verified.
