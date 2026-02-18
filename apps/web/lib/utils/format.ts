/**
 * Centralized formatting utilities for consistent data display across the application.
 *
 * Design Principles:
 * - Single source of truth for formatting rules
 * - Consistent precision and locale settings
 * - Pure functions for easy testing
 * - Type-safe inputs and outputs
 *
 * Usage:
 * - Import directly from this file (no barrel exports)
 * - Use for all currency, percentage, and date displays
 * - Prefer these utilities over inline Intl.NumberFormat or toFixed
 */

/**
 * Format a number as USD currency with consistent precision.
 *
 * @param amount - Numeric amount in dollars
 * @returns Formatted string with $ symbol, commas, and 2 decimal places
 *
 * @example
 * formatCurrency(1234.56) // "$1,234.56"
 * formatCurrency(0) // "$0.00"
 * formatCurrency(-500.5) // "$-500.50"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a number as a percentage with configurable decimal precision.
 *
 * @param value - Numeric percentage value (e.g., 15.5 for 15.5%)
 * @param decimals - Number of decimal places to display (default: 1)
 * @returns Formatted string with % symbol
 *
 * @example
 * formatPercentage(15.5) // "15.5%"
 * formatPercentage(15.5, 2) // "15.50%"
 * formatPercentage(100, 0) // "100%"
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a date with consistent locale settings.
 *
 * @param date - Date object or ISO date string
 * @param format - Display format (short: MM/DD/YYYY, long: Month DD, YYYY)
 * @returns Formatted date string
 *
 * @example
 * formatDate(new Date("2026-02-16")) // "02/16/2026"
 * formatDate("2026-02-16", "long") // "February 16, 2026"
 */
export function formatDate(date: Date | string, format: "short" | "long" = "short"): string {
  const d = typeof date === "string" ? new Date(date) : date;

  if (format === "long") {
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Parse a user-typed currency string into a number.
 * Strips "$", commas, and whitespace before parsing.
 *
 * @param value - Raw input string (e.g. "$1,234.56", "1234.56", "")
 * @returns Numeric value, or 0 for empty/invalid input
 *
 * @example
 * parseCurrencyInput("$1,234.56") // 1234.56
 * parseCurrencyInput("") // 0
 * parseCurrencyInput("abc") // 0
 */
export function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, "").trim();
  if (cleaned === "" || cleaned === "-") return 0;
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}
