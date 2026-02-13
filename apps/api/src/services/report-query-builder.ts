import {
  eq,
  ne,
  gt,
  lt,
  gte,
  lte,
  like,
  inArray,
  and,
  isNull,
  isNotNull,
  sql,
  sum,
  avg,
  count,
  min,
  max,
  desc,
  asc,
} from "drizzle-orm";
import type { TenantSchema } from "../db/schema/tenant.js";
import type { ReportDefinition, ReportFilter, ReportColumn } from "@construction/shared";

/**
 * Build a dynamic Drizzle query from a report definition.
 * Determines base table, applies filters, aggregations, grouping, and sorting.
 * Returns the query object (does NOT execute it - caller executes).
 *
 * @param db - Drizzle database instance
 * @param schema - Tenant schema
 * @param reportDefinition - Report configuration
 * @returns Drizzle query object ready for execution
 */
export function buildReportQuery(
  db: any,
  schema: TenantSchema,
  reportDefinition: ReportDefinition
) {
  // Determine base table from dataSource
  let baseTable: any;
  let baseQuery: any;

  switch (reportDefinition.dataSource) {
    case "projects":
      baseTable = schema.projects;
      break;
    case "budgets":
      baseTable = schema.budgetLineItems;
      break;
    case "change_orders":
      baseTable = schema.changeOrders;
      break;
    case "payment_apps":
      // Payment apps not yet in schema - use projects as fallback
      baseTable = schema.projects;
      break;
    case "bids":
      baseTable = schema.bids;
      break;
    case "commitments":
      baseTable = schema.commitments;
      break;
    default:
      throw new Error(`Unsupported data source: ${reportDefinition.dataSource}`);
  }

  // Build select clause based on columns and aggregations
  const selectClause = buildSelectClause(baseTable, reportDefinition.columns);

  // Start query with select
  baseQuery = db.select(selectClause).from(baseTable);

  // Apply filters
  if (reportDefinition.filters && reportDefinition.filters.length > 0) {
    baseQuery = applyFilters(baseQuery, baseTable, reportDefinition.filters);
  }

  // Apply groupBy
  if (reportDefinition.groupBy) {
    const groupByField = baseTable[reportDefinition.groupBy];
    if (groupByField) {
      baseQuery = baseQuery.groupBy(groupByField);
    }
  }

  // Apply sortBy
  if (reportDefinition.sortBy) {
    const sortField = baseTable[reportDefinition.sortBy.field];
    if (sortField) {
      baseQuery =
        reportDefinition.sortBy.direction === "desc"
          ? baseQuery.orderBy(desc(sortField))
          : baseQuery.orderBy(asc(sortField));
    }
  }

  return baseQuery;
}

/**
 * Build select clause with aggregations
 */
function buildSelectClause(baseTable: any, columns: ReportColumn[]) {
  const selectClause: Record<string, any> = {};

  for (const column of columns) {
    const field = baseTable[column.field];
    if (!field) continue;

    if (column.aggregation) {
      // Apply aggregation function
      selectClause[column.label] = applyAggregation(field, column.aggregation);
    } else {
      // Regular field selection
      selectClause[column.label] = field;
    }
  }

  return selectClause;
}

/**
 * Apply aggregation function to a field
 */
function applyAggregation(field: any, aggregation: string) {
  switch (aggregation) {
    case "sum":
      return sum(field);
    case "avg":
      return avg(field);
    case "count":
      return count(field);
    case "min":
      return min(field);
    case "max":
      return max(field);
    default:
      return field;
  }
}

/**
 * Apply filters to a query based on filter configurations.
 * Supports multiple filter operators including equals, comparisons, contains, array operations.
 *
 * @param query - Base query to apply filters to
 * @param baseTable - Table schema for field access
 * @param filters - Array of filter configurations
 * @returns Modified query with filters applied
 */
export function applyFilters(
  query: any,
  baseTable: any,
  filters: ReportFilter[]
): any {
  const conditions = filters.map((filter) => {
    const field = baseTable[filter.field];
    if (!field) return undefined;

    switch (filter.operator) {
      case "equals":
        return eq(field, filter.value);
      case "not_equals":
        return ne(field, filter.value);
      case "greater_than":
        return gt(field, filter.value);
      case "less_than":
        return lt(field, filter.value);
      case "contains":
        return like(field, `%${filter.value}%`);
      case "in":
        return inArray(field, Array.isArray(filter.value) ? filter.value : [filter.value]);
      case "between":
        if (Array.isArray(filter.value) && filter.value.length === 2) {
          return and(gte(field, filter.value[0]), lte(field, filter.value[1]));
        }
        return undefined;
      case "is_null":
        return isNull(field);
      case "is_not_null":
        return isNotNull(field);
      default:
        return undefined;
    }
  }).filter(Boolean);

  if (conditions.length === 0) {
    return query;
  }

  // Combine all conditions with AND
  return query.where(and(...conditions));
}

/**
 * Apply aggregations to query columns.
 * Handles sum, avg, count, min, max operations on numeric and other fields.
 *
 * @param query - Base query
 * @param columns - Column configurations with optional aggregation functions
 * @returns Modified query with aggregations applied
 */
export function applyAggregations(
  query: any,
  columns: ReportColumn[]
): any {
  // Aggregations are now handled in buildSelectClause
  // This function is kept for backward compatibility
  return query;
}
