import { eq, and, sql } from "drizzle-orm";
import type { TenantSchema } from "../db/schema/tenant.js";
import type { VarianceAlert } from "@construction/shared";

type TenantDb = { db: ReturnType<typeof import("drizzle-orm/node-postgres")["drizzle"]> };

/**
 * Check budget variances for a project.
 * Calculates variance between budgeted amounts and committed amounts per line item.
 *
 * @param projectId - Project UUID
 * @param tenantDb - Tenant database instance
 * @param schema - Tenant schema
 * @param thresholds - Optional variance thresholds (defaults: warning 10%, critical 20%)
 * @returns Array of variance alerts with severity levels
 */
export async function checkBudgetVariances(
  projectId: string,
  tenantDb: TenantDb["db"],
  schema: TenantSchema,
  thresholds?: { warning: number; critical: number }
): Promise<VarianceAlert[]> {
  const { warning = 0.10, critical = 0.20 } = thresholds ?? {};

  // Query: budget line items with aggregated committed amounts
  // Only count commitments that are executed (status = 'executed')
  const results = await tenantDb
    .select({
      budgetLineItemId: schema.budgetLineItems.id,
      costCodeId: schema.budgetLineItems.costCodeId,
      description: schema.budgetLineItems.description,
      budgeted: schema.budgetLineItems.budgetedAmount,
      committed: sql<string>`COALESCE(SUM(CASE WHEN ${schema.commitments.status} = 'executed' THEN ${schema.commitmentLineItems.amount} ELSE 0 END), 0)`,
    })
    .from(schema.budgetLineItems)
    .leftJoin(
      schema.commitmentLineItems,
      eq(schema.commitmentLineItems.budgetLineItemId, schema.budgetLineItems.id)
    )
    .leftJoin(
      schema.commitments,
      eq(schema.commitments.id, schema.commitmentLineItems.commitmentId)
    )
    .where(eq(schema.budgetLineItems.projectId, projectId))
    .groupBy(
      schema.budgetLineItems.id,
      schema.budgetLineItems.costCodeId,
      schema.budgetLineItems.description,
      schema.budgetLineItems.budgetedAmount
    );

  // Process results and calculate variance metrics
  const alerts: VarianceAlert[] = results.map((row) => {
    const budgeted = Number(row.budgeted);
    const committed = Number(row.committed);
    const variance = budgeted - committed;

    // Calculate variance percentage (handle zero budgeted amount)
    const variancePercent = budgeted === 0 ? 0 : Math.abs(variance) / budgeted;

    // Determine severity
    let severity: "ok" | "warning" | "critical" = "ok";
    if (committed > budgeted && variancePercent >= critical) {
      severity = "critical";
    } else if (committed > budgeted && variancePercent >= warning) {
      severity = "warning";
    }

    return {
      budgetLineItemId: row.budgetLineItemId,
      costCodeId: row.costCodeId,
      description: row.description,
      budgeted,
      committed,
      variance,
      variancePercent,
      severity,
    };
  });

  return alerts;
}
