import { RetainageConfig } from "@construction/shared";

/**
 * Calculate the current retainage rate based on project completion percentage
 * and the progressive retainage schedule.
 *
 * @param retainageConfig - Company retainage configuration
 * @param projectCompletionPercent - Current project completion (0-100)
 * @returns Applicable retainage rate percentage
 */
export function getCurrentRetainageRate(
  retainageConfig: RetainageConfig,
  projectCompletionPercent: number
): number {
  // If no progressive rates defined, use default rate
  if (!retainageConfig.progressiveRates || retainageConfig.progressiveRates.length === 0) {
    return retainageConfig.defaultRate;
  }

  // Sort progressive rates by upToPercent ascending
  const sortedRates = [...retainageConfig.progressiveRates].sort(
    (a, b) => a.upToPercent - b.upToPercent
  );

  // Find first tier where project completion is less than or equal to tier threshold
  for (const tier of sortedRates) {
    if (projectCompletionPercent <= tier.upToPercent) {
      return tier.rate;
    }
  }

  // If project completion exceeds all tiers, use the last tier's rate
  return sortedRates[sortedRates.length - 1].rate;
}

/**
 * Calculate retainage amount from a total amount and retainage rate.
 *
 * @param totalAmount - Total amount to calculate retainage from
 * @param retainageRate - Retainage rate percentage (0-100)
 * @returns Retainage amount with 2 decimal precision
 */
export function calculateRetainage(
  totalAmount: number,
  retainageRate: number
): number {
  const retainageAmount = totalAmount * (retainageRate / 100);
  return Number(retainageAmount.toFixed(2));
}
