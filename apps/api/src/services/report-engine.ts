import { eq, and, lt, sql } from "drizzle-orm";
import type { TenantSchema } from "../db/schema/tenant.js";
import { buildReportQuery } from "./report-query-builder.js";
import type { ReportDefinition, ReportFilter } from "@construction/shared";

/**
 * Report execution result with metadata
 */
export interface ReportExecutionResult {
  data: unknown[];
  metadata: {
    generatedAt: Date;
    rowCount: number;
    executionTime: number;
    fromCache: boolean;
  };
}

/**
 * Execute a report with materialized view caching.
 * Checks for cached results and returns them if valid and not expired.
 * Otherwise, generates fresh report data and caches for 1 hour.
 *
 * @param db - Drizzle database instance
 * @param schema - Tenant schema
 * @param reportDefinition - Report configuration
 * @param options - Execution options (forceRefresh, filter overrides)
 * @returns Report data with execution metadata
 */
export async function executeReport(
  db: any,
  schema: TenantSchema,
  reportDefinition: ReportDefinition & { id: string },
  options: {
    forceRefresh?: boolean;
    filters?: ReportFilter[];
  } = {}
): Promise<ReportExecutionResult> {
  const startTime = Date.now();
  const { forceRefresh = false, filters } = options;

  // Check for cached results if not forcing refresh
  if (!forceRefresh) {
    const cached = await db
      .select()
      .from(schema.materializedReportData)
      .where(
        and(
          eq(schema.materializedReportData.reportDefinitionId, reportDefinition.id),
          sql`${schema.materializedReportData.expiresAt} > NOW()`
        )
      )
      .limit(1);

    if (cached.length > 0) {
      const cachedResult = cached[0];
      const executionTime = Date.now() - startTime;

      return {
        data: cachedResult.data as unknown[],
        metadata: {
          generatedAt: cachedResult.generatedAt,
          rowCount: Array.isArray(cachedResult.data) ? cachedResult.data.length : 0,
          executionTime,
          fromCache: true,
        },
      };
    }
  }

  // Build and execute query
  const query = buildReportQuery(db, schema, {
    ...reportDefinition,
    filters: filters ?? reportDefinition.filters,
  });

  const queryStartTime = Date.now();
  const results = await query;
  const queryExecutionTime = Date.now() - queryStartTime;

  // Store in materialized cache with 1-hour expiry
  const generatedAt = new Date();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(schema.materializedReportData).values({
    reportDefinitionId: reportDefinition.id,
    data: results,
    generatedAt,
    expiresAt,
  });

  const executionTime = Date.now() - startTime;

  return {
    data: results,
    metadata: {
      generatedAt,
      rowCount: results.length,
      executionTime,
      fromCache: false,
    },
  };
}

/**
 * Refresh materialized report data.
 * If reportDefinitionId provided, refreshes only that report.
 * Otherwise, refreshes all active reports and cleans up expired data.
 *
 * @param db - Drizzle database instance
 * @param schema - Tenant schema
 * @param reportDefinitionId - Optional specific report to refresh
 * @returns Count of refreshed reports
 */
export async function refreshMaterializedData(
  db: any,
  schema: TenantSchema,
  reportDefinitionId?: string
): Promise<{ refreshedCount: number; deletedCount: number }> {
  // Delete expired materialized data
  const deleted = await db
    .delete(schema.materializedReportData)
    .where(lt(schema.materializedReportData.expiresAt, sql`NOW()`));

  const deletedCount = deleted.rowCount ?? 0;

  // If specific report requested, refresh only that one
  if (reportDefinitionId) {
    await db
      .delete(schema.materializedReportData)
      .where(eq(schema.materializedReportData.reportDefinitionId, reportDefinitionId));

    return { refreshedCount: 1, deletedCount };
  }

  // Otherwise, refresh all active reports
  const activeReports = await db
    .select()
    .from(schema.reportDefinitions)
    .where(eq(schema.reportDefinitions.status, "active"));

  // Clear all cached data for active reports (they'll regenerate on next execution)
  if (activeReports.length > 0) {
    await db
      .delete(schema.materializedReportData)
      .where(
        sql`${schema.materializedReportData.reportDefinitionId} IN (${sql.join(
          activeReports.map((r: any) => sql`${r.id}`),
          sql`, `
        )})`
      );
  }

  return { refreshedCount: activeReports.length, deletedCount };
}
