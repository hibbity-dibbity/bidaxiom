import type { CostType } from "@cm/shared/types/estimates";

/**
 * Markup configuration with tiered fallback hierarchy
 */
export interface MarkupConfig {
  // Company defaults (from company profile or system defaults)
  companyDefaults: {
    laborMarkup: number;
    materialMarkup: number;
    equipmentMarkup: number;
    subcontractorMarkup: number;
  };
  // Estimate-level overrides (optional)
  estimateOverrides?: {
    [costType: string]: number;
  };
  // Markup base type: apply markup to direct costs only, or direct + overhead
  markupBaseType?: "direct" | "direct_plus_overhead";
}

/**
 * Overhead configuration
 */
export interface OverheadConfig {
  type: "percentage" | "fixed";
  value: number; // Percentage (e.g., 15) or fixed dollar amount
}

/**
 * Estimate line item structure
 */
export interface EstimateLineItem {
  id: string;
  quantity: string | number; // Drizzle numeric type is string
  unitCost: string | number; // Drizzle numeric type is string
  costType: CostType;
  customMarkupPercent?: string | number | null; // Line item override
}

/**
 * Calculate markup percentage for a line item using tiered fallback hierarchy
 *
 * Priority cascade:
 * 1. Line item override (customMarkupPercent)
 * 2. Estimate-level cost type override (estimateOverrides[costType])
 * 3. Company default tier (companyDefaults[{costType}Markup])
 *
 * @param lineItem - Line item with optional custom markup
 * @param config - Markup configuration with tiered defaults
 * @returns Markup percentage as number
 */
export function calculateLineItemMarkup(
  lineItem: EstimateLineItem,
  config: MarkupConfig
): number {
  // Priority 1: Line item override
  if (
    lineItem.customMarkupPercent !== undefined &&
    lineItem.customMarkupPercent !== null
  ) {
    return Number(lineItem.customMarkupPercent);
  }

  // Priority 2: Estimate-level cost type override
  if (config.estimateOverrides?.[lineItem.costType] !== undefined) {
    return config.estimateOverrides[lineItem.costType];
  }

  // Priority 3: Company default tier
  const costTypeKey = `${lineItem.costType}Markup` as keyof MarkupConfig["companyDefaults"];
  return config.companyDefaults[costTypeKey] || 0;
}

/**
 * Calculate estimate totals with tiered markup and overhead
 *
 * Calculation order (per CONTEXT.md decision):
 * 1. Calculate direct costs: sum(quantity * unitCost) for all line items
 * 2. Calculate overhead:
 *    - If percentage: directCosts * (overheadValue / 100)
 *    - If fixed: overheadValue
 * 3. Determine markup base:
 *    - If 'direct_plus_overhead': directCosts + overhead
 *    - If 'direct': directCosts only
 * 4. Calculate total markup: For each line item, itemCost * (markupPercent / 100), summed
 * 5. Calculate total cost: directCosts + overhead + totalMarkup
 * 6. Calculate margin: (totalMarkup / totalCost) * 100
 *
 * @param lineItems - Array of estimate line items
 * @param markupConfig - Markup configuration with tiered defaults
 * @param overheadConfig - Overhead configuration (percentage or fixed)
 * @returns Calculated totals with margin
 */
export function calculateEstimateTotals(
  lineItems: EstimateLineItem[],
  markupConfig: MarkupConfig,
  overheadConfig: OverheadConfig
): {
  directCosts: number;
  overhead: number;
  totalMarkup: number;
  totalCost: number;
  marginPercent: number;
  marginDollars: number;
} {
  // Step 1: Calculate direct costs
  const directCosts = lineItems.reduce((sum, item) => {
    const quantity = Number(item.quantity);
    const unitCost = Number(item.unitCost);
    return sum + quantity * unitCost;
  }, 0);

  // Step 2: Calculate overhead
  const overhead =
    overheadConfig.type === "percentage"
      ? directCosts * (overheadConfig.value / 100)
      : overheadConfig.value;

  // Step 3: Determine markup base
  const markupBase =
    markupConfig.markupBaseType === "direct_plus_overhead"
      ? directCosts + overhead
      : directCosts;

  // Step 4: Calculate total markup (sum of per-line-item markup)
  const totalMarkup = lineItems.reduce((sum, item) => {
    const quantity = Number(item.quantity);
    const unitCost = Number(item.unitCost);
    const itemCost = quantity * unitCost;
    const markupPercent = calculateLineItemMarkup(item, markupConfig);
    return sum + itemCost * (markupPercent / 100);
  }, 0);

  // Step 5: Calculate total cost
  const totalCost = directCosts + overhead + totalMarkup;

  // Step 6: Calculate margin
  const marginPercent = totalCost > 0 ? (totalMarkup / totalCost) * 100 : 0;
  const marginDollars = totalMarkup;

  // Round all values to 2 decimal places for currency
  return {
    directCosts: Math.round(directCosts * 100) / 100,
    overhead: Math.round(overhead * 100) / 100,
    totalMarkup: Math.round(totalMarkup * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    marginPercent: Math.round(marginPercent * 100) / 100,
    marginDollars: Math.round(marginDollars * 100) / 100,
  };
}
