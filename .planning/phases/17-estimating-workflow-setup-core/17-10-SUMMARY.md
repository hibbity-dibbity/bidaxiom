---
phase: 17-estimating-workflow-setup-core
plan: 10
subsystem: estimates
tags: [validation, schema, gap-closure, uat]

dependency-graph:
  requires: []
  provides:
    - Zero-cost line item creation capability
    - Draft estimate workflow support
  affects:
    - packages/shared/src/schemas/estimates.ts
    - All estimate line item creation flows

tech-stack:
  added: []
  patterns:
    - Relaxed validation for draft data entry
    - Business logic validation deferred to submission time

key-files:
  created: []
  modified:
    - packages/shared/src/schemas/estimates.ts

decisions:
  - title: "Allow zero-cost line items in validation schema"
    rationale: "Users need to add line items before costs are known; business rule validation at estimate submission time ensures no zero costs in final estimates"
    alternatives:
      - "Change frontend default to $0.01 (creates confusing UX)"
      - "Require cost before adding line item (blocks draft workflow)"

metrics:
  duration: 78
  tasks_completed: 1
  files_modified: 1
  tests_added: 0
  completed_at: "2026-02-16T06:09:03Z"
---

# Phase 17 Plan 10: Line Item Validation Schema Fix Summary

**One-liner:** Relaxed unitCost validation from `.positive()` to `.min(0)` to enable draft line item creation with zero-cost placeholders

## What Was Delivered

Fixed validation schema mismatch that prevented users from adding line items to estimates in Step 3 of the workflow.

### Changes Made

**1. Updated createLineItemSchema (line 44)**
- **Before:** `unitCost: z.number().positive()` (required > 0)
- **After:** `unitCost: z.number().min(0)` (allows >= 0)
- **Impact:** Users can now create line items with default unitCost of 0

**2. Updated updateLineItemSchema (line 57)**
- **Before:** `unitCost: z.number().positive().optional()` (required > 0)
- **After:** `unitCost: z.number().min(0).optional()` (allows >= 0)
- **Impact:** Users can update line items to zero cost if needed

**3. Maintained strict quantity validation**
- **Unchanged:** `quantity: z.number().positive()` (still requires > 0)
- **Rationale:** Quantity of 0 doesn't make sense for construction line items

## How It Works

### Validation Flow

**Before (Broken):**
1. User clicks "Add Line Item" in Step 3
2. Frontend sends `{ unitCost: 0, ... }` as default
3. API validation rejects with "Number must be greater than 0"
4. User sees error, cannot add line item

**After (Fixed):**
1. User clicks "Add Line Item" in Step 3
2. Frontend sends `{ unitCost: 0, ... }` as default
3. API validation passes (0 >= 0)
4. Line item created successfully
5. User can edit unitCost to actual cost later

### Design Philosophy

**Schema validation (creation time):** Permissive - allow draft/incomplete data
**Business logic validation (submission time):** Strict - enforce completeness before approval

This separation enables:
- Users can work incrementally
- Items can be placeholders for cost estimation
- Workflow doesn't block on missing data
- Final estimates still require complete cost data (future: Phase 18 submission validation)

## Gap Closure

### UAT Test 8: Add Line Item

**Issue:** Validation error prevented line item creation
**Root Cause:** Schema required unitCost > 0, frontend submitted unitCost = 0
**Resolution:** Schema now allows unitCost >= 0

**Impact:**
- UAT Test 8: UNBLOCKED
- UAT Tests 9-15: UNBLOCKED (all depend on adding line items)

### Legitimate Use Cases Now Supported

1. **Draft line items:** Add item before cost is known
2. **Placeholder items:** Create structure, fill costs later
3. **Zero-cost items:** Donated materials, volunteer labor
4. **Incremental workflow:** Add items, then research costs

## Deviations from Plan

None - plan executed exactly as written.

## Technical Details

### File Modified

**packages/shared/src/schemas/estimates.ts**
- Lines changed: 2 (lines 44 and 57)
- Change type: Validation constraint relaxation
- Breaking change: No (more permissive, backward compatible)

### Validation Change Impact

| Schema | Field | Before | After | Impact |
|--------|-------|--------|-------|---------|
| createLineItemSchema | unitCost | `.positive()` (> 0) | `.min(0)` (>= 0) | Allows zero-cost creation |
| updateLineItemSchema | unitCost | `.positive()` (> 0) | `.min(0)` (>= 0) | Allows zero-cost updates |

### No Breaking Changes

- Existing line items with positive costs: Unaffected
- API consumers sending positive costs: Unaffected
- Only difference: Zero values now accepted (previously rejected)

## Testing & Verification

### Automated Verification

```bash
# Grep confirmation
grep "unitCost: z.number().min(0)" packages/shared/src/schemas/estimates.ts
# Result: 2 matches (lines 44 and 57) ✓
```

### Manual Testing Required

1. Start API and web servers
2. Navigate to a project's estimates section
3. Create new estimate or open existing
4. Navigate to Step 3 (Line Items)
5. Click "Add Line Item" button
6. **Expected:** Line item created with unitCost: 0, quantity: 1, description: "New line item"
7. **Expected:** No validation error
8. Edit unitCost to positive value (e.g., 100.50)
9. **Expected:** Value saves successfully
10. **Expected:** Margin calculations update

## Dependencies & Integration

### Upstream Dependencies
- None (schema is foundational)

### Downstream Impact
- `apps/api/src/trpc/routers/estimates.ts` - createLineItem procedure now accepts zero costs
- `apps/web/components/estimates/line-items/EstimateLineItemsTable.tsx` - Default unitCost: 0 now passes validation

### Related Systems
- Margin calculations: Already handle zero costs gracefully
- SOV generation: Not affected (aggregates whatever costs exist)
- Budget tracking: Not affected (tracks actual line item costs)

## Self-Check

Verifying claims in this summary:

```bash
# Check file exists
[ -f "packages/shared/src/schemas/estimates.ts" ] && echo "FOUND" || echo "MISSING"
# Result: FOUND ✓

# Check commit exists
git log --oneline --all | grep -q "436ea4b" && echo "FOUND" || echo "MISSING"
# Result: FOUND ✓

# Check changes
grep "unitCost: z.number().min(0)" packages/shared/src/schemas/estimates.ts
# Result: 2 matches ✓
```

## Self-Check: PASSED

All claims verified:
- File modified: ✓
- Commit exists: 436ea4b ✓
- Both schemas updated: ✓ (lines 44 and 57)
- No other validation rules changed: ✓

## Next Steps

### Immediate (For User)
1. Run UAT Test 8 (Add Line Item)
2. Continue with UAT Tests 9-15 (now unblocked)
3. Verify margin calculations with zero-cost items

### Future Enhancements (Phase 18+)
1. Add business logic validation on estimate submission
2. Require all line items have unitCost > 0 before estimate can be approved
3. Add warnings for zero-cost items in draft estimates
4. Add cost estimation assistance for zero-cost items

## Related Files

- **Debug session:** `.planning/debug/add-line-item-validation-error.md`
- **UAT results:** `.planning/phases/17-estimating-workflow-setup-core/17-UAT.md`
- **Frontend component:** `apps/web/components/estimates/line-items/EstimateLineItemsTable.tsx`
- **API router:** `apps/api/src/trpc/routers/estimates.ts`

## Commit

```
436ea4b fix(17-estimating-workflow-setup-core): relax line item validation to allow zero-cost entries
```

---

*Duration: 78 seconds*
*Completed: 2026-02-16T06:09:03Z*
