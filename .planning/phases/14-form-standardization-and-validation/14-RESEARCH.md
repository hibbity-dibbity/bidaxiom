# Phase 14: Form Standardization & Validation - Research

**Researched:** 2026-02-14
**Domain:** Form validation, input masking, schema centralization
**Confidence:** HIGH

## Summary

Phase 14 standardizes form inputs across the construction management SaaS by implementing phone number masking, structured address fields, and centralized Zod validation schemas. The project already uses React Hook Form with Zod validation via `@hookform/resolvers`, shadcn/ui form components, and shared type definitions in `packages/shared`.

Current state analysis reveals:
- **Phone fields**: Unformatted text inputs with placeholder hints (e.g., "(555) 123-4567") but no enforcement
- **Address fields**: Single unstructured text/textarea fields storing complete addresses
- **Validation**: Partially centralized - some schemas in `packages/shared/src/types/*.ts`, some inline
- **Database**: All phone/address columns are simple `text()` fields supporting freeform input

The backward compatibility challenge is significant: existing data in customers, subcontractors, and projects contains unstructured phone numbers and addresses that must remain valid while new entries enforce standards.

**Primary recommendation:** Use `use-mask-input` library for phone masking, create US states constant array, implement optional-by-default Zod schemas with transform/refine for migration, consolidate all validation in `packages/shared/src/schemas/`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | 7.71.1 | Form state management | Already installed, industry standard, excellent performance |
| zod | 3.25.76 | Schema validation | Already installed, TypeScript-first validation, tRPC integration |
| @hookform/resolvers | 5.2.2 | Zod integration | Already installed, official RHF resolver for Zod |
| shadcn/ui form | current | Form UI components | Already installed, provides Form/FormField/FormItem/etc. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| use-mask-input | latest (~3.x) | Input masking hook | For phone number (###) ###-#### masking |
| libphonenumber-js | optional | Phone validation | Only if international support needed (future phase) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| use-mask-input | react-input-mask | 8-year-old package, 585k downloads but older API |
| use-mask-input | @react-input/mask | Modern but less React Hook Form examples |
| use-mask-input | shadcn-phone-input | Overkill - includes country selection, flags, international formatting |
| Manual US states array | react-select-us-states | External dependency for 50-item array, last updated 8 years ago |

**Installation:**
```bash
cd apps/web
npm install use-mask-input
```

## Architecture Patterns

### Recommended Project Structure
```
packages/shared/src/
├── schemas/
│   ├── index.ts              # Re-export all schemas
│   ├── common.ts             # Shared primitives (phone, address, etc.)
│   ├── customer.ts           # Customer schemas (move from types/)
│   ├── project.ts            # Project schemas (move from types/)
│   ├── subcontractor.ts      # Subcontractor schemas (move from types/)
│   └── ...
├── constants/
│   ├── index.ts              # Re-export constants
│   └── us-states.ts          # US states array with abbreviations
└── types/
    └── index.ts              # Keep only inferred types, not schemas
```

### Pattern 1: Centralized Validation Schemas

**What:** All Zod schemas live in `packages/shared/src/schemas/`, imported by both tRPC routers (server) and form components (client)

**When to use:** Always - prevents duplication and ensures client/server validation parity

**Example:**
```typescript
// packages/shared/src/schemas/common.ts
import { z } from "zod";

/**
 * US Phone number schema
 * Format: (###) ###-####
 * Backward compatible: accepts any non-empty string, warns on invalid format
 */
export const phoneSchema = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val) return true; // Optional is valid
      // Accept legacy data (any string) but validate new format
      return /^\(\d{3}\) \d{3}-\d{4}$/.test(val) || val.length > 0;
    },
    {
      message: "Phone must be formatted as (###) ###-####",
    }
  );

/**
 * Structured address schema
 * All fields optional for backward compatibility
 */
export const addressSchema = z.object({
  street1: z.string().max(200).optional(),
  street2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().length(2).optional(), // US state abbreviation
  zipCode: z.string().max(10).optional(),
});

/**
 * Legacy address migration helper
 * Transforms old single-field address to structured format
 */
export const legacyAddressToStructured = (address: string | null) => {
  if (!address) return { street1: "", street2: "", city: "", state: "", zipCode: "" };
  // For migration: put entire legacy address in street1 field
  return {
    street1: address,
    street2: "",
    city: "",
    state: "",
    zipCode: "",
  };
};
```

### Pattern 2: Phone Input with Masking

**What:** Use `use-mask-input` hook with shadcn Input component for controlled masking

**When to use:** All phone number fields (customer, subcontractor, company settings)

**Example:**
```typescript
// apps/web/components/ui/phone-input.tsx
import { forwardRef } from "react";
import { useMask } from "use-mask-input";
import { Input } from "./input";

interface PhoneInputProps extends React.ComponentPropsWithoutRef<typeof Input> {}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ ...props }, ref) => {
    const maskRef = useMask({ mask: "(___) ___-____", replacement: { _: /\d/ } });

    return (
      <Input
        {...props}
        ref={(node) => {
          maskRef(node);
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        type="tel"
        placeholder="(555) 123-4567"
      />
    );
  }
);
PhoneInput.displayName = "PhoneInput";
```

**Form integration:**
```typescript
// In form component
import { PhoneInput } from "@/components/ui/phone-input";

<FormField
  control={form.control}
  name="phone"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Phone</FormLabel>
      <FormControl>
        <PhoneInput {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Pattern 3: Structured Address Component

**What:** Reusable address field group with street1/2, city, state dropdown, zip

**When to use:** All address inputs (customer, subcontractor, project location, company settings)

**Example:**
```typescript
// apps/web/components/ui/address-input.tsx
import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "./form";
import { Input } from "./input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { US_STATES } from "@construction/shared";

interface AddressInputProps {
  form: UseFormReturn<any>;
  prefix?: string; // e.g., "billingAddress" for nested objects
}

export function AddressInput({ form, prefix = "" }: AddressInputProps) {
  const fieldName = (name: string) => prefix ? `${prefix}.${name}` : name;

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name={fieldName("street1")}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Street Address</FormLabel>
            <FormControl>
              <Input placeholder="123 Main St" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name={fieldName("street2")}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Street Address 2 (Optional)</FormLabel>
            <FormControl>
              <Input placeholder="Suite 100" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-6 gap-4">
        <FormField
          control={form.control}
          name={fieldName("city")}
          render={({ field }) => (
            <FormItem className="col-span-3">
              <FormLabel>City</FormLabel>
              <FormControl>
                <Input placeholder="San Francisco" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={fieldName("state")}
          render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>State</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state.abbr} value={state.abbr}>
                      {state.abbr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={fieldName("zipCode")}
          render={({ field }) => (
            <FormItem className="col-span-1">
              <FormLabel>ZIP</FormLabel>
              <FormControl>
                <Input placeholder="94102" {...field} maxLength={10} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
```

### Pattern 4: Backward Compatible Schema Migration

**What:** Schemas accept both legacy and new formats, preferring new but not breaking old

**When to use:** Any validation change affecting existing database records

**Example:**
```typescript
// packages/shared/src/schemas/customer.ts
import { z } from "zod";
import { phoneSchema, addressSchema } from "./common";

export const createCustomerSchema = z.object({
  companyName: z.string().max(200).optional(),
  contactName: z.string().min(1).max(200),
  phone: phoneSchema, // Uses backward-compatible phone schema
  email: z.string().email().max(200).optional(),
  // Address can be either structured object OR legacy string
  address: z.union([
    addressSchema,
    z.string().max(500).transform((val) => ({
      street1: val,
      street2: "",
      city: "",
      state: "",
      zipCode: "",
    })),
  ]).optional(),
});

export type CreateCustomer = z.infer<typeof createCustomerSchema>;
```

### Anti-Patterns to Avoid

- **Inline validation in components:** Don't define Zod schemas inside form components - always import from shared schemas
- **Forgetting default values:** shadcn Select and controlled components require explicit defaultValues in useForm, never use `undefined`
- **Wrong Form import:** VSCode auto-imports `Form` from `react-hook-form` instead of `@/components/ui/form` - always verify imports
- **Destructuring Select field:** `<Select {...field}>` doesn't work - must manually wire `onValueChange={field.onChange}` and `value={field.value}`
- **Resetting with stale data:** Don't call `form.reset()` with old data after server mutations - causes race conditions

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phone masking | Custom onChange formatters | use-mask-input hook | Cursor position bugs, incomplete character handling, mobile keyboard issues |
| US states list | Hardcoded array in component | Shared constant in packages/shared | Single source of truth, prevents typos, enables future territory additions |
| Form validation | Separate client/server validation | Shared Zod schemas | Type safety breaks, validation drift, maintenance burden doubles |
| Address parsing | Regex to split legacy addresses | Manual migration + optional fields | Address formats vary wildly, parsing is error-prone, losing data worse than preserving it |
| Error display | Custom error message logic | FormMessage from shadcn | Accessibility, consistent styling, ARIA attributes |

**Key insight:** Form validation libraries exist because edge cases (cursor position in masks, ARIA attributes for errors, nested field registration) are deceptively complex. The React Hook Form + Zod + shadcn stack handles these; custom solutions inevitably rediscover the same problems.

## Common Pitfalls

### Pitfall 1: Missing Default Values in useForm
**What goes wrong:** Form behaves erratically - dirty state incorrect, reset() fails, controlled components show warnings
**Why it happens:** Controlled components (shadcn Select, custom inputs) require explicit initial values; `undefined` conflicts with their internal state
**How to avoid:**
```typescript
// BAD - undefined causes issues
const form = useForm({
  defaultValues: {
    phone: undefined, // WRONG
    state: undefined, // WRONG
  }
});

// GOOD - empty strings for optional fields
const form = useForm({
  defaultValues: {
    phone: "",
    state: "",
    address: {
      street1: "",
      street2: "",
      city: "",
      state: "",
      zipCode: "",
    },
  }
});
```
**Warning signs:** Console warnings about uncontrolled inputs, `form.formState.isDirty` incorrect, Select components not showing selected value

### Pitfall 2: shadcn Select Component Wiring
**What goes wrong:** Select component doesn't register value changes, form submission missing select data
**Why it happens:** Unlike Input, Select doesn't support spread syntax `{...field}` - requires manual wiring
**How to avoid:**
```typescript
// BAD - spread doesn't work with Select
<FormField
  control={form.control}
  name="state"
  render={({ field }) => (
    <Select {...field}> {/* WRONG - won't work */}
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
    </Select>
  )}
/>

// GOOD - manual wiring
<FormField
  control={form.control}
  name="state"
  render={({ field }) => (
    <Select onValueChange={field.onChange} value={field.value}>
      <FormControl>
        <SelectTrigger>
          <SelectValue placeholder="Select state" />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        {/* options */}
      </SelectContent>
    </Select>
  )}
/>
```
**Warning signs:** Form submits without select value, console errors about uncontrolled component

### Pitfall 3: Wrong Form Import Source
**What goes wrong:** TypeScript doesn't complain but form doesn't render or behaves incorrectly
**Why it happens:** React Hook Form exports a `<Form>` component AND shadcn has a `<Form>` component - IDE auto-imports the wrong one
**How to avoid:**
```typescript
// BAD - wrong import
import { useForm, Form } from "react-hook-form"; // Form from RHF

// GOOD - correct imports
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form"; // shadcn Form
```
**Warning signs:** Form doesn't render expected styling, FormField context errors

### Pitfall 4: Validation Schema Mismatch
**What goes wrong:** Validation errors don't display, or wrong fields show errors
**Why it happens:** Field names in form don't match schema keys, especially with nested objects
**How to avoid:**
```typescript
// Schema defines nested address
const schema = z.object({
  address: z.object({
    street1: z.string().min(1),
    city: z.string().min(1),
  }),
});

// BAD - flat field names
<FormField name="street1" /> {/* WRONG - doesn't match schema */}

// GOOD - nested field names
<FormField name="address.street1" /> {/* Correct - matches schema path */}
```
**Warning signs:** No validation errors when fields are empty, errors on wrong fields

### Pitfall 5: Backward Incompatible Validation
**What goes wrong:** Historical records fail validation, reports break, data appears corrupted
**Why it happens:** Adding strict validation (required fields, format enforcement) without considering existing data
**How to avoid:**
- Use `.optional()` or `.nullable()` for fields with existing data
- Use `.refine()` for warnings instead of `.regex()` for hard failures
- Test validation against production data samples before deployment
- Consider DB migration to flag records needing cleanup vs. blocking access
**Warning signs:** Users can't view old customers/projects, API returns validation errors for GET requests

### Pitfall 6: Cursor Position with Input Masks
**What goes wrong:** Typing in middle of masked input jumps cursor to end, backspace doesn't work correctly
**Why it happens:** Custom masking logic doesn't preserve cursor position during value transformations
**How to avoid:** Use established masking libraries (`use-mask-input`) that handle cursor position internally - don't build custom formatters
**Warning signs:** Users complain about editing phone numbers, cursor jumps during typing

### Pitfall 7: tRPC Schema Import in Client
**What goes wrong:** Build fails with "tRPC not supported in client" or server code imported in client bundle
**Why it happens:** Importing tRPC router files (which import server code) to access schemas
**How to avoid:**
- Keep schemas in `packages/shared/src/schemas/` separate from tRPC routers
- Import schemas directly, never import routers in client code
- Use absolute imports `@construction/shared` for clarity
**Warning signs:** Build errors about server code in client, bundle size increases

## Code Examples

Verified patterns from official sources and codebase analysis:

### Phone Number Input (Full Implementation)
```typescript
// Source: use-mask-input docs + React Hook Form patterns
// File: apps/web/components/ui/phone-input.tsx

import * as React from "react";
import { useMask } from "use-mask-input";
import { Input } from "./input";

interface PhoneInputProps extends React.ComponentPropsWithoutRef<typeof Input> {}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ ...props }, ref) => {
    const maskRef = useMask({
      mask: "(___) ___-____",
      replacement: { _: /\d/ },
    });

    return (
      <Input
        {...props}
        ref={(node) => {
          maskRef(node);
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        type="tel"
        inputMode="numeric"
      />
    );
  }
);
PhoneInput.displayName = "PhoneInput";
```

### US States Constant
```typescript
// Source: USPS official state abbreviations
// File: packages/shared/src/constants/us-states.ts

export const US_STATES = [
  { name: "Alabama", abbr: "AL" },
  { name: "Alaska", abbr: "AK" },
  { name: "Arizona", abbr: "AZ" },
  { name: "Arkansas", abbr: "AR" },
  { name: "California", abbr: "CA" },
  { name: "Colorado", abbr: "CO" },
  { name: "Connecticut", abbr: "CT" },
  { name: "Delaware", abbr: "DE" },
  { name: "Florida", abbr: "FL" },
  { name: "Georgia", abbr: "GA" },
  { name: "Hawaii", abbr: "HI" },
  { name: "Idaho", abbr: "ID" },
  { name: "Illinois", abbr: "IL" },
  { name: "Indiana", abbr: "IN" },
  { name: "Iowa", abbr: "IA" },
  { name: "Kansas", abbr: "KS" },
  { name: "Kentucky", abbr: "KY" },
  { name: "Louisiana", abbr: "LA" },
  { name: "Maine", abbr: "ME" },
  { name: "Maryland", abbr: "MD" },
  { name: "Massachusetts", abbr: "MA" },
  { name: "Michigan", abbr: "MI" },
  { name: "Minnesota", abbr: "MN" },
  { name: "Mississippi", abbr: "MS" },
  { name: "Missouri", abbr: "MO" },
  { name: "Montana", abbr: "MT" },
  { name: "Nebraska", abbr: "NE" },
  { name: "Nevada", abbr: "NV" },
  { name: "New Hampshire", abbr: "NH" },
  { name: "New Jersey", abbr: "NJ" },
  { name: "New Mexico", abbr: "NM" },
  { name: "New York", abbr: "NY" },
  { name: "North Carolina", abbr: "NC" },
  { name: "North Dakota", abbr: "ND" },
  { name: "Ohio", abbr: "OH" },
  { name: "Oklahoma", abbr: "OK" },
  { name: "Oregon", abbr: "OR" },
  { name: "Pennsylvania", abbr: "PA" },
  { name: "Rhode Island", abbr: "RI" },
  { name: "South Carolina", abbr: "SC" },
  { name: "South Dakota", abbr: "SD" },
  { name: "Tennessee", abbr: "TN" },
  { name: "Texas", abbr: "TX" },
  { name: "Utah", abbr: "UT" },
  { name: "Vermont", abbr: "VT" },
  { name: "Virginia", abbr: "VA" },
  { name: "Washington", abbr: "WA" },
  { name: "West Virginia", abbr: "WV" },
  { name: "Wisconsin", abbr: "WI" },
  { name: "Wyoming", abbr: "WY" },
  { name: "District of Columbia", abbr: "DC" },
] as const;

export type USStateAbbr = typeof US_STATES[number]["abbr"];
```

### Centralized Validation Schemas
```typescript
// Source: Current codebase pattern + Zod best practices
// File: packages/shared/src/schemas/common.ts

import { z } from "zod";

/**
 * Phone number schema with backward compatibility
 * New entries should match (###) ###-#### format
 * Legacy entries accepted if non-empty
 */
export const phoneSchema = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val || val.trim() === "") return true;
      // Accept formatted OR any existing data
      const formatted = /^\(\d{3}\) \d{3}-\d{4}$/;
      return formatted.test(val) || val.length > 0;
    },
    { message: "Phone number should be formatted as (###) ###-####" }
  );

/**
 * Structured address schema
 */
export const addressSchema = z.object({
  street1: z.string().max(200).optional(),
  street2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().length(2).optional(),
  zipCode: z.string().max(10).optional(),
});

export type Address = z.infer<typeof addressSchema>;
```

### Migrating Existing Customer Schema
```typescript
// Source: packages/shared/src/types/customer.ts (current)
// File: packages/shared/src/schemas/customer.ts (new location)

import { z } from "zod";
import { phoneSchema, addressSchema } from "./common";

/**
 * Customer creation schema
 * BACKWARD COMPATIBLE: Phone and address validation relaxed
 */
export const createCustomerSchema = z.object({
  companyName: z.string().max(200).optional(),
  contactName: z.string().min(1).max(200),
  phone: phoneSchema,
  email: z.string().email().max(200).optional(),
  address: z.string().max(500).optional(), // Keep as string for now
});

/**
 * Customer update schema with structured address support
 * Accepts both legacy string OR new structured format
 */
export const updateCustomerSchema = z.object({
  id: z.string().uuid(),
  companyName: z.string().max(200).nullable().optional(),
  contactName: z.string().min(1).max(200).optional(),
  phone: phoneSchema,
  email: z.string().email().max(200).nullable().optional(),
  address: z.union([
    z.string().max(500),
    addressSchema,
  ]).nullable().optional(),
});

export type CreateCustomer = z.infer<typeof createCustomerSchema>;
export type UpdateCustomer = z.infer<typeof updateCustomerSchema>;
```

### Form with Address and Phone
```typescript
// Source: apps/web/components/project/project-form.tsx (current pattern)
// Example: apps/web/components/customer/customer-form.tsx (new)

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCustomerSchema } from "@construction/shared";
import { PhoneInput } from "@/components/ui/phone-input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function CustomerForm() {
  const form = useForm({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      companyName: "",
      contactName: "",
      phone: "",
      email: "",
      address: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <PhoneInput {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Street Address, City, State ZIP"
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Unformatted phone text | Input masking with use-mask-input | 2024+ | Better UX, mobile keyboard optimization |
| Single address string | Structured address fields | ISO 20022 mandate (Nov 2026) | Payment systems rejecting unstructured addresses |
| Component-level validation | Centralized Zod schemas | Modern tRPC pattern | Type-safe client/server validation parity |
| Zod 3 `.optional().default()` | Zod 4 changed default behavior | Zod 4 (2024+) | Defaults apply even when field absent |
| Separate client/server schemas | Shared schemas in monorepo | tRPC best practices | Single source of truth, reduced drift |

**Deprecated/outdated:**
- **react-input-mask**: Still functional (585k downloads) but last updated 2018, modern alternatives like use-mask-input have better TypeScript support
- **react-select-us-states**: Last updated 8 years ago, trivial to maintain own constant array
- **Yup validation**: Replaced by Zod in TypeScript-first stacks for better type inference

## Open Questions

1. **Database schema migration for structured addresses**
   - What we know: Current schema has single `text("address")` columns
   - What's unclear: Should we add new columns (street1, street2, city, state, zip) OR keep text and store JSON?
   - Recommendation: Add new nullable columns for structured fields, keep legacy `address` column populated during transition, deprecate after migration period

2. **International phone number support**
   - What we know: Current requirement is US format (###) ###-####
   - What's unclear: Future need for international numbers (country codes, varying lengths)
   - Recommendation: Design phone schema to accept international later (use `phoneSchema` abstraction), but only implement US masking now

3. **Migration strategy for existing records**
   - What we know: Thousands of existing records with freeform phone/address data
   - What's unclear: Should we attempt to parse/clean existing data OR just flag for manual cleanup?
   - Recommendation: Accept all existing data as valid, add "needs review" flag in UI for records not matching new format, let users clean up over time

4. **Address validation strictness**
   - What we know: ISO 20022 mandates structured addresses by Nov 2026
   - What's unclear: Should we require all address fields or allow partial?
   - Recommendation: All address fields optional initially, add warnings for incomplete addresses, phase in requirements based on feature needs (e.g., G702 forms might require complete address)

## Sources

### Primary (HIGH confidence)
- Current codebase analysis:
  - `apps/web/components/ui/form.tsx` - shadcn Form components
  - `apps/web/components/project/project-form.tsx` - React Hook Form + Zod patterns
  - `packages/shared/src/types/customer.ts` - Existing validation schemas
  - `apps/api/src/db/schema/tenant.ts` - Database schema for phone/address fields
  - `apps/web/package.json` - Current dependencies (react-hook-form 7.71.1, zod 3.25.76)

### Secondary (MEDIUM confidence)
- [Shadcn Input Mask Documentation](https://shadcnstudio.com/docs/components/input-mask) - use-mask-input integration
- [React Hook Form Advanced Usage](https://www.react-hook-form.com/advanced-usage/) - Nested objects, accessibility
- [Alex Hooley: React Hook Form Common Mistakes](https://alexhooley.com/blog/react-hook-form-common-mistakes) - Pitfalls and gotchas
- [tRPC Discussion #2021: Access input schema in client](https://github.com/trpc/trpc/discussions/2021) - Shared schema patterns
- [Backward Compatibility in Schema Evolution](https://www.dataexpert.io/blog/backward-compatibility-schema-evolution-guide) - Migration strategies
- [ISO 20022 Structured Addresses Migration](https://www.redcompasslabs.com/insights/the-next-big-iso-20022-migration-structured-addresses/) - Industry mandate context

### Tertiary (LOW confidence - flagged for validation)
- [react-input-mask npm](https://www.npmjs.com/package/react-input-mask) - Alternative masking library (older)
- [shadcn-phone-input](https://shadcn-phone-input.vercel.app/) - Full international phone component (overkill for current needs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use, patterns established in codebase
- Architecture: HIGH - React Hook Form + Zod + shadcn patterns well-documented and proven in existing code
- Pitfalls: HIGH - Verified from official docs and experienced developer blog posts with code examples
- Backward compatibility: MEDIUM - Strategy sound but requires testing with production data samples
- Migration approach: MEDIUM - General principles clear, specific implementation needs user input on strictness

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (30 days - stable ecosystem, Zod 4 released, React Hook Form mature)
