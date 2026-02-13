import { z } from "zod";

/**
 * Reporting and Analytics Types
 *
 * Defines schemas and types for custom reports, pre-built templates,
 * report schedules, materialized data caching, and analytics metrics.
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Report type classification.
 */
export const reportTypeEnum = z.enum([
  "project_status",
  "budget_variance",
  "payment_status",
  "change_order_summary",
  "bid_comparison",
  "cost_performance",
  "cash_flow",
  "commitment_summary",
  "custom",
]);
export type ReportType = z.infer<typeof reportTypeEnum>;

// Const array for runtime iteration
export const REPORT_TYPES = reportTypeEnum.options;

/**
 * Aggregation functions for report columns.
 */
export const aggregationFunctionEnum = z.enum([
  "sum",
  "avg",
  "count",
  "min",
  "max",
]);
export type AggregationFunction = z.infer<typeof aggregationFunctionEnum>;

// Const array for runtime iteration
export const AGGREGATION_FUNCTIONS = aggregationFunctionEnum.options;

/**
 * Chart visualization types.
 */
export const chartTypeEnum = z.enum([
  "bar",
  "line",
  "pie",
  "doughnut",
  "area",
  "table",
]);
export type ChartType = z.infer<typeof chartTypeEnum>;

// Const array for runtime iteration
export const CHART_TYPES = chartTypeEnum.options;

/**
 * Filter comparison operators.
 */
export const filterOperatorEnum = z.enum([
  "equals",
  "not_equals",
  "greater_than",
  "less_than",
  "contains",
  "in",
  "between",
  "is_null",
  "is_not_null",
]);
export type FilterOperator = z.infer<typeof filterOperatorEnum>;

// Const array for runtime iteration
export const FILTER_OPERATORS = filterOperatorEnum.options;

/**
 * Report schedule frequency.
 */
export const scheduleFrequencyEnum = z.enum([
  "daily",
  "weekly",
  "monthly",
  "quarterly",
]);
export type ScheduleFrequency = z.infer<typeof scheduleFrequencyEnum>;

// Const array for runtime iteration
export const SCHEDULE_FREQUENCIES = scheduleFrequencyEnum.options;

/**
 * Export file formats.
 */
export const exportFormatEnum = z.enum(["pdf", "excel", "csv"]);
export type ExportFormat = z.infer<typeof exportFormatEnum>;

// Const array for runtime iteration
export const EXPORT_FORMATS = exportFormatEnum.options;

/**
 * Report definition status lifecycle.
 */
export const reportStatusEnum = z.enum(["draft", "active", "archived"]);
export type ReportStatus = z.infer<typeof reportStatusEnum>;

// Const array for runtime iteration
export const REPORT_STATUSES = reportStatusEnum.options;

/**
 * Data source for report queries.
 */
export const dataSourceEnum = z.enum([
  "projects",
  "budgets",
  "change_orders",
  "payment_apps",
  "bids",
  "commitments",
]);
export type DataSource = z.infer<typeof dataSourceEnum>;

// Const array for runtime iteration
export const DATA_SOURCES = dataSourceEnum.options;

/**
 * Data types for filter values.
 */
export const filterDataTypeEnum = z.enum(["string", "number", "date", "boolean"]);
export type FilterDataType = z.infer<typeof filterDataTypeEnum>;

// Const array for runtime iteration
export const FILTER_DATA_TYPES = filterDataTypeEnum.options;

// ============================================================================
// Schemas
// ============================================================================

/**
 * Report filter configuration.
 * Defines a single filter condition for a report query.
 */
export const reportFilterSchema = z.object({
  field: z.string().min(1).max(100),
  operator: filterOperatorEnum,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.unknown())]).optional(),
  dataType: filterDataTypeEnum,
});
export type ReportFilter = z.infer<typeof reportFilterSchema>;

/**
 * Report column configuration.
 * Defines a column in the report output.
 */
export const reportColumnSchema = z.object({
  field: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  aggregation: aggregationFunctionEnum.optional(),
  format: z.string().max(50).optional(), // e.g., "currency", "percent", "date"
  width: z.number().int().positive().optional(), // Column width in pixels
});
export type ReportColumn = z.infer<typeof reportColumnSchema>;

/**
 * Report chart visualization configuration.
 */
export const reportChartConfigSchema = z.object({
  chartType: chartTypeEnum,
  xAxis: z.string().min(1).max(100),
  yAxis: z.string().min(1).max(100),
  groupBy: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
});
export type ReportChartConfig = z.infer<typeof reportChartConfigSchema>;

/**
 * Sort configuration for reports.
 */
export const reportSortSchema = z.object({
  field: z.string().min(1).max(100),
  direction: z.enum(["asc", "desc"]),
});
export type ReportSort = z.infer<typeof reportSortSchema>;

/**
 * Report definition - full user-created report configuration.
 */
export const reportDefinitionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: reportTypeEnum,
  dataSource: dataSourceEnum,
  filters: z.array(reportFilterSchema).default([]),
  columns: z.array(reportColumnSchema).min(1),
  sortBy: reportSortSchema.optional(),
  groupBy: z.string().max(100).optional(),
  chartConfig: reportChartConfigSchema.optional(),
  status: reportStatusEnum.default("active"),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReportDefinition = z.infer<typeof reportDefinitionSchema>;

/**
 * Report template - pre-built report configuration that can be instantiated.
 */
export const reportTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: reportTypeEnum,
  isSystem: z.boolean().default(false),
  definition: z.object({
    type: reportTypeEnum,
    dataSource: dataSourceEnum,
    filters: z.array(reportFilterSchema).default([]),
    columns: z.array(reportColumnSchema).min(1),
    sortBy: reportSortSchema.optional(),
    groupBy: z.string().max(100).optional(),
    chartConfig: reportChartConfigSchema.optional(),
    status: reportStatusEnum.default("active"),
  }),
  previewImageUrl: z.string().url().optional(),
  createdAt: z.string().datetime(),
});
export type ReportTemplate = z.infer<typeof reportTemplateSchema>;

/**
 * Report schedule - automated report generation and delivery.
 */
export const reportScheduleSchema = z.object({
  id: z.string().uuid(),
  reportDefinitionId: z.string().uuid(),
  name: z.string().min(1).max(200),
  frequency: scheduleFrequencyEnum,
  dayOfWeek: z.number().int().min(0).max(6).optional(), // 0 = Sunday
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/), // HH:MM format
  recipients: z.array(z.string().email()).min(1),
  format: exportFormatEnum,
  isActive: z.boolean().default(true),
  lastRunAt: z.string().datetime().optional(),
  nextRunAt: z.string().datetime().optional(),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReportSchedule = z.infer<typeof reportScheduleSchema>;

/**
 * Materialized report data - cached report results with TTL.
 */
export const materializedReportDataSchema = z.object({
  id: z.string().uuid(),
  reportDefinitionId: z.string().uuid(),
  data: z.unknown(), // JSONB - flexible report output
  generatedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});
export type MaterializedReportData = z.infer<typeof materializedReportDataSchema>;

// ============================================================================
// Analytics Metrics Interfaces
// ============================================================================

/**
 * Budget variance analysis metrics for a cost code or project.
 */
export interface BudgetVarianceMetrics {
  budgeted: number;
  committed: number;
  actual: number;
  variance: number;
  variancePercent: number;
  status: "ok" | "warning" | "critical";
}

/**
 * Cost performance metrics using Earned Value Management (EVM).
 * Follows standard EVM formulas for project cost analysis.
 */
export interface CostPerformanceMetrics {
  budgetAtCompletion: number; // BAC - total project budget
  earnedValue: number; // EV - value of work completed
  actualCost: number; // AC - actual cost incurred
  costVariance: number; // CV = EV - AC
  costPerformanceIndex: number; // CPI = EV / AC
  estimateAtCompletion: number; // EAC = BAC / CPI
  estimateToComplete: number; // ETC = EAC - AC
  varianceAtCompletion: number; // VAC = BAC - EAC
}

/**
 * Cash flow projection for a time period.
 */
export interface CashFlowProjection {
  period: string; // e.g., "2024-01", "2024-Q1"
  inflow: number;
  outflow: number;
  net: number;
  cumulativeNet: number;
}

/**
 * Report export options for PDF/Excel generation.
 */
export interface ReportExportOptions {
  format: ExportFormat;
  includeCharts: boolean;
  pageOrientation: "portrait" | "landscape";
  paperSize: "letter" | "a4";
}

// ============================================================================
// Create/Update Schemas
// ============================================================================

/**
 * Create report definition schema (omits auto-generated fields).
 */
export const createReportDefinitionSchema = reportDefinitionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateReportDefinition = z.infer<typeof createReportDefinitionSchema>;

/**
 * Update report definition schema (all fields optional except id).
 */
export const updateReportDefinitionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  filters: z.array(reportFilterSchema).optional(),
  columns: z.array(reportColumnSchema).min(1).optional(),
  sortBy: reportSortSchema.optional(),
  groupBy: z.string().max(100).optional(),
  chartConfig: reportChartConfigSchema.optional(),
  status: reportStatusEnum.optional(),
});
export type UpdateReportDefinition = z.infer<typeof updateReportDefinitionSchema>;

/**
 * Create report schedule schema (omits auto-generated fields).
 */
export const createReportScheduleSchema = reportScheduleSchema.omit({
  id: true,
  lastRunAt: true,
  nextRunAt: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateReportSchedule = z.infer<typeof createReportScheduleSchema>;

/**
 * Update report schedule schema (all fields optional except id).
 */
export const updateReportScheduleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  frequency: scheduleFrequencyEnum.optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  recipients: z.array(z.string().email()).min(1).optional(),
  format: exportFormatEnum.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateReportSchedule = z.infer<typeof updateReportScheduleSchema>;
