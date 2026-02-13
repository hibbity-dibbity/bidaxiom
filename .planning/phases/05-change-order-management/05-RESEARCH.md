# Phase 5: Change Order Management - Research

**Researched:** 2026-02-12
**Domain:** Approval workflows, change order management, state machines, sequential numbering
**Confidence:** HIGH

## Summary

Phase 5 implements construction change order management with three distinct types (owner, internal, subcontractor), configurable multi-party approval workflows, and automatic budget updates on approval. The research reveals this requires: (1) a flexible approval workflow state machine that supports sequential and parallel approvers with role-based rules, (2) separate numbering sequences for PCOs (Pending Change Orders) vs. approved COs using database-level concurrency controls, (3) comprehensive audit trails capturing every state transition and field change, and (4) transactional budget updates that maintain three-tier cost tracking integrity (budget → committed → actual).

The construction industry standard clearly distinguishes PCOs from approved COs—PCOs are tentative proposals that don't affect budgets, while approved COs become contractual and automatically update budget line items. The approval workflow must be configurable per company (some require owner approval for all COs over $X, others delegate to PMs), support multi-party sequential approval (PM → Superintendent → Owner), and handle parallel approvals (e.g., both accountant AND PM must approve).

**Primary recommendation:** Use database-driven approval workflow configuration (not hardcoded state machines) to support company-specific approval rules, implement scoped sequential numbering using PostgreSQL SELECT FOR UPDATE to prevent race conditions, and leverage existing audit logging infrastructure enhanced with change order-specific history tables for field-level change tracking.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | (existing) | Database schema and queries | Already project standard, supports transactions with isolation levels |
| Zod | (existing) | Schema validation and discriminated unions | Already project standard, excellent for change order type variants |
| tRPC | (existing) | Type-safe API procedures | Already project standard, supports middleware composition |
| PostgreSQL | 15+ | Relational database with ACID guarantees | Already project standard, required for SELECT FOR UPDATE and isolation levels |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | - | - | All necessary libraries already in stack |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Database-driven workflow | XState v5 | XState is excellent for client-side flows but overkill for server-side approval workflows—database tables are simpler, easier to configure per-company, and easier to query for reporting |
| Custom numbering logic | PostgreSQL SEQUENCE | SEQUENCE works for global incrementing but can't handle scoped sequences (e.g., PCO-2024-001 per project per year)—requires SELECT FOR UPDATE pattern instead |
| Separate history table | PostgreSQL temporal tables | Temporal tables are powerful but add complexity; construction industry expects explicit change order history with "Revision X" labeling, which is clearer with a dedicated history table |

**Installation:**
No new packages required—all dependencies already in monorepo.

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
├── trpc/routers/
│   └── change-order.ts           # tRPC procedures for CO CRUD + approval actions
├── services/
│   ├── change-order.ts            # Business logic: create, submit, approve, reject
│   └── approval-workflow.ts       # Workflow evaluation: who's next, can user approve, etc.
├── db/schema/
│   └── tenant.ts                  # changeOrders, changeOrderLineItems, approvalSteps, coHistory tables
└── utils/
    └── sequential-number.ts       # Scoped numbering with SELECT FOR UPDATE

apps/web/components/change-order/
├── change-order-form.tsx          # Create/edit CO with discriminated union (owner/internal/sub)
├── change-order-approval-panel.tsx # Approve/reject with comments
├── change-order-history.tsx       # Audit trail with field-level changes
└── change-order-summary-cards.tsx # Dashboard cards: pending, approved, totals
```

### Pattern 1: Discriminated Union for Change Order Types

**What:** Use Zod discriminated unions to enforce different validation rules for owner, internal, and subcontractor change orders.

**When to use:** When types share common fields but have type-specific requirements.

**Example:**
```typescript
// packages/shared/src/types/change-order.ts
export const ownerChangeOrderSchema = z.object({
  type: z.literal("owner"),
  projectId: z.string().uuid(),
  description: z.string().min(1),
  requestedBy: z.string().min(1),
  ownerApprovalRequired: z.boolean().default(true),
  lineItems: z.array(budgetLineItemImpactSchema).min(1),
});

export const internalChangeOrderSchema = z.object({
  type: z.literal("internal"),
  projectId: z.string().uuid(),
  description: z.string().min(1),
  reason: z.enum(["error", "efficiency", "value_engineering", "other"]),
  lineItems: z.array(budgetLineItemImpactSchema).min(1),
});

export const subcontractorChangeOrderSchema = z.object({
  type: z.literal("subcontractor"),
  projectId: z.string().uuid(),
  description: z.string().min(1),
  commitmentId: z.string().uuid(), // Which subcontract is changing
  lineItems: z.array(budgetLineItemImpactSchema).min(1),
});

export const createChangeOrderSchema = z.discriminatedUnion("type", [
  ownerChangeOrderSchema,
  internalChangeOrderSchema,
  subcontractorChangeOrderSchema,
]);
```

### Pattern 2: Database-Driven Approval Workflow

**What:** Store approval workflow configuration in database tables (not hardcoded state machines) to support company-specific rules.

**When to use:** When approval rules vary by company, project type, or CO amount.

**Example:**
```typescript
// DB Schema
const approvalWorkflowSteps = schema.table("approval_workflow_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  changeOrderId: uuid("change_order_id").notNull().references(() => changeOrders.id),
  stepOrder: integer("step_order").notNull(), // 1, 2, 3...
  approverRole: text("approver_role"), // "org:project_manager", null = any PM
  approverUserId: text("approver_user_id"), // Specific user or null = any with role
  requirementType: text("requirement_type").notNull(), // "all", "any", "specific"
  status: text("status").notNull().default("pending"), // pending, approved, rejected, skipped
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  comments: text("comments"),
});

// Service logic
async function evaluateWorkflow(changeOrderId: string) {
  const steps = await getApprovalSteps(changeOrderId);
  const currentStep = steps.find(s => s.status === "pending");

  if (!currentStep) {
    return { isComplete: true, nextApprovers: [] };
  }

  return {
    isComplete: false,
    currentStepOrder: currentStep.stepOrder,
    nextApprovers: currentStep.approverUserId
      ? [currentStep.approverUserId]
      : await getUsersByRole(currentStep.approverRole),
  };
}
```

### Pattern 3: Scoped Sequential Numbering with SELECT FOR UPDATE

**What:** Generate change order numbers scoped to project/year without race conditions using row-level locking.

**When to use:** When you need sequences like "PCO-2024-001", "CO-2024-015" per project.

**Example:**
```typescript
// apps/api/src/utils/sequential-number.ts
async function getNextChangeOrderNumber(
  db: NodePgDatabase,
  schema: string,
  projectId: string,
  type: "pco" | "co",
  year: number
): Promise<string> {
  return await db.transaction(async (tx) => {
    // Lock the counter row to prevent race conditions
    const [counter] = await tx
      .select()
      .from(changeOrderCounters)
      .where(
        and(
          eq(changeOrderCounters.projectId, projectId),
          eq(changeOrderCounters.type, type),
          eq(changeOrderCounters.year, year)
        )
      )
      .for("update"); // SELECT FOR UPDATE - critical for concurrency

    let nextNumber: number;
    if (!counter) {
      // First CO/PCO for this project/year
      await tx.insert(changeOrderCounters).values({
        projectId,
        type,
        year,
        lastNumber: 1,
      });
      nextNumber = 1;
    } else {
      nextNumber = counter.lastNumber + 1;
      await tx
        .update(changeOrderCounters)
        .set({ lastNumber: nextNumber })
        .where(eq(changeOrderCounters.id, counter.id));
    }

    const prefix = type === "pco" ? "PCO" : "CO";
    return `${prefix}-${year}-${String(nextNumber).padStart(3, "0")}`;
  }, { isolationLevel: "serializable" });
}
```

### Pattern 4: Change Order History with Field-Level Tracking

**What:** Track every modification to a change order in a separate history table with before/after values.

**When to use:** Always—construction projects require full audit trails for liability and compliance.

**Example:**
```typescript
const changeOrderHistory = schema.table("change_order_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  changeOrderId: uuid("change_order_id").notNull().references(() => changeOrders.id),
  revisionNumber: integer("revision_number").notNull(),
  changedBy: text("changed_by").notNull(),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  changeType: text("change_type").notNull(), // "field_update", "status_change", "approval", "line_item_change"
  fieldName: text("field_name"), // e.g., "description", "totalAmount"
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  comments: text("comments"),
});

// Service: Record field changes
async function updateChangeOrder(id: string, updates: Partial<ChangeOrder>, userId: string) {
  const current = await getChangeOrder(id);
  const revision = await getNextRevision(id);

  await db.transaction(async (tx) => {
    // Apply updates
    await tx.update(changeOrders).set(updates).where(eq(changeOrders.id, id));

    // Record history for each changed field
    for (const [field, newValue] of Object.entries(updates)) {
      if (current[field] !== newValue) {
        await tx.insert(changeOrderHistory).values({
          changeOrderId: id,
          revisionNumber: revision,
          changedBy: userId,
          changeType: "field_update",
          fieldName: field,
          oldValue: current[field],
          newValue: newValue,
        });
      }
    }
  });
}
```

### Pattern 5: Transactional Budget Updates on Approval

**What:** When a change order is approved, update budget line items atomically in a transaction with proper isolation.

**When to use:** Always—budget updates must be atomic with approval status changes.

**Example:**
```typescript
async function approveChangeOrder(changeOrderId: string, userId: string) {
  return await db.transaction(async (tx) => {
    const co = await tx
      .select()
      .from(changeOrders)
      .where(eq(changeOrders.id, changeOrderId))
      .for("update"); // Lock to prevent concurrent approvals

    if (co.status !== "pending_approval") {
      throw new Error("Change order is not pending approval");
    }

    // Update CO status
    await tx
      .update(changeOrders)
      .set({
        status: "approved",
        approvedBy: userId,
        approvedAt: new Date(),
      })
      .where(eq(changeOrders.id, changeOrderId));

    // Apply budget impacts
    const lineItems = await tx
      .select()
      .from(changeOrderLineItems)
      .where(eq(changeOrderLineItems.changeOrderId, changeOrderId));

    for (const item of lineItems) {
      await tx
        .update(budgetLineItems)
        .set({
          budgetedAmount: sql`budgeted_amount + ${item.amountChange}`,
          updatedAt: new Date(),
        })
        .where(eq(budgetLineItems.id, item.budgetLineItemId));
    }

    // Record history
    await tx.insert(changeOrderHistory).values({
      changeOrderId,
      revisionNumber: await getNextRevision(changeOrderId),
      changedBy: userId,
      changeType: "status_change",
      oldValue: { status: "pending_approval" },
      newValue: { status: "approved" },
    });
  }, { isolationLevel: "serializable" });
}
```

### Anti-Patterns to Avoid

- **Hardcoded approval workflows:** Don't embed approval logic in code (if/else chains). Use database-driven workflow steps so companies can configure their own approval chains without code changes.
- **Optimistic concurrency for numbering:** Don't generate CO numbers by finding max + 1 without locking. This creates race conditions where two concurrent requests get the same number. Always use SELECT FOR UPDATE.
- **Updating budget without transaction:** Don't update budget line items separately from CO approval. Use a single transaction with serializable isolation to prevent partial updates if approval fails mid-process.
- **Storing full snapshots instead of deltas:** Don't store entire CO state on every change. Store field-level deltas (old → new) so you can reconstruct history and see exactly what changed when.
- **Client-side approval validation:** Don't trust client-side "can this user approve?" checks. Always re-validate approval permissions server-side based on current workflow step and user role.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State machine library | Custom state transition logic | Database-driven workflow steps | State machines like XState are powerful but overkill for server-side approval workflows that need per-company configuration, reporting, and mid-flight changes. Database tables are simpler, queryable, and support dynamic workflow modification. |
| Concurrent numbering | SELECT MAX + 1 logic | PostgreSQL SELECT FOR UPDATE | Race conditions are subtle and hard to test. SELECT FOR UPDATE is battle-tested and guaranteed to prevent duplicate numbers even under high concurrency. |
| Change history | Manual before/after logging | Dedicated history table pattern | Audit trails have many edge cases: nested objects, null handling, type coercion, circular references. Use a proven history table pattern with JSONB for old/new values. |
| Notification system | Custom email/push logic | Defer to Phase 6+ notification service | Approval notifications need multi-channel delivery (email, SMS, in-app), read receipts, retry logic, and preference management. This is a cross-cutting concern best handled by a dedicated notification service implemented later. For Phase 5, log approval events only—don't send emails yet. |

**Key insight:** Construction approval workflows seem simple on the surface but have deceptive complexity: multi-party sequential/parallel approvals, role-based vs. user-specific approvers, amount thresholds triggering different workflows, and mid-flight workflow changes (e.g., PM escalates to owner). Database-driven configuration handles all these cases without code changes.

## Common Pitfalls

### Pitfall 1: Race Conditions in Sequential Numbering

**What goes wrong:** Two users create change orders simultaneously for the same project. Both get "CO-2024-005" because the code does `SELECT MAX(number) + 1` without locking.

**Why it happens:** PostgreSQL's default "read committed" isolation level allows non-repeatable reads. Between SELECT and INSERT, another transaction can commit a new row with the same number.

**How to avoid:** Always use `SELECT FOR UPDATE` when reading the counter row, and wrap the entire number generation (read counter, increment, update counter, insert CO) in a single transaction with "serializable" isolation level.

**Warning signs:**
- Unit tests pass but production has duplicate numbers under load
- CO numbers have gaps (e.g., 001, 002, 005—missing 003 and 004)
- Database constraint violations on unique index for CO numbers

### Pitfall 2: Approval Workflow State Inconsistency

**What goes wrong:** A change order shows "Approved" but the budget wasn't updated, or it shows "Pending" but the budget already changed.

**Why it happens:** Approval status update and budget impact are executed in separate transactions. If the first succeeds but the second fails (network issue, constraint violation), you have partial state.

**How to avoid:** Wrap status update + budget update in a single database transaction. Use serializable isolation level to prevent concurrent modifications. If budget update fails, the entire transaction rolls back and CO stays "Pending."

**Warning signs:**
- "This CO is approved but I don't see the budget change"
- Budget totals don't match sum of line items + approved COs
- Audit logs show CO approved but no corresponding budget update log

### Pitfall 3: PCO-to-CO Conversion Loses History

**What goes wrong:** User creates PCO-2024-012, gets it approved, system assigns CO-2024-008 and deletes the PCO. All PCO-stage discussions and revisions are lost.

**Why it happens:** Treating PCO and CO as different entities instead of status progression of the same entity.

**How to avoid:** Use a single `change_orders` table with `status` field: "draft" → "pco_submitted" → "pending_approval" → "approved" or "rejected". When a PCO is approved, update status to "approved" and assign a CO number (keep PCO number in a separate field for reference). Never delete rows—use soft deletes or archive tables.

**Warning signs:**
- User asks "Where did my PCO comments go?"
- CO approval history doesn't show the PCO discussion
- Can't trace which budget change came from which PCO

### Pitfall 4: Hardcoded Approval Rules Can't Handle Real-World Variance

**What goes wrong:** Code has `if (amount > 50000) { requireOwnerApproval = true }` but different companies have different thresholds, and some need superintendent approval too, and some need both accountant AND PM approval in parallel.

**Why it happens:** Trying to implement flexible workflows with if/else logic instead of data-driven configuration.

**How to avoid:** Store approval workflow templates in database tables: `approval_workflow_templates` (per company/project type) and `approval_workflow_steps` (per CO instance). Let companies configure their own rules: "All COs over $X require owner approval" or "Internal COs need PM + accountant parallel approval."

**Warning signs:**
- Every new approval requirement needs a code change
- QA keeps finding edge cases: "What if PM is also the owner?"
- Different customers want different approval flows but you can't configure it

### Pitfall 5: Ignoring Clerk Role Normalization (Existing Project Pattern)

**What goes wrong:** Approval workflow checks `ctx.user.role === "project_manager"` but Clerk returns compact role `pm`, causing approval to fail even though user has correct role.

**Why it happens:** Phase 1 established that Clerk v5 uses compact JWT claims and roles need `org:` prefix for CASL. This pattern must extend to change order approvals.

**How to avoid:** Always normalize Clerk roles to `org:` prefix in tRPC context middleware (already done in Phase 1). When storing approver roles in `approval_workflow_steps`, use normalized format: `org:project_manager`, not `project_manager` or `pm`.

**Warning signs:**
- PM can view change orders but can't approve them
- CASL allows action but approval workflow rejects user
- Role checks work in development (hardcoded test users) but fail in production (Clerk roles)

## Code Examples

Verified patterns from research:

### Drizzle Transaction with Isolation Level
```typescript
// Source: https://orm.drizzle.team/docs/transactions
import { db } from "./db";

await db.transaction(
  async (tx) => {
    // All queries here are atomic
    await tx.insert(changeOrders).values({ /* ... */ });
    await tx.update(budgetLineItems).set({ /* ... */ });
  },
  {
    isolationLevel: "serializable", // Highest isolation—prevents all anomalies
    accessMode: "read write",
  }
);
```

### Zod Discriminated Union for CO Types
```typescript
// Source: https://zod.dev/api (discriminatedUnion section)
import { z } from "zod";

const changeOrderSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("owner"),
    projectId: z.string().uuid(),
    ownerRequestedBy: z.string(),
    // Owner-specific fields
  }),
  z.object({
    type: z.literal("internal"),
    projectId: z.string().uuid(),
    reason: z.enum(["error", "efficiency", "value_engineering", "other"]),
    // Internal-specific fields
  }),
  z.object({
    type: z.literal("subcontractor"),
    projectId: z.string().uuid(),
    commitmentId: z.string().uuid(),
    // Subcontractor-specific fields
  }),
]);

// TypeScript correctly narrows type based on discriminator
function processChangeOrder(co: z.infer<typeof changeOrderSchema>) {
  if (co.type === "owner") {
    console.log(co.ownerRequestedBy); // ✓ TypeScript knows this exists
  }
}
```

### CASL Ability Check for Approval
```typescript
// Source: Existing Phase 1 pattern (apps/api/src/auth/abilities.ts)
import { subject } from "@casl/ability";

// In tRPC procedure
.mutation(async ({ ctx, input }) => {
  const co = await getChangeOrder(input.id);

  // Check CASL ability using project scoping
  if (!ctx.ability.can("manage", subject("ChangeOrder", { projectId: co.projectId }))) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  // Then check workflow-specific approval permission
  const canApprove = await canUserApproveAtCurrentStep(co.id, ctx.userId, ctx.user.role);
  if (!canApprove) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not your turn to approve" });
  }

  // Proceed with approval
})
```

### Audit Logging for Change Orders
```typescript
// Source: Existing Phase 1 pattern (apps/api/src/trpc/middleware/audit.ts)
import { withAuditLog } from "../middleware/audit";
import { AuditAction } from "@construction/shared";

// In change order router
export const changeOrderRouter = router({
  approve: protectedProcedure
    .use(withAuditLog({ entityType: "ChangeOrder", action: AuditAction.UPDATE }))
    .input(approveChangeOrderSchema)
    .mutation(async ({ ctx, input }) => {
      // Business logic here
      // Audit log fires automatically on success (fire-and-forget)
    }),
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| XState v4 | XState v5 | 2023-2024 | XState v5 is actor-model based, but this doesn't affect our decision—we're using database-driven workflows instead |
| Hardcoded approval flows | Configurable workflow templates | 2020+ (enterprise PMO tools) | Modern construction software (Procore, Autodesk Build) lets companies configure approval chains per project type |
| Global CO numbering | Project/year scoped numbering | Industry standard | PCO-2024-001 vs. CO-2024-015—separate sequences make it clear what's tentative vs. approved |
| Email-only notifications | Multi-channel (email, SMS, push, in-app) | 2022+ | Modern construction software uses real-time in-app + mobile push for time-critical approvals |

**Deprecated/outdated:**
- **Client-side state machines for approval workflows:** XState is great for UI flows (multi-step forms) but server-side approval workflows need database persistence, mid-flight changes, and reporting queries. Database-driven workflows are the current pattern.
- **JSON column for approval history:** Early implementations stored full object snapshots in JSONB. Current best practice: separate history table with field-level deltas for better querying and indexing.

## Open Questions

1. **Should approval workflows support time-based escalation?**
   - What we know: Enterprise PMO tools support "if PM doesn't approve within 48 hours, escalate to superintendent"
   - What's unclear: Does v1 need this, or can it be deferred to v2? How would it work with email-only notifications (Phase 5) vs. real-time push (future)?
   - Recommendation: Defer to v2. Phase 5 focuses on core approval workflow. Add a `escalation_config` JSONB column to `approval_workflow_steps` for future use, but don't implement escalation logic yet. Users can manually reassign if needed.

2. **How should parallel approvals work—all required or any one?**
   - What we know: Some companies need both accountant AND PM approval (all), others need PM OR superintendent (any)
   - What's unclear: Do we need both modes in v1, or start with "all" and add "any" later?
   - Recommendation: Implement "all" (more restrictive) in Phase 5. Add `requirement_type` enum field (`all`, `any`, `specific`) to approval_workflow_steps but only support `all` initially. This makes future "any" support a database config change, not schema migration.

3. **Should change orders support attachments (drawings, scope docs)?**
   - What we know: Real-world COs often reference drawings, scope documents, photos of field conditions
   - What's unclear: Should Phase 5 implement this, or rely on document management from Phase 3?
   - Recommendation: Don't create a separate CO attachment system. Add a `related_documents` JSONB array to `change_orders` table that stores document IDs from the existing `documents` table. UI shows these documents in CO detail view. This reuses Phase 3 infrastructure (S3 storage, versioning, permissions).

4. **What happens if a budget line item is deleted after CO references it?**
   - What we know: Phase 4 allows budget line item updates but not deletion once locked. COs will lock budget line items they impact.
   - What's unclear: What if user tries to delete a budget line item that has pending COs?
   - Recommendation: Add `hasReferencingChangeOrders` check to budget line item deletion procedure. Block deletion if any CO (pending or approved) references it. User must resolve or reject COs first. This prevents orphaned CO line items.

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM Transactions](https://orm.drizzle.team/docs/transactions) - PostgreSQL transaction isolation levels, SELECT FOR UPDATE patterns
- [Zod Discriminated Unions](https://zod.dev/api) - Type-safe change order type variants
- [PostgreSQL SELECT FOR UPDATE](https://on-systems.tech/blog/128-preventing-read-committed-sql-concurrency-errors/) - Preventing race conditions in sequential numbering
- Existing codebase patterns:
  - `apps/api/src/trpc/middleware/audit.ts` - Audit logging pattern
  - `apps/api/src/auth/abilities.ts` - CASL authorization with project scoping
  - `apps/api/src/db/schema/tenant.ts` - Budget line item locking mechanism
  - `.planning/phases/04-budget-and-cost-tracking/04-01-PLAN.md` - Three-tier cost tracking model

### Secondary (MEDIUM confidence)
- [Construction Change Order Best Practices](https://www.procore.com/library/how-construction-change-orders-work) - Industry workflow standards
- [PCO vs CO Numbering](https://support.projectmates.com/support/solutions/articles/44000613275-what-are-some-differences-between-potential-change-orders-pcos-and-change-orders-cos-) - Separate numbering sequences pattern
- [Multi-Level Approval System Design](https://www.coderbased.com/p/multi-level-approval-system-design) - Database schema for approval workflows
- [Change Order Types](https://www.linarc.com/buildspace/what-are-the-different-types-of-change-orders-in-construction) - Owner vs. internal vs. subcontractor
- [XState Documentation](https://stately.ai/docs/xstate) - State machine patterns (evaluated but not using)
- [Oracle Change Order Automation](https://docs.oracle.com/en/cloud/saas/readiness/erp/24a/ppm24a/24A-ppm-wn-f30828.htm) - Automatic budget update pattern
- [Approval Workflow Notifications](https://learn.microsoft.com/en-us/power-automate/modern-approvals) - Real-time notification patterns

### Tertiary (LOW confidence)
- [Audit Trail Patterns](https://www.red-gate.com/blog/database-design-for-audit-logging) - General audit logging approaches
- [PostgreSQL Sequences and Race Conditions](https://www.neilconway.org/docs/sequences/) - Understanding sequence limitations
- [React Hook Form Multi-Step](https://blog.logrocket.com/building-reusable-multi-step-form-react-hook-form-zod/) - Frontend multi-step form patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing project dependencies, no new libraries
- Architecture: HIGH - Patterns verified against existing Phase 1-4 implementations and industry research
- Pitfalls: HIGH - Based on existing project patterns (Clerk role normalization) and verified PostgreSQL concurrency patterns
- Open questions: MEDIUM - Some design decisions need product owner input (escalation, parallel approval modes)

**Research date:** 2026-02-12
**Valid until:** ~30 days (2026-03-14) - Stack is stable, approval workflow patterns are well-established
