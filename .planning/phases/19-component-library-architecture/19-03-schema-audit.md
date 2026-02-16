# Schema Audit: Centralization Assessment

**Date:** 2026-02-16
**Phase:** 19 Plan 03
**Purpose:** Identify schema locations, duplication, and consolidation targets for shared validation logic

## Executive Summary

**Current State:**
- Most entity schemas already exist in `packages/shared/src/types/` directory
- Servers (tRPC routers) are importing from `@construction/shared`
- Client forms have mix of local inline schemas and shared imports
- Schema location convention inconsistent: `types/` vs `schemas/` directories

**Key Finding:**
Schemas exist but are split between `types/` (entity schemas) and `schemas/` (common + estimates). The plan targets consolidation in `schemas/` directory, but entities are currently in `types/`.

**Recommendation:**
Rather than moving existing schemas from `types/` to `schemas/`, we should:
1. Keep existing schemas in `types/` (they're already working and imported)
2. Update client components to import from shared package instead of local definitions
3. Document the convention: `schemas/` for reusable validation primitives (phone, address), `types/` for entity CRUD schemas

---

## Existing Schema Inventory

### Already in Shared Package (`packages/shared/src/types/`)

| Entity | File | Exports | Status |
|--------|------|---------|--------|
| **Project** | `types/project.ts` | `createProjectSchema`, `updateProjectSchema`, `listProjectsSchema`, `teamMemberSchema`, `projectPhaseSchema` | ✅ Complete |
| **Customer** | `types/customer.ts` | `createCustomerSchema`, `updateCustomerSchema` | ✅ Complete |
| **Budget** | `types/budget.ts` | `createBudgetLineItemSchema`, `updateBudgetLineItemSchema`, `createCommitmentSchema`, `updateCommitmentSchema` | ✅ Complete |
| **Change Order** | `types/change-order.ts` | `createChangeOrderSchema` (discriminated union), `updateChangeOrderSchema`, `submitForApprovalSchema`, `approveRejectSchema` | ✅ Complete |
| **Subcontractor** | `types/bidding.ts` | `createSubcontractorSchema`, `updateSubcontractorSchema` | ✅ Complete |
| **Bid/RFQ** | `types/bidding.ts` | `createRfqSchema`, `updateRfqSchema`, `submitBidSchema`, `updateBidVersionSchema`, `awardBidSchema` | ✅ Complete |
| **Estimates** | `schemas/estimates.ts` | `createEstimateSchema`, `updateEstimateSchema`, `createLineItemSchema`, `updateLineItemSchema`, `generateBidSchema` | ✅ Complete |
| **Common** | `schemas/common.ts` | `phoneSchema`, `addressSchema` | ✅ Complete |

**Observation:** All target entities already have centralized schemas. No duplication found at server level.

---

## Client Schema Usage Analysis

### Local Inline Schemas Found

**Location:** `apps/web/components/`

| Component | Local Schema | Should Import From |
|-----------|--------------|---------------------|
| `estimates/workflow/steps/01-BasicInfo.tsx` | `basicInfoSchema = z.object({name, projectType})` | `@construction/shared` (subset of `createEstimateSchema`) |
| `estimates/workflow/steps/05-MarkupConfig.tsx` | `markupConfigSchema = z.object({overheadType, markupBase})` | `@construction/shared` (subset of `updateEstimateSchema`) |
| `reports/report-builder.tsx` | `reportConfigSchema = z.object({dataSource, filters, columns})` | ⚠️ Report-specific, no shared equivalent |
| `reports/schedule-dialog.tsx` | `scheduleFormSchema = z.object({frequency, format})` | ⚠️ Report-specific, no shared equivalent |

**Finding:** Only 2 form components have local schemas that should be replaced (estimate workflow steps). Report schemas are UI-specific and don't need centralization.

---

## Server Import Analysis

### tRPC Router Schema Imports

Checked all routers in `apps/api/src/trpc/routers/`:

| Router | Import Status | Schemas Used |
|--------|---------------|--------------|
| `project.ts` | ✅ Shared | `createProjectSchema`, `updateProjectSchema`, `listProjectsSchema` from `@construction/shared` |
| `customer.ts` | ✅ Shared | `createCustomerSchema`, `updateCustomerSchema` from `@construction/shared` |
| `budget.ts` | ✅ Shared | `createBudgetLineItemSchema`, `updateBudgetLineItemSchema` from `@construction/shared` |
| `change-order.ts` | ✅ Shared | `createChangeOrderSchema`, `updateChangeOrderSchema` from `@construction/shared` |
| `bid.ts` | ✅ Shared | `submitBidSchema`, `updateBidVersionSchema`, `awardBidSchema` from `@construction/shared` |
| `commitment.ts` | ✅ Shared | `createCommitmentSchema` from `@construction/shared` |
| `auth.ts` | ⚠️ Inline | Auth-specific schemas (login, register, reset password) - not entity CRUD |
| `audit.ts` | ⚠️ Inline | Query filter schemas only (no CRUD) |

**Finding:** All entity CRUD operations already import from shared package. No duplication at server level.

---

## Schema Location Convention

### Current Structure

```
packages/shared/src/
├── schemas/
│   ├── common.ts       # phoneSchema, addressSchema (reusable primitives)
│   ├── estimates.ts    # Estimate CRUD schemas
│   └── index.ts        # Re-exports
└── types/
    ├── project.ts      # Project CRUD schemas + types
    ├── customer.ts     # Customer CRUD schemas + types
    ├── budget.ts       # Budget/commitment schemas + types
    ├── change-order.ts # Change order schemas + types
    ├── bidding.ts      # RFQ/bid/subcontractor schemas + types
    └── ...
```

### Observed Pattern

- **`schemas/`**: Reusable validation primitives (phone, address) and newer entities (estimates)
- **`types/`**: Entity CRUD schemas + TypeScript types + constants (enums, defaults)

### Recommendation

**Option A: Keep Current Structure (RECOMMENDED)**
- Leave entity schemas in `types/` (they're already working)
- Use `schemas/` for shared validation primitives only
- Update client components to import from `@construction/shared`
- Document convention in shared package README

**Option B: Move to `schemas/` (Plan's Original Intent)**
- Move all entity schemas from `types/*.ts` to `schemas/*.ts`
- Update all imports across codebase
- Higher risk, more churn for same outcome

**Decision:** Pursue Option A - schemas are already centralized, just need client migration.

---

## Consolidation Plan

### Phase 1: Client Component Migration (Required)

**Target Components:**

1. **Estimate Workflow Steps**
   - File: `apps/web/components/estimates/workflow/steps/01-BasicInfo.tsx`
   - Change: Remove `basicInfoSchema`, import subset from `@construction/shared`
   - Notes: Workflow step may need partial schema (name + projectType only)

2. **Estimate Markup Config**
   - File: `apps/web/components/estimates/workflow/steps/05-MarkupConfig.tsx`
   - Change: Remove `markupConfigSchema`, import from `@construction/shared`
   - Notes: Uses `overheadType`, `markupBase` from `updateEstimateSchema`

**Approach:**
- For workflow steps that validate subsets of full schemas, use `.pick()` method:
  ```typescript
  import { createEstimateSchema } from "@construction/shared";
  const basicInfoSchema = createEstimateSchema.pick({ name: true, projectType: true });
  ```

### Phase 2: Schema Re-export Alignment (Optional)

Current `packages/shared/src/schemas/index.ts` only exports:
- `common.ts` schemas
- `estimates.ts` schemas

Consider adding re-exports from `types/` for consistency:
```typescript
export * from "./common";
export * from "./estimates";

// Re-export entity schemas from types/ for convenience
export * from "../types/project";
export * from "../types/customer";
export * from "../types/budget";
export * from "../types/change-order";
export * from "../types/bidding";
```

This allows imports like:
```typescript
import { createProjectSchema, phoneSchema } from "@construction/shared";
// Instead of:
import { createProjectSchema } from "@construction/shared"; // from types/
import { phoneSchema } from "@construction/shared"; // from schemas/
```

---

## Migration Checklist

### Must-Have Changes
- [x] Audit complete
- [ ] Remove local `basicInfoSchema` from `01-BasicInfo.tsx`, import from shared
- [ ] Remove local `markupConfigSchema` from `05-MarkupConfig.tsx`, import from shared
- [ ] Update `schemas/index.ts` to re-export entity schemas from `types/`
- [ ] Verify TypeScript compilation succeeds
- [ ] Verify forms still validate correctly

### Out of Scope
- ❌ Moving schemas from `types/` to `schemas/` (already centralized)
- ❌ Report schemas (UI-specific, not entity CRUD)
- ❌ Auth schemas (not entity CRUD, session-specific)

---

## Duplication Analysis

### Server-Side Duplication
**Found:** None
**Reason:** All tRPC routers import from `@construction/shared`

### Client-Side Duplication
**Found:** 2 instances (estimate workflow steps)
**Severity:** Low (subset schemas for multi-step forms)
**Risk:** Validation drift if estimate schema changes without updating workflow steps

### Schema Definition Duplication
**Found:** None
**Reason:** All entity schemas defined once in shared package

---

## Validation Patterns Observed

### Discriminated Unions
- **Change Orders**: `type` field discriminates owner/internal/subcontractor
- **Pattern**: `z.discriminatedUnion("type", [schema1, schema2, schema3])`
- **Client Usage**: React Hook Form handles discriminated unions natively

### Partial Updates
- **Pattern**: `updateSchema = createSchema.partial()` or selective optional fields
- **Examples**: `updateProjectSchema`, `updateCustomerSchema`

### Refinements
- **Phone Schema**: Custom `.refine()` for US format validation
- **State Schema**: Length validation via `.refine()`
- **Invitation Schema**: XOR validation (subcontractorId OR externalEmail+companyName)

### Reusable Primitives
- **`phoneSchema`**: Used by customer, subcontractor
- **`addressSchema`**: Used by customer, subcontractor, project (via structured fields)

---

## Recommendations

### Immediate Actions
1. ✅ **No schema movement needed** - entities already centralized in `types/`
2. ✅ **Client migration only** - update 2 estimate workflow components
3. ✅ **Documentation** - clarify `schemas/` vs `types/` convention

### Future Enhancements
1. **Schema versioning** - if API versioning becomes necessary
2. **Async validation** - unique constraint checks (email, jobNumber) via `.refine()`
3. **Error message i18n** - centralize validation messages for localization

---

## Conclusion

The codebase is already following schema centralization best practices. Servers import from shared package, avoiding duplication. Only 2 client components have local inline schemas that should be migrated.

**No new schema files need to be created.** Task 2 of the plan (Create centralized schemas) can be simplified to:
- Update `schemas/index.ts` to re-export entity schemas
- Ensure all entity schemas are accessible via single import

**Task 3 migration** will be lightweight:
- 2 client components to update
- 0 server routers to update (already done)
