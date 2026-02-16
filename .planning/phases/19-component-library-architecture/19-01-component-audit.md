# Component Duplication Audit - Phase 19 Plan 01

**Date:** 2026-02-16
**Purpose:** Identify component patterns used 3+ times for extraction to shared/ directory

## Audit Methodology

1. Searched for status badge implementations across components/
2. Searched for currency formatting usage patterns
3. Searched for table component implementations
4. Applied extraction threshold: **3+ uses = extract to shared/**

## Findings

### 1. Status Badge Pattern

**Pattern:** Variant-based status display with color coding using Badge component

**Locations Found (32 files use Badge):**
- `components/bidding/rfq-status-badge.tsx` - RFQ statuses (draft, issued, closed, awarded, cancelled)
- `components/estimates/lifecycle/StatusBadge.tsx` - Estimate statuses (draft, submitted, accepted, under_contract)
- `components/payment-app/payment-app-list.tsx` - Payment app statuses (draft, submitted, under_review, approved, rejected, paid)
- `components/change-order/change-order-list.tsx` - Change order statuses (draft, pco_submitted, pending_approval, approved, rejected, void)
- Additional files use Badge for various status displays (workflow, integration sync, etc.)

**Pattern Analysis:**
- **Color mapping:** Each implementation maintains its own `statusColors` Record mapping status to Tailwind classes
- **Inconsistent approach:**
  - Some use `bg-{color}-500/10 text-{color}-700 border-{color}-200` pattern (RFQ, payment apps)
  - Others use `bg-{color}-500` solid backgrounds (change orders)
  - Some use Badge variant prop, others use className override
- **Duplication:** 10+ status color mappings exist across codebase

**Extraction Decision:** ✅ **EXTRACT**
- **Threshold:** 10+ uses across domains
- **Reasoning:** Status badges are pervasive UI pattern; consolidation enables design system consistency
- **Target:** `components/shared/status-badge.tsx` with CVA variants

### 2. Currency Formatting Pattern

**Pattern:** USD formatting with 2 decimals, comma separators

**Locations Found (32 files use currency formatting):**
- `components/estimates/line-items/MarginCalculator.tsx` - Has `formatCurrency` utility
- `components/payment-app/payment-app-list.tsx` - Creates own `currencyFormatter` with Intl.NumberFormat
- `components/change-order/change-order-list.tsx` - Creates own `currencyFormatter` with `minimumFractionDigits: 0`
- `components/bidding/bid-comparison-table.tsx` - Likely has own formatter
- `components/budget/budget-line-item-table.tsx` - Likely has own formatter
- 27+ other files use inline formatting

**Pattern Analysis:**
- **Inconsistent precision:** Some use 0 decimals, some use 2, some don't specify
- **Duplication:** Multiple files create their own `Intl.NumberFormat` instances
- **Existing utility:** `MarginCalculator.tsx` already has `formatCurrency` but isolated to estimates module
- **Usage count:** 32+ files format currency

**Extraction Decision:** ✅ **EXTRACT**
- **Threshold:** 32+ uses across entire application
- **Reasoning:** Financial data is core domain; consistent formatting critical for user trust
- **Target:** `lib/utils/format.ts` for centralized formatting utilities

### 3. Percentage Formatting Pattern

**Pattern:** Fixed decimal formatting with % symbol

**Locations Found:**
- `components/estimates/line-items/MarginCalculator.tsx` - Has `formatPercent` utility
- Used for margin percentages across estimate components
- ~8+ uses identified

**Extraction Decision:** ✅ **EXTRACT**
- **Threshold:** 8+ uses
- **Reasoning:** Margin calculations are critical financial metrics; consistent formatting needed
- **Target:** `lib/utils/format.ts` alongside `formatCurrency`

### 4. Date Formatting Pattern

**Pattern:** Locale-based date display

**Locations Found:**
- ~10+ files use `.toLocaleString()` or `new Date()` display
- Inconsistent formatting approaches

**Extraction Decision:** ✅ **EXTRACT**
- **Threshold:** 10+ uses
- **Reasoning:** Consistent date formatting improves UX; centralization enables future locale support
- **Target:** `lib/utils/format.ts` with `formatDate` utility

### 5. Table Components

**Pattern:** TanStack Table with inline editing

**Locations Found (21 files use Table):**
- `components/estimates/line-items/EstimateLineItemsTable.tsx` - Full TanStack Table with editable cells
- `components/budget/budget-line-item-table.tsx` - Budget line items
- `components/bidding/bid-comparison-table.tsx` - Bid comparison
- `components/payment-app/aging-report-table.tsx` - Aging report
- Others use basic Table UI component for read-only display

**Pattern Analysis:**
- **Divergent complexity:** Editable tables (TanStack) vs. simple display tables (UI component)
- **Domain-specific logic:** Each table has unique column definitions, editing behavior, mutations
- **Limited reuse potential:** Tables are tightly coupled to their data models

**Extraction Decision:** ❌ **DO NOT EXTRACT**
- **Threshold:** While 21+ files use tables, implementations are domain-specific
- **Reasoning:** High coupling to domain models; low divergence likelihood for shared patterns
- **Alternative:** Keep using `components/ui/table.tsx` for basic structure; domain tables stay local
- **Future consideration:** If 3+ tables share identical editing patterns, extract EditableTableCell

### 6. Currency Display Component

**Pattern:** Formatted currency with optional colorization (positive/negative)

**Locations Identified:**
- Multiple components show currency with color coding for variance
- Budget variance displays (green positive, red negative)
- Financial summary cards
- ~12+ locations with color-coded currency

**Extraction Decision:** ✅ **EXTRACT**
- **Threshold:** 12+ uses with consistent color pattern
- **Reasoning:** Combines currency formatting with consistent visual semantics (red = loss, green = gain)
- **Target:** `components/shared/currency-display.tsx` wrapping `formatCurrency` utility

## Extraction Priority

### High Priority (Plan 01)
1. **StatusBadge** - 10+ uses, design system foundation
2. **formatCurrency** - 32+ uses, critical for financial accuracy
3. **CurrencyDisplay** - 12+ uses, combines formatting + visual semantics
4. **formatPercentage** - 8+ uses, margin calculations
5. **formatDate** - 10+ uses, consistent temporal display

### Not Extracted (Below Threshold or Too Coupled)
- **Table components** - Domain-specific, high coupling
- **Form components** - Already using shadcn/ui + react-hook-form pattern
- **Navigation components** - 1-2 uses each (TopBar, Sidebar are singletons)

## Extraction Pattern

### File Naming Convention
- ✅ kebab-case files: `status-badge.tsx`, `currency-display.tsx`
- ✅ PascalCase exports: `StatusBadge`, `CurrencyDisplay`
- ✅ Follows Next.js App Router + shadcn/ui conventions

### Import Strategy
- ❌ **No barrel exports** (`index.ts` files cause bundle bloat)
- ✅ **Direct imports only:** `import { StatusBadge } from "@/components/shared/status-badge"`
- ✅ **Named exports preferred** over default exports for tree-shaking

### CVA Variant Strategy
- **Controlled variants:** Limit to 3-5 variant dimensions per RESEARCH.md guidance
- **StatusBadge variants:** Single `variant` dimension with 9 options (draft, pending, active, approved, completed, rejected, cancelled, warning, error)
- **Design system priority:** Controlled variants ensure consistency over maximum flexibility

## Success Metrics

After extraction:
- [ ] Zero instances of inline `Intl.NumberFormat` for currency formatting
- [ ] All status badges use `StatusBadge` component from shared/
- [ ] All currency displays use either `formatCurrency` or `CurrencyDisplay`
- [ ] All percentage displays use `formatPercentage` utility
- [ ] Date formatting consolidated to `formatDate` utility

## Migration Notes

**Phase 19 Plan 01 Scope:**
- Create shared components (do NOT migrate existing usage yet)
- Establish extraction pattern for future plans
- Document component APIs for team reference

**Future Plans:**
- Plan 02+: Migrate existing usage to shared components
- Measure bundle size impact of consolidation
- Add Storybook documentation for shared components
