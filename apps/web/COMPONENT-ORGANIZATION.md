# Component Organization

This document defines component extraction and organization conventions for the Next.js web app.

## Directory Structure

```
components/
├── ui/                    # Base design system (shadcn/ui)
│   ├── button.tsx
│   ├── form.tsx
│   └── ...
├── shared/                # Extracted domain-agnostic (3+ uses)
│   ├── status-badge.tsx
│   ├── currency-display.tsx
│   └── ...
├── [domain]/              # Domain-specific components
│   ├── project/
│   ├── budget/
│   ├── estimates/
│   └── ...
└── layout/                # App-wide layout
    ├── sidebar.tsx
    ├── topbar.tsx
    └── ...
```

## Extraction Threshold: 3+ Uses

Components should be extracted to `shared/` only when:
1. Used in 3+ locations across different domains
2. Unlikely to diverge per use case
3. Complex enough to warrant extraction

### Decision Tree

1. **Is it used 3+ times?**
   - No → Keep in domain folder
   - Yes → Continue to #2

2. **Is it domain-specific?**
   - Yes → Keep in `components/[domain]/`
   - No → Continue to #3

3. **Will it diverge per use?**
   - Yes → Don't extract (accept duplication)
   - No → Continue to #4

4. **Is it complex enough to warrant extraction?**
   - No → Keep inline
   - Yes → Extract to `shared/`

### Examples

**Extract to shared/:**
- StatusBadge (used across RFQs, estimates, integrations - 6+ uses)
- CurrencyDisplay (used across budgets, estimates, projects - 14+ uses)
- DataTable (if used for projects, bids, estimates - 3+ uses)

**Keep in domain:**
- EstimateLineItemsTable (only used in estimates workflow)
- BudgetVarianceChart (only used in budget views)
- RFQForm (only used in bidding)

**Don't extract (accept duplication):**
- Form layouts that will diverge per feature
- One-off page components
- Components with high coupling to specific domain logic

## Naming Conventions

- **File names:** kebab-case (e.g., `status-badge.tsx`)
- **Component exports:** PascalCase (e.g., `StatusBadge`)
- **Utility exports:** camelCase (e.g., `formatCurrency`)

## CVA Variants

Use class-variance-authority for component variants:

```typescript
const componentVariants = cva(
  "base-classes",
  {
    variants: {
      variant: { ... },
      size: { ... },
    },
    defaultVariants: { ... },
  }
);
```

**Limits:**
- 3-5 variant dimensions per component
- Prioritize design system consistency over flexibility
- Don't encode business logic in variants

## Import Patterns

**DO:**
```typescript
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
```

**DON'T:**
```typescript
import { StatusBadge } from "@/components/shared"; // Barrel export
```

Barrel exports break tree-shaking and inflate bundles.

## Component APIs

- Keep props focused (3-5 props ideal)
- Use composition over configuration
- Prefer controlled components for shared UI
- Document non-obvious props with JSDoc

## Real-World Examples from Phase 19

### StatusBadge (Extracted - 6+ uses)

**Before:** 10+ components with inline badge styling using ad-hoc Tailwind classes:
```tsx
// RFQ status (apps/web/components/bidding/rfq-status-badge.tsx)
<span className="bg-blue-100 text-blue-800 px-2 py-1">Issued</span>

// Estimate status (apps/web/components/estimates/lifecycle/StatusBadge.tsx)
<span className="bg-green-100 text-green-800 px-2 py-1">Accepted</span>

// Integration status (apps/web/components/integrations/qbo-sync-status.tsx)
<span className="bg-gray-100 text-gray-800 px-2 py-1">Synced</span>
```

**After:** Centralized StatusBadge with 9 CVA variants:
```tsx
// apps/web/components/shared/status-badge.tsx
export const StatusBadge = ({ variant, children }: StatusBadgeProps) => {
  return <span className={statusBadgeVariants({ variant })}>{children}</span>;
};

// Usage across domains
<StatusBadge variant="pending">Issued</StatusBadge>
<StatusBadge variant="approved">Accepted</StatusBadge>
<StatusBadge variant="active">Synced</StatusBadge>
```

**Impact:** Consistent color semantics, design system enforcement, 60+ lines of duplication eliminated.

### CurrencyDisplay (Extracted - 14+ uses)

**Before:** 32+ files with inline Intl.NumberFormat:
```tsx
// Budget summary (apps/web/components/budget/budget-summary-cards.tsx)
{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(remaining)}

// Project header (apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx)
{project.budget?.toFixed(2)}

// Margin calculator (apps/web/components/estimates/line-items/MarginCalculator.tsx)
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value);
};
```

**After:** Centralized utility + component:
```tsx
// apps/web/lib/utils/format.ts
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// apps/web/components/shared/currency-display.tsx
export const CurrencyDisplay = ({ amount, colorize, showSign }: Props) => {
  const formatted = formatCurrency(Math.abs(amount));
  const display = showSign ? `${amount >= 0 ? '+' : '-'}${formatted}` : formatted;

  const colorClass = colorize
    ? amount >= 0 ? 'text-green-600' : 'text-red-600'
    : '';

  return <span className={cn('tabular-nums', colorClass)}>{display}</span>;
};

// Usage
<CurrencyDisplay amount={remaining} colorize /> // Green if positive, red if negative
```

**Impact:** Single source of truth for currency formatting, semantic colorization, proper numeric alignment.

### EstimateLineItemsTable (NOT Extracted - Domain-Specific)

**Analysis:** Used in 5+ locations within estimates domain, but:
- Tightly coupled to estimate line item data model
- Inline editing behavior specific to estimate workflow
- Column definitions diverge per use case (basic info vs. full editing)
- High domain coupling makes extraction risky

**Decision:** Keep in `components/estimates/` despite 5+ uses. The 3+ threshold is necessary but not sufficient - domain coupling matters.

## References

- Research: `.planning/phases/19-component-library-architecture/19-RESEARCH.md`
- Context: `.planning/phases/19-component-library-architecture/19-CONTEXT.md`
- Phase 19 Plan 01 Summary: `.planning/phases/19-component-library-architecture/19-01-SUMMARY.md`
- Phase 19 Plan 02 Summary: `.planning/phases/19-component-library-architecture/19-02-SUMMARY.md`
