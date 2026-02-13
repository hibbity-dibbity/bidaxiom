/**
 * Report Scheduler Service
 *
 * Calculates next run times for scheduled reports and processes report delivery.
 * Supports daily, weekly, monthly, and quarterly scheduling frequencies.
 */

import type { ReportSchedule, ReportDefinition, ScheduleFrequency } from '@construction/shared';
import { eq } from 'drizzle-orm';
import { executeReport, exportReport } from './report-executor.js';
import { sendReportEmail } from './email-sender.js';

/**
 * Calculate the next run time for a schedule based on its frequency.
 *
 * @param schedule - Report schedule configuration
 * @returns Next run timestamp
 */
export function calculateNextRun(schedule: ReportSchedule): Date {
  const now = new Date();
  const [hours, minutes] = schedule.time.split(':').map(Number);

  let nextRun = new Date();

  switch (schedule.frequency as ScheduleFrequency) {
    case 'daily': {
      // Tomorrow at schedule.time
      nextRun.setDate(now.getDate() + 1);
      nextRun.setHours(hours, minutes, 0, 0);
      break;
    }

    case 'weekly': {
      // Next occurrence of schedule.dayOfWeek at schedule.time
      if (schedule.dayOfWeek === null || schedule.dayOfWeek === undefined) {
        throw new Error('dayOfWeek is required for weekly schedules');
      }

      const currentDayOfWeek = now.getDay();
      const targetDayOfWeek = schedule.dayOfWeek;

      let daysUntilTarget = targetDayOfWeek - currentDayOfWeek;
      if (daysUntilTarget <= 0) {
        daysUntilTarget += 7; // Next week
      }

      nextRun.setDate(now.getDate() + daysUntilTarget);
      nextRun.setHours(hours, minutes, 0, 0);

      // If the calculated time is in the past (today but earlier), add a week
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 7);
      }
      break;
    }

    case 'monthly': {
      // Next occurrence of schedule.dayOfMonth at schedule.time
      if (schedule.dayOfMonth === null || schedule.dayOfMonth === undefined) {
        throw new Error('dayOfMonth is required for monthly schedules');
      }

      const targetDay = schedule.dayOfMonth;

      // Start with next month
      nextRun.setMonth(now.getMonth() + 1);
      nextRun.setHours(hours, minutes, 0, 0);

      // Handle end-of-month edge cases (e.g., day 31 in 30-day months)
      const daysInNextMonth = new Date(
        nextRun.getFullYear(),
        nextRun.getMonth() + 1,
        0
      ).getDate();

      const actualDay = Math.min(targetDay, daysInNextMonth);
      nextRun.setDate(actualDay);

      // If we're still in the current month and the target day hasn't passed yet
      if (now.getDate() < targetDay && actualDay <= daysInNextMonth) {
        nextRun.setMonth(now.getMonth());
        nextRun.setDate(actualDay);
      }
      break;
    }

    case 'quarterly': {
      // Next quarter boundary (Jan 1, Apr 1, Jul 1, Oct 1) at schedule.time
      const currentMonth = now.getMonth();
      let nextQuarterMonth: number;

      if (currentMonth < 3) {
        nextQuarterMonth = 3; // April
      } else if (currentMonth < 6) {
        nextQuarterMonth = 6; // July
      } else if (currentMonth < 9) {
        nextQuarterMonth = 9; // October
      } else {
        nextQuarterMonth = 0; // January (next year)
      }

      nextRun.setMonth(nextQuarterMonth);
      nextRun.setDate(1);
      nextRun.setHours(hours, minutes, 0, 0);

      // If we're moving to January, increment the year
      if (nextQuarterMonth === 0) {
        nextRun.setFullYear(now.getFullYear() + 1);
      }

      // If the calculated time is in the past, move to next quarter
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 3);
        if (nextRun.getMonth() === 0) {
          nextRun.setFullYear(nextRun.getFullYear() + 1);
        }
      }
      break;
    }

    default: {
      throw new Error(`Unsupported frequency: ${schedule.frequency}`);
    }
  }

  return nextRun;
}

/**
 * Process a scheduled report: execute, export, and email.
 *
 * @param db - Database instance
 * @param schema - Tenant schema
 * @param schedule - Report schedule
 * @param reportDefinition - Report configuration
 * @returns Processing result with success status
 */
export async function processSchedule(
  db: any,
  schema: any,
  schedule: ReportSchedule,
  reportDefinition: ReportDefinition
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Processing scheduled report: ${reportDefinition.name} (${schedule.id})`);

    // 1. Execute report
    const reportResults = await executeReport(db, schema, reportDefinition);

    // 2. Export to requested format
    const exportPath = await exportReport(
      reportResults,
      reportDefinition,
      schedule.format as 'pdf' | 'excel' | 'csv'
    );

    // 3. Send email with attachment
    const emailSubject = `Scheduled Report: ${reportDefinition.name}`;
    const emailBody = buildReportEmailHtml(reportDefinition, exportPath);

    const emailResult = await sendReportEmail(
      schedule.recipients,
      emailSubject,
      emailBody,
      exportPath,
      `${reportDefinition.name}.${schedule.format}`
    );

    if (!emailResult.success) {
      return {
        success: false,
        error: emailResult.error || 'Email delivery failed',
      };
    }

    // 4. Update schedule timestamps
    const now = new Date();
    const nextRunAt = calculateNextRun(schedule);

    await db
      .update(schema.reportSchedules)
      .set({
        lastRunAt: now,
        nextRunAt: nextRunAt,
        updatedAt: now,
      })
      .where(eq(schema.reportSchedules.id, schedule.id));

    console.log(
      `Successfully processed scheduled report ${schedule.id}. Next run: ${nextRunAt.toISOString()}`
    );

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to process scheduled report ${schedule.id}:`, errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Build HTML email body for report delivery.
 *
 * @param reportDefinition - Report configuration
 * @param downloadUrl - URL or path to download the report
 * @returns HTML email content
 */
function buildReportEmailHtml(
  reportDefinition: ReportDefinition,
  downloadUrl: string
): string {
  const generatedDate = new Date().toLocaleString();

  // Build filters summary
  const filtersSummary = reportDefinition.filters.length > 0
    ? reportDefinition.filters
        .map((filter: any) => `${filter.field} ${filter.operator} ${filter.value || '(empty)'}`)
        .join(', ')
    : 'No filters applied';

  // Simple inline CSS for email client compatibility
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${reportDefinition.name}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #2563eb;
      color: white;
      padding: 20px;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background-color: #f9fafb;
      padding: 20px;
      border: 1px solid #e5e7eb;
      border-top: none;
    }
    .info-row {
      margin: 10px 0;
    }
    .label {
      font-weight: bold;
      color: #6b7280;
    }
    .download-button {
      display: inline-block;
      background-color: #2563eb;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      margin-top: 20px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0;">${reportDefinition.name}</h1>
    <p style="margin: 5px 0 0 0; opacity: 0.9;">Scheduled Report Delivery</p>
  </div>

  <div class="content">
    ${reportDefinition.description ? `<p>${reportDefinition.description}</p>` : ''}

    <div class="info-row">
      <span class="label">Report Type:</span> ${reportDefinition.type.replace(/_/g, ' ').toUpperCase()}
    </div>

    <div class="info-row">
      <span class="label">Generated:</span> ${generatedDate}
    </div>

    <div class="info-row">
      <span class="label">Filters Applied:</span> ${filtersSummary}
    </div>

    <div class="info-row">
      <span class="label">Format:</span> ${reportDefinition.name.split('.').pop()?.toUpperCase() || 'PDF'}
    </div>

    <p style="margin-top: 20px;">
      Your scheduled report is attached to this email. You can also download it using the link below.
    </p>

    <a href="file://${downloadUrl}" class="download-button">Download Report</a>
  </div>

  <div class="footer">
    <p>
      This is an automated report delivery from your Construction Management System.
      To modify or cancel this scheduled report, please visit the Reports section of your dashboard.
    </p>
  </div>
</body>
</html>
  `.trim();
}
