# Phase 34: Currency Format on Blur - Research

**Researched:** 2026-02-18
**Domain:** React controlled inputs, format-on-blur, React Hook Form integration
**Confidence:** HIGH (all findings from direct codebase inspection)

## Summary

Every currency input in this app currently uses `type="number"` inputs with raw numeric values — no formatting on screen. The goal is: user types freely, tabs away, field shows `$X,XXX.XX`. On focus, the field reverts to the raw number so editing is natural.

Two distinct input patterns exist in the codebase. **RHF-managed fields** (change-order-form, commitment-form) use `register()` with `valueAsNumber: true`. **Plain-state fields** (budget-line-item-table, sov-editor, bid-comparison-table) manage their own string state. A third category — **inline click-to-edit cells** (SOVLineItemCard, EstimateLineItemsTable) — already has a blur callback pattern, just needs currency formatting added to it.

The correct approach is a single shared `useCurrencyField` hook that returns props spread onto an `<Input>`. For RHF fields the hook composes with the RHF `register()` return value, preserving RHF's own `onBlur` (which triggers validation). For plain-state fields the hook manages its own local string state. The `formatCurrency` utility already exists and is correct; no new packages are needed.

**Primary recommendation:** Create `apps/web/hooks/use-currency-field.ts` with two usage modes: standalone and RHF-composed. Update each of the 7 identified currency inputs to use it. Change `type="number"` to `type="text"` on currency inputs so the formatted string can display.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FORM-01 | All currency and amount input fields reformat to US currency format on blur (when the user leaves the field), displaying the value as "$X,XXX.XX" after the user finishes typing | formatCurrency utility verified; blur pattern documented for both RHF and plain-state fields; all 7 target fields catalogued with their exact input type |
</phase_requirements>

---

## Existing Utilities (Verified by Codebase Inspection)

### `formatCurrency` — the canonical formatter

**Location:** `apps/web/lib/utils/format.ts`
**Returns:** `"$X,XXX.XX"` string via `Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 })`

```typescript
// Source: apps/web/lib/utils/format.ts (verified)
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
```

**Also available at:**
- `packages/shared/src/utils/currency.ts` — identical implementation
- `apps/web/components/estimates/line-items/MarginCalculator.tsx` — re-exports from `@/lib/utils/format` for backward compatibility

**Import to use:** `import { formatCurrency } from "@/lib/utils/format";`

### `parseCurrency` — does NOT exist yet

No existing parse utility. Must be created inline or added to `format.ts`. The parse logic is simple:

```typescript
// Strip $ and commas, parse as float
function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[$,]/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}
```

**Recommendation:** Add `parseCurrencyInput` to `apps/web/lib/utils/format.ts` alongside `formatCurrency`.

---

## Field Inventory (Verified by Codebase Inspection)

All 7 fields from the prior decision — their current input type, state management, and what changes.

### Category A: RHF-managed fields (2 fields)

These use `register()` with `valueAsNumber: true`. The `register()` call spreads `{ name, ref, onChange, onBlur }` onto the input. The existing `onBlur` from RHF triggers validation and must be preserved.

| File | Field | Current input | RHF field path |
|------|-------|--------------|----------------|
| `apps/web/components/change-order/change-order-form.tsx` | `amountChange` | `type="number"`, `valueAsNumber: true` | `lineItems.${index}.amountChange` |
| `apps/web/components/budget/commitment-form.tsx` | `amount` | `type="number"`, `valueAsNumber: true` | `lineItems.${index}.amount` |

**Key observation:** Both forms also use `watch("lineItems")` to compute a running total, which means RHF's internal value must stay numeric. The format-on-blur approach handles this: the display is a string (formatted) but RHF holds the number.

### Category B: Plain-state fields (3 fields)

These use `useState` with a string value. On form submit, they call `parseFloat(formData.X)`. Format-on-blur is straightforward: display the formatted string after blur, show raw number on focus.

| File | Field | State key | Parse on submit |
|------|-------|-----------|-----------------|
| `apps/web/components/budget/budget-line-item-table.tsx` | `budgetedAmount` | `formData.budgetedAmount` (string) | `parseFloat(formData.budgetedAmount)` |
| `apps/web/components/payment-app/sov-editor.tsx` | `scheduledValue` | `formData.scheduledValue` (string) | `parseFloat(formData.scheduledValue)` |
| `apps/web/components/bidding/bid-comparison-table.tsx` | `adjustmentAmount` | `adjustmentAmount` (string, useState) | `parseFloat(adjustmentAmount)` |

### Category C: Inline click-to-edit fields (2 fields)

These already have a blur-triggered save pattern. `SOVLineItemCard` and `EstimateLineItemsTable.EditableCell` both use local `useState` string + `handleBlur` that calls `parseFloat`. Adding format-on-blur means: show formatted string when not editing, accept raw input when editing. The `isEditing` boolean already controls the display/input toggle.

| File | Field | Existing blur handler | State type |
|------|-------|--------------------|------------|
| `apps/web/components/estimates/sov/SOVLineItemCard.tsx` | `amountValue` | `handleAmountBlur()` — parses float, calls `onUpdate` | `useState(String(sovLineItem.amount))` |
| `apps/web/components/estimates/line-items/EstimateLineItemsTable.tsx` | `unitCost` (via `EditableCell`) | `handleBlur()` — parses float for number columns, calls `updateLineItem.mutate` | `useState(initialValue ?? "")` |

---

## Architecture Patterns

### The `useCurrencyField` Hook

Create `apps/web/hooks/use-currency-field.ts`. This hook manages the display/raw value split.

**Core concept:**
- Internally stores a `displayValue` string (either raw while editing or formatted while blurred)
- On focus: strip formatting, show raw number string
- On blur: format the value, report numeric value to caller

**Standalone mode (for plain-state fields):**

```typescript
// Source: this codebase, no external library
function useCurrencyField(initialValue: string | number) {
  const numericValue = typeof initialValue === "string"
    ? parseCurrencyInput(initialValue)
    : initialValue;

  const [displayValue, setDisplayValue] = useState(
    numericValue ? formatCurrency(numericValue) : ""
  );

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Strip formatting so user can edit the raw number
    const n = parseCurrencyInput(e.target.value);
    setDisplayValue(n !== 0 ? String(n) : "");
    e.target.select(); // Select all for easy overwrite
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayValue(e.target.value);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const n = parseCurrencyInput(e.target.value);
    setDisplayValue(isNaN(n) || n === 0 ? "" : formatCurrency(n));
    return n; // caller can use this numeric value
  };

  return { displayValue, handleFocus, handleChange, handleBlur };
}
```

**RHF-composed mode:**

For RHF fields, do NOT use `register()` directly on the input. Instead, use `Controller` from RHF, which gives explicit `field.onChange`, `field.onBlur`, `field.value`. This avoids the conflict between RHF's `onBlur` and the format-on-blur `onBlur`.

```typescript
// Pattern for RHF currency fields (change-order-form, commitment-form)
// Source: verified against current forms — both already import Controller-compatible patterns
import { Controller, useFormContext } from "react-hook-form";

<Controller
  name={`lineItems.${index}.amountChange`}
  control={control}
  render={({ field }) => {
    const [displayValue, setDisplayValue] = useState(
      field.value ? formatCurrency(field.value) : ""
    );
    return (
      <Input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={(e) => setDisplayValue(e.target.value)}
        onFocus={(e) => {
          const n = parseCurrencyInput(e.target.value);
          setDisplayValue(n !== 0 ? String(n) : "");
          e.target.select();
        }}
        onBlur={() => {
          const n = parseCurrencyInput(displayValue);
          setDisplayValue(n !== 0 ? formatCurrency(n) : "");
          field.onChange(n);    // update RHF's numeric value
          field.onBlur();       // trigger RHF validation
        }}
      />
    );
  }}
/>
```

**CRITICAL:** Replace `register()` with `Controller` for the two RHF currency fields. Do NOT try to merge onBlur handlers by spreading `register()` — state conflicts occur because `register()` sets `type="number"` behavior internally.

### Category C fields — inline pattern (simpler)

For `SOVLineItemCard` and `EstimateLineItemsTable`, do NOT use the hook — these components already have the right structure. Just:
1. Change `type="number"` to `type="text" inputMode="decimal"`
2. In the "not editing" display, show `formatCurrency(numericValue)` (already done in SOVLineItemCard)
3. In `handleAmountBlur`/`handleBlur`, after parsing, set the display string to the raw number (so editing starts from raw), and format on transition back to display mode

For `EstimateLineItemsTable.EditableCell`: the `isEditing` boolean already controls display vs input. When `isEditing` becomes false, show `formatCurrency(Number(initialValue))` instead of `Number(initialValue).toFixed(2)`.

---

## Standard Stack

No new packages needed. Everything uses existing code.

| Tool | Version | Purpose | Source |
|------|---------|---------|--------|
| `formatCurrency` | existing | Format number to `$X,XXX.XX` | `@/lib/utils/format` |
| `parseCurrencyInput` | new (trivial) | Strip `$,` and parse float | Add to `@/lib/utils/format` |
| React `useState` | existing | Local display state | React built-in |
| RHF `Controller` | existing | Replace `register()` for currency fields | Already imported in forms |
| `inputMode="decimal"` | HTML attribute | Mobile keyboard shows numeric keypad for text inputs | HTML standard |

**Installation:** None required.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Currency formatting | Custom Intl.NumberFormat call | `formatCurrency` from `@/lib/utils/format` | Already exists, already correct for en-US |
| Currency parsing | Complex regex | `parseCurrencyInput` — 3 lines: replace `$,`, `parseFloat`, handle NaN | The problem is genuinely simple; no library warranted |
| Live masking | Any masking library | Format-on-blur only | Live masking was tried and reverted (prior decision) |

**Key insight:** This phase is pure UI behavior — no backend changes, no library additions. The complexity is in getting the RHF integration right, not in the formatting math.

---

## Common Pitfalls

### Pitfall 1: Spreading `register()` and adding a second `onBlur`

**What goes wrong:** `{...register("amountChange", { valueAsNumber: true }), onBlur: myHandler}` — the spread overwrites the last `onBlur` definition. If the order is reversed, RHF's validation `onBlur` is lost.

**Why it happens:** JavaScript object spread is last-writer-wins. Both handlers are needed.

**How to avoid:** Switch RHF currency fields from `register()` to `Controller`. `Controller` gives explicit `field.onBlur` that you call manually, so both run.

**Warning signs:** Validation errors stop appearing after field edits; or currency formatting never applies.

---

### Pitfall 2: Leaving `type="number"` on formatted inputs

**What goes wrong:** `type="number"` inputs reject non-numeric characters. Formatted value `"$12,500.00"` is invalid for `type="number"` and the browser clears the input or shows a validation error.

**Why it happens:** HTML number inputs only accept numeric strings with optional sign and decimal point.

**How to avoid:** Change all currency inputs to `type="text" inputMode="decimal"`. `inputMode="decimal"` gives the numeric keyboard on mobile while allowing any string value.

**Warning signs:** Input displays blank after formatting, or browser shows "invalid value" warning.

---

### Pitfall 3: Losing the `e.target.select()` on focus

**What goes wrong:** User focuses the field, cursor is in the middle of `$12,500.00`. User must manually select-all before typing, which feels broken.

**How to avoid:** In `onFocus`, call `e.target.select()` after setting the raw value. This selects all text so typing immediately replaces it.

---

### Pitfall 4: setState during Controller render closure causes stale closure bugs

**What goes wrong:** Putting `useState` inside a `Controller` render prop creates a new state instance on every re-render. Value resets unexpectedly.

**How to avoid:** Extract the currency input into a separate component (`CurrencyInput`) that receives `value`, `onChange`, `onBlur` as props. The `Controller` passes `field.value`, `field.onChange`, `field.onBlur` to it.

**Recommended pattern:**

```typescript
// Separate component avoids stale closure in Controller render prop
function CurrencyInput({
  value,
  onChange,
  onBlur,
  placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  onBlur: () => void;
  placeholder?: string;
}) {
  const [displayValue, setDisplayValue] = useState(
    value ? formatCurrency(value) : ""
  );

  // Sync if parent value changes (e.g., reset form)
  useEffect(() => {
    setDisplayValue(value ? formatCurrency(value) : "");
  }, [value]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={displayValue}
      placeholder={placeholder ?? "0.00"}
      onChange={(e) => setDisplayValue(e.target.value)}
      onFocus={(e) => {
        const n = parseCurrencyInput(e.target.value);
        setDisplayValue(n !== 0 ? String(n) : "");
        e.target.select();
      }}
      onBlur={() => {
        const n = parseCurrencyInput(displayValue);
        setDisplayValue(n !== 0 ? formatCurrency(n) : "");
        onChange(n);
        onBlur();
      }}
    />
  );
}
```

---

### Pitfall 5: `watch("lineItems")` total breaks when value is formatted string

**What goes wrong:** In change-order-form and commitment-form, `totalAmount` is computed via `watch("lineItems").reduce(... Number(item.amountChange) ...)`. If `amountChange` is somehow a string instead of a number, `Number(...)` coerces it — but this only works if `Controller` correctly calls `field.onChange(numericValue)`.

**How to avoid:** Ensure `field.onChange` is always called with `parseCurrencyInput(displayValue)` — a number — not the formatted string. This is enforced by the `CurrencyInput` component above.

---

### Pitfall 6: `useEffect` dependency on `value` causing infinite loop

**What goes wrong:** The sync `useEffect` in `CurrencyInput` (pitfall 4 solution) watches `value`. If `field.onChange(n)` causes a re-render where `field.value` changes, the effect fires and resets the display, overwriting the user's partial typing.

**How to avoid:** The effect only needs to fire when the form is reset (e.g., navigating away and back). Use a ref to track whether the user is focused:

```typescript
const isFocusedRef = useRef(false);

useEffect(() => {
  if (!isFocusedRef.current) {
    setDisplayValue(value ? formatCurrency(value) : "");
  }
}, [value]);
```

Set `isFocusedRef.current = true` on focus and `false` on blur (after formatting).

---

## Code Examples

### Complete `CurrencyInput` component (canonical implementation)

This is the single reusable component for all RHF and plain-state currency fields.

```typescript
// Source: to be created at apps/web/components/ui/currency-input.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { formatCurrency, parseCurrencyInput } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  /** Numeric value (what RHF or parent state holds) */
  value: number;
  /** Called with numeric value on blur */
  onChange: (value: number) => void;
  /** Called on blur (for RHF field.onBlur or form validation) */
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CurrencyInput({
  value,
  onChange,
  onBlur,
  placeholder = "0.00",
  className,
  disabled,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(
    value ? formatCurrency(value) : ""
  );
  const isFocusedRef = useRef(false);

  // Sync when parent resets the form (not during active typing)
  useEffect(() => {
    if (!isFocusedRef.current) {
      setDisplayValue(value ? formatCurrency(value) : "");
    }
  }, [value]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={displayValue}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(className)}
      onChange={(e) => setDisplayValue(e.target.value)}
      onFocus={(e) => {
        isFocusedRef.current = true;
        const n = parseCurrencyInput(e.target.value);
        setDisplayValue(n !== 0 ? String(n) : "");
        e.target.select();
      }}
      onBlur={() => {
        isFocusedRef.current = false;
        const n = parseCurrencyInput(displayValue);
        const formatted = n !== 0 ? formatCurrency(n) : "";
        setDisplayValue(formatted);
        onChange(n);
        onBlur?.();
      }}
    />
  );
}
```

### `parseCurrencyInput` to add to `format.ts`

```typescript
// Source: to be added to apps/web/lib/utils/format.ts
/**
 * Parse a currency input string (typed or formatted) to a number.
 * Handles: "$1,234.56", "1234.56", "1,234", "1234", ""
 * Returns 0 for empty or invalid input.
 */
export function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, "").trim();
  if (cleaned === "" || cleaned === "-") return 0;
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}
```

### Using `CurrencyInput` with React Hook Form `Controller`

```typescript
// Source: pattern for change-order-form and commitment-form
import { Controller } from "react-hook-form";
import { CurrencyInput } from "@/components/ui/currency-input";

// Replace the register()-based Input for amountChange:
<Controller
  name={`lineItems.${index}.amountChange`}
  control={control}
  render={({ field }) => (
    <CurrencyInput
      value={field.value ?? 0}
      onChange={field.onChange}
      onBlur={field.onBlur}
    />
  )}
/>
```

### Using `CurrencyInput` for plain-state fields

```typescript
// Source: pattern for budget-line-item-table, sov-editor
// Before:
<Input
  type="number"
  step="0.01"
  value={formData.budgetedAmount}
  onChange={(e) => setFormData({ ...formData, budgetedAmount: e.target.value })}
  placeholder="0.00"
/>

// After:
<CurrencyInput
  value={parseFloat(formData.budgetedAmount) || 0}
  onChange={(n) => setFormData({ ...formData, budgetedAmount: String(n) })}
/>
// Note: formData.budgetedAmount stays as string; submit still does parseFloat()
```

### Updating `EstimateLineItemsTable.EditableCell` for `unitCost`

The `EditableCell` has its own blur pattern. For currency columns, change the display value:

```typescript
// Source: apps/web/components/estimates/line-items/EstimateLineItemsTable.tsx
// In the not-editing branch, instead of:
{type === "number" && initialValue ? Number(initialValue).toFixed(2) : value || "-"}

// For unitCost (currency) columns, pass a prop to signal currency display:
// Option: add isCurrency prop to EditableCell, or just handle unitCost column specially
{isCurrency && initialValue
  ? formatCurrency(Number(initialValue))
  : type === "number" && initialValue
  ? Number(initialValue).toFixed(2)
  : value || "-"}

// In the editing branch for currency cells, use CurrencyInput instead of type="number" Input
```

### Updating `SOVLineItemCard` for `amountValue`

```typescript
// Source: apps/web/components/estimates/sov/SOVLineItemCard.tsx
// SOVLineItemCard already uses isEditingAmount toggle correctly
// Change: when editing, use CurrencyInput; when not editing, display formatCurrency()
// The existing handleAmountBlur already calls onUpdate with the parsed number

// Current editing input:
<Input
  type="number"  // CHANGE to CurrencyInput
  step="0.01"
  value={amountValue}
  onChange={(e) => setAmountValue(e.target.value)}
  onBlur={handleAmountBlur}
  ...
/>

// Replace with:
<CurrencyInput
  value={parseFloat(amountValue) || 0}
  onChange={(n) => {
    setAmountValue(String(n));
    if (n !== sovLineItem.amount) {
      onUpdate(sovLineItem.id, { amount: n });
    }
    setIsEditingAmount(false);
  }}
  onBlur={() => setIsEditingAmount(false)}
/>
```

---

## Implementation Order

The planner should sequence tasks in this order to minimize risk:

1. **Add `parseCurrencyInput` to `format.ts`** — foundation, no UI changes
2. **Create `CurrencyInput` component** at `apps/web/components/ui/currency-input.tsx` — the single reusable component
3. **Update change-order-form** (`amountChange`) — RHF Controller pattern
4. **Update commitment-form** (`amount`) — same RHF Controller pattern
5. **Update budget-line-item-table** (`budgetedAmount`) — plain-state pattern
6. **Update sov-editor** (`scheduledValue`) — plain-state pattern
7. **Update bid-comparison-table** (`adjustmentAmount`) — plain-state pattern
8. **Update SOVLineItemCard** (`amountValue`) — inline edit pattern
9. **Update EstimateLineItemsTable** (`unitCost` via EditableCell) — inline edit pattern, most complex due to TanStack Table column structure

---

## Architecture Decision: One Component, Not One Hook

The `CurrencyInput` **component** approach is preferred over a `useCurrencyField` **hook** approach because:

- Components are easier to test in isolation
- No stale-closure risk from hooks used inside `Controller` render props (a hook inside a render prop creates a new instance on every render)
- Consistent API: both RHF and plain-state fields use the same `<CurrencyInput value onChange onBlur />` props
- The component is self-contained — it manages its own display state without leaking implementation details

---

## What Does NOT Change

- Zod schemas: already `z.number()`, no changes needed
- tRPC routers: already receive and store numbers, no changes needed
- Database: already numeric columns, no changes needed
- `formatCurrency` utility: already correct, used as-is
- The `currencyFormatter` local instances in change-order-form, commitment-form, and other files: these are used for **display** (table cells, totals, select options) — they stay. Only the **input fields** change.

---

## Open Questions

1. **`adjustmentAmount` in bid-comparison-table — is it truly a required field?**
   - What we know: it is `type="number"` with `placeholder="0.00"`, passed to the mutation as `adjustmentAmount ? parseFloat(adjustmentAmount) : undefined`
   - What's unclear: the field is optional (mutation accepts `adjustmentAmount?: number`). If the user leaves it blank, `parseCurrencyInput("")` returns `0`, which would change semantics from "not provided" to `0`.
   - Recommendation: In the `CurrencyInput`'s `onChange`, pass `n !== 0 ? n : undefined` for this field, or keep the existing `adjustmentAmount ? parseFloat(adjustmentAmount) : undefined` logic by checking if `displayValue` is empty.

2. **`EstimateLineItemsTable.EditableCell` — apply to `unitCost` column only or all number columns?**
   - What we know: `quantity` is also a number column in `EditableCell`. Quantity is not a currency value.
   - What's unclear: Should quantity also be formatted? The phase scope (FORM-01) specifies "currency and amount fields" — quantity is a count, not currency.
   - Recommendation: Add `isCurrency?: boolean` prop to `EditableCell`. Only `unitCost` column passes `isCurrency`. `quantity` and `customMarkupPercent` remain as plain number inputs.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all 7 target files — confirmed field types, state management, blur patterns
- `apps/web/lib/utils/format.ts` — `formatCurrency` implementation verified
- `apps/web/components/shared/currency-display.tsx` — existing display component confirmed
- `apps/web/components/estimates/line-items/MarginCalculator.tsx` — `formatCurrency` re-export chain verified
- `apps/web/hooks/use-debounce.ts` — confirmed no `useCurrencyField` hook exists yet

### Secondary (MEDIUM confidence)
- React Hook Form `Controller` + `register()` behavior: verified by reading form component source. The `register()` spreading behavior with `onBlur` conflict is well-established React Hook Form documentation behavior (not re-verified against RHF docs here, but matches the code observed).

---

## Metadata

**Confidence breakdown:**
- Field inventory: HIGH — read every file directly
- formatCurrency utility: HIGH — read source directly
- RHF Controller pattern: HIGH — matches observed code structure; standard RHF docs pattern
- Pitfalls: HIGH — derived from direct code analysis, not speculation
- CurrencyInput component design: HIGH — derived from combining observed patterns

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable React/RHF patterns; codebase won't change the target files independently)
