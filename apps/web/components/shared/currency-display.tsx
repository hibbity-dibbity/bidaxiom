"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";

interface CurrencyDisplayProps {
  /**
   * Numeric amount to display (in dollars)
   */
  amount: number;
  /**
   * Show + sign for positive values
   * @default false
   */
  showSign?: boolean;
  /**
   * Apply semantic color coding (green for positive, red for negative)
   * @default false
   */
  colorize?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * CurrencyDisplay - Shared component for consistent USD currency formatting.
 *
 * Features:
 * - Consistent USD formatting via centralized formatCurrency utility
 * - Optional semantic colorization (green = positive, red = negative)
 * - Optional sign display for variance/delta views
 *
 * Usage:
 * ```tsx
 * <CurrencyDisplay amount={1234.56} />
 * // Output: $1,234.56
 *
 * <CurrencyDisplay amount={-500} colorize />
 * // Output: $-500.00 (in red)
 *
 * <CurrencyDisplay amount={250.75} showSign colorize />
 * // Output: +$250.75 (in green)
 * ```
 *
 * Design System:
 * - Replaces inline Intl.NumberFormat instances
 * - Provides consistent precision (2 decimals) across application
 * - Semantic colors follow financial data conventions
 */
export function CurrencyDisplay({
  amount,
  showSign = false,
  colorize = false,
  className,
}: CurrencyDisplayProps) {
  const formatted = formatCurrency(amount);
  const sign = showSign && amount > 0 ? "+" : "";

  const colorClass = colorize
    ? amount < 0
      ? "text-financial-negative"
      : amount > 0
      ? "text-financial-positive"
      : "text-foreground"
    : "";

  return (
    <span className={cn("font-mono tabular-nums", colorClass, className)}>
      {sign}{formatted}
    </span>
  );
}
