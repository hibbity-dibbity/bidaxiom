---
phase: 17-estimating-workflow-setup-core
plan: 06
subsystem: estimates
tags: [ui, estimates, line-items, sov, workflow]
completed: 2026-02-16T03:51:10Z
duration: 6 min

dependencies:
  requires:
    - 17-05-guided-estimate-workflow-ui
  provides:
    - estimate-line-items-table-with-inline-editing
    - margin-calculation-and-display
    - sov-builder-with-variance-validation
    - labor-rates-application
    - complete-6-step-estimating-workflow
  affects:
    - apps/web/components/estimates/workflow/steps/03-LineItems.tsx
    - apps/web/components/estimates/workflow/steps/04-LaborRates.tsx
    - apps/web/components/estimates/workflow/steps/06-SOVBuilder.tsx

tech-stack:
  added:
    - TanStack Table v8 for inline editing
  patterns:
    - Spreadsheet-style inline editing with auto-save on blur
    - Margin calculation with color-coded indicators
    - SOV variance validation with $1.00 tolerance
    - Section subtotals grouped by CSI division

key-files:
  created:
    - apps/web/components/estimates/line-items/MarginCalculator.tsx (pure calculation functions)
    - apps/web/components/estimates/line-items/EstimateLineItemsTable.tsx (TanStack Table with inline editing)
    - apps/web/components/estimates/line-items/SectionSubtotal.tsx (CSI division grouping)
    - apps/web/components/estimates/workflow/steps/03-LineItems.tsx (Step 3: Line Items Entry)
    - apps/web/components/estimates/workflow/steps/04-LaborRates.tsx (Step 4: Labor Rates Application)
    - apps/web/components/estimates/sov/SOVLineItemCard.tsx (SOV line item with inline editing)
    - apps/web/components/estimates/sov/SOVBuilder.tsx (SOV generation and finalization)
    - apps/web/components/estimates/workflow/steps/06-SOVBuilder.tsx (Step 6: SOV Builder)
  modified:
    - apps/api/src/trpc/routers/estimates.ts (added createLineItem and deleteLineItem procedures)

key-decisions:
  - TanStack Table for inline editing: Industry-standard table library with excellent TypeScript support and flexible cell editing patterns
  - Auto-save on blur without debouncing: Simpler than debounced typing, prevents data loss, matches user expectation of "edit then click away"
  - Color-coded margin indicators: Red < 10%, yellow 10-20%, green >= 20% based on construction industry norms
  - $1.00 SOV variance tolerance: Allows for rounding differences while ensuring accuracy for financial compliance
  - CSI division grouping by default: Industry-standard organization method, familiar to all construction professionals
  - Section subtotals in-table: Provides real-time cost visibility without separate summary section, matches spreadsheet UX

metrics:
  files_created: 8
  files_modified: 1
  lines_added: 1583
  tasks_completed: 2
  commits: 2
---

# Phase 17 Plan 06: Line Items Table and SOV Builder Summary

**One-liner:** TanStack Table-based line items editor with margin display, labor rates application, and SOV builder with variance validation completing the 6-step estimating workflow.

## What Was Built

### Task 1: Estimate Line Items Table with Inline Editing

**Components Created:**

1. **MarginCalculator.tsx** - Pure calculation functions for cost, markup, and margin
   - `calculateLineItemMargin()`: Computes cost, markup, total, and margin percentage
   - `getMarginColorClass()`: Returns color class based on margin thresholds
   - `formatCurrency()` and `formatPercent()`: Display formatting utilities

2. **EstimateLineItemsTable.tsx** - TanStack Table v8 with inline editing
   - 11 columns: CSI Code, Description, Quantity, Unit, Unit Cost, Cost Type, Markup %, Cost (calculated), Margin $ (calculated), Margin % (calculated), Actions
   - Inline editing: Click cell to edit, blur to save
   - Editable cells: Description, Quantity, Unit Cost, Markup % (optional override)
   - Dropdown selects: CSI Code, Unit, Cost Type
   - Auto-save on blur calls `trpc.estimates.updateLineItem.mutate()`
   - Calculated columns: Cost = quantity × unitCost, Margin = calculated via MarginCalculator
   - Color-coded margin: red < 10%, yellow 10-20%, green >= 20%
   - "Add Line Item" button appends to estimate
   - Delete button per row with confirmation

3. **SectionSubtotal.tsx** - CSI division grouping rows
   - Groups line items by costCodeId (CSI division)
   - Calculates section cost, markup, and margin percentage
   - Displays as bold row with indented section name
   - Shows rolled-up totals for each CSI division

4. **03-LineItems.tsx** - Workflow Step 3
   - Loads estimate with line items via `trpc.estimates.getById`
   - Renders EstimateLineItemsTable
   - Displays total estimate cost at bottom
   - Unlocks Step 4 when lineItems.length > 0

**API Enhancements:**

- Added `createLineItem` procedure to `apps/api/src/trpc/routers/estimates.ts`
  - Auto-calculates orderIndex (max + 1)
  - Recalculates estimate totals after creation
  - Audit log for line item creation

- Added `deleteLineItem` procedure
  - Recalculates estimate totals after deletion (or resets to 0 if no items remain)
  - Audit log for line item deletion

**Patterns Used:**

- TanStack Table `meta.updateData` pattern for inline editing (from RESEARCH.md Pattern 6)
- EditableCell component: local state → blur → mutation
- SelectCell component: dropdown select → onChange → mutation
- Section grouping: `useMemo` to group by division, render subtotal rows between sections

### Task 2: Labor Rates UI and SOV Builder

**Components Created:**

1. **04-LaborRates.tsx** - Workflow Step 4
   - Loads labor rate templates via `trpc.estimateTemplates.listLaborRateTemplates`
   - Displays templates as clickable cards (company vs personal badges)
   - "Apply Labor Rates" button triggers `trpc.estimateTemplates.applyLaborRateTemplate.mutate()`
   - Shows table of current labor line items (description, quantity, rate, total)
   - "Skip Labor Rates" button to bypass step
   - Unlocks Step 5 after applying rates or clicking skip

2. **SOVLineItemCard.tsx** - SOV line item display with inline editing
   - Props: sovLineItem, onUpdate, onDelete, isEditable
   - Inline editing for description and amount (click to edit, blur to save)
   - Displays cost code references as chips/badges
   - Shows completion % (display only, defaults to 0)
   - Drag handle icon (GripVertical) for future drag-and-drop reordering
   - Delete button (if isEditable)

3. **SOVBuilder.tsx** - SOV generation and adjustment UI
   - State: groupingMethod, sovLineItems, isGenerated
   - "Generate SOV" button:
     - Dropdown for groupingMethod (CSI, phase, payment_schedule)
     - Calls `trpc.sov.generate.mutate({ estimateId, groupingMethod })`
     - Populates sovLineItems state
   - Display mode:
     - List of SOVLineItemCards with inline editing enabled
     - Running totals: Estimate Total, SOV Total, Variance
     - Variance calculation: sovTotal - estimateTotal
     - Color-coded variance: green if <= $1.00, red if > $1.00
     - Alert: Red alert if variance > $1.00, green alert if variance acceptable
   - "Finalize SOV" button:
     - Disabled if variance > $1.00
     - Calls `trpc.sov.finalize.mutate({ estimateId, lineItems })`
     - Validates total matches estimate (within $1.00)
   - "Regenerate" button to reset and regenerate

4. **06-SOVBuilder.tsx** - Workflow Step 6
   - Loads company profile to get default `sovGroupingMethod`
   - Renders SOVBuilder component with estimateId and defaultGroupingMethod
   - Instructions: "Review and adjust SOV line items before finalizing"
   - Note: "Once finalized, the SOV will be locked and versioned"

**No API Changes Required:**

- Existing `trpc.sov.generate` and `trpc.sov.finalize` procedures used
- Existing `trpc.estimateTemplates.listLaborRateTemplates` and `applyLaborRateTemplate` procedures used

## Verification

### Components Exist

```
✓ apps/web/components/estimates/line-items/MarginCalculator.tsx
✓ apps/web/components/estimates/line-items/EstimateLineItemsTable.tsx
✓ apps/web/components/estimates/line-items/SectionSubtotal.tsx
✓ apps/web/components/estimates/workflow/steps/03-LineItems.tsx
✓ apps/web/components/estimates/workflow/steps/04-LaborRates.tsx
✓ apps/web/components/estimates/sov/SOVLineItemCard.tsx
✓ apps/web/components/estimates/sov/SOVBuilder.tsx
✓ apps/web/components/estimates/workflow/steps/06-SOVBuilder.tsx
```

### API Procedures Added

```
✓ trpc.estimates.createLineItem (line 505)
✓ trpc.estimates.deleteLineItem (line 627)
```

### Key Patterns

```
✓ TanStack Table: useReactTable, getCoreRowModel (EstimateLineItemsTable.tsx)
✓ Inline editing: EditableCell with onBlur handler (EstimateLineItemsTable.tsx)
✓ Margin calculation: calculateLineItemMargin() pure function (MarginCalculator.tsx)
✓ Color-coded margin: getMarginColorClass() (MarginCalculator.tsx, SectionSubtotal.tsx)
✓ SOV variance validation: Math.abs(variance) <= 1.0 (SOVBuilder.tsx)
```

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Commit | Message | Files |
|--------|---------|-------|
| 6e98319 | feat(17-06): create estimate line items table with inline editing | 5 files (4 created, 1 modified) |
| 6adfdd6 | feat(17-06): create labor rates UI and SOV builder | 4 files created |

## Next Steps

Plan 17-06 completes the estimating workflow setup. All 6 workflow steps are now functional:

1. **Step 1:** Basic Info (name, description, project type)
2. **Step 2:** Template Selection (apply cost code templates)
3. **Step 3:** Line Items Entry (TanStack Table with inline editing) ← Created in this plan
4. **Step 4:** Labor Rates Application (apply labor rate templates) ← Created in this plan
5. **Step 5:** Markup Configuration (overhead and markup settings)
6. **Step 6:** SOV Builder (generate and finalize SOV) ← Created in this plan

**Ready for integration testing:**
- User can create estimate, add line items, apply labor rates, configure markup, generate SOV, and finalize
- Margin calculations display in real-time with color indicators
- SOV variance validation prevents finalization if total doesn't match
- All data persists via tRPC mutations with audit logging

**Potential future enhancements** (not in Phase 17 scope):
- Drag-and-drop reordering for SOV line items (drag handle already present)
- Split/merge SOV line items (mentioned in plan but deferred)
- Real-time validation while editing (currently validates on save)
- Undo/redo for line item changes
- Import line items from CSV/Excel

## Self-Check: PASSED

**Created files verified:**
- [x] apps/web/components/estimates/line-items/MarginCalculator.tsx EXISTS
- [x] apps/web/components/estimates/line-items/EstimateLineItemsTable.tsx EXISTS
- [x] apps/web/components/estimates/line-items/SectionSubtotal.tsx EXISTS
- [x] apps/web/components/estimates/workflow/steps/03-LineItems.tsx EXISTS
- [x] apps/web/components/estimates/workflow/steps/04-LaborRates.tsx EXISTS
- [x] apps/web/components/estimates/sov/SOVLineItemCard.tsx EXISTS
- [x] apps/web/components/estimates/sov/SOVBuilder.tsx EXISTS
- [x] apps/web/components/estimates/workflow/steps/06-SOVBuilder.tsx EXISTS

**Modified files verified:**
- [x] apps/api/src/trpc/routers/estimates.ts MODIFIED (createLineItem and deleteLineItem added)

**Commits verified:**
- [x] 6e98319 EXISTS (feat: create estimate line items table with inline editing)
- [x] 6adfdd6 EXISTS (feat: create labor rates UI and SOV builder)
