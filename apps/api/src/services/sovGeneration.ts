import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import type { TenantSchema } from "../db/schema/index.js";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

/**
 * SOV generation service for estimates.
 * Provides smart grouping algorithms to convert estimate line items into Schedule of Values.
 *
 * Best practices from construction industry:
 * - CSI division grouping: Industry standard, familiar to all stakeholders
 * - Phase grouping: Aligns with construction schedule and milestone payments
 * - Payment schedule grouping: Direct mapping to cash flow planning
 *
 * Reference: https://buildern.com/resources/blog/schedule-of-values/
 */

/**
 * SOV line item structure for generation preview.
 * Not saved to DB until finalize procedure is called.
 */
export interface SOVLineItem {
  id: string;
  description: string;
  amount: number;
  costCodeReferences: string[];
  completionPercent: number;
  sortOrder: number;
  scheduledValues: unknown[];
}

/**
 * Generic grouping helper function.
 * Groups an array of items by a key extraction function.
 *
 * @param array - Array of items to group
 * @param keyFn - Function that extracts the grouping key from each item
 * @returns Map of key to array of items with that key
 */
function groupBy<T>(array: T[], keyFn: (item: T) => string): Map<string, T[]> {
  return array.reduce((map, item) => {
    const key = keyFn(item);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(item);
    return map;
  }, new Map<string, T[]>());
}

/**
 * Group estimate line items by CSI division.
 *
 * Extracts the CSI division number from the costCodeId (assumes 4-digit codes
 * where division = floor(costCodeId / 1000)). For example:
 * - 3100 (Concrete) → Division 03
 * - 9200 (Painting) → Division 09
 *
 * Custom codes (50+) are grouped as "Custom Codes".
 *
 * @param lineItems - Estimate line items to group
 * @returns Map of division description to line items
 */
export function groupByCsi(lineItems: any[]): Map<string, any[]> {
  return groupBy(lineItems, (item) => {
    const division = Math.floor(item.costCodeId / 1000);

    if (division >= 50) {
      return "Custom Codes";
    }

    return `CSI Division ${division.toString().padStart(2, "0")}`;
  });
}

/**
 * Group estimate line items by project phase.
 *
 * Uses the `phase` metadata field on line items. Items without a phase
 * are grouped under "General".
 *
 * Common phases: Sitework, Foundation, Framing, MEP, Finishes, etc.
 *
 * @param lineItems - Estimate line items to group
 * @returns Map of phase name to line items
 */
export function groupByPhase(lineItems: any[]): Map<string, any[]> {
  return groupBy(lineItems, (item) => {
    // Phase can be stored in JSONB metadata or as a dedicated field
    // For now, use a default "General" phase since schema doesn't have it yet
    return (item.phase as string | undefined) || "General";
  });
}

/**
 * Group estimate line items by payment schedule period.
 *
 * Uses the `paymentPeriod` metadata field on line items. Items without a
 * payment period are grouped under "Month 1".
 *
 * Typical periods: "Month 1", "Month 2", "Mobilization", "Closeout", etc.
 *
 * @param lineItems - Estimate line items to group
 * @returns Map of payment period to line items
 */
export function groupByPaymentSchedule(lineItems: any[]): Map<string, any[]> {
  return groupBy(lineItems, (item) => {
    // Payment period can be stored in JSONB metadata
    // For now, use a default "Month 1" since schema doesn't have it yet
    return (item.paymentPeriod as string | undefined) || "Month 1";
  });
}

/**
 * Generate Schedule of Values from an estimate.
 *
 * Process:
 * 1. Load estimate with all line items
 * 2. Apply selected grouping algorithm (CSI, phase, or payment schedule)
 * 3. Calculate group totals including quantity × unitCost + custom markup
 * 4. Create SOV line items with proper sorting
 * 5. Validate that SOV total matches estimate total (within $1.00 tolerance)
 *
 * @param estimateId - UUID of the estimate to generate SOV from
 * @param groupingMethod - Grouping strategy to use
 * @param db - Drizzle database connection
 * @param tenantSchema - Tenant schema with table definitions
 * @returns Array of SOV line items (not yet saved to database)
 * @throws Error if estimate not found or validation fails
 */
export async function generateSOVFromEstimate(
  estimateId: string,
  groupingMethod: "csi" | "phase" | "payment_schedule",
  db: NodePgDatabase,
  tenantSchema: TenantSchema
): Promise<SOVLineItem[]> {
  // 1. Fetch estimate with line items
  const estimate = await db.query.estimates.findFirst({
    where: eq(tenantSchema.estimates.id, estimateId),
    with: {
      lineItems: true,
    },
  });

  if (!estimate) {
    throw new Error("Estimate not found");
  }

  if (!estimate.lineItems || estimate.lineItems.length === 0) {
    throw new Error("Estimate has no line items");
  }

  // 2. Group line items based on selected method
  let groups: Map<string, any[]>;

  switch (groupingMethod) {
    case "csi":
      groups = groupByCsi(estimate.lineItems);
      break;

    case "phase":
      groups = groupByPhase(estimate.lineItems);
      break;

    case "payment_schedule":
      groups = groupByPaymentSchedule(estimate.lineItems);
      break;

    default:
      throw new Error(`Unknown grouping method: ${groupingMethod}`);
  }

  // 3. Create SOV line items from groups
  const sovLineItems: SOVLineItem[] = [];
  let sortOrder = 0;

  for (const [groupName, items] of Array.from(groups.entries())) {
    // Calculate group total with proper decimal precision
    // Formula: sum(quantity × unitCost × (1 + customMarkupPercent/100))
    const groupTotal = items.reduce((sum, item) => {
      const quantity = new Decimal(item.quantity);
      const unitCost = new Decimal(item.unitCost);
      const cost = quantity.times(unitCost);

      // Apply custom markup if present (stored as percentage, e.g., 15 = 15%)
      const markupPercent = item.customMarkupPercent
        ? new Decimal(item.customMarkupPercent)
        : new Decimal(0);
      const markup = cost.times(markupPercent).div(100);

      return sum.plus(cost).plus(markup);
    }, new Decimal(0));

    sovLineItems.push({
      id: randomUUID(),
      description: groupName,
      amount: groupTotal.toDecimalPlaces(2).toNumber(), // Round to 2 decimal places
      costCodeReferences: items.map((i) => i.costCodeId.toString()),
      completionPercent: 0,
      sortOrder: sortOrder++,
      scheduledValues: [], // Can be populated based on grouping method in future
    });
  }

  // 4. Validate total matches estimate (within $1.00 tolerance for rounding)
  const sovTotal = sovLineItems.reduce(
    (sum, item) => sum.plus(item.amount),
    new Decimal(0)
  );
  const estimateTotal = new Decimal(estimate.totalCost);
  const difference = sovTotal.minus(estimateTotal).abs();

  if (difference.greaterThan(1.0)) {
    throw new Error(
      `SOV total ($${sovTotal.toFixed(2)}) does not match estimate total ($${estimateTotal.toFixed(2)}). Difference: $${difference.toFixed(2)}`
    );
  }

  return sovLineItems;
}
