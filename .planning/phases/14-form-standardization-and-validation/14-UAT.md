---
status: diagnosed
phase: 14-form-standardization-and-validation
source:
  - 14-01-SUMMARY.md
  - 14-02-SUMMARY.md
  - 14-03-SUMMARY.md
  - 14-04-SUMMARY.md
  - 14-05-SUMMARY.md
started: 2026-02-15T14:45:00Z
updated: 2026-02-15T15:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Phone input masking in customer form
expected: Navigate to /customers page. Click "Add Customer" button. In the phone field, start typing digits (e.g., 5551234567). The input should automatically format as you type to display (555) 123-4567 format with parentheses, space, and dash appearing automatically.
result: issue
reported: "failed, error: Unhandled Runtime Error Error: useFormField should be used within <FormField> Source components\ui\form.tsx (48:11) @ useFormField"
severity: blocker

### 2. Address structured fields in customer form
expected: In the customer "Add Customer" dialog, the address section should display 5 separate fields: Street Address 1, Street Address 2 (optional), City, State (dropdown), and ZIP Code. No single freeform address textarea should be present.
result: issue
reported: "Failed, error when opening add customer page: Unhandled Runtime Error Error: useFormField should be used within <FormField> Source components\ui\form.tsx (48:11) @ useFormField"
severity: blocker

### 3. State dropdown contains all US states
expected: Click the State dropdown in the customer address section. The dropdown should contain all 50 US states plus DC (51 total options) with 2-letter abbreviations (AL, AK, AZ, etc.). States should be in alphabetical order by abbreviation.
result: skipped
reason: Blocked by test 1-2 customer form error

### 4. Customer address persistence and display
expected: Create a new customer with phone (555) 123-4567 and address (123 Main St, Suite 100, Denver, CO, 80202). After saving, navigate to the customer detail page. The address should display as formatted text showing "123 Main St, Suite 100, Denver, CO 80202" or similar structured format.
result: skipped
reason: Blocked by test 1-2 customer form error

### 5. Subcontractor form phone and address inputs
expected: Navigate to /subcontractors page and create a new subcontractor. The contact phone field should have (###) ###-#### input masking. The address section should show 5 structured fields (street1, street2, city, state dropdown, zip) instead of a single textarea.
result: issue
reported: "Failed, When clicking to create a new subcontractor I get an error: Unhandled Runtime Error Error: useFormField should be used within <FormField> Source components\ui\form.tsx (48:11) @ useFormField"
severity: blocker

### 6. Subcontractor address display
expected: After creating a subcontractor with structured address, navigate to the subcontractor detail page. The address should display as formatted structured text (not individual field labels, but nicely formatted like "123 Main St, Denver, CO 80202").
result: skipped
reason: Blocked by test 5 subcontractor form error

### 7. Project form location uses structured address
expected: Navigate to /projects/new to create a new project. The location field should display as AddressInput with 5 structured fields (Street Address 1, Street Address 2, City, State dropdown, ZIP Code) instead of a single text input.
result: pass
note: "User requested placeholder text changes (street address 2: Suite 4B, City: Houston, State: TX, Zip: 77001) - noted as enhancement request, not blocking"

### 8. Project inline customer dialog uses standardized inputs
expected: On the project creation form, click the "Add Customer" button in the customer dropdown section. The inline dialog should appear with phone field using (###) ###-#### masking and address using 5 structured fields with state dropdown.
result: pass

### 9. Form validation error display
expected: In any form (customer, subcontractor, or project), submit with invalid phone (e.g., "abc" or "123") or missing required address fields. Validation error messages should display consistently below each field in red text, using the same error message style across all forms.
result: pass

### 10. Phone field accepts optional empty values
expected: Create a customer or subcontractor without entering a phone number (leave it blank). The form should submit successfully without validation errors, confirming that phone numbers are optional as designed.
result: pass

### 11. Data persistence after migration
expected: Since the migration deleted existing phone/address data (per user decision), previously created customers/subcontractors/projects should show empty address fields. No old freeform address text should appear. Forms should still be editable to add new structured addresses.
result: pass

## Summary

total: 11
passed: 5
issues: 1
pending: 0
skipped: 3

## Gaps

- truth: "Customer form renders without errors and displays phone input with automatic (###) ###-#### formatting"
  status: failed
  reason: "User reported: failed, error: Unhandled Runtime Error Error: useFormField should be used within <FormField> Source components\ui\form.tsx (48:11) @ useFormField"
  severity: blocker
  test: 1
  root_cause: "Standalone <FormLabel>Address</FormLabel> used outside FormField wrapper. FormLabel internally calls useFormField() which requires FormField context. Working project-form.tsx uses <h4 className='text-sm font-medium'>Address</h4> instead."
  artifacts:
    - path: "apps/web/app/(dashboard)/customers/page.tsx"
      issue: "Lines 414 and 501 use standalone FormLabel for Address section"
    - path: "apps/web/components/bidding/subcontractor-form.tsx"
      issue: "Line 190 uses standalone FormLabel for Address section"
  missing:
    - "Replace FormLabel with regular heading (h4 or Label primitive) in customer dialogs"
    - "Replace FormLabel with regular heading (h4 or Label primitive) in subcontractor form"
  debug_session: ".planning/debug/phase14-useformfield-error.md"
