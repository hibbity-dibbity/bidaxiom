/**
 * Payment Application Calculation Module
 *
 * Implements AIA G702/G703 payment application calculations following industry-standard
 * formulas for work completed, retainage, and balance to finish.
 */

/**
 * Calculate amounts for a single payment app line item based on SOV and percent complete.
 *
 * @param scheduledValue - SOV item scheduled value (total allocated for this line)
 * @param previousPercentComplete - Percent complete from previous payment app (0-100)
 * @param currentPercentComplete - Current percent complete (0-100)
 * @param materialsStoredThisPeriod - Value of materials stored on-site this period
 * @param retainageRate - Retainage percentage rate (0-100)
 * @returns Calculated amounts as strings with 2 decimal places for DB storage
 */
export function calculateLineItemAmounts(
  scheduledValue: number,
  previousPercentComplete: number,
  currentPercentComplete: number,
  materialsStoredThisPeriod: number,
  retainageRate: number
): {
  workCompletedThisPeriod: string;
  materialsStoredThisPeriod: string;
  totalCompletedAndStored: string;
  retainagePercent: string;
  retainageAmount: string;
} {
  // Work completed this period = (current % - previous %) × scheduled value
  const workThisPeriod =
    ((currentPercentComplete - previousPercentComplete) / 100) * scheduledValue;

  // Total completed and stored = work this period + materials stored
  const totalCompletedAndStored = workThisPeriod + materialsStoredThisPeriod;

  // Retainage = total × retainage rate
  const retainageAmount = totalCompletedAndStored * (retainageRate / 100);

  return {
    workCompletedThisPeriod: workThisPeriod.toFixed(2),
    materialsStoredThisPeriod: materialsStoredThisPeriod.toFixed(2),
    totalCompletedAndStored: totalCompletedAndStored.toFixed(2),
    retainagePercent: retainageRate.toFixed(2),
    retainageAmount: retainageAmount.toFixed(2),
  };
}

/**
 * Calculate payment application totals following AIA G702 format.
 *
 * @param originalContractSum - Original contract sum from SOV total
 * @param netChangeByChangeOrders - Sum of approved change order amounts
 * @param previousPayments - Sum of previous approved payment app currentPaymentDue amounts
 * @param lineItems - Array of calculated line item amounts
 * @returns G702 totals as numbers (caller converts to strings for DB)
 */
export function calculatePaymentAppTotals(
  originalContractSum: number,
  netChangeByChangeOrders: number,
  previousPayments: number,
  lineItems: Array<{
    totalCompletedAndStored: string;
    retainageAmount: string;
  }>
): {
  contractSumToDate: number;
  totalCompletedAndStored: number;
  retainageAmount: number;
  totalEarnedLessRetainage: number;
  currentPaymentDue: number;
  balanceToFinish: number;
} {
  // Contract sum to date = original + change orders
  const contractSumToDate = originalContractSum + netChangeByChangeOrders;

  // Sum all line items
  const totalCompletedAndStored = lineItems.reduce(
    (sum, item) => sum + Number(item.totalCompletedAndStored),
    0
  );

  const retainageAmount = lineItems.reduce(
    (sum, item) => sum + Number(item.retainageAmount),
    0
  );

  // Total earned less retainage
  const totalEarnedLessRetainage = totalCompletedAndStored - retainageAmount;

  // Current payment due = earned less retainage - previous payments
  const currentPaymentDue = totalEarnedLessRetainage - previousPayments;

  // Balance to finish = contract sum to date - total completed and stored
  const balanceToFinish = contractSumToDate - totalCompletedAndStored;

  return {
    contractSumToDate,
    totalCompletedAndStored,
    retainageAmount,
    totalEarnedLessRetainage,
    currentPaymentDue,
    balanceToFinish,
  };
}
