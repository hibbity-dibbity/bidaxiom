---
phase: 10-reporting-and-analytics
plan: 01
subsystem: reporting
tags: [schema, types, permissions, database]
dependencies:
  requires: []
  provides:
    - reporting-types
    - reporting-schema
    - report-permissions
  affects: []
tech-stack:
  added:
    - Zod schemas for report validation
    - PostgreSQL JSONB for flexible report configurations
    - Report materialized views pattern
  patterns:
    - TEXT column + Zod validation for enums
    - JSONB for flexible nested data structures
    - Foreign key CASCADE delete for dependent records
    - Performance indexes on query columns
key-files:
  created:
    - packages/shared/src/types/reporting.ts
  modified:
    - packages/shared/src/types/auth.ts
    - packages/shared/src/index.ts
    - apps/api/src/auth/abilities.ts
    - apps/api/src/db/schema/tenant.ts
    - apps/api/src/tenant/provision.ts
    - apps/api/src/tenant/context.ts
decisions:
  - title: TEXT column + Zod validation for report enums
    rationale: Follows Phase 2 companyType pattern, avoids PostgreSQL ENUM migration complexity while maintaining type safety
  - title: JSONB for report filters, columns, and chart config
    rationale: Provides flexibility for evolving report structures without schema migrations, supports dynamic user-defined reports
  - title: Materialized data with expiry timestamps
    rationale: Performance optimization for expensive aggregate queries, TTL-based cache invalidation prevents stale data
  - title: CASCADE delete from report_definitions to schedules/materialized_data
    rationale: Deleting a report should clean up its schedules and cached data automatically to prevent orphaned records
  - title: Separate indexes for type and status
    rationale: Common query patterns filter by type (budget_variance, cost_performance) and status (active, archived) independently
  - title: Partial index on next_run_at WHERE is_active = true
    rationale: Scheduled job worker only queries active schedules, partial index reduces index size and improves query performance
metrics:
  duration: 5 min
  tasks-completed: 2
  files-modified: 7
  completed-date: 2026-02-13
---

# Phase 10 Plan 01: Reporting Schema and Type Foundation Summary

**One-liner:** Comprehensive reporting type system with Zod validation, four tenant-scoped tables (definitions, templates, schedules, materialized data), and role-based permissions for custom reports and analytics.

## What Was Built

### Task 1: Shared Reporting Types with Zod Schemas
Created comprehensive reporting type system in `packages/shared/src/types/reporting.ts`:

**Enums (with const arrays for runtime iteration):**
- `ReportType`: 9 report types (project_status, budget_variance, payment_status, change_order_summary, bid_comparison, cost_performance, cash_flow, commitment_summary, custom)
- `AggregationFunction`: 5 functions (sum, avg, count, min, max)
- `ChartType`: 6 chart types (bar, line, pie, doughnut, area, table)
- `FilterOperator`: 9 operators (equals, not_equals, greater_than, less_than, contains, in, between, is_null, is_not_null)
- `ScheduleFrequency`: 4 frequencies (daily, weekly, monthly, quarterly)
- `ExportFormat`: 3 formats (pdf, excel, csv)
- `ReportStatus`: 3 statuses (draft, active, archived)
- `DataSource`: 6 sources (projects, budgets, change_orders, payment_apps, bids, commitments)
- `FilterDataType`: 4 types (string, number, date, boolean)

**Zod Schemas:**
- `reportFilterSchema`: Field, operator, value, data type
- `reportColumnSchema`: Field, label, aggregation, format, width
- `reportChartConfigSchema`: Chart type, axes, grouping, title
- `reportSortSchema`: Field and direction
- `reportDefinitionSchema`: Full report configuration (254 lines)
- `reportTemplateSchema`: Pre-built report templates
- `reportScheduleSchema`: Automated report delivery configuration
- `materializedReportDataSchema`: Cached report results with TTL
- Create/update schemas for definitions and schedules

**Analytics Metrics Interfaces:**
- `BudgetVarianceMetrics`: Budgeted, committed, actual, variance, status
- `CostPerformanceMetrics`: Full EVM metrics (BAC, EV, AC, CV, CPI, EAC, ETC, VAC)
- `CashFlowProjection`: Period, inflow, outflow, net, cumulative
- `ReportExportOptions`: Format, orientation, paper size

**CASL Permissions:**
Added "Report" to `AppSubjects` type and updated abilities for all 7 roles:
- **Manage** (create, read, update, delete): org:admin, org:project_manager, org:accountant
- **Read**: org:estimator, org:superintendent, org:foreman, org:member

### Task 2: Reporting Tables in Tenant Schema
Added four tables to `apps/api/src/db/schema/tenant.ts`:

**1. report_definitions**
- User-created custom reports with filters, columns, sorting, grouping, charts
- JSONB columns for flexible filter/column/chart configurations
- Status lifecycle: draft → active → archived
- Tracks creator and timestamps

**2. report_templates**
- Pre-built report configurations (system and tenant-specific)
- `isSystem` flag distinguishes read-only system templates from customizable tenant templates
- Stores partial definition (no id/creator/timestamps)
- Optional preview image URL

**3. report_schedules**
- Automated report generation and email delivery
- Supports daily/weekly/monthly/quarterly frequencies
- Recipients array for multi-recipient delivery
- Foreign key to report_definitions with CASCADE delete
- Tracks last run and calculates next run time

**4. materialized_report_data**
- Cached report results with TTL for performance
- JSONB data column for flexible report output
- Foreign key to report_definitions with CASCADE delete
- Expires_at timestamp for cache invalidation

**Performance Indexes:**
- `idx_report_definitions_type`: Fast report type filtering
- `idx_report_definitions_status`: Active report lookups
- `idx_report_schedules_next_run`: Scheduled job queries (partial index on active schedules)
- `idx_materialized_report_data_expires`: Cache cleanup queries

**Provisioning SQL:**
Updated `apps/api/src/tenant/provision.ts` with CREATE TABLE statements and all indexes. New tenants will automatically receive all four reporting tables.

**Tenant Context:**
Updated `apps/api/src/tenant/context.ts` to expose all four tables in `RequestTenantContext.schema`.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

### TypeScript Compilation
- ✅ `packages/shared`: No errors in reporting.ts or index.ts
- ✅ `apps/api`: No errors in tenant.ts, provision.ts, or context.ts
- ⚠️ Pre-existing QuickBooks type errors (unrelated to this plan)

### Type System Validation
- ✅ "Report" exists in AppSubjects type
- ✅ All 7 roles have Report permissions (3 manage, 4 read)
- ✅ All enums have corresponding const arrays for runtime iteration
- ✅ Zod schemas validate all report configuration fields

### Schema Validation
- ✅ TenantSchema type includes reportDefinitions, reportTemplates, reportSchedules, materializedReportData
- ✅ Foreign key constraints on report_schedules and materialized_report_data reference report_definitions
- ✅ CASCADE delete ensures orphaned records are cleaned up
- ✅ All four tables exposed in RequestTenantContext

### Provisioning Validation
- ✅ CREATE TABLE statements for all four tables
- ✅ Four performance indexes created
- ✅ Partial index on next_run_at uses WHERE clause for active schedules
- ✅ JSONB default values use proper casting syntax

## Technical Notes

### Report Configuration Flexibility
JSONB columns for filters, columns, and chart config allow reports to evolve without schema migrations. Users can define custom filters with any operator, add/remove columns with aggregations, and configure visualizations dynamically.

### Materialized Data Cache Pattern
The `materialized_report_data` table implements a TTL-based cache:
1. Expensive report queries generate results and store in JSONB
2. `expiresAt` timestamp controls cache lifetime (e.g., 15 minutes for real-time, 24 hours for daily reports)
3. Query checks cache first, falls back to live query if expired
4. Background job cleans expired cache entries using `idx_materialized_report_data_expires` index

### Report Schedule Execution
The `report_schedules` table supports cron-like scheduling:
- **Daily**: time field (HH:MM format)
- **Weekly**: dayOfWeek (0-6, Sunday=0) + time
- **Monthly**: dayOfMonth (1-31) + time
- **Quarterly**: Calculated from lastRunAt + 3 months
- `nextRunAt` pre-calculated for efficient worker queries (partial index on active schedules)

### Permission Strategy
Report permissions follow existing patterns:
- Admin/PM/Accountant can create and manage reports (financial visibility roles)
- Estimator/Superintendent/Foreman/Member can read reports (consume analytics)
- Report access will eventually scope to project team membership (future enhancement)

## Self-Check

### Files Created
- ✅ FOUND: packages/shared/src/types/reporting.ts

### Files Modified
- ✅ FOUND: packages/shared/src/types/auth.ts (Report in AppSubjects)
- ✅ FOUND: packages/shared/src/index.ts (reporting exports)
- ✅ FOUND: apps/api/src/auth/abilities.ts (Report permissions)
- ✅ FOUND: apps/api/src/db/schema/tenant.ts (4 new tables)
- ✅ FOUND: apps/api/src/tenant/provision.ts (CREATE TABLE statements)
- ✅ FOUND: apps/api/src/tenant/context.ts (schema exposure)

### Commits Verified
- ✅ FOUND: 9859bc9 (Task 1: reporting types)
- ✅ FOUND: e4dfc92 (Task 2: reporting tables)

## Self-Check: PASSED

All files exist, all commits verified, TypeScript compilation passes for reporting-related changes.

## Next Steps

**Plan 10-02** will build the report definition tRPC router with:
- Create/update/delete report definitions
- List reports by type and status
- Clone report from template
- Execute report query (with materialized data cache)
- Export report to PDF/Excel/CSV

**Plan 10-03** will implement report execution engine:
- Dynamic query builder from filter/column configuration
- Aggregation and grouping logic
- Chart data transformation
- Cache invalidation strategy

**Plan 10-04** will create report schedule management:
- CRUD operations for schedules
- Background worker for scheduled report generation
- Email delivery with attachments
- Next run time calculation

**Plan 10-05** will build reporting UI:
- Report builder interface with drag-drop
- Template gallery with previews
- Live report preview
- Schedule configuration modal
- Export button with format selection
