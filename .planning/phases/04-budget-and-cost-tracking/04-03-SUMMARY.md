---
phase: 04-budget-and-cost-tracking
plan: 03
subsystem: api-commitments
tags: [tRPC, commitments, cost-tracking, variance-warnings, lifecycle-management]

dependency_graph:
  requires:
    - "04-01 (Budget schema and calculations)"
    - "04-02 (Budget tRPC router)"
    - "03-03 (Project abilities pattern)"
  provides:
    - "Commitment CRUD API with line items"
    - "Budget variance warnings on commitment creation"
    - "Status lifecycle enforcement"
    - "Commitment-to-budget linkage"
  affects:
    - "04-04 (Commitment UI will consume this API)"
    - "Phase 6 (Payment applications will track against commitments)"

tech_stack:
  added:
    - tRPC router for commitment management
  patterns:
    - Budget variance checking (non-blocking warnings)
    - Status transition validation
    - Line item to budget line item mapping
    - Manual project ability loading

key_files:
  created:
    - apps/api/src/trpc/routers/commitment.ts
  modified:
    - apps/api/src/trpc/router.ts

decisions:
  - summary: "Commitment creation warns but doesn't block when over budget"
    rationale: "PMs need flexibility to approve over-budget commitments with justification. Warnings provide visibility without preventing legitimate business needs."
    alternatives: ["Hard budget enforcement", "Approval workflow gates"]
    impact: "Enables workflow flexibility while maintaining budget awareness"

  - summary: "Only draft commitments can be deleted"
    rationale: "Once commitment enters workflow (pending/approved/executed), it should be tracked for audit. Use 'closed' status instead of delete."
    alternatives: ["Allow delete with audit trail", "Soft delete pattern"]
    impact: "Ensures financial audit trail integrity"

  - summary: "Status transitions follow strict lifecycle"
    rationale: "Prevents invalid state transitions (e.g., executed → draft) that would break financial reporting and audit trail."
    alternatives: ["Allow arbitrary transitions", "Role-based transition rules"]
    impact: "Enforces proper procurement workflow"

metrics:
  duration: 121
  tasks: 2
  files_created: 1
  files_modified: 1
  commits: 2
  completed_at: "2026-02-13T04:12:52Z"
---

# Phase 04 Plan 03: Commitment Management tRPC Router Summary

**One-liner:** Commitment tRPC router with line item tracking, budget variance warnings, and lifecycle management for subcontracts and purchase orders.

## What Was Built

Created the commitment tRPC router (`commitment.ts`) with 6 procedures for full lifecycle management of subcontracts and purchase orders. Registered the router in the app router, making all commitment APIs accessible via `trpc.commitment.*`.

### Key Features

1. **Commitment Creation with Budget Warnings**
   - Line items can optionally map to budget line items
   - Server validates budget line item exists and belongs to project
   - Calculates current committed amounts (approved + executed commitments)
   - Returns non-blocking warnings when new commitments would exceed budget
   - Transaction ensures commitment + line items inserted atomically

2. **Status Lifecycle Management**
   - Valid transitions: draft → pending → approved → executed → closed
   - Invalid transitions throw BAD_REQUEST error
   - Approved status sets approvedBy/approvedAt timestamps
   - Executed status sets executedAt timestamp
   - Terminal state (closed) prevents further transitions

3. **Deletion Rules**
   - Only draft commitments can be deleted
   - All other statuses return FORBIDDEN error directing to use close instead
   - Ensures audit trail for commitments that enter workflow

4. **Line Item Context**
   - getLineItems and getById include budget line item details via LEFT JOIN
   - Shows budget description and budgeted amount for context
   - Supports line items without budget linkage (budgetLineItemId nullable)

5. **List Filtering**
   - Filter by status (draft/pending/approved/executed/closed)
   - Filter by type (subcontract/purchase_order)
   - Returns metadata: line item count, calculated total

6. **CASL Permission Integration**
   - Uses manual loadProjectAbilities pattern (same as budget router)
   - Project team membership determines permissions
   - Foremen get read access (defined in abilities.ts)

## Implementation Details

### Procedures

| Procedure | Type | Input | Output | Notes |
|-----------|------|-------|--------|-------|
| create | mutation | createCommitmentSchema | { commitment, lineItems, warnings } | Server calculates totalAmount from line items |
| list | query | { projectId, status?, type? } | Array with metadata | Includes lineItemCount and calculatedTotal |
| getById | query | { id } | Commitment with full line items | LEFT JOIN budget for context |
| update | mutation | updateCommitmentSchema | Updated commitment | Validates status transitions |
| delete | mutation | { id } | { success: true } | Only draft status allowed |
| getLineItems | query | { commitmentId } | Array with budget context | LEFT JOIN budget line items |

### Status Transition Map

```typescript
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["pending", "closed"],
  pending: ["approved", "draft", "closed"],
  approved: ["executed", "pending", "closed"],
  executed: ["closed"],
  closed: [], // Terminal state
};
```

### Budget Variance Warning Structure

```typescript
{
  budgetLineItemId: string;
  budgeted: number;
  currentCommitted: number;
  newCommitted: number;
  exceedsBy: number;
}
```

## Deviations from Plan

None - plan executed exactly as written.

## Testing Notes

### Manual Verification Steps

1. **TypeScript compilation**: `npx tsc --noEmit` (pre-existing Clerk errors unrelated to commitment router)
2. **Router registration**: Verified commitment router imported and added to appRouter
3. **All 6 procedures present**: create, list, getById, update, delete, getLineItems
4. **Schema imports**: Verified createCommitmentSchema, updateCommitmentSchema, commitmentStatusEnum, AuditAction
5. **loadProjectAbilities pattern**: Copied from budget.ts for consistency

### Expected Runtime Behavior

- Creating commitment with over-budget line items returns warnings array (non-blocking)
- Attempting invalid status transition (e.g., executed → draft) throws BAD_REQUEST
- Deleting non-draft commitment throws FORBIDDEN
- All mutations create audit logs with before/after state
- Line items without budgetLineItemId are allowed (returns null for budget context)

## Integration Points

### Upstream Dependencies

- **04-01**: Budget schema (budget_line_items, commitments, commitment_line_items tables)
- **04-02**: Budget router for variance calculation pattern
- **03-03**: Project abilities pattern for CASL permission loading

### Downstream Consumers

- **04-04**: Commitment UI will call these procedures
- **Phase 5**: Change order commitments
- **Phase 6**: Payment applications tracking against commitments

### Shared Schema Usage

```typescript
// From @construction/shared
import {
  createCommitmentSchema,
  updateCommitmentSchema,
  commitmentStatusEnum,
  commitmentTypeEnum,
  AuditAction,
} from "@construction/shared";
```

## Files Changed

### Created

- `apps/api/src/trpc/routers/commitment.ts` (570 lines)
  - 6 tRPC procedures
  - VALID_STATUS_TRANSITIONS map
  - loadProjectAbilities helper
  - Full TypeScript types

### Modified

- `apps/api/src/trpc/router.ts`
  - Added commitmentRouter import
  - Registered as `commitment: commitmentRouter`

## Commits

1. `a5f9fc0` - feat(04-03): create commitment tRPC router with full lifecycle management
2. `2e08d86` - feat(04-03): register commitment router in app router

## Next Steps

1. **04-04**: Build commitment UI (list, create form, detail view, status management)
2. **Add to budget summary**: Update getProjectSummary to include commitment totals
3. **E2E testing**: Create integration tests for full commitment lifecycle
4. **Variance thresholds**: Make warning/critical thresholds configurable per company (Phase 2 company settings)

## Self-Check: PASSED

Verified all claims:

```bash
# File exists
$ ls apps/api/src/trpc/routers/commitment.ts
apps/api/src/trpc/routers/commitment.ts

# Commits exist
$ git log --oneline | grep "04-03"
2e08d86 feat(04-03): register commitment router in app router
a5f9fc0 feat(04-03): create commitment tRPC router with full lifecycle management

# Router registered
$ grep "commitment" apps/api/src/trpc/router.ts
import { commitmentRouter } from "./routers/commitment.js";
  commitment: commitmentRouter,
```

All assertions verified.
