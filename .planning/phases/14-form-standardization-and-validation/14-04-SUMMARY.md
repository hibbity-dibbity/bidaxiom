---
phase: 14-form-standardization-and-validation
plan: 04
subsystem: forms
tags: [forms, validation, phone-input, address-input, react-hook-form]
one-liner: Customer and subcontractor forms using PhoneInput and AddressInput with proper React Hook Form integration
dependency-graph:
  requires: [14-01, 14-02, 14-03]
  provides: [standardized-customer-forms, standardized-subcontractor-forms]
  affects: [customer-management, subcontractor-directory]
tech-stack:
  added: []
  patterns: [react-hook-form-with-custom-components, structured-address-display]
key-files:
  created: []
  modified:
    - apps/web/app/(dashboard)/customers/page.tsx
    - apps/web/app/(dashboard)/customers/[customerId]/page.tsx
    - apps/web/components/bidding/subcontractor-form.tsx
    - apps/web/app/(dashboard)/subcontractors/[subId]/page.tsx
decisions: []
metrics:
  duration: 4 min
  tasks: 2
  files: 4
  completed: 2026-02-15T14:32:53Z
---

# Phase 14 Plan 04: Customer and Subcontractor Forms Summary

Customer and subcontractor forms updated with PhoneInput for (###) ###-#### phone masking and AddressInput for structured address entry (street1, street2, city, state dropdown, zip).

## What Was Built

### Task 1: Customer Page Forms
- Refactored customer list page to use React Hook Form with `zodResolver`
- Replaced plain phone input with `PhoneInput` component for automatic (###) ###-#### formatting
- Replaced freeform address textarea with `AddressInput` component (5 structured fields)
- Updated customer table to display formatted structured address (street1, city, state zip)
- Updated customer detail page to format and display structured address correctly

**Files:**
- `apps/web/app/(dashboard)/customers/page.tsx` - Add/edit dialogs with PhoneInput and AddressInput
- `apps/web/app/(dashboard)/customers/[customerId]/page.tsx` - Display formatted structured address

### Task 2: Subcontractor Form
- Refactored `SubcontractorForm` to use shadcn `Form` wrapper pattern (was using plain `<form>` with `{...register()}`)
- Replaced contactPhone text input with `PhoneInput` component
- Replaced freeform address textarea with `AddressInput` component
- Updated defaultValues mapping to convert DB fields (street1, street2, city, state, zip) to form address object shape
- Updated subcontractor detail page to display formatted structured address
- Updated edit dialog to pass structured address fields correctly
- Kept CSI trade checkboxes unchanged (already working)

**Files:**
- `apps/web/components/bidding/subcontractor-form.tsx` - PhoneInput and AddressInput integration
- `apps/web/app/(dashboard)/subcontractors/[subId]/page.tsx` - Display formatted structured address

## How It Works

**React Hook Form Integration:**
- Both forms use `useForm` with `zodResolver(createCustomerSchema | createSubcontractorSchema)`
- `PhoneInput` integrates via `<FormField render={({ field }) => <PhoneInput {...field} />}>`
- `AddressInput` receives form instance and prefix: `<AddressInput form={form} prefix="address" />`

**Address Field Mapping:**
- Form stores address as object: `{ street1, street2, city, state, zipCode }`
- Submit handler flattens to API schema: `{ address: {...}, street1, street2, city, state, zip }`
- API schema includes both `address` object and flat fields for backward compatibility

**Address Display:**
- Table: `formatAddress()` returns single-line comma-separated: "street1, city, state zip"
- Detail pages: Multi-line with `whitespace-pre-line` for newline-separated formatting

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Commit | Message |
|--------|---------|
| f5b605c | feat(14-04): update customer dialogs with PhoneInput and AddressInput |
| 62014b5 | feat(14-04): update subcontractor form with PhoneInput and AddressInput |

## Verification

- TypeScript compilation: Customer and subcontractor files updated, no new errors introduced (pre-existing errors in auth/workflow files unrelated to changes)
- Customer add dialog: PhoneInput masks as (###) ###-####, AddressInput shows 5 structured fields
- Customer edit dialog: Pre-fills existing data correctly from structured fields
- Customer table: Displays formatted addresses (street1, city, state zip)
- Customer detail page: Shows multi-line formatted structured address
- Subcontractor create form: PhoneInput masks, AddressInput shows structured fields
- Subcontractor edit: Pre-fills existing data correctly from DB fields (street1, street2, city, state, zip)
- Subcontractor detail page: Shows multi-line formatted structured address

## Next Steps

Continue with Plan 05 (final plan in Phase 14) to standardize remaining forms.

---

**Plan Duration:** 4 minutes
**Completed:** 2026-02-15 14:32 UTC

## Self-Check: PASSED

All files exist:
- FOUND: apps/web/app/(dashboard)/customers/page.tsx
- FOUND: apps/web/app/(dashboard)/customers/[customerId]/page.tsx
- FOUND: apps/web/components/bidding/subcontractor-form.tsx
- FOUND: apps/web/app/(dashboard)/subcontractors/[subId]/page.tsx

All commits exist:
- FOUND: f5b605c
- FOUND: 62014b5
