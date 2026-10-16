import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/**
 * Seed system report templates.
 * Templates are stored in the public schema and available to all tenants.
 * Uses upsert pattern for idempotency.
 */
export async function seedReportTemplates(db: NodePgDatabase<any>) {
  const templates = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Project Status Summary',
      description: 'Overview of all active projects with key metrics',
      type: 'project_status',
      isSystem: true,
      definition: {
        type: 'project_status',
        dataSource: 'projects',
        columns: [
          { field: 'name', label: 'Project Name' },
          { field: 'status', label: 'Status' },
          { field: 'budget', label: 'Budget', aggregation: 'sum' },
          { field: 'startDate', label: 'Start Date' },
          { field: 'endDate', label: 'End Date' },
          { field: 'createdBy', label: 'Created By' },
        ],
        filters: [
          {
            field: 'status',
            operator: 'equals',
            value: 'active',
            dataType: 'string',
          },
        ],
        chartConfig: null,
      },
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Budget Variance Report',
      description: 'Analyze budget vs actual costs by cost code',
      type: 'budget_variance',
      isSystem: true,
      definition: {
        type: 'budget_variance',
        dataSource: 'budgets',
        columns: [
          { field: 'projectId', label: 'Project' },
          { field: 'costCodeId', label: 'Cost Code' },
          { field: 'budgetedAmount', label: 'Budgeted', aggregation: 'sum' },
          { field: 'actualCost', label: 'Actual', aggregation: 'sum' },
          { field: 'variance', label: 'Variance', aggregation: 'sum' },
        ],
        filters: [],
        chartConfig: {
          chartType: 'bar',
          xAxis: 'costCodeId',
          yAxis: 'variance',
        },
      },
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      name: 'Change Order Summary',
      description: 'Approved change orders by type',
      type: 'change_order_summary',
      isSystem: true,
      definition: {
        type: 'change_order_summary',
        dataSource: 'change_orders',
        columns: [
          { field: 'projectId', label: 'Project' },
          { field: 'coNumber', label: 'CO #' },
          { field: 'type', label: 'Type' },
          { field: 'status', label: 'Status' },
          { field: 'totalAmount', label: 'Amount', aggregation: 'sum' },
          { field: 'approvedAt', label: 'Approved' },
        ],
        filters: [
          {
            field: 'status',
            operator: 'equals',
            value: 'approved',
            dataType: 'string',
          },
        ],
        chartConfig: {
          chartType: 'pie',
          xAxis: 'type',
          yAxis: 'totalAmount',
          groupBy: 'type',
        },
      },
    },
    {
      id: '00000000-0000-0000-0000-000000000005',
      name: 'Bid Comparison',
      description: 'Compare submitted bids',
      type: 'bid_comparison',
      isSystem: true,
      definition: {
        type: 'bid_comparison',
        dataSource: 'bids',
        columns: [
          { field: 'projectId', label: 'Project' },
          { field: 'bidderCompanyName', label: 'Bidder' },
          { field: 'totalAmount', label: 'Amount', aggregation: 'sum' },
          { field: 'status', label: 'Status' },
          { field: 'submittedAt', label: 'Submitted' },
        ],
        filters: [
          {
            field: 'status',
            operator: 'in',
            value: ['submitted', 'under_review'],
            dataType: 'string',
          },
        ],
        chartConfig: {
          chartType: 'bar',
          xAxis: 'bidderCompanyName',
          yAxis: 'totalAmount',
        },
      },
    },
    {
      id: '00000000-0000-0000-0000-000000000006',
      name: 'Cost Performance',
      description: 'Budgeted vs actual costs by project',
      type: 'cost_performance',
      isSystem: true,
      definition: {
        type: 'cost_performance',
        dataSource: 'budgets',
        columns: [
          { field: 'projectId', label: 'Project' },
          { field: 'budgetedAmount', label: 'Budgeted', aggregation: 'sum' },
          { field: 'actualCost', label: 'Actual', aggregation: 'sum' },
        ],
        filters: [],
        groupBy: 'projectId',
        chartConfig: {
          chartType: 'line',
          xAxis: 'projectId',
          yAxis: 'budgetedAmount',
        },
      },
    },
    {
      id: '00000000-0000-0000-0000-000000000007',
      name: 'Commitment Summary',
      description: 'Approved and executed commitments by type',
      type: 'commitment_summary',
      isSystem: true,
      definition: {
        type: 'commitment_summary',
        dataSource: 'commitments',
        columns: [
          { field: 'projectId', label: 'Project' },
          { field: 'type', label: 'Type' },
          { field: 'vendorName', label: 'Vendor' },
          { field: 'totalAmount', label: 'Amount', aggregation: 'sum' },
          { field: 'status', label: 'Status' },
          { field: 'executedAt', label: 'Executed' },
        ],
        filters: [
          {
            field: 'status',
            operator: 'in',
            value: ['approved', 'executed'],
            dataType: 'string',
          },
        ],
        chartConfig: {
          chartType: 'doughnut',
          xAxis: 'type',
          yAxis: 'totalAmount',
          groupBy: 'type',
        },
      },
    },
  ];

  // Upsert templates (INSERT ... ON CONFLICT DO UPDATE)
  for (const template of templates) {
    await db.execute(sql`
      INSERT INTO public.report_templates (
        id, name, description, type, is_system, definition, created_at, updated_at
      ) VALUES (
        ${template.id},
        ${template.name},
        ${template.description},
        ${template.type},
        ${template.isSystem},
        ${JSON.stringify(template.definition)}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        type = EXCLUDED.type,
        is_system = EXCLUDED.is_system,
        definition = EXCLUDED.definition,
        updated_at = NOW()
    `);
  }

  console.log(`✓ Seeded ${templates.length} report templates`);
}
