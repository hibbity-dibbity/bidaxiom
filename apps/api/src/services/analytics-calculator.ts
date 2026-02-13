import { eq, and, gte, lte, sql } from "drizzle-orm";
import type { TenantSchema } from "../db/schema/tenant.js";

/**
 * Cost Performance Metrics
 * Based on Earned Value Management (EVM) formulas
 */
export interface CostPerformanceMetrics {
  budgetAtCompletion: number;
  earnedValue: number;
  actualCost: number;
  costVariance: number;
  costPerformanceIndex: number;
  estimateAtCompletion: number;
  estimateToComplete: number;
  varianceAtCompletion: number;
}

/**
 * Budget Variance Metrics
 */
export interface BudgetVarianceMetrics {
  budgeted: number;
  committed: number;
  actual: number;
  variance: number;
  variancePercent: number;
  status: "ok" | "warning" | "critical";
}

/**
 * Cash Flow Projection
 */
export interface CashFlowProjection {
  period: string;
  periodStart: Date;
  periodEnd: Date;
  inflow: number;
  outflow: number;
  net: number;
  cumulativeNet: number;
}

/**
 * Calculate cost performance metrics using Earned Value Management formulas.
 * Handles division by zero gracefully.
 *
 * @param budgeted - Budget at Completion (BAC)
 * @param committed - Total committed costs
 * @param actual - Actual costs incurred
 * @param percentComplete - Project completion percentage (0-100)
 * @returns Cost performance metrics object
 */
export function calculateCostPerformance(
  budgeted: number,
  committed: number,
  actual: number,
  percentComplete: number
): CostPerformanceMetrics {
  const budgetAtCompletion = budgeted;
  const earnedValue = budgeted * (percentComplete / 100);
  const actualCost = actual;

  // Cost Variance (CV) = EV - AC
  const costVariance = earnedValue - actualCost;

  // Cost Performance Index (CPI) = EV / AC
  // Handle division by zero
  const costPerformanceIndex = actualCost !== 0 ? earnedValue / actualCost : 0;

  // Estimate at Completion (EAC) = BAC / CPI
  // Handle division by zero
  const estimateAtCompletion = costPerformanceIndex !== 0 ? budgeted / costPerformanceIndex : budgeted;

  // Estimate to Complete (ETC) = EAC - AC
  const estimateToComplete = estimateAtCompletion - actualCost;

  // Variance at Completion (VAC) = BAC - EAC
  const varianceAtCompletion = budgeted - estimateAtCompletion;

  return {
    budgetAtCompletion,
    earnedValue,
    actualCost,
    costVariance,
    costPerformanceIndex,
    estimateAtCompletion,
    estimateToComplete,
    varianceAtCompletion,
  };
}

/**
 * Calculate budget variance metrics.
 * Determines variance status based on percentage thresholds.
 *
 * @param budgeted - Total budgeted amount
 * @param committed - Total committed amount
 * @param actual - Total actual costs
 * @returns Budget variance metrics with status
 */
export function calculateBudgetVariance(
  budgeted: number,
  committed: number,
  actual: number
): BudgetVarianceMetrics {
  const variance = budgeted - (committed + actual);

  // Calculate variance percentage (handle division by zero)
  const variancePercent = budgeted !== 0 ? (variance / budgeted) * 100 : 0;

  // Determine status based on variance percentage
  let status: "ok" | "warning" | "critical";
  if (variancePercent < -20) {
    status = "critical"; // Over budget by more than 20%
  } else if (variancePercent < -10) {
    status = "warning"; // Over budget by 10-20%
  } else {
    status = "ok"; // Within acceptable range
  }

  return {
    budgeted,
    committed,
    actual,
    variance,
    variancePercent,
    status,
  };
}

/**
 * Project cash flow over time.
 * Queries payment applications (inflow) and commitments (outflow) grouped by period.
 *
 * @param db - Drizzle database instance
 * @param schema - Tenant schema
 * @param projectId - Project UUID
 * @param startDate - Start date for projection
 * @param endDate - End date for projection
 * @param periodType - Grouping period (monthly or quarterly)
 * @returns Array of cash flow projections by period
 */
export async function projectCashFlow(
  db: any,
  schema: TenantSchema,
  projectId: string,
  startDate: Date,
  endDate: Date,
  periodType: "monthly" | "quarterly"
): Promise<CashFlowProjection[]> {
  // TODO: Payment applications not yet in schema
  // For now, return placeholder cash flow projections based on commitments only

  // Determine period format based on type
  const periodFormat = periodType === "monthly" ? "YYYY-MM" : "YYYY-Q";
  const truncFunction = periodType === "monthly" ? "month" : "quarter";

  // Query commitments for outflow (executed contracts)
  const outflowQuery = await db
    .select({
      period: sql<string>`TO_CHAR(DATE_TRUNC(${sql.raw(`'${truncFunction}'`)}, ${schema.commitments.executedAt}), ${sql.raw(`'${periodFormat}'`)})`,
      amount: sql<string>`SUM(COALESCE(${schema.commitments.totalAmount}, 0))`,
    })
    .from(schema.commitments)
    .where(
      and(
        eq(schema.commitments.projectId, projectId),
        gte(schema.commitments.executedAt, startDate),
        lte(schema.commitments.executedAt, endDate),
        eq(schema.commitments.status, "executed")
      )
    )
    .groupBy(sql`DATE_TRUNC(${sql.raw(`'${truncFunction}'`)}, ${schema.commitments.executedAt})`);

  // Build period map
  const periodMap = new Map<string, { inflow: number; outflow: number }>();

  // Add outflow data (inflow placeholder - payment apps not in schema yet)
  for (const row of outflowQuery) {
    if (!row.period) continue;
    periodMap.set(row.period, {
      inflow: 0, // TODO: Add when payment apps schema is available
      outflow: parseFloat(row.amount ?? "0"),
    });
  }

  // Convert to sorted array with cumulative net
  const periods = Array.from(periodMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, data]) => ({ period, ...data }));

  let cumulativeNet = 0;
  const projections: CashFlowProjection[] = periods.map((p) => {
    const net = p.inflow - p.outflow;
    cumulativeNet += net;

    // Parse period to get start/end dates
    const { periodStart, periodEnd } = parsePeriod(p.period, periodType);

    return {
      period: p.period,
      periodStart,
      periodEnd,
      inflow: p.inflow,
      outflow: p.outflow,
      net,
      cumulativeNet,
    };
  });

  return projections;
}

/**
 * Parse period string to get start and end dates
 */
function parsePeriod(
  period: string,
  periodType: "monthly" | "quarterly"
): { periodStart: Date; periodEnd: Date } {
  if (periodType === "monthly") {
    // Format: YYYY-MM
    const [year, month] = period.split("-").map(Number);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0); // Last day of month
    return { periodStart, periodEnd };
  } else {
    // Format: YYYY-Q
    const [year, quarter] = period.split("-");
    const q = parseInt(quarter);
    const startMonth = (q - 1) * 3;
    const periodStart = new Date(parseInt(year), startMonth, 1);
    const periodEnd = new Date(parseInt(year), startMonth + 3, 0); // Last day of quarter
    return { periodStart, periodEnd };
  }
}
