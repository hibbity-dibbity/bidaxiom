---
status: resolved
trigger: "Investigate the 'useFormField should be used within <FormField>' error affecting customer and subcontractor forms in Phase 14."
created: 2026-02-15T00:00:00Z
updated: 2026-02-15T00:14:00Z
---

## Current Focus

hypothesis: CONFIRMED - AddressInput component internally uses FormField/FormLabel which calls useFormField(), but it's being used OUTSIDE a FormField wrapper in broken forms
test: Examined all three forms - found the pattern difference
expecting: Working form wraps AddressInput differently than broken forms
next_action: Document root cause and identify fix location

## Symptoms

expected: Customer and subcontractor forms should render PhoneInput and AddressInput components without errors
actual: Forms throw "useFormField should be used within <FormField>" error
errors: Error at components/ui/form.tsx line 48 - "Error: useFormField should be used within <FormField>"
reproduction: Open customer add/edit dialog or subcontractor create/edit form
started: After Phase 14 Plan 04 implementation (PhoneInput/AddressInput integration)

## Eliminated

## Evidence

- timestamp: 2026-02-15T00:05:00Z
  checked: PhoneInput component (apps/web/components/ui/phone-input.tsx)
  found: PhoneInput is a simple wrapper around Input with ref forwarding - does NOT use FormField internally
  implication: PhoneInput works fine when used directly in FormField render prop (as all forms do)

- timestamp: 2026-02-15T00:06:00Z
  checked: AddressInput component (apps/web/components/ui/address-input.tsx)
  found: AddressInput INTERNALLY uses FormField, FormLabel, FormControl, FormMessage (lines 37-124)
  implication: AddressInput creates its own FormField wrappers, which means it uses useFormField internally

- timestamp: 2026-02-15T00:07:00Z
  checked: Customer form usage (customers/page.tsx lines 413-416, 500-503)
  found: AddressInput is used OUTSIDE FormField - just a div with FormLabel + AddressInput
  implication: When AddressInput's internal FormLabel/FormControl call useFormField(), they're not inside a FormField context = ERROR

- timestamp: 2026-02-15T00:08:00Z
  checked: Subcontractor form usage (subcontractor-form.tsx lines 189-192)
  found: Same pattern - div with FormLabel + AddressInput, NO FormField wrapper
  implication: Same error - AddressInput's internal components can't find FormField context

- timestamp: 2026-02-15T00:09:00Z
  checked: Working project form usage (project-form.tsx lines 330-332, 784-786)
  found: Also uses div + heading + AddressInput (NO FormField wrapper)
  implication: WAIT - project form also doesn't wrap AddressInput in FormField, but it's marked as "working"

- timestamp: 2026-02-15T00:10:00Z
  checked: Re-examined all three usages more carefully
  found: ALL THREE forms use the same pattern - no FormField wrapper around AddressInput
  implication: If project form works, then the pattern isn't the issue. Need to reconsider.

- timestamp: 2026-02-15T00:11:00Z
  checked: form.tsx useFormField() function (lines 42-67)
  found: useFormField calls useFormContext() and checks two contexts - FormFieldContext and FormItemContext
  implication: Error occurs when FormFieldContext is null (line 47-49), but AddressInput's internal FormFields should provide their own context

- timestamp: 2026-02-15T00:12:00Z
  checked: AddressInput internal structure again
  found: AddressInput renders FormField components which provide FormFieldContext via Controller/FormFieldContext.Provider (form.tsx lines 29-40)
  implication: AddressInput's FormFields SHOULD provide context. Why aren't they?

- timestamp: 2026-02-15T00:13:00Z
  checked: Standalone FormLabel usage in broken forms
  found: customers/page.tsx line 414, 501 and subcontractor-form.tsx line 190 have `<FormLabel>Address</FormLabel>` OUTSIDE FormField
  implication: THIS IS THE PROBLEM - FormLabel calls useFormField() (line 93), but it's outside a FormField context!

## Resolution

root_cause: The broken forms use `<FormLabel>Address</FormLabel>` as a standalone component OUTSIDE a FormField wrapper (customers/page.tsx lines 414 & 501, subcontractor-form.tsx line 190). FormLabel internally calls useFormField() to access form state (form.tsx line 93), which requires being inside a FormField context. The working project-form.tsx avoids this by using a plain `<h4>` heading instead of FormLabel (lines 330, 784).

fix: Replace standalone `<FormLabel>Address</FormLabel>` with a plain HTML element like `<h4>` or `<Label>` (the primitive, not FormLabel) in the broken forms. FormLabel should ONLY be used inside FormField render props.

verification: Open customer add/edit dialog and subcontractor create/edit form - they should render without errors.

files_changed:
  - apps/web/app/(dashboard)/customers/page.tsx (lines 414, 501)
  - apps/web/components/bidding/subcontractor-form.tsx (line 190)
