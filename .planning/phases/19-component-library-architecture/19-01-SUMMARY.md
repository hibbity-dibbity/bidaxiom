---
phase: 19-component-library-architecture
plan: 01
subsystem: design-system
tags: [component-library, cva, design-system, formatting-utilities, code-consolidation]

dependency-graph:
  requires: []
  provides:
    - shared/status-badge (CVA variants for status display)
    - shared/currency-display (consistent currency formatting)
    - utils/format (centralized formatting utilities)
  affects:
    - All components using status badges (future migration)
    - All components formatting currency (future migration)
    - All components formatting dates/percentages (future migration)

tech-stack:
  added:
    - class-variance-authority (CVA) for type-safe variants
  patterns:
    - Controlled CVA variants for design system consistency
    - Direct imports only (no barrel exports)
    - kebab-case files, PascalCase exports (Next.js conventions)
    - 3+ use threshold for component extraction

key-files:
  created:
    - apps/web/components/shared/status-badge.tsx
    - apps/web/components/shared/currency-display.tsx
    - apps/web/lib/utils/format.ts
    - .planning/phases/19-component-library-architecture/19-01-component-audit.md
  modified: []

decisions:
  - title: "3+ use threshold for extraction"
    rationale: "Components used fewer than 3 times are not worth extracting; duplication acceptable below threshold"
    alternatives: ["Extract everything", "5+ use threshold"]

  - title: "CVA for controlled variants over ad-hoc classNames"
    rationale: "Type-safe variants enforce design system consistency; prevents color/style drift across components"
    alternatives: ["Plain className props", "Tailwind variants plugin"]

  - title: "No barrel exports (index.ts files)"
    rationale: "Barrel exports cause bundle bloat by preventing tree-shaking; direct imports required"
    alternatives: ["Create index.ts for convenience"]

  - title: "Keep tables domain-specific"
    rationale: "Tables are highly coupled to domain models; 21+ uses but all divergent implementations"
    alternatives: ["Extract EditableTableCell pattern"]

metrics:
  duration: 2.7 min
  tasks: 2
  files: 4
  commits: 2
  completed: 2026-02-16
---

# Phase 19 Plan 01: Component Extraction Foundation Summary

**One-liner:** Extracted 5 proven patterns (StatusBadge with CVA, CurrencyDisplay, formatCurrency/Percentage/Date) from 32+ duplicated implementations to establish design system foundation.

## Objective

Extract proven component patterns (3+ uses) into shared locations with CVA variants for design system consistency. Eliminate duplication in status badges, currency formatting, and date/percentage formatting by consolidating existing implementations into reusable shared components.

## What Was Built

### 1. Component Duplication Audit
- Analyzed 32 files using Badge component
- Identified 32+ files with inline currency formatting
- Found 21 table implementations (decided NOT to extract due to domain coupling)
- Documented extraction decisions for 6 component patterns
- Applied 3+ use threshold per CONTEXT.md guidance

### 2. Shared Components Created

**StatusBadge (apps/web/components/shared/status-badge.tsx):**
- CVA-based variant system with 9 semantic options
- Variants: draft, pending, active, approved, completed, rejected, cancelled, warning, error
- Light/dark mode support built-in
- Type-safe props via VariantProps
- 68 lines including comprehensive JSDoc documentation

**CurrencyDisplay (apps/web/components/shared/currency-display.tsx):**
- Wraps formatCurrency utility for consistent USD formatting
- Optional semantic colorization (green positive, red negative)
- Optional sign display for variance/delta views
- tabular-nums class for proper numeric alignment
- 74 lines with usage examples

**Format Utilities (apps/web/lib/utils/format.ts):**
- formatCurrency: Intl.NumberFormat with 2 decimal precision
- formatPercentage: Configurable decimal places (default 1)
- formatDate: Short (MM/DD/YYYY) and long (Month DD, YYYY) formats
- 79 lines with JSDoc examples for all functions
- Pure functions for easy testing

### 3. Design System Patterns Established

**Naming Convention:**
- kebab-case filenames: status-badge.tsx, currency-display.tsx
- PascalCase exports: StatusBadge, CurrencyDisplay
- Follows Next.js App Router + shadcn/ui conventions

**Import Strategy:**
- No barrel exports (index.ts files)
- Direct imports only: `import { StatusBadge } from "@/components/shared/status-badge"`
- Prevents bundle bloat via proper tree-shaking

**Extraction Threshold:**
- 3+ uses = extract to shared/
- <3 uses = keep local/domain-specific
- High coupling = don't extract even if 3+ uses (e.g., tables)

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions

### 1. 3+ Use Threshold for Extraction
**Context:** Needed objective criteria for when to extract components vs. keep local

**Decision:** Components must be used 3+ times to justify extraction to shared/

**Rationale:**
- Below 3 uses, duplication is acceptable and often preferable
- Premature abstraction creates coupling without clear benefit
- 3+ uses indicates proven pattern worth standardizing

**Alternatives Considered:**
- Extract everything: Creates premature abstractions, maintenance burden
- 5+ threshold: Too high, misses obvious consolidation opportunities

**Impact:** Clear decision framework for future component extraction decisions

### 2. CVA for Controlled Variants
**Context:** Status badges had inconsistent color mappings across 10+ files

**Decision:** Use class-variance-authority (CVA) for type-safe, controlled variants

**Rationale:**
- TypeScript autocomplete guides developers to valid variants
- Prevents color drift and ad-hoc style overrides
- Centralized variant definitions enable design system evolution
- Single source of truth for semantic color mappings

**Alternatives Considered:**
- Plain className prop: No type safety, allows style drift
- Tailwind variants plugin: Less flexible, build-time only

**Impact:** Design system consistency enforced at compile time

### 3. No Barrel Exports
**Context:** Team requested convenience of `import { StatusBadge } from "@/components/shared"`

**Decision:** Require direct imports; no index.ts barrel files

**Rationale:**
- Barrel exports prevent tree-shaking in many bundlers
- Even unused components get included in final bundle
- RESEARCH.md identifies barrel exports as anti-pattern
- Direct imports are explicit and traceable

**Alternatives Considered:**
- Create index.ts for convenience: Increases bundle size
- TypeScript path aliases: Doesn't solve tree-shaking issue

**Impact:** Optimal bundle size; explicit import dependencies

### 4. Tables NOT Extracted
**Context:** 21 files use Table component; seems like extraction candidate

**Decision:** Keep tables domain-specific; do NOT extract shared table component

**Rationale:**
- Each table tightly coupled to its data model
- Column definitions, editing behavior, mutations all divergent
- EstimateLineItemsTable, BudgetLineItemTable, BidComparisonTable have minimal overlap
- High coupling + low reuse potential = poor extraction candidate

**Alternatives Considered:**
- Extract EditableTableCell pattern: Possible future work if 3+ identical implementations emerge

**Impact:** Avoids premature abstraction; keeps domain logic colocated with data models

## Testing Notes

### Manual Verification Performed
1. ✅ Verified shared/ directory created
2. ✅ Verified all files created with correct naming (kebab-case)
3. ✅ Verified exports are PascalCase (StatusBadge, CurrencyDisplay)
4. ✅ Verified CVA variants in status-badge.tsx
5. ✅ Verified formatCurrency exists in format.ts
6. ✅ Verified minimum line counts exceeded (68, 74, 79 vs. 40, 20, 30)

### Component API Examples

**StatusBadge:**
```tsx
<StatusBadge variant="approved">Approved</StatusBadge>
<StatusBadge variant="warning">Pending Review</StatusBadge>
<StatusBadge variant="error">Rejected</StatusBadge>
```

**CurrencyDisplay:**
```tsx
<CurrencyDisplay amount={1234.56} />
// Output: $1,234.56

<CurrencyDisplay amount={-500} colorize />
// Output: $-500.00 (in red)

<CurrencyDisplay amount={250.75} showSign colorize />
// Output: +$250.75 (in green)
```

**Format Utilities:**
```tsx
formatCurrency(1234.56) // "$1,234.56"
formatPercentage(15.5) // "15.5%"
formatDate(new Date("2026-02-16")) // "02/16/2026"
formatDate("2026-02-16", "long") // "February 16, 2026"
```

## Migration Path (Future Work)

**Phase 19 Plan 01 Scope:**
- ✅ Create shared components
- ✅ Establish extraction patterns
- ✅ Document component APIs

**Future Plans (19-02+):**
- Migrate existing status badge implementations to use StatusBadge
- Replace inline Intl.NumberFormat instances with formatCurrency
- Update percentage displays to use formatPercentage
- Consolidate date formatting to formatDate utility
- Measure bundle size impact of consolidation

**Success Metrics After Migration:**
- Zero inline Intl.NumberFormat for currency formatting
- All status badges use StatusBadge component
- Consistent color semantics across application
- Reduced bundle size from eliminated duplication

## Files Changed

### Created (4 files)
- `.planning/phases/19-component-library-architecture/19-01-component-audit.md` - Duplication analysis and extraction decisions
- `apps/web/components/shared/status-badge.tsx` - CVA-based status indicator
- `apps/web/components/shared/currency-display.tsx` - Consistent currency formatting
- `apps/web/lib/utils/format.ts` - Centralized formatting utilities

### Modified (0 files)
None - this plan creates foundation; migration happens in future plans

## Commits

1. **ebb05e9** - `docs(19-01): audit component duplication patterns`
   - Analyzed 32 Badge uses, 32 currency formatting instances, 21 table uses
   - Identified 5 patterns meeting 3+ use threshold
   - Documented extraction decisions and CVA variant strategy

2. **76f4e66** - `feat(19-01): create shared components with CVA variants`
   - StatusBadge with 9 CVA variants
   - CurrencyDisplay with colorization and sign display
   - Format utilities (formatCurrency, formatPercentage, formatDate)
   - Follow Next.js conventions, no barrel exports

## Self-Check: PASSED

**Created Files Verification:**
```bash
✅ apps/web/components/shared/status-badge.tsx exists (68 lines)
✅ apps/web/components/shared/currency-display.tsx exists (74 lines)
✅ apps/web/lib/utils/format.ts exists (79 lines)
✅ .planning/phases/19-component-library-architecture/19-01-component-audit.md exists (176 lines)
```

**Commits Verification:**
```bash
✅ ebb05e9 exists in git log
✅ 76f4e66 exists in git log
```

**Exports Verification:**
```bash
✅ statusBadgeVariants exported from status-badge.tsx
✅ StatusBadge function exported from status-badge.tsx
✅ CurrencyDisplay exported from currency-display.tsx
✅ formatCurrency exported from format.ts
✅ formatPercentage exported from format.ts
✅ formatDate exported from format.ts
```

All claims verified successfully.
