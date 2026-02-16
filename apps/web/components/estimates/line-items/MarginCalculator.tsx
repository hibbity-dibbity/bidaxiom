/**
 * Margin calculation utilities for estimate line items.
 * Pure functions for cost, markup, and margin calculations.
 *
 * Note: formatCurrency and formatPercent have been moved to @/lib/utils/format
 * Re-exported here for backward compatibility.
 */

import { formatCurrency as sharedFormatCurrency } from "@/lib/utils/format";

export interface MarginResult {
  cost: number;
  markup: number;
  total: number;
  marginPercent: number;
  marginDollars: number;
}

/**
 * Calculate line item margin metrics.
 *
 * Formula:
 * - cost = quantity * unitCost
 * - markup = cost * (markupPercent / 100)
 * - total = cost + markup
 * - marginPercent = (markup / total) * 100 if total > 0, else 0
 *
 * @param quantity - Line item quantity
 * @param unitCost - Cost per unit
 * @param markupPercent - Markup percentage (e.g., 20 for 20%)
 * @returns Margin calculation results
 */
export function calculateLineItemMargin(
  quantity: number,
  unitCost: number,
  markupPercent: number
): MarginResult {
  const cost = quantity * unitCost;
  const markup = cost * (markupPercent / 100);
  const total = cost + markup;
  const marginPercent = total > 0 ? (markup / total) * 100 : 0;

  return {
    cost,
    markup,
    total,
    marginPercent,
    marginDollars: markup,
  };
}

/**
 * Get color class for margin percentage.
 * Red if < 10%, yellow if 10-20%, green if >= 20%.
 */
export function getMarginColorClass(marginPercent: number): string {
  if (marginPercent < 10) {
    return "text-red-600";
  } else if (marginPercent < 20) {
    return "text-yellow-600";
  } else {
    return "text-green-600";
  }
}

/**
 * Format currency for display.
 * Re-exported from shared utilities for backward compatibility.
 */
export function formatCurrency(value: number): string {
  return sharedFormatCurrency(value);
}

/**
 * Format percentage for display.
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}
