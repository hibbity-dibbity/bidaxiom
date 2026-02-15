---
phase: 14-form-standardization-and-validation
plan: 07
subsystem: [forms, validation]
tags: [customer-management, subcontractor-management, required-fields, email-validation]
completed: 2026-02-15
duration: 1.5

dependency_graph:
  requires: [14-01, 14-02, 14-03, 14-04, 14-05]
  provides: [email-required-validation]
  affects: [customer-forms, subcontractor-forms]

tech_stack:
  added: []
  patterns: [zod-required-fields, react-hook-form-validation]

key_files:
  created: []
  modified:
    - packages/shared/src/types/customer.ts
    - packages/shared/src/types/bidding.ts
    - apps/web/app/(dashboard)/customers/page.tsx
    - apps/web/components/bidding/subcontractor-form.tsx

decisions:
  - summary: Keep .optional() in update schemas for partial updates
    rationale: Update operations should allow partial updates where email can be omitted
  - summary: Remove .nullable() from email fields to prevent NULL storage
    rationale: Prevents storing NULL values going forward while allowing existing records with NULL emails

metrics:
  tasks_completed: 2
  files_modified: 4
  commits: 2
---

# Phase 14 Plan 07 - Email Required Field Fix

**One-liner:** Email fields now required with proper validation in customer and subcontractor forms using Zod schema enforcement

## What Was Built

Made email fields required in customer and subcontractor forms by fixing Zod schema validation and updating UI labels. This resolves Gap 2 from Phase 14 UAT where blank email submissions showed "invalid email" error instead of "Required" error.

## Changes Made

### Schema Updates (Task 1)
- **createCustomerSchema**: Changed `email: z.string().email().max(200).optional()` to `email: z.string().email().max(200)`
- **updateCustomerSchema**: Changed `email: z.string().email().max(200).nullable().optional()` to `email: z.string().email().max(200).optional()`
- **createSubcontractorSchema**: Changed `contactEmail: z.string().email().optional()` to `contactEmail: z.string().email()`
- **updateSubcontractorSchema**: Changed `contactEmail: z.string().email().nullable().optional()` to `contactEmail: z.string().email().optional()`

### UI Updates (Task 2)
- **Customer add/edit dialogs**: Changed "Email" label to "Email *" (line 403, 490)
- **Subcontractor form**: Changed "Contact Email" label to "Contact Email *" (line 165)
- Matches existing required field pattern used for Contact Name and Company Name

## Technical Decisions

**Why removing .optional() fixes the issue:**
Zod's `.email()` validator validates format even when `.optional()` is present. An empty string is not a valid email format, so blank submissions failed with "invalid email" error. Removing `.optional()` makes the field required, causing Zod to validate:
1. Field is present (not undefined)
2. Field is not empty (default string validation)
3. Field is valid email format (`.email()` validator)

**Update schema pattern:**
- Keep `.optional()` to allow partial updates (email can be omitted when updating other fields)
- Remove `.nullable()` to prevent storing NULL email values going forward
- Existing records with NULL emails can still be loaded and updated

## Deviations from Plan

None - plan executed exactly as written.

## Artifacts Created

N/A (schema and UI label updates only)

## Affects

**Subsystems:**
- forms: Customer and subcontractor form validation
- validation: Email field validation behavior

**Features:**
- customer-management: Customer creation and editing
- subcontractor-management: Subcontractor creation and editing

**User Impact:**
- Users must now provide email when creating customers or subcontractors
- Blank email shows clear "Required" error instead of confusing "invalid email"
- Existing records with NULL emails can still be edited (update schema allows optional)

## Testing Notes

**Manual verification required:**
1. Customer form: Leave email blank, expect "Required" error (not "invalid email")
2. Customer form: Enter invalid format "notanemail", expect "Invalid email" error
3. Customer form: Enter valid email, expect form submits successfully
4. Subcontractor form: Same validation behavior as customer form
5. Edit existing customer with NULL email: Form loads, can update to valid email

**TypeScript compilation:** Verified with `npx tsc --noEmit` in shared package - no errors

## Self-Check

**Files created:** N/A

**Files modified:**
- packages/shared/src/types/customer.ts: FOUND
- packages/shared/src/types/bidding.ts: FOUND
- apps/web/app/(dashboard)/customers/page.tsx: FOUND
- apps/web/components/bidding/subcontractor-form.tsx: FOUND

**Commits:**
- 8c7dae3: FOUND
- 75abcf4: FOUND

## Self-Check: PASSED

---

**Tasks:** 2/2 complete
**Duration:** 1.5 minutes
**Commits:** 8c7dae3, 75abcf4
