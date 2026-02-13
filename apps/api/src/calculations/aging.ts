/**
 * Aging bucket calculation helpers for AR/AP reporting.
 * Used when JavaScript-based grouping is needed (though SQL-based calculations are preferred for performance).
 */

export interface AgingItem {
  amount: number;
  daysOutstanding: number;
}

export interface AgingBuckets {
  current: number; // 0-30 days
  days31_60: number;
  days61_90: number;
  days91_120: number;
  days120Plus: number;
}

/**
 * Calculate the number of days between two dates.
 * @param approvedAt - The date the invoice/payment was approved
 * @param asOfDate - The date to calculate aging as of (defaults to now)
 * @returns Number of days outstanding
 */
export function getDaysOutstanding(approvedAt: Date, asOfDate: Date = new Date()): number {
  const diffMs = asOfDate.getTime() - approvedAt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Categorize items into aging buckets based on days outstanding.
 * @param items - Array of items with amount and daysOutstanding
 * @returns AgingBuckets object with sums per bucket
 */
export function calculateAgingBuckets(items: AgingItem[]): AgingBuckets {
  const buckets: AgingBuckets = {
    current: 0,
    days31_60: 0,
    days61_90: 0,
    days91_120: 0,
    days120Plus: 0,
  };

  for (const item of items) {
    const { amount, daysOutstanding } = item;

    if (daysOutstanding <= 30) {
      buckets.current += amount;
    } else if (daysOutstanding <= 60) {
      buckets.days31_60 += amount;
    } else if (daysOutstanding <= 90) {
      buckets.days61_90 += amount;
    } else if (daysOutstanding <= 120) {
      buckets.days91_120 += amount;
    } else {
      buckets.days120Plus += amount;
    }
  }

  return buckets;
}
