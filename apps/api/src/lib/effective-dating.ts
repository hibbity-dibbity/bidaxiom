import { and, lte, or, isNull, gt, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * Helper for effective-dated queries (point-in-time lookups).
 *
 * Returns a SQL condition that selects records valid at a specific date:
 * - validFrom <= asOf
 * - AND (validTo IS NULL OR validTo > asOf)
 *
 * This pattern supports temporal versioning where:
 * - Current version has validTo = NULL
 * - Historical versions have validTo set to the timestamp of the next version
 *
 * @param validFromCol - The valid_from column reference
 * @param validToCol - The valid_to column reference
 * @param asOf - The date to query as of (defaults to now)
 * @returns Drizzle SQL condition for WHERE clause
 *
 * @example
 * ```ts
 * const profile = await db
 *   .select()
 *   .from(schema.companyProfiles)
 *   .where(asOfDate(schema.companyProfiles.validFrom, schema.companyProfiles.validTo, new Date('2024-01-15')))
 *   .limit(1);
 * ```
 */
export function asOfDate(
  validFromCol: PgColumn,
  validToCol: PgColumn,
  asOf: Date = new Date()
): SQL {
  return and(
    lte(validFromCol, asOf),
    or(isNull(validToCol), gt(validToCol, asOf))
  )!;
}
