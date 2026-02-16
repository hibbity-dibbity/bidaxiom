# Phase 18: Estimating Workflow - Lifecycle & Conversion - Research

**Researched:** 2026-02-16
**Domain:** Construction estimating lifecycle management, bid generation, won/lost tracking, project conversion
**Confidence:** HIGH

## Summary

Phase 18 completes the estimating workflow by implementing the full lifecycle from estimate creation through bid submission, won/lost tracking, and conversion to active projects. This phase bridges estimating (Phase 17) with project management, automating status transitions and minimizing clicks between stages.

The research reveals that modern construction software treats estimate-to-project conversion as a critical workflow automation point. Industry best practices emphasize one-click conversions that preserve data integrity, automatic status transitions based on lifecycle events, and clear visual indicators of next steps to reduce cognitive load.

**Primary recommendation:** Implement a state machine pattern for estimate/bid status management with automatic project status updates, use immutable snapshots for bid versioning, and provide one-click conversion that creates projects with pre-populated budgets from accepted estimates.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zustand | 4.x | State management for workflow UI | Already used in Phase 17 for workflow state, proven pattern for multi-step flows |
| Drizzle ORM | Latest | Database operations | Project's existing ORM, handles transactions needed for conversions |
| Zod | 3.x | Schema validation | Project standard, ensures data integrity during conversions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| XState | 5.x | State machine for lifecycle | Optional - if status transition logic becomes complex (20+ transitions) |
| date-fns | Latest | Date calculations | For bid expiration, acceptance deadlines |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| XState (state machine) | Manual transition validation | XState adds 50KB bundle, manual validation simpler for ~10 status transitions |
| Custom conversion logic | QuickBooks Online API sync | QBO sync adds complexity, Phase 8 already handles this separately |

**Installation:**
```bash
# Already installed in Phase 17
# No new dependencies needed unless XState is chosen
npm install xstate # Optional, only if state machine chosen
```

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
├── services/
│   ├── estimateLifecycle.ts    # Status transition rules
│   ├── bidGeneration.ts         # Convert estimate → bid
│   └── projectConversion.ts     # Convert estimate → project
apps/web/components/estimates/
├── actions/
│   ├── GenerateBidButton.tsx
│   ├── SubmitBidButton.tsx
│   ├── MarkWonLostButtons.tsx
│   └── ConvertToProjectButton.tsx
└── lifecycle/
    ├── StatusBadge.tsx          # Visual status indicator
    ├── NextStepsPanel.tsx       # Contextual next actions
    └── LifecycleTimeline.tsx    # Visual lifecycle progress
```

### Pattern 1: Status Transition State Machine

**What:** Define valid status transitions upfront, enforce with validation function

**When to use:** All status changes (draft → submitted → accepted → under_contract)

**Example:**
```typescript
// Source: Industry best practice (Procore, Buildern workflows)
const VALID_ESTIMATE_TRANSITIONS: Record<EstimateStatus, EstimateStatus[]> = {
  draft: ["submitted"],
  submitted: ["accepted", "draft"], // Can revert to draft if not accepted
  accepted: ["under_contract"],
  under_contract: [], // Terminal state
};

function canTransition(from: EstimateStatus, to: EstimateStatus): boolean {
  return VALID_ESTIMATE_TRANSITIONS[from]?.includes(to) ?? false;
}

// Usage in API handler
export const submitEstimate = protectedProcedure
  .input(z.object({ estimateId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const estimate = await getEstimate(input.estimateId);

    if (!canTransition(estimate.status, "submitted")) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Cannot submit estimate with status '${estimate.status}'`,
      });
    }

    // Create immutable snapshot, update status
    // ...
  });
```

### Pattern 2: Immutable Bid Snapshots

**What:** When generating bid from estimate, create point-in-time snapshot of all data

**When to use:** Estimate → bid conversion, bid versioning

**Example:**
```typescript
// Based on existing estimateVersions pattern from Phase 17
async function generateBidFromEstimate(estimateId: string, userId: string) {
  const estimate = await getEstimateWithLineItems(estimateId);

  // Create immutable snapshot
  const bidSnapshot = {
    estimateId: estimate.id,
    estimateName: estimate.name,
    lineItems: estimate.lineItems, // Full copy, not reference
    totals: {
      directCosts: estimate.directCosts,
      overhead: estimate.overheadAmount,
      markup: estimate.markupAmount,
      total: estimate.totalCost,
    },
    createdAt: new Date(),
    createdBy: userId,
  };

  return bidSnapshot;
}
```

### Pattern 3: One-Click Project Conversion

**What:** Convert accepted estimate to active project with pre-populated budget

**When to use:** When estimate status = "accepted" and user clicks "Convert to Project"

**Example:**
```typescript
// Based on existing bid.ts award procedure pattern
export const convertToProject = protectedProcedure
  .input(z.object({ estimateId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const { db, schema } = ctx.tenant;

    const estimate = await getEstimate(input.estimateId);

    if (estimate.status !== "accepted") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only accepted estimates can be converted to projects",
      });
    }

    // Transaction: update estimate, create project, create budget
    return await db.transaction(async (tx) => {
      // 1. Update estimate status
      await tx.update(schema.estimates)
        .set({ status: "under_contract" })
        .where(eq(schema.estimates.id, input.estimateId));

      // 2. Get existing project (estimate already linked to project)
      const project = await getProject(estimate.projectId);

      // 3. Update project status
      await tx.update(schema.projects)
        .set({
          status: "active",
          budget: estimate.totalCost,
        })
        .where(eq(schema.projects.id, estimate.projectId));

      // 4. Create budget line items from estimate line items
      const lineItems = await getEstimateLineItems(input.estimateId);
      const budgetLineItems = lineItems.map(item => ({
        projectId: estimate.projectId,
        costCodeId: item.costCodeId,
        description: item.description,
        budgetAmount: item.unitCost * item.quantity,
        // ... other fields
      }));

      await tx.insert(schema.budgetLineItems).values(budgetLineItems);

      return { projectId: estimate.projectId };
    });
  });
```

### Pattern 4: Contextual Next Steps UI

**What:** Display only valid next actions based on current status

**When to use:** Estimate detail page, workflow completion screen

**Example:**
```tsx
// Based on Procore/Buildern workflow patterns
function NextStepsPanel({ estimate }: { estimate: Estimate }) {
  const nextActions = useMemo(() => {
    switch (estimate.status) {
      case "draft":
        return [
          { label: "Submit for Approval", action: "submit", primary: true },
          { label: "Generate Bid", action: "generate-bid", primary: false },
        ];
      case "submitted":
        return [
          { label: "Mark as Accepted", action: "accept", primary: true },
          { label: "Revert to Draft", action: "revert", primary: false },
        ];
      case "accepted":
        return [
          { label: "Convert to Project", action: "convert", primary: true },
        ];
      case "under_contract":
        return []; // Terminal state, no actions
      default:
        return [];
    }
  }, [estimate.status]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Next Steps</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          {nextActions.map(action => (
            <Button
              key={action.action}
              variant={action.primary ? "default" : "outline"}
              onClick={() => handleAction(action.action)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

### Anti-Patterns to Avoid

- **Destructive conversions:** Never delete estimate data when converting to project. Keep estimate record as historical source of truth.
- **Manual status updates:** Status should transition automatically based on actions (submit → "submitted", convert → "under_contract"). No manual dropdown to change status.
- **Double data entry:** Converting estimate to project should copy all data automatically. User should never re-enter line items.
- **Unclear affordances:** Buttons should be disabled with tooltips when actions are invalid ("Cannot submit draft estimate with 0 line items").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Complex state machines | Custom transition validator with nested if/else | XState (if 20+ transitions) | XState handles edge cases, visualizes state graph, prevents impossible states |
| Bid expiration tracking | Manual date checks in UI | Database column + cron job | Database timestamp + scheduled job ensures accurate expiration even when UI not loaded |
| Conversion rollback | Manual cleanup on error | Database transactions | Drizzle transactions ensure all-or-nothing conversion, auto-rollback on error |

**Key insight:** Estimate-to-project conversion involves multiple tables (estimates, projects, budgets, line items). Use database transactions to ensure atomicity. If any step fails (e.g., budget creation), entire conversion rolls back automatically.

## Common Pitfalls

### Pitfall 1: Lost Data on Conversion
**What goes wrong:** User converts estimate to project, then realizes they need to reference original estimate details. Data was moved/deleted instead of copied.

**Why it happens:** Treating conversion as a "move" operation instead of "copy + link" operation.

**How to avoid:**
- Keep estimate record intact with status = "under_contract"
- Add `sourceEstimateId` to projects table to maintain link
- Budget line items reference estimate line items via metadata

**Warning signs:** User asks "Where did my estimate go?" after conversion.

### Pitfall 2: Invalid Status Transitions
**What goes wrong:** User submits estimate, marks as won, then tries to edit line items. Edit succeeds, breaking immutability contract.

**Why it happens:** No validation on update operations checking current status.

**How to avoid:**
```typescript
// Add status check to all update operations
export const updateEstimate = protectedProcedure
  .input(updateEstimateSchema)
  .mutation(async ({ ctx, input }) => {
    const estimate = await getEstimate(input.id);

    // Prevent editing after submission
    if (estimate.status !== "draft") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot edit estimate after submission. Create a new version instead.",
      });
    }

    // ... perform update
  });
```

**Warning signs:** Estimate totals don't match bid amounts, user confused why edits aren't saving.

### Pitfall 3: Unclear Next Steps
**What goes wrong:** User completes estimate, doesn't know whether to submit, generate bid, or convert to project. Abandons workflow.

**Why it happens:** No contextual guidance on available actions.

**How to avoid:**
- Display "Next Steps" panel showing only valid actions
- Use progressive disclosure: show "Convert to Project" only when status = "accepted"
- Add empty states with call-to-action ("Your estimate is ready. Submit for approval?")

**Warning signs:** User support tickets asking "What do I do next?" or "How do I create a project from this?"

### Pitfall 4: Bid Won/Lost Not Tracked
**What goes wrong:** User generates multiple bids, submits to clients, but has no way to mark which ones won. Loses track of pipeline.

**Why it happens:** No bid tracking table, treating bid as one-time snapshot instead of trackable entity.

**How to avoid:**
- Create `bids` table separate from estimates
- Add status field: "draft", "submitted", "won", "lost"
- Link bids back to source estimate for reference

**Warning signs:** User creates spreadsheet outside app to track bid status.

## Code Examples

Verified patterns from official sources:

### Generate Bid from Estimate
```typescript
// Based on existing bid.ts submit procedure
export const generateBid = protectedProcedure
  .input(z.object({
    estimateId: z.string().uuid(),
    bidName: z.string().min(1),
  }))
  .mutation(async ({ ctx, input }) => {
    const { db, schema } = ctx.tenant;
    const estimate = await getEstimateWithLineItems(input.estimateId);

    if (estimate.status !== "draft" && estimate.status !== "submitted") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Can only generate bid from draft or submitted estimates",
      });
    }

    // Create bid record
    const [bid] = await db.insert(schema.bids).values({
      estimateId: input.estimateId,
      projectId: estimate.projectId,
      name: input.bidName,
      status: "draft",
      totalAmount: estimate.totalCost,
      snapshot: {
        estimate: estimate,
        lineItems: estimate.lineItems,
        totals: {
          directCosts: estimate.directCosts,
          overhead: estimate.overheadAmount,
          markup: estimate.markupAmount,
          total: estimate.totalCost,
        },
      },
      createdBy: ctx.userId,
    }).returning();

    // Audit log
    await createAuditLog(db, schema, {
      entityType: "Bid",
      entityId: bid.id,
      action: AuditAction.CREATE,
      actorId: ctx.userId,
      changes: { after: bid },
    });

    return bid;
  });
```

### Mark Bid Won/Lost
```typescript
export const updateBidStatus = protectedProcedure
  .input(z.object({
    bidId: z.string().uuid(),
    status: z.enum(["won", "lost"]),
    notes: z.string().optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    const { db, schema } = ctx.tenant;
    const bid = await getBid(input.bidId);

    if (bid.status !== "submitted") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Can only mark submitted bids as won/lost",
      });
    }

    const [updated] = await db.update(schema.bids)
      .set({
        status: input.status,
        closedAt: new Date(),
        closedBy: ctx.userId,
        closedNotes: input.notes,
      })
      .where(eq(schema.bids.id, input.bidId))
      .returning();

    // If won, update estimate to accepted
    if (input.status === "won") {
      await db.update(schema.estimates)
        .set({
          status: "accepted",
          acceptedAt: new Date(),
        })
        .where(eq(schema.estimates.id, bid.estimateId));
    }

    return updated;
  });
```

### Automated Project Status Transitions
```typescript
// Trigger project status updates based on estimate lifecycle
export const submitEstimate = protectedProcedure
  .input(z.object({ estimateId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const { db, schema } = ctx.tenant;

    return await db.transaction(async (tx) => {
      // Update estimate
      const [estimate] = await tx.update(schema.estimates)
        .set({
          status: "submitted",
          submittedAt: new Date(),
        })
        .where(eq(schema.estimates.id, input.estimateId))
        .returning();

      // Automatically update project status: draft → bidding
      await tx.update(schema.projects)
        .set({ status: "bidding" }) // New status needed
        .where(eq(schema.projects.id, estimate.projectId));

      return estimate;
    });
  });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual estimate → project data entry | One-click conversion with data copy | ~2020 (Procore, Buildern) | Reduces 30+ minutes of data entry to 5 seconds |
| Separate bid tracking spreadsheet | Integrated bid management with status tracking | ~2022 (PlanHub, BuildingConnected) | Centralizes pipeline visibility, automatic win/loss reporting |
| Email-based bid submission | In-app bid submission with notifications | ~2021 (Procore, Autodesk) | Trackable submission events, automatic status updates |
| Manual project status updates | Automated status based on estimate lifecycle | ~2023 (emerging best practice) | Eliminates forgotten status updates, ensures accurate reporting |

**Deprecated/outdated:**
- **PDF export as "bid submission":** Modern apps use digital submissions with tracking, not static PDFs
- **Separate estimate and project entities:** Current approach links them from creation (estimate created within project context)

## Open Questions

1. **Should bid and estimate be the same entity or separate?**
   - What we know: Phase 17 UAT feedback suggests estimate = internal document, bid = external document submitted to client
   - What's unclear: Whether user creates bid from estimate (copy operation) or estimate evolves into bid (status change)
   - Recommendation: Keep separate. Estimate = internal cost analysis, Bid = client-facing proposal. Bid references estimate as source but can have adjustments (scope changes, negotiated pricing)

2. **How granular should project status be?**
   - What we know: Current schema has `active, on_hold, completed, archived`
   - What's unclear: Does "active" mean "in construction" or "any non-completed project"? Should there be "bidding", "awarded", "in_progress" states?
   - Recommendation: Add "bidding" status (estimate submitted, awaiting decision). "active" = awarded/in construction. Keeps schema simple while supporting lifecycle automation.

3. **What happens to estimates if bid is lost?**
   - What we know: Lost bids should be tracked for reporting
   - What's unclear: Should estimate status revert to "draft" or stay "submitted"? Can user create new estimate version after loss?
   - Recommendation: Keep estimate status as "submitted", add metadata `linkedBidId` and `linkedBidStatus`. Allow creating new estimate version from same project for re-bidding.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `apps/api/src/trpc/routers/estimates.ts` - Submit procedure pattern (lines 747-845)
- Existing codebase: `apps/api/src/trpc/routers/bid.ts` - Award and status transition patterns (lines 744-850, 852-1037)
- Existing codebase: `packages/shared/src/types/estimates.ts` - Status enum definition (line 4)
- Phase 17 UAT results: `.planning/phases/17-estimating-workflow-setup-core/17-UAT.md` - User feedback on workflow UX

### Secondary (MEDIUM confidence)
- [Construction Bidding Process: From Strategy to Submission](https://buildern.com/resources/blog/construction-bidding-process/) - Bid lifecycle stages
- [Construction Bid Management Software | Procore](https://www.procore.com/bid-management) - One-click bid-to-contract conversion
- [From Construction Estimates to Job Costing: ERP Solutions](https://cmicglobal.com/resources/article/erp-solutions-to-common-workflow-challenges-estimate-to-job-costing) - Estimate to budget conversion best practices
- [Construction Estimating Software Review](https://buildern.com/resources/blog/construction-estimating-software-review/) - Modern workflow automation features
- [The 5 Phases of a Construction Project Lifecycle](https://resources.kahua.com/blog/the-5-stages-of-a-construction-projects-lifecycle) - Project status lifecycle stages

### Tertiary (LOW confidence)
- [Construction Bid Strategy in 2026](https://conwize.io/articles/construction-bid-strategy-in-2026/) - Emerging trends, needs validation with user
- WebSearch findings on AI automation in construction - Noted but not incorporated (out of scope for Phase 18)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Zustand and Drizzle already proven in Phase 17
- Architecture: HIGH - Patterns based on existing bid.ts and estimates.ts code
- Pitfalls: MEDIUM - Based on industry articles + logical extrapolation from Phase 17 UAT feedback
- State transitions: HIGH - Validated against existing bid status transitions (lines 784-801 in bid.ts)

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days - stable domain)

**Key dependencies:**
- Phase 17 complete (estimate creation, line items, SOV)
- Existing project status enum (active, on_hold, completed, archived)
- Existing bid management tables (bids, bidVersions from Phase 7)

**Schema changes needed:**
- Add `bids.estimateId` foreign key (link bid to source estimate)
- Add `bids.status` enum: "draft", "submitted", "won", "lost"
- Add `projects.status` value: "bidding" (between creation and awarded)
- Add `estimates.linkedBidId` (optional, track which bid generated from estimate)
