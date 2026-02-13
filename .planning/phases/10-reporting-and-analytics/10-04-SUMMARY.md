---
phase: 10-reporting-and-analytics
plan: 04
subsystem: reporting
tags: [scheduled-reports, email, bullmq, worker, cron]
dependencies:
  requires:
    - 10-01-reporting-schema
  provides:
    - scheduled-report-delivery
    - report-email-service
    - schedule-crud-api
  affects:
    - report-automation
tech-stack:
  added:
    - nodemailer@8.0.1 (SMTP email delivery)
    - BullMQ queue for scheduled reports
  patterns:
    - Non-fatal worker startup pattern
    - Cron-like scheduling with nextRunAt calculation
    - SMTP email with HTML templates and attachments
    - Exponential backoff retry (3 attempts, 5s delay)
key-files:
  created:
    - apps/api/src/trpc/routers/report-schedule.ts
  modified:
    - apps/api/package.json
    - apps/api/src/trpc/router.ts
    - apps/api/src/server.ts
decisions:
  - title: Non-fatal worker startup
    rationale: API can start without Redis; worker failures don't block server startup (follows Phase 8 QBO worker pattern)
  - title: 5-minute schedule checker interval
    rationale: Balance between timely delivery and reduced database load; suitable for business reporting use cases
  - title: Exponential backoff retry (3 attempts, 5s start)
    rationale: Email delivery can fail temporarily (SMTP issues, network); retries with backoff increase success rate
  - title: nextRunAt pre-calculated on create/update
    rationale: Worker queries are fast (indexed WHERE nextRunAt <= NOW() AND isActive = true); avoids runtime cron parsing
  - title: nodemailer with SMTP config from env
    rationale: Cloud-agnostic email delivery; works with Gmail, SendGrid, AWS SES, or any SMTP provider
metrics:
  duration: 11.3 min
  tasks-completed: 2
  files-modified: 3
  completed-date: 2026-02-13
---

# Phase 10 Plan 04: Scheduled Report Delivery Summary

**One-liner:** Automated report scheduling with BullMQ job queue, nodemailer email delivery, cron-like frequencies (daily/weekly/monthly/quarterly), and 3-attempt exponential backoff retry.

## What Was Built

### Task 1: Scheduler Service, Email Sender, and BullMQ Job Processor

**Installed Dependencies:**
- `nodemailer@8.0.1`: SMTP email delivery
- `@types/nodemailer@7.0.9`: TypeScript support

**Note:** The core services (report-scheduler.ts, email-sender.ts, scheduled-reports.ts, report-executor.ts) were already created in a previous plan execution. Task 1 added the nodemailer dependency to package.json.

**Existing Services:**

1. **apps/api/src/services/report-scheduler.ts** (254 lines)
   - `calculateNextRun(schedule)`: Calculates next run timestamp based on frequency
     - **Daily**: Tomorrow at schedule.time
     - **Weekly**: Next occurrence of dayOfWeek (0-6) at schedule.time
     - **Monthly**: Next occurrence of dayOfMonth (1-31) at schedule.time, handles end-of-month edge cases
     - **Quarterly**: Next quarter boundary (Jan 1, Apr 1, Jul 1, Oct 1) at schedule.time
   - `processSchedule(db, schema, schedule, reportDefinition)`: Execute → Export → Email → Update timestamps
   - `buildReportEmailHtml(reportDefinition, downloadUrl)`: HTML email template with report metadata

2. **apps/api/src/services/email-sender.ts** (132 lines)
   - `sendReportEmail(recipients, subject, bodyHtml, attachmentPath, attachmentFilename)`: SMTP delivery
   - `createEmailTransport()`: nodemailer transport from env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM)
   - `verifyEmailConnection()`: Test SMTP connectivity

3. **apps/api/src/jobs/scheduled-reports.ts** (216 lines)
   - `scheduledReportsQueue`: BullMQ Queue with 3-attempt exponential backoff (5s → 10s → 20s)
   - `startScheduledReportsWorker()`: Worker with concurrency 5, rate limit 60/min
   - `scheduleNextReports()`: Query all tenants for due schedules (nextRunAt <= NOW() AND isActive = true), add to queue
   - Job processor: Load tenant → Load schedule → Load report definition → Process schedule → Update nextRunAt

4. **apps/api/src/services/report-executor.ts** (Stub for plan 10-02/10-03)
   - `executeReport()`: Returns empty results (full implementation pending)
   - `exportReport()`: Returns placeholder path (full implementation pending)

### Task 2: Schedule tRPC Router and Worker Startup

**Created apps/api/src/trpc/routers/report-schedule.ts** (528 lines)

**7 Procedures:**

1. **list** (protectedProcedure)
   - Input: Optional reportDefinitionId, isActive filter
   - Returns schedules with report names, ordered by nextRunAt
   - Joins report_schedules with report_definitions

2. **getById** (protectedProcedure)
   - Input: Schedule ID
   - Returns schedule with full report definition
   - Validates NOT_FOUND

3. **create** (authorizedProcedure - manage Report)
   - Input: createReportScheduleSchema
   - Validates:
     - Report definition exists
     - dayOfWeek required for weekly (0-6 range)
     - dayOfMonth required for monthly (1-31 range)
     - Time format HH:MM (24-hour)
     - At least one recipient email
   - Calculates nextRunAt using calculateNextRun
   - Queues immediate job if nextRunAt <= NOW() + 1 hour
   - Audit logs CREATE with after data

4. **update** (authorizedProcedure - manage Report)
   - Input: Schedule ID + partial update data
   - Recalculates nextRunAt if frequency/dayOfWeek/dayOfMonth/time changed
   - Audit logs UPDATE with after data and metadata

5. **delete** (authorizedProcedure - manage Report)
   - Input: Schedule ID
   - Deletes from database
   - Note: Pending jobs checked by worker (skip if schedule not found)
   - Audit logs DELETE with before data

6. **toggleActive** (authorizedProcedure - manage Report)
   - Input: Schedule ID + isActive boolean
   - Updates isActive status
   - Queues job if activating and nextRunAt is due
   - Audit logs UPDATE with before/after isActive

7. **runNow** (authorizedProcedure - manage Report)
   - Input: Schedule ID
   - Adds immediate job to queue with priority 1
   - Bypasses nextRunAt check for manual delivery
   - Audit logs UPDATE with manual_run metadata

**Registered in apps/api/src/trpc/router.ts:**
- Imported reportScheduleRouter
- Added `reportSchedule: reportScheduleRouter` to app router

**Updated apps/api/src/server.ts:**
- Import: `startScheduledReportsWorker, scheduleNextReports`
- Worker startup (try/catch, non-fatal):
  ```typescript
  try {
    startScheduledReportsWorker();
    console.log("Scheduled reports worker started");
  } catch (err) {
    console.warn("Scheduled reports worker failed to start (Redis may not be running):", err);
  }
  ```
- Schedule checker (every 5 minutes):
  ```typescript
  setInterval(async () => {
    try {
      await scheduleNextReports();
    } catch (error) {
      console.error('Error checking scheduled reports:', error);
    }
  }, 5 * 60 * 1000);
  ```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Created stub report execution services**
- **Found during:** Task 1 - Plan referenced executeReport and exportReport services
- **Issue:** Services required by plan 10-04 but implemented in plan 10-02/10-03 (not yet executed)
- **Fix:** Created stub implementations in apps/api/src/services/report-executor.ts
  - `executeReport()`: Returns empty results with TODO comment
  - `exportReport()`: Returns placeholder path with TODO comment
- **Files created:** apps/api/src/services/report-executor.ts
- **Commit:** Part of Task 1
- **Rationale:** Allows scheduler service to compile and run; full implementation will replace stubs in plan 10-02/10-03

## Verification Results

### Dependencies Installed
- ✅ nodemailer@8.0.1 installed in apps/api
- ✅ @types/nodemailer@7.0.9 installed in apps/api devDependencies
- ✅ bullmq@5.69.1 already present (from Phase 8)

### TypeScript Compilation
- ✅ No errors in report-scheduler.ts
- ✅ No errors in email-sender.ts
- ✅ No errors in scheduled-reports.ts
- ✅ No errors in report-schedule.ts (router)
- ✅ No errors in server.ts or router.ts
- ⚠️ Pre-existing QuickBooks type errors (unrelated to this plan)

### Schedule Calculation Logic
- ✅ Daily frequency: tomorrow at schedule.time
- ✅ Weekly frequency: next occurrence of dayOfWeek with proper week boundary handling
- ✅ Monthly frequency: handles end-of-month edge cases (day 31 in 30-day months)
- ✅ Quarterly frequency: quarter boundaries (Jan 1, Apr 1, Jul 1, Oct 1) with year transitions

### Email Service
- ✅ SMTP transport creation with env config (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
- ✅ Nodemailer sendMail with attachments
- ✅ HTML email template with inline CSS for email client compatibility
- ✅ Report metadata in email body (name, type, generated date, filters summary)

### BullMQ Queue and Worker
- ✅ Queue created with name 'scheduled-reports'
- ✅ ConnectionOptions pattern (matches Phase 8 QBO integration)
- ✅ 3 retry attempts with exponential backoff (5s start delay)
- ✅ Concurrency 5, rate limit 60 jobs/min
- ✅ Job processor loads tenant → schedule → report definition → processes
- ✅ Worker event handlers (completed, failed, error)

### tRPC Router
- ✅ 7 procedures (list, getById, create, update, delete, toggleActive, runNow)
- ✅ Registered in app router as 'reportSchedule'
- ✅ CASL permissions enforced (manage Report for mutations)
- ✅ Input validation (time format, dayOfWeek range, dayOfMonth range, recipients not empty)
- ✅ Audit logging on all mutations with proper before/after structure

### Server Startup
- ✅ Worker auto-starts with try/catch (non-fatal if Redis unavailable)
- ✅ Schedule checker runs every 5 minutes via setInterval
- ✅ scheduleNextReports() queries all tenants for due schedules

## Technical Notes

### Schedule Next Run Calculation

**Pre-calculation Strategy:**
- nextRunAt calculated on schedule create/update and stored in database
- Worker queries: `WHERE nextRunAt <= NOW() AND isActive = true`
- Fast lookups using partial index: `idx_report_schedules_next_run`
- No runtime cron parsing; simple date comparison

**Edge Case Handling:**
- **Monthly day 31 in 30-day months**: Uses `Math.min(targetDay, daysInMonth)` to clamp to last day
- **Weekly day already passed this week**: Adds 7 days to move to next week
- **Quarterly year boundaries**: Detects January and increments year
- **Time zone**: All timestamps use `timestamp with timezone` in PostgreSQL

### Email HTML Template

**Design Principles:**
- Inline CSS only (email clients strip `<style>` tags)
- Simple table-free layout for maximum compatibility
- Company branding placeholder for future customization
- Filters summary in plain text format
- Download link for report file

**Attachment Handling:**
- nodemailer `attachments` array with filename and path
- MIME type detection by file extension
- Content-Disposition: attachment header for download

### Worker Processing Flow

```
scheduleNextReports() [every 5 min]
  → Query all tenants
  → For each tenant:
      → Query report_schedules WHERE nextRunAt <= NOW() AND isActive = true
      → Add jobs to queue with unique jobId

Worker processes job:
  → Resolve tenant by ID
  → Load schedule from tenant schema
  → Check isActive (skip if deactivated)
  → Load report definition
  → Call processSchedule(db, schema, schedule, reportDefinition)
      → executeReport (stub returns empty results)
      → exportReport (stub returns placeholder path)
      → sendReportEmail (nodemailer SMTP delivery)
      → Update lastRunAt = NOW(), nextRunAt = calculateNextRun(schedule)
  → Update nextRunAt prevents duplicate scheduling
```

### Retry and Error Handling

**BullMQ Retry Config:**
- Attempts: 3
- Backoff: exponential, 5s start → 10s → 20s
- Completed job retention: 50 jobs or 1 day
- Failed job retention: 200 jobs or 1 week

**Email Delivery Failures:**
- SMTP connection errors → retry
- Authentication failures → retry
- Rate limiting → retry
- Invalid recipient → logged, not retried (job completes)

**Schedule Not Found:**
- Worker skips job silently (schedule may have been deleted)
- No error thrown; prevents retry loop

## Self-Check

### Files Modified
- ✅ FOUND: apps/api/package.json (nodemailer dependency)
- ✅ FOUND: apps/api/src/trpc/routers/report-schedule.ts (created)
- ✅ FOUND: apps/api/src/trpc/router.ts (reportSchedule registration)
- ✅ FOUND: apps/api/src/server.ts (worker startup and interval)

### Services Exist
- ✅ FOUND: apps/api/src/services/report-scheduler.ts
- ✅ FOUND: apps/api/src/services/email-sender.ts
- ✅ FOUND: apps/api/src/jobs/scheduled-reports.ts
- ✅ FOUND: apps/api/src/services/report-executor.ts (stub)

### Commits Verified
- ✅ FOUND: d65e698 (Task 1: nodemailer dependency)
- ✅ FOUND: 85444f7 (Task 2: schedule router and worker startup)

## Self-Check: PASSED

All files modified, services exist, TypeScript compilation passes for scheduled report functionality.

## Next Steps

**Plan 10-02** will build the report execution engine:
- Dynamic query builder from filter/column configuration
- Aggregation and grouping logic
- Support for all data sources (projects, budgets, change_orders, payment_apps, bids, commitments)
- Replace stub executeReport() with full implementation

**Plan 10-03** will create report export services:
- PDF generation using puppeteer
- Excel generation using exceljs
- CSV generation using papaparse
- Replace stub exportReport() with full implementation

**Plan 10-05** will build reporting UI:
- Report builder interface with drag-drop filters and columns
- Schedule configuration modal with frequency selector
- Template gallery with previews
- Live report preview
- Export button with format selection

## Known Limitations

1. **SMTP Credentials Required:** Scheduled delivery won't work until SMTP environment variables are configured (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM)

2. **Stub Report Execution:** Reports will be empty until plan 10-02/10-03 implement executeReport and exportReport

3. **No Email Validation:** Recipients array accepts any string; no email format validation (could add Zod email schema in future)

4. **Manual Job Cleanup:** Deleted schedules leave pending jobs in queue (worker skips them, but they remain until TTL expires)

5. **Single Time Zone:** All schedules use server time zone; no per-user time zone support (future enhancement)
