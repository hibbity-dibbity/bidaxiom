# Phase 4: Budget & Cost Tracking - Research

**Researched:** 2026-02-12
**Domain:** Construction budget management, cost tracking, committed costs, and financial forecasting
**Confidence:** MEDIUM-HIGH

## Summary

Phase 4 implements the financial core of the construction management platform. Users must be able to create project budgets with line items mapped to CSI cost codes, track actuals versus committed costs in real-time, manage subcontracts and purchase orders as commitments, generate cost-to-complete forecasts using earned value principles, and lock budget line items once payment applications are created to ensure financial integrity. This phase extends the existing project management foundation with budget tables, commitment tracking, variance analysis, and real-time dashboard reporting.

The implementation presents four key challenges: (1) decimal precision must be exact for financial calculations without floating-point errors, (2) committed costs from subcontracts and purchase orders must be tracked separately from actuals, (3) budget variance alerts must trigger at configurable thresholds to catch overruns early, and (4) budget line items must lock after payment application creation while preserving the ability to make changes via formal change orders. Research indicates that construction budget management follows a three-tier cost tracking model (budget → committed → actual) and relies heavily on CSI MasterFormat cost codes for standardization across the industry.

**Primary recommendation:** Use PostgreSQL NUMERIC(15,2) for all currency values to ensure exact decimal precision, implement a three-tier cost tracking model with separate tables for budget line items, commitments (subcontracts/POs), and actuals (payment applications), use company-configurable CSI divisions with custom cost code support, calculate variances and forecasts using materialized views for performance, implement budget line item locking with version control, and build real-time budget dashboards with Recharts waterfall charts showing budget vs committed vs actual flows.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | Current (0.45.1+) | Budget schema, cost code relationships, commitment tracking | Already in use; excellent PostgreSQL NUMERIC support with typed aggregations |
| tRPC | Current (11.10.0+) | Type-safe budget CRUD, commitment creation, variance reporting APIs | Already in use; end-to-end type safety with React Query integration |
| CASL | Current (6.8.0+) | Budget access control, commitment approval permissions | Already in use; supports entity-level permissions for financial data |
| Zod | Current (3.25.76+) | Budget line item validation, cost code schemas, PO/subcontract validation | Already in use; runtime validation with TypeScript inference |
| PostgreSQL NUMERIC | Built-in | Exact decimal precision for currency (no floating-point errors) | Industry standard for financial applications; PostgreSQL 16+ recommended |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Recharts | ^2.15.0 | Budget variance charts, waterfall visualizations, variance dashboards | Dashboard visualization; declarative React charts built on D3 |
| date-fns | ^3.x | Date range calculations for forecasting, period comparisons | Already in use from Phase 3; lightweight date manipulation |
| Zod Transform | Built-in | Transform string currency inputs to PostgreSQL NUMERIC | Form input handling; convert "$1,234.56" to numeric |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PostgreSQL NUMERIC | Store cents as BIGINT | Integer storage is faster but requires application-layer conversion and complicates reporting |
| Materialized views | Real-time aggregation on every query | Real-time is always current but slower for complex multi-table aggregations |
| Recharts | D3.js directly, Victory, Nivo | D3 offers more control but steeper learning curve; Recharts balances ease and flexibility |
| Budget line locking | Soft delete + immutable history | Soft delete is simpler but doesn't enforce change order workflow |
| Separate budget versions table | In-place updates with audit logs | Version table is more explicit but adds JOIN complexity |

**Installation:**
```bash
# New dependencies for Phase 4
pnpm add recharts
pnpm add -D @types/recharts

# Already installed from Phase 3
# date-fns, zod, drizzle-orm, @casl/ability
```

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
├── db/schema/
│   ├── tenant.ts              # Add budget, budget_line_items, commitments, commitment_line_items
│   └── seed/
│       └── csi-cost-codes.ts  # CSI MasterFormat division seed data
├── trpc/routers/
│   ├── budget.ts              # Budget CRUD, line item management, variance reporting
│   ├── commitment.ts          # Subcontract/PO creation, line item tracking
│   └── forecast.ts            # Cost-to-complete calculations, EAC/ETC metrics
├── calculations/
│   ├── variance.ts            # Budget vs actual vs committed variance calculations
│   ├── forecast.ts            # EAC, ETC, CPI calculations using earned value
│   └── aggregations.ts        # Helper functions for cost rollups by cost code
└── auth/
    └── abilities.ts           # UPDATED: Budget and commitment permissions

apps/web/app/(dashboard)/
├── projects/
│   └── [projectId]/
│       ├── budget/
│       │   ├── page.tsx       # Budget dashboard with variance charts
│       │   ├── line-items/
│       │   │   └── page.tsx   # Budget line item editor with cost code mapping
│       │   └── forecast/
│       │       └── page.tsx   # Cost-to-complete forecast dashboard
│       └── commitments/
│           ├── page.tsx       # Commitment list (subcontracts + POs)
│           └── new/
│               └── page.tsx   # Commitment creation form
└── components/
    └── budget/
        ├── budget-variance-chart.tsx    # Recharts waterfall chart
        ├── budget-line-item-table.tsx   # Editable table with cost code selector
        ├── commitment-form.tsx          # Subcontract/PO creation form
        └── forecast-metrics.tsx         # EAC, ETC, CPI, variance indicators
```

### Pattern 1: Three-Tier Cost Tracking Model
**What:** Track project costs across three distinct tiers: budget (planned), committed (contractually obligated), and actual (invoiced/paid). This provides early warning when commitments exceed budget before money is actually spent.

**When to use:** All construction project budget management; industry-standard approach.

**Example:**
```typescript
// apps/api/src/db/schema/tenant.ts
export function createTenantSchema(schemaName: string) {
  const schema = pgSchema(schemaName);

  /**
   * Budget line items with CSI cost code mapping
   * Each line item represents a budget allocation for a specific cost code
   */
  const budgetLineItems = schema.table("budget_line_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    costCodeId: integer("cost_code_id").notNull(), // 0-49 for CSI divisions, 50+ for custom
    description: text("description").notNull(),
    budgetedAmount: numeric("budgeted_amount", { precision: 15, scale: 2 }).notNull(),
    isLocked: boolean("is_locked").notNull().default(false), // Locked after payment app
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Commitments: subcontracts and purchase orders
   * Tracks financial commitments before actual costs are incurred
   */
  const commitments = schema.table("commitments", {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'subcontract' or 'purchase_order'
    vendorName: text("vendor_name").notNull(),
    contractNumber: text("contract_number"),
    totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
    status: text("status").notNull().default("pending"), // pending, approved, executed, closed
    executedAt: timestamp("executed_at", { withTimezone: true }),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  /**
   * Commitment line items: map commitments to budget line items
   * Allows tracking committed costs against specific budget allocations
   */
  const commitmentLineItems = schema.table("commitment_line_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    commitmentId: uuid("commitment_id").notNull().references(() => commitments.id, { onDelete: "cascade" }),
    budgetLineItemId: uuid("budget_line_item_id").references(() => budgetLineItems.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  });

  return {
    schema,
    budgetLineItems,
    commitments,
    commitmentLineItems,
    // ... existing tables
  };
}

// Query example: Calculate three-tier costs for a project
const costSummary = await tenantDb
  .select({
    costCode: budgetLineItems.costCodeId,
    budgeted: sql<number>`COALESCE(SUM(${budgetLineItems.budgetedAmount}), 0)`,
    committed: sql<number>`COALESCE(SUM(${commitmentLineItems.amount}), 0)`,
    // Actuals would come from payment applications (Phase 6)
    variance: sql<number>`
      COALESCE(SUM(${budgetLineItems.budgetedAmount}), 0) -
      COALESCE(SUM(${commitmentLineItems.amount}), 0)
    `,
  })
  .from(budgetLineItems)
  .leftJoin(commitmentLineItems, eq(commitmentLineItems.budgetLineItemId, budgetLineItems.id))
  .where(eq(budgetLineItems.projectId, projectId))
  .groupBy(budgetLineItems.costCodeId);
```

**Source:** [Construction Cost Management](https://www.foundationsoft.com/learn/job-costs-purchase-orders/), [Committed Costs Reporting](https://www.mastt.com/blogs/tracking-committed-costs)

### Pattern 2: Budget Line Item Locking with Change Order Integration
**What:** Lock budget line items after payment applications are created against them. Changes to locked items require formal change orders, preserving audit trail and preventing unauthorized budget modifications.

**When to use:** Financial integrity requirements; prevents budget manipulation after commitments are made.

**Example:**
```typescript
// apps/api/src/trpc/routers/budget.ts
export const budgetRouter = router({
  updateLineItem: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      budgetedAmount: z.number().positive(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { userId, tenant } = ctx;

      // Fetch line item and check lock status
      const [lineItem] = await tenant.db
        .select()
        .from(budgetLineItems)
        .where(eq(budgetLineItems.id, input.id));

      if (!lineItem) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Budget line item not found" });
      }

      // CRITICAL: Prevent modification of locked items
      if (lineItem.isLocked) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Budget line item is locked. Use change order to modify.",
        });
      }

      // Verify project access
      ForbiddenError.from(ctx.abilities).throwUnlessCan("update", "Budget", {
        projectId: lineItem.projectId,
      });

      // Update line item
      const [updated] = await tenant.db
        .update(budgetLineItems)
        .set({
          budgetedAmount: input.budgetedAmount.toString(),
          description: input.description ?? lineItem.description,
          updatedAt: new Date(),
        })
        .where(eq(budgetLineItems.id, input.id))
        .returning();

      // Audit log
      await ctx.tenant.auditLog({
        entityType: "BudgetLineItem",
        entityId: updated.id,
        action: "update",
        actorId: userId,
        changes: {
          before: { budgetedAmount: lineItem.budgetedAmount },
          after: { budgetedAmount: updated.budgetedAmount },
        },
      });

      return updated;
    }),

  lockLineItem: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Called when payment application is created (Phase 6)
      const [locked] = await ctx.tenant.db
        .update(budgetLineItems)
        .set({
          isLocked: true,
          lockedAt: new Date(),
          lockedBy: ctx.userId,
        })
        .where(eq(budgetLineItems.id, input.id))
        .returning();

      return locked;
    }),
});
```

**Source:** [Budget Line Item Locking](https://support.procore.com/products/online/user-guide/project-level/budget/tutorials/set-up-a-budget), [Construction Budget Best Practices](https://buildern.com/resources/blog/construction-budgeting-guide/)

### Pattern 3: Company-Configurable Cost Codes with CSI Defaults
**What:** Store company cost code configuration in company_profiles with CSI MasterFormat divisions as defaults, plus custom codes. Projects select from their company's available codes at creation time.

**When to use:** Multi-company SaaS where each company has different trade specializations and cost tracking requirements.

**Example:**
```typescript
// packages/shared/src/types/cost-codes.ts
export const csiDivisionSchema = z.object({
  division: z.number().int().min(0).max(49),
  name: z.string(),
  description: z.string(),
});

export const customCostCodeSchema = z.object({
  id: z.number().int().min(50), // Custom codes start at 50
  name: z.string().max(100),
  description: z.string().max(500),
  isActive: z.boolean().default(true),
});

export const costCodeConfigSchema = z.object({
  enabledCsiDivisions: z.array(z.number().int().min(0).max(49)).default([]),
  customCodes: z.array(customCostCodeSchema).default([]),
});

export type CostCodeConfig = z.infer<typeof costCodeConfigSchema>;

// CSI MasterFormat 2020 divisions (seed data)
export const CSI_DIVISIONS = [
  { division: 0, name: "Procurement and Contracting Requirements", description: "General requirements" },
  { division: 1, name: "General Requirements", description: "Administrative and temporary facilities" },
  { division: 2, name: "Existing Conditions", description: "Demolition and site remediation" },
  { division: 3, name: "Concrete", description: "Concrete forming and placement" },
  { division: 4, name: "Masonry", description: "Brick, block, and stone masonry" },
  { division: 5, name: "Metals", description: "Structural steel and metal fabrications" },
  { division: 6, name: "Wood, Plastics, and Composites", description: "Rough and finish carpentry" },
  { division: 7, name: "Thermal and Moisture Protection", description: "Insulation, roofing, siding" },
  { division: 8, name: "Openings", description: "Doors, windows, and glazing" },
  { division: 9, name: "Finishes", description: "Drywall, painting, flooring, ceilings" },
  { division: 10, name: "Specialties", description: "Toilet accessories, signage, lockers" },
  { division: 11, name: "Equipment", description: "Commercial and institutional equipment" },
  { division: 12, name: "Furnishings", description: "Casework, window treatments, furniture" },
  { division: 13, name: "Special Construction", description: "Pools, fountains, special structures" },
  { division: 14, name: "Conveying Equipment", description: "Elevators, escalators, lifts" },
  // ... continues through division 49
  { division: 21, name: "Fire Suppression", description: "Fire sprinklers and suppression systems" },
  { division: 22, name: "Plumbing", description: "Plumbing fixtures and piping" },
  { division: 23, name: "HVAC", description: "Heating, ventilation, and air conditioning" },
  { division: 26, name: "Electrical", description: "Electrical power and lighting" },
  { division: 27, name: "Communications", description: "Data, voice, and security systems" },
  { division: 28, name: "Electronic Safety and Security", description: "Fire alarms, access control" },
  { division: 31, name: "Earthwork", description: "Excavation, grading, and soil treatment" },
  { division: 32, name: "Exterior Improvements", description: "Paving, landscaping, site utilities" },
  { division: 33, name: "Utilities", description: "Water, sewer, and power distribution" },
] as const;

// apps/api/src/db/schema/tenant.ts - Add to companyProfiles
const companyProfiles = schema.table("company_profiles", {
  // ... existing fields
  costCodeConfig: jsonb("cost_code_config")
    .$type<CostCodeConfig>()
    .default({ enabledCsiDivisions: [], customCodes: [] }),
});
```

**Source:** [CSI MasterFormat 2026 Guide](https://archdesk.com/blog/2026-guide-csi-masterformat), [Construction Cost Code Customization](https://www.redhammer.io/blog/creating-effective-construction-cost-codes-a-strategic-approach-for-business-success)

### Pattern 4: Cost-to-Complete Forecasting with Earned Value Management
**What:** Calculate Estimate at Completion (EAC) and Estimate to Complete (ETC) using earned value principles. Use Cost Performance Index (CPI) to project final costs based on current spending trends.

**When to use:** Financial forecasting and variance analysis; provides early warning of budget overruns.

**Example:**
```typescript
// apps/api/src/calculations/forecast.ts
import type { TenantSchema } from "../db/schema/tenant.js";

interface ForecastMetrics {
  budgetAtCompletion: number;  // BAC - Original budget
  earnedValue: number;         // EV - Value of work completed
  actualCost: number;          // AC - Money spent so far
  committedCost: number;       // Money contractually committed
  costPerformanceIndex: number; // CPI = EV / AC
  estimateAtCompletion: number; // EAC = BAC / CPI
  estimateToComplete: number;   // ETC = EAC - AC
  varianceAtCompletion: number; // VAC = BAC - EAC
}

export async function calculateForecast(
  projectId: string,
  tenantDb: TenantSchema["db"]
): Promise<ForecastMetrics> {
  // Get total budget
  const budgetResult = await tenantDb
    .select({
      total: sql<number>`COALESCE(SUM(${budgetLineItems.budgetedAmount}::numeric), 0)`,
    })
    .from(budgetLineItems)
    .where(eq(budgetLineItems.projectId, projectId));

  const budgetAtCompletion = Number(budgetResult[0].total);

  // Get committed costs (subcontracts + POs)
  const committedResult = await tenantDb
    .select({
      total: sql<number>`COALESCE(SUM(${commitments.totalAmount}::numeric), 0)`,
    })
    .from(commitments)
    .where(
      and(
        eq(commitments.projectId, projectId),
        eq(commitments.status, "executed")
      )
    );

  const committedCost = Number(committedResult[0].total);

  // Actual costs come from payment applications (Phase 6)
  // For now, use committed costs as proxy
  const actualCost = committedCost;

  // Earned value: simplified as % complete * budget
  // In production, would calculate based on completed work
  const earnedValue = budgetAtCompletion * 0.5; // Placeholder

  // Cost Performance Index: efficiency of spending
  const costPerformanceIndex = earnedValue > 0 ? earnedValue / actualCost : 1;

  // Estimate at Completion: projected final cost
  const estimateAtCompletion = costPerformanceIndex > 0
    ? budgetAtCompletion / costPerformanceIndex
    : budgetAtCompletion;

  // Estimate to Complete: remaining cost to finish
  const estimateToComplete = estimateAtCompletion - actualCost;

  // Variance at Completion: expected over/under budget
  const varianceAtCompletion = budgetAtCompletion - estimateAtCompletion;

  return {
    budgetAtCompletion,
    earnedValue,
    actualCost,
    committedCost,
    costPerformanceIndex,
    estimateAtCompletion,
    estimateToComplete,
    varianceAtCompletion,
  };
}
```

**Source:** [Earned Value Management 2026](https://www.bigtime.net/blogs/earned-value-management-system/), [Cost Forecasting Construction](https://www.projectmanager.com/blog/cost-forecasting-construction-project-management)

### Pattern 5: Budget Variance Alerts with Configurable Thresholds
**What:** Trigger alerts when budget variance exceeds company-configurable thresholds (e.g., 10% warning, 20% critical). Detect problems early before they become unrecoverable.

**When to use:** Proactive budget monitoring; industry best practice to catch overruns at 10% vs discovering at 30%.

**Example:**
```typescript
// apps/api/src/calculations/variance.ts
interface VarianceAlert {
  budgetLineItemId: string;
  costCode: number;
  description: string;
  budgeted: number;
  committed: number;
  variance: number;
  variancePercent: number;
  severity: "warning" | "critical" | "ok";
}

export async function checkBudgetVariances(
  projectId: string,
  tenantDb: TenantSchema["db"],
  thresholds: { warning: number; critical: number } = { warning: 0.10, critical: 0.20 }
): Promise<VarianceAlert[]> {
  // Query budget vs committed by line item
  const variances = await tenantDb
    .select({
      id: budgetLineItems.id,
      costCode: budgetLineItems.costCodeId,
      description: budgetLineItems.description,
      budgeted: sql<number>`${budgetLineItems.budgetedAmount}::numeric`,
      committed: sql<number>`COALESCE(SUM(${commitmentLineItems.amount}::numeric), 0)`,
    })
    .from(budgetLineItems)
    .leftJoin(
      commitmentLineItems,
      eq(commitmentLineItems.budgetLineItemId, budgetLineItems.id)
    )
    .where(eq(budgetLineItems.projectId, projectId))
    .groupBy(budgetLineItems.id, budgetLineItems.costCodeId, budgetLineItems.description, budgetLineItems.budgetedAmount);

  // Calculate variance and severity
  return variances.map((v) => {
    const variance = Number(v.budgeted) - Number(v.committed);
    const variancePercent = Number(v.budgeted) > 0
      ? Math.abs(variance) / Number(v.budgeted)
      : 0;

    let severity: "ok" | "warning" | "critical" = "ok";
    if (variance < 0) {
      // Over budget
      if (variancePercent >= thresholds.critical) {
        severity = "critical";
      } else if (variancePercent >= thresholds.warning) {
        severity = "warning";
      }
    }

    return {
      budgetLineItemId: v.id,
      costCode: v.costCode,
      description: v.description,
      budgeted: Number(v.budgeted),
      committed: Number(v.committed),
      variance,
      variancePercent,
      severity,
    };
  });
}

// tRPC procedure to get alerts
export const budgetRouter = router({
  getVarianceAlerts: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const alerts = await checkBudgetVariances(
        input.projectId,
        ctx.tenant.db
      );

      // Filter to only warnings and critical
      return alerts.filter(a => a.severity !== "ok");
    }),
});
```

**Source:** [Budget Overrun Alerts](https://smartbarrel.io/blog/construction-productivity-tracking/), [Early Warning Systems](https://monograph.com/blog/budget-overrun-prevention-ae-projects)

### Pattern 6: Materialized Views for Budget Reporting Performance
**What:** Use PostgreSQL materialized views to pre-compute complex budget aggregations (budget by cost code, variance by phase, commitment summary). Refresh on schedule or after significant changes.

**When to use:** Budget dashboards with complex joins and aggregations; trading data freshness for query performance.

**Example:**
```typescript
// apps/api/src/db/migrations/create-budget-summary-view.sql
CREATE MATERIALIZED VIEW tenant_abc123.budget_summary AS
SELECT
  bli.project_id,
  bli.cost_code_id,
  SUM(bli.budgeted_amount) AS total_budgeted,
  COALESCE(SUM(cli.amount), 0) AS total_committed,
  SUM(bli.budgeted_amount) - COALESCE(SUM(cli.amount), 0) AS variance,
  COUNT(DISTINCT c.id) AS commitment_count
FROM budget_line_items bli
LEFT JOIN commitment_line_items cli ON cli.budget_line_item_id = bli.id
LEFT JOIN commitments c ON c.id = cli.commitment_id AND c.status = 'executed'
GROUP BY bli.project_id, bli.cost_code_id;

-- Create index for fast lookups
CREATE INDEX idx_budget_summary_project ON tenant_abc123.budget_summary(project_id);

-- Refresh command (run after budget/commitment changes)
REFRESH MATERIALIZED VIEW tenant_abc123.budget_summary;

// apps/api/src/db/schema/tenant.ts
// Query materialized view instead of complex joins
export async function getBudgetSummary(projectId: string, tenantDb: Database) {
  // First, refresh materialized view
  await tenantDb.execute(sql`REFRESH MATERIALIZED VIEW budget_summary`);

  // Then query pre-computed results
  return await tenantDb.execute(
    sql`SELECT * FROM budget_summary WHERE project_id = ${projectId}`
  );
}
```

**Source:** [PostgreSQL Materialized Views](https://www.postgresql.org/docs/current/rules-materializedviews.html), [Materialized Views Guide](https://www.epsio.io/blog/postgres-materialized-views-basics-tutorial-and-optimization-tips)

### Anti-Patterns to Avoid

- **Floating-point for currency:** JavaScript `number` and PostgreSQL `REAL`/`DOUBLE` introduce rounding errors (0.1 + 0.2 !== 0.3). Always use PostgreSQL `NUMERIC` and handle as strings or libraries like decimal.js in critical calculations.
- **Budget modifications without audit trail:** Direct updates to budget amounts bypass accountability. Always log changes to audit_logs with before/after values.
- **Hard-coded variance thresholds:** Companies have different risk tolerances. Store thresholds in company_profiles (e.g., 5% for high-risk, 15% for low-risk projects).
- **Calculating actuals without payment applications:** Using commitment amounts as actuals inflates costs. Wait for Phase 6 payment applications to track true actuals.
- **No validation on locked budget edits:** Forgetting to check `isLocked` allows budget manipulation after payment apps. Always verify lock status before updates.
- **Real-time aggregation on every dashboard load:** Complex 5+ table JOINs slow down dashboards. Use materialized views refreshed periodically (every 15 minutes or on mutation).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decimal precision | Custom money class with string math | PostgreSQL NUMERIC + Zod transform | NUMERIC is battle-tested for finance; handles precision edge cases (division, rounding) correctly |
| Currency formatting | String manipulation with regex | Intl.NumberFormat API | Handles locales, currency symbols, decimal separators; browsers have optimized implementations |
| Cost variance formulas | Custom budget math | Earned Value Management formulas (EAC, ETC, CPI) | EVM is construction industry standard; auditors expect these metrics |
| Budget waterfall charts | Custom SVG rendering | Recharts waterfall (or stacked bar) | Waterfall charts require complex positioning math; Recharts handles responsive + interactive |
| Cost code hierarchy | Recursive tree queries | PostgreSQL JSONB array + denormalization | CSI divisions are flat (0-49); custom codes are shallow (1-2 levels); JSONB is simpler than recursive CTEs |

**Key insight:** Construction budget tracking has been standardized by CFMA (Construction Financial Management Association) and implemented by Procore, Foundation, CMiC. Don't invent novel cost tracking models—follow the three-tier budget/committed/actual pattern and EVM forecasting formulas used across the industry.

## Common Pitfalls

### Pitfall 1: Floating-Point Precision Errors in Budget Calculations
**What goes wrong:** Using JavaScript `number` or PostgreSQL `REAL`/`DOUBLE` for currency causes rounding errors that compound over hundreds of line items, leading to "missing pennies" and financial reconciliation headaches.

**Why it happens:** Developers default to `number` type without understanding IEEE 754 floating-point representation cannot exactly represent decimal fractions like 0.1.

**How to avoid:**
- Use PostgreSQL `NUMERIC(15,2)` for all currency columns (budgeted_amount, total_amount, etc.)
- Use Zod `.transform()` to convert string inputs to numeric before database insert
- For client-side calculations, use `decimal.js` or keep values as strings until final display
- Never use `toFixed()` for calculations, only for display formatting

**Warning signs:**
- Budget totals don't match sum of line items (off by $0.01 or more)
- Variance calculations show tiny errors like -$0.000000001
- Database schema uses `REAL`, `DOUBLE PRECISION`, or JavaScript `number` for currency

**Source:** [PostgreSQL NUMERIC Best Practices](https://www.crunchydata.com/blog/working-with-money-in-postgres)

### Pitfall 2: Committed Costs Not Tracked Separately from Actuals
**What goes wrong:** Treating purchase orders and subcontracts as "actual costs" before invoices are paid inflates cost reports and hides true cash flow, leading to budget overrun surprises when invoices arrive.

**Why it happens:** Confusion between contractual obligations (commitments) and cash outflows (actuals); skipping the three-tier model to simplify implementation.

**How to avoid:**
- Separate `commitments` table from payment applications (Phase 6)
- Dashboard shows three columns: Budget | Committed | Actual | Remaining
- Committed = executed subcontracts + POs; Actual = approved payment applications
- Variance = Budget - (Committed + Forecasted Remaining)

**Warning signs:**
- Budget reports only show two columns (budget vs actual)
- Subcontracts and POs directly update "actual cost" fields
- No way to see money contractually committed but not yet invoiced

**Source:** [Committed Costs Tracking](https://www.mastt.com/blogs/tracking-committed-costs), [CFMA Committed Cost Best Practices](https://www.foundationsoft.com/learn/job-costs-purchase-orders/)

### Pitfall 3: Budget Line Items Not Locked After Payment Applications
**What goes wrong:** Users reduce budget line items after payment applications are created to hide overruns, making historical reports inaccurate and audit trails incomplete.

**Why it happens:** Lack of enforcement; trusting users not to manipulate budgets maliciously or accidentally.

**How to avoid:**
- Add `isLocked` boolean and `lockedAt` timestamp to `budget_line_items`
- Lock line item when first payment application references it (Phase 6)
- Enforce lock in tRPC mutation with clear error: "Use change order to modify locked budget"
- Change orders (Phase 5) are the ONLY way to modify locked budgets
- Add verification check: locked items cannot be updated without approved change order

**Warning signs:**
- Budget line items can be edited without restriction
- No lock status indicator in database schema
- No integration between budgets and payment applications

**Source:** [Procore Budget Locking](https://support.procore.com/products/online/user-guide/project-level/budget/tutorials/set-up-a-budget)

### Pitfall 4: No Variance Threshold Alerts Leading to Late Discovery
**What goes wrong:** Teams don't notice budget overruns until 30-50% over budget, when recovery is impossible. No proactive alerts at 10-20% thresholds where corrective action is feasible.

**Why it happens:** Dashboards show variance but don't actively alert; users must manually check reports daily.

**How to avoid:**
- Implement variance threshold checks on every commitment creation
- Store thresholds in company_profiles (warning: 10%, critical: 20%)
- tRPC mutation throws warning (not error) when commitment would exceed threshold
- Frontend shows confirmation dialog: "This commitment exceeds budget by 15%. Proceed?"
- Dashboard shows variance alerts prominently with red/yellow indicators
- Optional: Email notifications when critical threshold is breached

**Warning signs:**
- No variance alert logic in commitment creation flow
- Thresholds are hard-coded or non-existent
- Users discover overruns via monthly reports instead of real-time alerts

**Source:** [Budget Alert Best Practices](https://smartbarrel.io/blog/construction-productivity-tracking/), [Early Warning Systems](https://monograph.com/blog/budget-overrun-prevention-ae-projects)

### Pitfall 5: Complex Aggregations Without Materialized Views Causing Slow Dashboards
**What goes wrong:** Budget dashboard loads take 5-10 seconds because every page load recalculates 5+ table JOINs across thousands of budget line items, commitments, and payment applications.

**Why it happens:** Over-normalization without performance optimization; assuming PostgreSQL can always handle complex queries in real-time.

**How to avoid:**
- Create materialized views for dashboard queries (budget summary, variance by cost code)
- Refresh materialized view after budget/commitment mutations (not on every read)
- Use `REFRESH MATERIALIZED VIEW CONCURRENTLY` to avoid locking table during refresh
- Add indexes on materialized view for fast lookups (project_id, cost_code_id)
- For very large projects, schedule background refresh every 15 minutes instead of mutation-triggered

**Warning signs:**
- Budget dashboard takes >2 seconds to load
- Database query logs show multi-second queries with 5+ JOINs
- Same aggregation query runs on every page load instead of cached results

**Source:** [PostgreSQL Materialized Views Performance](https://www.epsio.io/blog/postgres-materialized-views-basics-tutorial-and-optimization-tips)

## Code Examples

Verified patterns from official sources:

### Budget Line Item Creation with Cost Code Validation
```typescript
// apps/api/src/trpc/routers/budget.ts
import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { budgetLineItems } from "../../db/schema/tenant.js";

const createBudgetLineItemSchema = z.object({
  projectId: z.string().uuid(),
  costCodeId: z.number().int().min(0), // 0-49 CSI, 50+ custom
  description: z.string().min(1).max(500),
  budgetedAmount: z.number().positive(),
});

export const budgetRouter = router({
  createLineItem: protectedProcedure
    .input(createBudgetLineItemSchema)
    .mutation(async ({ ctx, input }) => {
      const { userId, tenant } = ctx;
      if (!tenant) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Verify cost code is enabled for this company
      const companyProfile = await tenant.getCurrentCompanyProfile();
      const isValidCostCode =
        input.costCodeId < 50
          ? companyProfile.costCodeConfig.enabledCsiDivisions.includes(input.costCodeId)
          : companyProfile.costCodeConfig.customCodes.some(c => c.id === input.costCodeId);

      if (!isValidCostCode) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cost code not enabled for this company",
        });
      }

      // Check project access
      ForbiddenError.from(ctx.abilities).throwUnlessCan("update", "Budget", {
        projectId: input.projectId,
      });

      // Create budget line item
      const [lineItem] = await tenant.db.insert(budgetLineItems).values({
        projectId: input.projectId,
        costCodeId: input.costCodeId,
        description: input.description,
        budgetedAmount: input.budgetedAmount.toFixed(2), // Ensure 2 decimal places
        createdBy: userId,
      }).returning();

      // Audit log
      await ctx.tenant.auditLog({
        entityType: "BudgetLineItem",
        entityId: lineItem.id,
        action: "create",
        actorId: userId,
        changes: { after: lineItem },
      });

      return lineItem;
    }),
});
```

### Commitment Creation with Budget Variance Warning
```typescript
// apps/api/src/trpc/routers/commitment.ts
export const commitmentRouter = router({
  create: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      type: z.enum(["subcontract", "purchase_order"]),
      vendorName: z.string().min(1),
      contractNumber: z.string().optional(),
      lineItems: z.array(z.object({
        budgetLineItemId: z.string().uuid(),
        description: z.string(),
        amount: z.number().positive(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const { userId, tenant } = ctx;

      // Calculate commitment total
      const totalAmount = input.lineItems.reduce((sum, li) => sum + li.amount, 0);

      // Check variance for each line item
      const variances = await Promise.all(
        input.lineItems.map(async (li) => {
          const [budget] = await tenant.db
            .select()
            .from(budgetLineItems)
            .where(eq(budgetLineItems.id, li.budgetLineItemId));

          if (!budget) {
            throw new TRPCError({ code: "NOT_FOUND", message: `Budget line item ${li.budgetLineItemId} not found` });
          }

          // Get existing commitments
          const existing = await tenant.db
            .select({ total: sql<number>`COALESCE(SUM(${commitmentLineItems.amount}::numeric), 0)` })
            .from(commitmentLineItems)
            .where(eq(commitmentLineItems.budgetLineItemId, li.budgetLineItemId));

          const existingCommitted = Number(existing[0].total);
          const newTotal = existingCommitted + li.amount;
          const budgeted = Number(budget.budgetedAmount);
          const variance = budgeted - newTotal;
          const variancePercent = budgeted > 0 ? Math.abs(variance) / budgeted : 0;

          return {
            budgetLineItemId: li.budgetLineItemId,
            variance,
            variancePercent,
            exceedsWarning: variancePercent >= 0.10,
            exceedsCritical: variancePercent >= 0.20,
          };
        })
      );

      // Check for critical variances
      const critical = variances.filter(v => v.exceedsCritical);
      if (critical.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Commitment would exceed budget by >20% on ${critical.length} line items`,
        });
      }

      // Create commitment
      const [commitment] = await tenant.db.transaction(async (tx) => {
        const [c] = await tx.insert(commitments).values({
          projectId: input.projectId,
          type: input.type,
          vendorName: input.vendorName,
          contractNumber: input.contractNumber,
          totalAmount: totalAmount.toFixed(2),
          status: "pending",
          createdBy: userId,
        }).returning();

        // Create line items
        await tx.insert(commitmentLineItems).values(
          input.lineItems.map(li => ({
            commitmentId: c.id,
            budgetLineItemId: li.budgetLineItemId,
            description: li.description,
            amount: li.amount.toFixed(2),
          }))
        );

        return [c];
      });

      return {
        commitment,
        warnings: variances.filter(v => v.exceedsWarning && !v.exceedsCritical),
      };
    }),
});
```

### Budget Dashboard with Recharts Waterfall Visualization
```typescript
// apps/web/components/budget/budget-variance-chart.tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface BudgetData {
  costCode: number;
  costCodeName: string;
  budgeted: number;
  committed: number;
  actual: number;
  variance: number;
}

export function BudgetVarianceChart({ data }: { data: BudgetData[] }) {
  // Transform for waterfall-style stacked bar
  const chartData = data.map(d => ({
    name: `Div ${d.costCode}: ${d.costCodeName}`,
    Budgeted: d.budgeted,
    Committed: d.committed,
    Remaining: Math.max(0, d.budgeted - d.committed),
    Overrun: Math.max(0, d.committed - d.budgeted),
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis
          tickFormatter={(value) =>
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
            }).format(value)
          }
        />
        <Tooltip
          formatter={(value) =>
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD'
            }).format(value as number)
          }
        />
        <Legend />
        <Bar dataKey="Budgeted" stackId="a" fill="#3b82f6" />
        <Bar dataKey="Committed" stackId="b" fill="#f59e0b" />
        <Bar dataKey="Remaining" stackId="b" fill="#10b981" />
        <Bar dataKey="Overrun" stackId="b" fill="#ef4444" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

**Source:** [Recharts Waterfall Chart Tutorial](https://medium.com/2359media/tutorial-how-to-create-a-waterfall-chart-in-recharts-15a0e980d4b)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Spreadsheet budgets | Database-backed with real-time sync | ~2018 | Eliminates version conflicts; single source of truth; instant updates |
| Budget vs actual only | Three-tier: budget/committed/actual | ~2020 | Early warning when contracts exceed budget before payment |
| Manual variance calculation | Automated alerts with thresholds | ~2022 | Proactive detection at 10% vs reactive discovery at 30% |
| Monthly cost reports | Real-time dashboards with charts | ~2023 | Daily visibility instead of 30-day lag; faster decision-making |
| Hard-coded cost codes | Company-configurable with CSI defaults | ~2024 | Supports diverse company types (GC, sub, specialty trades) |
| Manual EAC calculation | Automated EVM forecasting (CPI-based) | ~2025 | Standardized metrics; comparable across projects |

**Deprecated/outdated:**
- **Storing currency as INTEGER cents:** Modern ORMs handle NUMERIC correctly; no need for manual conversion
- **Excel-based change order tracking:** Audit trail is fragmented; use database with immutable logs
- **Custom CSV budget imports:** Use tRPC mutations with proper validation instead of batch CSV
- **Hard-coded CSI divisions:** Companies need custom codes; use JSONB config in company_profiles
- **Variance calculation on every query:** Use materialized views refreshed periodically

## Open Questions

1. **Multi-currency support**
   - What we know: Construction projects may have international suppliers; budgets in USD but commitments in CAD/MXN
   - What's unclear: Should we support multi-currency budgets or enforce single currency with manual conversion?
   - Recommendation: For v1, single currency per project (stored in project metadata). Add multi-currency in later phase if user demand exists.

2. **Budget templates by project type**
   - What we know: Commercial projects have different cost structures than residential; companies reuse similar budgets
   - What's unclear: Should we provide default budget templates (e.g., "Commercial Office" with typical CSI divisions pre-allocated)?
   - Recommendation: Defer to Phase 4.5 or later. Focus on core budget CRUD first; templates are convenience feature.

3. **Cost code hierarchy depth**
   - What we know: CSI MasterFormat has 3 levels (Division > Section > Subsection); some companies need 4-5 levels
   - What's unclear: Should cost codes support arbitrary hierarchy depth or limit to 2-3 levels?
   - Recommendation: Start with flat structure (division level only). Add hierarchy in later phase based on feedback.

4. **Budget approval workflow**
   - What we know: Large GCs require multi-party approval (PM → VP → CFO) before budget is locked
   - What's unclear: Should budget creation trigger approval workflow or allow immediate usage?
   - Recommendation: For v1, budgets are editable until locked by payment app. Add approval workflow if users request it.

5. **Retainage tracking**
   - What we know: Subcontracts often include retainage (5-10% withheld until project completion)
   - What's unclear: Should retainage be tracked separately in commitments table or handled in payment applications (Phase 6)?
   - Recommendation: Defer to Phase 6. Retainage is tied to payment application processing.

## Sources

### Primary (HIGH confidence)
- [PostgreSQL NUMERIC Documentation](https://www.postgresql.org/docs/current/datatype-numeric.html) - Decimal precision for financial data
- [Working with Money in Postgres](https://www.crunchydata.com/blog/working-with-money-in-postgres) - Financial data type best practices
- [Drizzle ORM Aggregations](https://orm.drizzle.team/docs/select) - SUM, GROUP BY with PostgreSQL
- [PostgreSQL Materialized Views](https://www.postgresql.org/docs/current/rules-materializedviews.html) - Performance optimization
- [Recharts Documentation](https://recharts.org/en-US/) - React chart library

### Secondary (MEDIUM confidence)
- [CSI MasterFormat 2026 Guide](https://archdesk.com/blog/2026-guide-csi-masterformat) - Cost code structure (verified 2026)
- [Tracking Committed Costs](https://www.mastt.com/blogs/tracking-committed-costs) - Three-tier budget model (2026)
- [Construction Cost Management Trends 2026](https://www.bauwise.com/construction-cost-management-trends/) - Industry best practices
- [Earned Value Management 2026](https://www.bigtime.net/blogs/earned-value-management-system/) - EVM formulas and metrics
- [Budget Overrun Prevention](https://monograph.com/blog/budget-overrun-prevention-ae-projects) - Variance thresholds (2026)
- [Recharts Waterfall Chart Tutorial](https://medium.com/2359media/tutorial-how-to-create-a-waterfall-chart-in-recharts-15a0e980d4b) - Budget visualization
- [Procore Budget Setup](https://support.procore.com/faq/what-are-procores-default-cost-codes) - Industry patterns
- [Construction Cost Code Best Practices](https://www.redhammer.io/blog/creating-effective-construction-cost-codes-a-strategic-approach-for-business-success) - Customization patterns (2026)

### Tertiary (LOW confidence - marked for validation)
- Various WebSearch results on construction purchase orders, subcontract management - Provides domain context but lacks technical implementation details

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - PostgreSQL NUMERIC, Drizzle ORM, tRPC, CASL all verified and already in use
- Architecture patterns: MEDIUM-HIGH - Three-tier model verified from industry sources; materialized views from PostgreSQL docs; earned value formulas are industry standard
- Pitfalls: MEDIUM - Based on PostgreSQL financial best practices (HIGH), construction industry patterns (MEDIUM), and general multi-tenant SaaS patterns
- Cost code structure: MEDIUM - CSI MasterFormat verified from official sources, but company customization patterns based on software vendor blogs

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (30 days for stable technologies; PostgreSQL, Drizzle, React ecosystem are mature)
