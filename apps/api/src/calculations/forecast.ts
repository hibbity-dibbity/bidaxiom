import { eq, and, sql, inArray } from "drizzle-orm";
import type { TenantSchema } from "../db/schema/tenant.js";
import type { ForecastMetrics } from "@construction/shared";

type TenantDb = { db: ReturnType<typeof import("drizzle-orm/node-postgres")["drizzle"]> };

/**
 * Calculate Earned Value Management (EVM) forecast metrics for a project.
 *
 * Formulas:
 * - Budget at Completion (BAC): Total budgeted amount
 * - Actual Cost (AC): For Phase 4, uses committed costs as proxy (Phase 6 will use payment apps)
 * - Earned Value (EV): Simplified calculation based on commitment execution percentage
 * - Cost Performance Index (CPI): EV / AC
 * - Estimate at Completion (EAC): BAC / CPI
 * - Estimate to Complete (ETC): EAC - AC
 * - Variance at Completion (VAC): BAC - EAC
 *
 * @param projectId - Project UUID
 * @param tenantDb - Tenant database instance
 * @param schema - Tenant schema
 * @returns Forecast metrics object
 */
export async function calculateForecast(
  projectId: string,
  tenantDb: TenantDb["db"],
  schema: TenantSchema
): Promise<ForecastMetrics> {
  // Query 1: Total budgeted amount (BAC)
  const [budgetResult] = await tenantDb
    .select({
      total: sql<string>`COALESCE(SUM(${schema.budgetLineItems.budgetedAmount}), 0)`,
    })
    .from(schema.budgetLineItems)
    .where(eq(schema.budgetLineItems.projectId, projectId));

  const budgetAtCompletion = Number(budgetResult?.total ?? 0);

  // Query 2: Total committed amount (approved and executed commitments)
  const [committedResult] = await tenantDb
    .select({
      total: sql<string>`COALESCE(SUM(${schema.commitments.totalAmount}), 0)`,
    })
    .from(schema.commitments)
    .where(
      and(
        eq(schema.commitments.projectId, projectId),
        inArray(schema.commitments.status, ["approved", "executed"])
      )
    );

  const committedCost = Number(committedResult?.total ?? 0);

  // Phase 4: Actual cost is based on commitments (Phase 6 will use payment applications)
  const actualCost = committedCost;

  // Simplified Earned Value calculation:
  // EV = (committedCost / budgetAtCompletion) * budgetAtCompletion
  // This simplifies to committedCost when BAC > 0
  // In Phase 6, this will be refined using actual payment application data
  let earnedValue = 0;
  if (budgetAtCompletion > 0 && committedCost > 0) {
    earnedValue = committedCost; // Simplified for Phase 4
  }

  // Cost Performance Index (CPI): EV / AC
  // If AC = 0, assume CPI = 1.0 (no cost variance)
  const costPerformanceIndex = actualCost === 0 ? 1.0 : earnedValue / actualCost;

  // Estimate at Completion (EAC): BAC / CPI
  // Avoid division by zero
  const estimateAtCompletion = costPerformanceIndex === 0 ? budgetAtCompletion : budgetAtCompletion / costPerformanceIndex;

  // Estimate to Complete (ETC): EAC - AC
  const estimateToComplete = estimateAtCompletion - actualCost;

  // Variance at Completion (VAC): BAC - EAC
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
