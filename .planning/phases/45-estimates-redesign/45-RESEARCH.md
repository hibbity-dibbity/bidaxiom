# Phase 45: Estimates Redesign - Research

**Researched:** 2026-02-22
**Domain:** React Hook Form, react-number-format v5, Tailwind/Lucide custom stepper, estimate wizard architecture
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Stepper visual design**
- Completed steps: Filled brand teal circle with a checkmark icon
- Active step: Filled brand teal circle with the step number
- Future steps: Gray outline circle with the step number
- Three distinct visual tiers: done (teal + check) / active (teal + number) / future (gray outline + number)
- Step labels: Only the active step shows its label below the circle
- Connecting line: Fills with brand teal as steps complete (left-to-right)

**Stepper navigation rules**
- Clicking a completed step jumps back freely — forward steps remain marked complete (no invalidation)
- Clicking a future step is allowed — user can jump forward, no validation gate enforced
- Moving forward: explicit "Next" button at the bottom of each step + Enter key on the last field
- Final step (Step 6): Read-only review/summary; Submit fires from there

**Currency input behavior**
- Empty field: Blank, no placeholder ($ appears as user starts typing)
- Submission value: JavaScript number via `onValueChange`
- Focus behavior: Claude decides (react-number-format default)
- Existing CurrencyInput: Claude decides after call site audit

**Form section grouping (estimate wizard steps only)**
- Horizontal divider line + section heading above each group
- Heading: `text-xs font-semibold uppercase tracking-wider text-muted-foreground`
- Which steps: Claude audits all 6 steps and applies where 2+ logical field groups exist
- Scope: Estimate wizard steps ONLY — CO, project, and customer forms NOT in scope

### Claude's Discretion
- react-number-format default focus behavior (stay formatted vs strip to raw) — use library default
- Whether to convert or delete the existing `CurrencyInput` component — decide after call site audit
- Which specific estimate wizard steps receive section grouping — audit fields per step and apply where warranted

### Deferred Ideas (OUT OF SCOPE)
- Section grouping on change order form
- Section grouping on project form
- Section grouping on customer form
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FORM-01 | Estimate creation wizard displays a horizontal stepper bar at the top with all 6 steps labeled, current step highlighted, completed steps visually marked; users can navigate back to any completed step by clicking it | WorkflowStepContainer + WorkflowSidebar files identified; stepper slots above WorkflowStepContainer in the workflow page layout |
| FORM-02 | All currency input fields across the app use react-number-format NumericFormat with $ prefix, thousands separators, 2 decimal precision; submission value is a number not a formatted string | 7 CurrencyInput call sites audited; react-number-format v5.4.4 confirmed installed; Controller pattern confirmed; 1 additional currency field found (bid-comparison-table leveling amount) |
| FORM-03 | Multi-section estimate wizard steps use clear visual section grouping (scoped to wizard steps only) | All 6 step files audited; grouping candidates identified per step |
</phase_requirements>

---

## Summary

Phase 45 targets three independent but coordinated changes to the estimate creation wizard: a horizontal stepper bar, currency input migration to react-number-format, and section grouping within wizard step forms.

The estimate wizard is fully built and functional. It uses a Zustand store (`useWorkflowState`) to track `currentStep` and `maxUnlockedStep`, with a vertical sidebar (`WorkflowSidebar`) providing navigation. The stepper bar will replace or augment this sidebar — the context decision says "horizontal stepper bar at the top," which means it inserts into the workflow page layout (`apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/workflow/page.tsx`) above the existing `WorkflowStepContainer`.

Currency inputs currently use a hand-rolled `CurrencyInput` component at `apps/web/components/ui/currency-input.tsx`. It formats on blur and exposes a numeric `onChange`. It has 7 call sites. The migration to NumericFormat is a systematic swap: build a new `NumericCurrencyInput` wrapper around `NumericFormat`, update `CurrencyInput` to delegate to it (or replace directly), and update the 2 Controller-wrapped usages in change-order-form and commitment-form.

No Controller-wrapped fields exist anywhere in the estimate wizard steps — all 6 steps use either `useForm` with `FormField`/`render`, plain `Input` elements, or inline table cell editing with local state. The CSS visibility constraint is a concern for the `change-order-form.tsx` only (it uses `{step === N && ...}` conditional mounting with a `Controller` inside).

**Primary recommendation:** Build a standalone `EstimateStepperBar` component, insert it into the workflow page, migrate `CurrencyInput` to a NumericFormat wrapper, keep the existing component path to avoid breaking all call sites, then apply section dividers to steps 1, 4, and 5 only.

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-number-format | ^5.4.4 | Live currency masking + numeric value | Installed in Phase 41 (FOUND-04); standard for currency UX |
| react-hook-form | (existing) | Form state management | Already used in all forms |
| zustand | (existing) | Workflow step state | Already the current state mechanism |
| lucide-react | (existing) | Check icon for completed steps | Already used throughout |
| tailwindcss | (existing) | Stepper styling | No third-party stepper needed |

### No New Installs Required
All needed libraries are already present. The stepper is built from Tailwind + Lucide primitives.

---

## Architecture Patterns

### Wizard Layout — Current Structure

```
apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/workflow/page.tsx
  EstimateWorkflowPage
  ├── flex min-h-screen
  │   ├── WorkflowSidebar  (w-64 border-r, vertical nav)
  │   └── flex-1 p-6
  │       ├── header (estimate name + saving indicator)
  │       └── WorkflowStepContainer (currentStep → renders step component)
```

The stepper bar inserts **between the page header and the WorkflowStepContainer**, inside the `flex-1 p-6` area. The sidebar remains for backward compatibility OR can be removed/converted — the CONTEXT says the stepper replaces the sidebar's navigation function. However, the sidebar currently drives `goToStep` from `useWorkflowState`, which the stepper will also call.

### Zustand Workflow State

File: `apps/web/components/estimates/workflow/useWorkflowState.ts`

```typescript
// Zustand store — persists estimateId + currentStep to localStorage
const useWorkflowState = create<WorkflowState>()(
  persist(
    (set, get) => ({
      currentStep: 1,
      maxUnlockedStep: 1,     // gates navigation in sidebar
      goToStep: (step) => {
        // Current: only allows step <= maxUnlockedStep
        // CHANGE NEEDED: allow all steps (CONTEXT: "future steps clickable")
        if (step <= maxUnlockedStep) { set({ currentStep: step }); }
      },
      unlockStep: (step) => { /* sets maxUnlockedStep = Math.max(current, step) */ }
    }),
    { name: 'estimate-workflow-state', partialize: ... }
  )
);
```

**Critical discovery:** The current `goToStep` only allows navigation to unlocked steps. The CONTEXT decision says future steps must be clickable (free navigation). The `goToStep` function must be changed to allow `step <= 6` always, not just `step <= maxUnlockedStep`.

### Pattern 1: EstimateStepperBar Component

New file: `apps/web/components/estimates/workflow/EstimateStepperBar.tsx`

```typescript
// Source: CONTEXT.md locked decisions + Tailwind + lucide-react
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkflowState } from "./useWorkflowState";

const STEPS = [
  { number: 1, label: "Basic Info" },
  { number: 2, label: "Template Selection" },
  { number: 3, label: "Line Items" },
  { number: 4, label: "Labor Rates" },
  { number: 5, label: "Markup Config" },
  { number: 6, label: "SOV Builder" },
];

export function EstimateStepperBar() {
  const { currentStep, goToStep } = useWorkflowState();

  return (
    <div className="flex items-start w-full mb-6">
      {STEPS.map((step, idx) => {
        const isDone = step.number < currentStep;
        const isActive = step.number === currentStep;
        const isLast = idx === STEPS.length - 1;

        return (
          <div key={step.number} className="flex items-start flex-1 min-w-0">
            {/* Circle + optional label */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => goToStep(step.number)}
                className={cn(
                  "w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                  (isDone || isActive) && "bg-primary border-primary text-primary-foreground",
                  !isDone && !isActive && "border-muted-foreground text-muted-foreground bg-transparent"
                )}
              >
                {isDone ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-semibold">{step.number}</span>
                )}
              </button>
              {isActive && (
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-1 text-center whitespace-nowrap">
                  {step.label}
                </span>
              )}
            </div>

            {/* Connecting line */}
            {!isLast && (
              <div className="flex-1 mx-1 mt-4 h-0.5">
                <div
                  className={cn(
                    "h-full",
                    isDone ? "bg-primary" : "bg-border"
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Insertion point in workflow page** (line ~69 of workflow/page.tsx):
```tsx
{/* Step Progress */}
<EstimateStepperBar />

{/* Step Content */}
<WorkflowStepContainer estimateId={estimate.id} currentStep={currentStep} />
```

### Pattern 2: NumericFormat Controller Wrapper

New file: `apps/web/components/ui/numeric-currency-input.tsx`

```typescript
// Source: react-number-format v5 docs + react-hook-form discussions #2200
import { NumericFormat } from "react-number-format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NumericCurrencyInputProps {
  value: number | undefined;
  onValueChange: (value: number | undefined) => void;
  onBlur?: () => void;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export function NumericCurrencyInput({
  value,
  onValueChange,
  onBlur,
  className,
  disabled,
  id,
}: NumericCurrencyInputProps) {
  return (
    <NumericFormat
      id={id}
      value={value === 0 ? "" : value}  // Show blank when 0 (CONTEXT: empty = blank)
      prefix="$"
      thousandSeparator
      decimalScale={2}
      fixedDecimalScale
      allowNegative
      customInput={Input}
      className={cn(className)}
      disabled={disabled}
      onBlur={onBlur}
      onValueChange={(values) => {
        onValueChange(values.floatValue);  // numeric, not string
      }}
    />
  );
}
```

**Controller wrapping pattern** (confirmed from react-hook-form discussions):
```typescript
<Controller
  name="amountChange"
  control={control}
  render={({ field }) => (
    <NumericCurrencyInput
      value={Number(field.value) || undefined}
      onValueChange={(n) => field.onChange(n ?? 0)}
      onBlur={field.onBlur}
    />
  )}
/>
```

**CRITICAL:** The `Controller` itself must NOT be conditionally mounted. The CSS visibility rule from v1.6 research applies to any UI that hides/shows Controller fields.

### Pattern 3: Section Grouping

Applied inside estimate wizard step JSX where 2+ logical groups exist:

```typescript
// Section heading + divider pattern
// Heading: text-xs font-semibold uppercase tracking-wider text-muted-foreground
<div className="space-y-4">
  <div>
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
      Overhead
    </p>
    <hr className="mb-4" />
    {/* fields */}
  </div>
  <div>
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
      Markup by Cost Type
    </p>
    <hr className="mb-4" />
    {/* fields */}
  </div>
</div>
```

### Anti-Patterns to Avoid

- **Conditional mounting of Controller fields:** The `change-order-form.tsx` uses `{step === 3 && <Card>...<Controller>...</Card>}` — this unmounts the Controller when not on step 3. This is a known regression risk flagged in the CONTEXT. For the estimate wizard stepper, steps are NEVER mounted simultaneously — each step is a separate component rendered via switch/case, so there is no conditional mounting of Controllers within a single form. The regression risk is in change-order-form only, which is out of scope.
- **Using `value` instead of `floatValue`:** `values.value` is a string like `"1250"`. Always use `values.floatValue` for the numeric result.
- **`useForm<any>`:** change-order-form.tsx line 63 uses `useForm<any>` — this is the existing warning sign. The estimate wizard steps use typed schemas.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Currency input with live masking | Custom regex input handler | NumericFormat v5 | Handles caret, selection, paste, mobile keyboard, negative numbers |
| Thousands separator display | `toLocaleString()` on input | NumericFormat prefix + thousandSeparator | Handles edge cases: leading zeros, partial entry, copy/paste |
| Stepper component | Third-party stepper package (no official shadcn stepper for React) | Tailwind + Lucide `Check` + `cn()` | No shadcn/ui stepper in core library; custom gives exact visual per CONTEXT decisions |

**Key insight:** react-number-format handles the hard edge cases of currency entry (caret positioning during format, selection on focus, negative sign, paste from clipboard) that the current `CurrencyInput` partially handles but the hand-rolled approach misses.

---

## Common Pitfalls

### Pitfall 1: floatValue is undefined when field is empty
**What goes wrong:** When user clears the field, `values.floatValue` is `undefined`, not `0`. If you call `field.onChange(values.floatValue)` directly, the RHF value becomes `undefined`, which fails Zod `z.number()` validation.
**How to avoid:** Use `field.onChange(values.floatValue ?? 0)` in the Controller render.
**Warning signs:** Zod validation errors for currency fields when user clears the input.

### Pitfall 2: goToStep won't navigate to future steps
**What goes wrong:** Current `goToStep` in `useWorkflowState.ts` has `if (step <= maxUnlockedStep)` guard. The CONTEXT decision allows clicking any step (future steps clickable). If `goToStep` isn't updated, the stepper clicks on future steps silently fail.
**How to avoid:** Update `goToStep` to allow `step >= 1 && step <= 6` always, removing the `maxUnlockedStep` gate.
**Warning signs:** Clicking future steps in stepper does nothing.

### Pitfall 3: Sidebar navigation conflict
**What goes wrong:** WorkflowSidebar still exists and also calls `goToStep`. After adding the stepper bar, there are two navigation UIs. The sidebar is gated by `maxUnlockedStep`, the stepper is not — they will show inconsistent state if kept together.
**How to avoid:** Either remove the sidebar for the workflow page (replace with stepper only) or convert the sidebar to also use the unrestricted navigation. The CONTEXT says "visible horizontal progress stepper" — implies the stepper is the primary nav; sidebar may be removed.
**Warning signs:** Double navigation controls confuse users; sidebar locks future steps but stepper allows them.

### Pitfall 4: CurrencyInput replacement breaking non-Controller call sites
**What goes wrong:** 5 of 7 CurrencyInput call sites use it with local `useState` (not React Hook Form Controller). The `NumericCurrencyInput` wrapper has `onValueChange` instead of `onChange`. Replacing the existing component path directly breaks these 5 sites.
**How to avoid:** Keep `CurrencyInput` at its path but rewrite its internals to use `NumericFormat`. The external props `value: number`, `onChange: (value: number) => void`, `onBlur`, `onKeyDown` match the existing interface — just replace the implementation. The 2 Controller sites need their `onChange` → `onValueChange` prop renamed.
**Warning signs:** TypeScript errors on prop name mismatch after replacement.

### Pitfall 5: value=0 showing "$0.00" instead of blank
**What goes wrong:** The CONTEXT says empty field should be blank. If you pass `value={0}` to NumericFormat with `fixedDecimalScale`, it shows `$0.00`. The user expects an empty field when no value has been entered.
**How to avoid:** Pass `value={value === 0 ? "" : value}` — NumericFormat treats empty string as blank display.

---

## Code Examples

### NumericFormat basic usage (verified from official docs)
```typescript
// Source: https://s-yadav.github.io/react-number-format/docs/numeric_format
import { NumericFormat } from "react-number-format";

<NumericFormat
  value={1234.56}
  prefix="$"
  thousandSeparator
  decimalScale={2}
  fixedDecimalScale
  onValueChange={(values) => {
    // values.floatValue: 1234.56 (number)
    // values.value: "1234.56" (string, no formatting)
    // values.formattedValue: "$1,234.56" (string)
    console.log(values.floatValue);
  }}
/>
```

### Controller + NumericFormat (verified from RHF discussions #2200)
```typescript
// Source: https://github.com/react-hook-form/react-hook-form/discussions/2200
<Controller
  name="price"
  control={control}
  render={({ field: { onChange, value, onBlur } }) => (
    <NumericFormat
      value={value}
      onValueChange={(values) => onChange(values.floatValue ?? 0)}
      onBlur={onBlur}
      prefix="$"
      thousandSeparator
      decimalScale={2}
      fixedDecimalScale
      customInput={Input}  // wraps shadcn Input
    />
  )}
/>
```

### Brand teal color token
```
/* From globals.css */
--primary: 188 80% 45%;  /* brand teal */
/* Used as: bg-primary, border-primary, text-primary-foreground */
```

---

## Current State Audit

### Estimate Wizard Files

| File | Path | Role |
|------|------|------|
| Workflow page | `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/workflow/page.tsx` | Layout: sidebar + step container |
| Zustand store | `apps/web/components/estimates/workflow/useWorkflowState.ts` | Step state — needs `goToStep` fix |
| Sidebar nav | `apps/web/components/estimates/workflow/WorkflowSidebar.tsx` | Current navigation — may be removed |
| Step container | `apps/web/components/estimates/workflow/WorkflowStepContainer.tsx` | switch(currentStep) → renders step |
| Step 1 | `apps/web/components/estimates/workflow/steps/01-BasicInfo.tsx` | RHF + useAutoSave; typed schema |
| Step 2 | `apps/web/components/estimates/workflow/steps/02-TemplateSelection.tsx` | Template cards; no form fields |
| Step 3 | `apps/web/components/estimates/workflow/steps/03-LineItems.tsx` | Delegates to EstimateLineItemsTable |
| Step 4 | `apps/web/components/estimates/workflow/steps/04-LaborRates.tsx` | Template selection; table display |
| Step 5 | `apps/web/components/estimates/workflow/steps/05-MarkupConfig.tsx` | RHF + useAutoSave; typed schema |
| Step 6 | `apps/web/components/estimates/workflow/steps/06-SOVBuilder.tsx` | Delegates to SOVBuilder |

### 6 Step Labels (for stepper)
From `WorkflowSidebar.tsx` and `WorkflowStepContainer.tsx`:
1. Basic Info
2. Template Selection
3. Line Items
4. Labor Rates
5. Markup Config
6. SOV Builder

### Step Form Analysis (for section grouping, FORM-03)

**Step 1 — Basic Info** (`01-BasicInfo.tsx`)
Fields: Estimate Name, Description (Optional), Project Type
Groups: "Estimate Identity" (name + description) and "Project Classification" (project type)
Recommendation: 2 groups warrant dividers. Apply grouping.

**Step 2 — Template Selection** (`02-TemplateSelection.tsx`)
Content: Card grid of Cost Code Templates, Card grid of Labor Rate Templates, Skip button
Groups: "Cost Code Templates" and "Labor Rate Templates" — already has `<h3>` headings
Recommendation: Has 2 distinct content sections. Apply section heading style (upgrade existing h3 to the spec typography). No RHF fields here.

**Step 3 — Line Items** (`03-LineItems.tsx`)
Content: Heading paragraph + `<EstimateLineItemsTable>` + footer summary. Single functional block.
Recommendation: Only 1 logical group. No dividers needed. Leave flat.

**Step 4 — Labor Rates** (`04-LaborRates.tsx`)
Content: Template selection cards + "Current Labor Line Items" table + Skip button
Groups: "Template Selection" and "Current Labor Line Items"
Recommendation: 2 groups warrant dividers. Apply grouping.

**Step 5 — Markup Config** (`05-MarkupConfig.tsx`)
Content: Overhead Card (overheadType + overheadValue) + Markup Base Card + Markup by Cost Type Card + Margin Summary Card
Groups: "Overhead", "Markup Base", "Markup by Cost Type", "Summary"
Recommendation: 3 distinct configuration groups + 1 read-only summary. Already separated by Cards. Cards are sufficient — adding more dividers would over-fragment. Leave Card structure; upgrade Card titles if needed. No additional dividers.

**Step 6 — SOV Builder** (`06-SOVBuilder.tsx`)
Content: Heading paragraph + `<SOVBuilder>` component. Single functional block.
Recommendation: Only 1 logical group. No dividers needed. Leave flat.

### CurrencyInput Call Site Audit

| File | Call Sites | Context | In RHF Controller? |
|------|-----------|---------|-------------------|
| `components/ui/currency-input.tsx` | — | Source component | N/A |
| `components/change-order/change-order-form.tsx` | 1 (line ~445) | `lineItems[index].amountChange` | YES — `<Controller>` |
| `components/budget/commitment-form.tsx` | 1 (line ~292) | `lineItems[index].amount` | YES — `<Controller>` |
| `components/budget/budget-line-item-table.tsx` | 2 (draft row + edit dialog) | Local state | No |
| `components/payment-app/sov-editor.tsx` | 2 (draft row + edit dialog) | Local state | No |
| `components/estimates/line-items/EstimateLineItemsTable.tsx` | 1 (inline EditableCell) | Local state | No |
| `components/estimates/sov/SOVLineItemCard.tsx` | 1 (inline amount edit) | Local state | No |

**Total: 7 CurrencyInput call sites across 6 files**

**Additional currency field found (not using CurrencyInput):**
- `components/bidding/bid-comparison-table.tsx` — `adjustmentAmount` state variable used in "Add Leveling Note" dialog; uses `<Input type="number">` or similar. Check this file for exact pattern and migrate to NumericCurrencyInput.

### Recommended Migration Strategy

Since 5 of 7 call sites use local state (not Controller) and the props are `value: number` + `onChange: (n: number) => void`, the lowest-risk approach is:

**Option A (Recommended): Rewrite CurrencyInput internals using NumericFormat**
- Keep `apps/web/components/ui/currency-input.tsx` at its path
- Change `CurrencyInput` props to remain `value: number`, `onChange: (value: number) => void`
- Replace the internal implementation with `NumericFormat + customInput={Input}`
- The 5 non-Controller call sites require no changes
- The 2 Controller call sites need no changes (they pass `onChange` which maps to `onValueChange` internally)

This avoids touching 5 files and requires only 1 file change for the migration itself. The 2 Controller usages already work correctly because they pass `onChange={(n) => field.onChange(n)}`.

**What changes inside `currency-input.tsx`:** Remove `useState displayValue`, `isFocusedRef`, `handleFocus`, `handleChange`, `handleBlur`. Replace with `NumericFormat customInput={Input}` with `onValueChange={(values) => onChange(values.floatValue ?? 0)}`.

**The `onKeyDown` prop challenge:** NumericFormat does not have an `onKeyDown` prop on its public interface — it passes through to the underlying input via `customInput`. Since `customInput={Input}` spreads props, `onKeyDown` should pass through. Verify this works in the draft row use cases (budget-line-item-table, sov-editor).

### Controller Risk Assessment (change-order-form)

`change-order-form.tsx` line 63: `useForm<any>` cast — existing warning sign.
Line 441: `<Controller name="lineItems.${index}.amountChange" ...>` — this Controller IS inside `{step === 3 && <Card>...</Card>}` on line 336. This means the Controller is unmounted/remounted when navigating between steps.

**This is the exact CSS visibility anti-pattern.** However, fixing it is out of scope for Phase 45 (change-order-form is explicitly excluded from FORM-03 section grouping). The CurrencyInput migration in change-order-form is still in scope (FORM-02 says "all currency input fields across the application").

The migration itself does NOT fix the Controller mount issue — it only replaces the currency input implementation. The existing RHF behavior (Controller being conditionally mounted) is pre-existing and unchanged.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Format-on-blur only (current CurrencyInput) | Live masking while typing (NumericFormat) | Better UX — user sees $ and commas immediately |
| Vertical sidebar for wizard nav | Horizontal stepper bar | Standard wizard UX pattern; at-a-glance progress |
| Manual `parseCurrencyInput` on blur | NumericFormat `floatValue` from `onValueChange` | No manual parsing; always a valid float |

**Deprecated approach:**
- The `parseCurrencyInput` in `lib/utils/format.ts` becomes unused after migration (keep file, keep other functions, just `parseCurrencyInput` will have no callers)

---

## Open Questions

1. **Should WorkflowSidebar be removed?**
   - What we know: The sidebar currently provides navigation. The stepper replaces it.
   - What's unclear: The CONTEXT says "horizontal progress stepper" but doesn't explicitly say "remove sidebar."
   - Recommendation: Remove the sidebar from the workflow page layout. The stepper is the navigation. The `w-64 border-r` sidebar takes significant horizontal space that step content needs. Removing it also eliminates the conflicting navigation UX (two navs with different lock behavior). The `WorkflowSidebar.tsx` file can remain for potential reuse elsewhere.

2. **Step 6 as "review/summary" or existing SOVBuilder?**
   - What we know: CONTEXT says "Final step is a read-only review/summary; Submit fires from there."
   - What we know about Step 6 currently: It renders `SOVBuilder` which is NOT a read-only summary — it is a full interactive SOV builder.
   - What's unclear: Does the CONTEXT intend Step 6 to be redesigned as a review step, or was the "review/summary" description approximate?
   - Recommendation: Keep Step 6 as `SOVBuilder` — it is the final configuration step. The "Submit" button that "fires from the review step" likely means adding a Submit/Finalize button to Step 6's bottom. This is consistent with the existing design where Step 6 has finalization context text. Do NOT redesign Step 6 as a pure read-only summary — that would be a major scope change.

3. **bid-comparison-table leveling amount input**
   - What we know: It uses `<Input>` (not `CurrencyInput`) for `adjustmentAmount` in a dialog, with local state.
   - What's unclear: The exact line and whether it's `type="number"` or `type="text"`.
   - Recommendation: During FORM-02 implementation, grep for `adjustmentAmount` in bid-comparison-table.tsx and migrate that input to `NumericCurrencyInput` directly.

---

## Sources

### Primary (HIGH confidence)
- Codebase file read — `apps/web/components/estimates/workflow/` all 6 step files + useWorkflowState + WorkflowSidebar + WorkflowStepContainer
- Codebase file read — `apps/web/components/ui/currency-input.tsx`
- Codebase file read — `apps/web/lib/utils/format.ts`
- Codebase file read — `apps/web/app/(dashboard)/projects/[projectSlug]/estimates/[estimateSlug]/workflow/page.tsx`
- Codebase file read — All 6 CurrencyInput consumer files
- Codebase file read — `apps/web/app/globals.css` (brand teal: `--primary: 188 80% 45%`)
- `apps/web/package.json` — react-number-format: "^5.4.4" confirmed

### Secondary (MEDIUM confidence)
- [react-hook-form discussions #2200](https://github.com/react-hook-form/react-hook-form/discussions/2200) — Controller + NumericFormat pattern; `onValueChange((values) => onChange(values.floatValue))` confirmed
- [react-number-format official props docs](https://s-yadav.github.io/react-number-format/docs/props/) — `onValueChange` values object: `{ formattedValue, value, floatValue }` confirmed
- [shadcn-ui discussions #6219](https://github.com/shadcn-ui/ui/discussions/6219) — No built-in stepper in shadcn/ui React; confirmed custom implementation needed

### Tertiary (LOW confidence)
- None — all critical findings have HIGH or MEDIUM source backing

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed installed, versions from package.json
- Architecture: HIGH — all wizard files read directly from codebase
- CurrencyInput call sites: HIGH — grepped and read all 7 call sites
- NumericFormat Controller pattern: MEDIUM — confirmed from official RHF discussions, cross-referenced with official docs
- Stepper: HIGH — no library needed; pure Tailwind + Lucide; brand color token confirmed
- Pitfalls: HIGH — derived directly from code reading (goToStep guard, floatValue undefined, conditional Controller mount)

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable libraries; internal codebase changes more frequently)
