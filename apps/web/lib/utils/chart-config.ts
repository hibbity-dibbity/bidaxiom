/**
 * Chart configuration utilities for report builder
 */

export type DataSource =
  | 'projects'
  | 'budgets'
  | 'change_orders'
  | 'bids'
  | 'commitments';

export type DataType = 'string' | 'number' | 'date' | 'boolean';

export interface FieldDefinition {
  id: string;
  label: string;
  dataType: DataType;
  aggregatable: boolean;
}

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'in';

/**
 * Get available fields for a data source
 */
export function getAvailableFields(dataSource: DataSource): FieldDefinition[] {
  const fieldsBySource: Record<DataSource, FieldDefinition[]> = {
    projects: [
      { id: 'name', label: 'Project Name', dataType: 'string', aggregatable: false },
      { id: 'status', label: 'Status', dataType: 'string', aggregatable: false },
      { id: 'budget', label: 'Budget', dataType: 'number', aggregatable: true },
      { id: 'startDate', label: 'Start Date', dataType: 'date', aggregatable: false },
      { id: 'endDate', label: 'End Date', dataType: 'date', aggregatable: false },
      { id: 'createdBy', label: 'Created By', dataType: 'string', aggregatable: false },
      { id: 'createdAt', label: 'Created At', dataType: 'date', aggregatable: false },
    ],
    budgets: [
      { id: 'projectId', label: 'Project', dataType: 'number', aggregatable: false },
      { id: 'costCodeId', label: 'Cost Code', dataType: 'number', aggregatable: false },
      { id: 'budgetedAmount', label: 'Budgeted Amount', dataType: 'number', aggregatable: true },
      { id: 'actualCost', label: 'Actual Cost', dataType: 'number', aggregatable: true },
      { id: 'variance', label: 'Variance', dataType: 'number', aggregatable: true },
      { id: 'isLocked', label: 'Is Locked', dataType: 'boolean', aggregatable: false },
      { id: 'createdAt', label: 'Created At', dataType: 'date', aggregatable: false },
    ],
    change_orders: [
      { id: 'projectId', label: 'Project', dataType: 'number', aggregatable: false },
      { id: 'coNumber', label: 'CO Number', dataType: 'number', aggregatable: false },
      { id: 'type', label: 'Type', dataType: 'string', aggregatable: false },
      { id: 'status', label: 'Status', dataType: 'string', aggregatable: false },
      { id: 'totalAmount', label: 'Total Amount', dataType: 'number', aggregatable: true },
      { id: 'approvedAt', label: 'Approved At', dataType: 'date', aggregatable: false },
      { id: 'createdAt', label: 'Created At', dataType: 'date', aggregatable: false },
    ],
    bids: [
      { id: 'projectId', label: 'Project', dataType: 'number', aggregatable: false },
      { id: 'bidderCompanyName', label: 'Bidder Company', dataType: 'string', aggregatable: false },
      { id: 'totalAmount', label: 'Total Amount', dataType: 'number', aggregatable: true },
      { id: 'status', label: 'Status', dataType: 'string', aggregatable: false },
      { id: 'submittedAt', label: 'Submitted At', dataType: 'date', aggregatable: false },
      { id: 'createdAt', label: 'Created At', dataType: 'date', aggregatable: false },
    ],
    commitments: [
      { id: 'projectId', label: 'Project', dataType: 'number', aggregatable: false },
      { id: 'type', label: 'Type', dataType: 'string', aggregatable: false },
      { id: 'vendorName', label: 'Vendor Name', dataType: 'string', aggregatable: false },
      { id: 'totalAmount', label: 'Total Amount', dataType: 'number', aggregatable: true },
      { id: 'status', label: 'Status', dataType: 'string', aggregatable: false },
      { id: 'executedAt', label: 'Executed At', dataType: 'date', aggregatable: false },
      { id: 'createdAt', label: 'Created At', dataType: 'date', aggregatable: false },
    ],
  };

  return fieldsBySource[dataSource] || [];
}

/**
 * Get available filter operators for a data type
 */
export function getFilterOperatorsByType(dataType: DataType): FilterOperator[] {
  const operatorsByType: Record<DataType, FilterOperator[]> = {
    string: ['equals', 'not_equals', 'contains', 'in'],
    number: ['equals', 'not_equals', 'greater_than', 'less_than', 'between'],
    date: ['equals', 'greater_than', 'less_than', 'between'],
    boolean: ['equals'],
  };

  return operatorsByType[dataType] || [];
}

/**
 * Get operator label for display
 */
export function getOperatorLabel(operator: FilterOperator): string {
  const labels: Record<FilterOperator, string> = {
    equals: 'Equals',
    not_equals: 'Not Equals',
    contains: 'Contains',
    greater_than: 'Greater Than',
    less_than: 'Less Than',
    between: 'Between',
    in: 'In',
  };

  return labels[operator] || operator;
}

/**
 * Get aggregation options for numeric fields
 */
export type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count';

export function getAggregationOptions(): { value: AggregationType; label: string }[] {
  return [
    { value: 'sum', label: 'Sum' },
    { value: 'avg', label: 'Average' },
    { value: 'min', label: 'Minimum' },
    { value: 'max', label: 'Maximum' },
    { value: 'count', label: 'Count' },
  ];
}

/**
 * Chart type options
 */
export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'table';

export function getChartTypeOptions(): { value: ChartType; label: string }[] {
  return [
    { value: 'bar', label: 'Bar Chart' },
    { value: 'line', label: 'Line Chart' },
    { value: 'pie', label: 'Pie Chart' },
    { value: 'area', label: 'Area Chart' },
    { value: 'table', label: 'Table Only' },
  ];
}

/**
 * Format currency values
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

/**
 * Format date values
 */
export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}
