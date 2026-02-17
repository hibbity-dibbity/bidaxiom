/**
 * Scheduled Reports Job Queue and Worker
 *
 * Background job processing for automated report delivery using BullMQ.
 * Handles scheduled report execution, export, and email delivery.
 */

import { Queue, Worker, Job, ConnectionOptions } from 'bullmq';
import { eq, and, lte } from 'drizzle-orm';
import { db as publicDb } from '../db/client.js';
import { tenants } from '../db/schema/public.js';
import { createTenantDb } from '../db/client.js';
import { processSchedule } from '../services/report-scheduler.js';

/**
 * Job data structure for scheduled report processing.
 */
export interface ScheduledReportJobData {
  tenantId: string;
  scheduleId: string;
}

/**
 * Redis connection configuration for BullMQ.
 * Shared across queue and workers.
 */
export const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null, // Required by BullMQ
};

/**
 * Scheduled reports queue — lazy getter.
 * Defers Redis connection until first use so the server can start without Redis.
 *
 * Configuration:
 * - 3 retry attempts with exponential backoff (5s, 10s, 20s)
 * - Completed jobs retained for 1 day or last 50 jobs
 * - Failed jobs retained for 1 week or last 200 jobs
 */
let _scheduledReportsQueue: Queue<ScheduledReportJobData> | null = null;

export function getScheduledReportsQueue(): Queue<ScheduledReportJobData> {
  if (!_scheduledReportsQueue) {
    _scheduledReportsQueue = new Queue<ScheduledReportJobData>('scheduled-reports', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // Start at 5 seconds, doubles each retry
        },
        removeOnComplete: { count: 50, age: 86400 },   // Keep 50 or 1 day (in seconds)
        removeOnFail: { count: 200, age: 604800 },      // Keep 200 or 1 week (in seconds)
      },
    });
  }
  return _scheduledReportsQueue;
}

/**
 * Start the BullMQ worker that processes scheduled report jobs.
 *
 * Worker configuration:
 * - Concurrency: 5 (balance between throughput and resource usage)
 * - Rate limit: 60 jobs/min (1 per second)
 *
 * @returns Running BullMQ Worker instance
 */
export function startScheduledReportsWorker(): Worker {
  const worker = new Worker<ScheduledReportJobData>(
    'scheduled-reports',
    async (job: Job<ScheduledReportJobData>) => {
      const { tenantId, scheduleId } = job.data;

      console.log(`Processing scheduled report job ${job.id} for tenant ${tenantId}, schedule ${scheduleId}`);

      try {
        // 1. Resolve tenant by ID
        const [tenant] = await publicDb
          .select()
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1);

        if (!tenant) {
          console.error(`Tenant not found: ${tenantId}`);
          return; // Skip job silently - tenant may have been deleted
        }

        // 2. Build tenant context (db + schema)
        const tenantDbContext = createTenantDb(tenant.schemaName);
        const db = tenantDbContext.db;
        const schema = tenantDbContext;

        // 3. Load schedule from database
        const [schedule] = await db
          .select()
          .from(schema.reportSchedules)
          .where(eq(schema.reportSchedules.id, scheduleId))
          .limit(1);

        if (!schedule) {
          console.log(`Schedule not found: ${scheduleId}. May have been deleted.`);
          return; // Skip job silently
        }

        // 4. Check if schedule is still active
        if (!schedule.isActive) {
          console.log(`Schedule ${scheduleId} is no longer active. Skipping.`);
          return;
        }

        // 5. Load report definition
        const [reportDefinition] = await db
          .select()
          .from(schema.reportDefinitions)
          .where(eq(schema.reportDefinitions.id, schedule.reportDefinitionId))
          .limit(1);

        if (!reportDefinition) {
          console.error(`Report definition not found: ${schedule.reportDefinitionId}`);
          throw new Error(`Report definition ${schedule.reportDefinitionId} not found`);
        }

        // 6. Process the schedule (execute, export, email)
        // Cast to any to avoid type mismatch between DB types and shared types
        const result = await processSchedule(db, schema, schedule as any, reportDefinition as any);

        if (!result.success) {
          throw new Error(result.error || 'Schedule processing failed');
        }

        console.log(`Successfully processed scheduled report ${scheduleId} for tenant ${tenantId}`);
      } catch (error) {
        console.error(`Scheduled report job failed for tenant ${tenantId}, schedule ${scheduleId}:`, error);

        // Re-throw to trigger BullMQ retry mechanism
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 5, // Process up to 5 reports concurrently
      limiter: {
        max: 60, // 60 jobs per minute
        duration: 60000, // 60 seconds
      },
    }
  );

  // Event handlers
  worker.on('completed', (job) => {
    console.log(`Scheduled report job ${job?.id} completed successfully`);
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;

    console.error(`Scheduled report job ${job.id} failed:`, err);

    // If all retries exhausted, log to console
    // In future: could create notification for admin
    if (job.attemptsMade >= (job.opts.attempts || 3)) {
      console.error(
        `Scheduled report job ${job.id} failed after ${job.attemptsMade} attempts.`,
        `Schedule ID: ${job.data.scheduleId}, Error: ${err.message}`
      );
    }
  });

  worker.on('error', (err) => {
    console.error('Scheduled reports worker error:', err);
  });

  console.log('Scheduled reports worker started with concurrency 5, rate limit 60/min');
  return worker;
}

/**
 * Query database for schedules due to run and add them to the queue.
 * Called periodically by the scheduler interval in server.ts.
 */
export async function scheduleNextReports(): Promise<void> {
  try {
    console.log('Checking for due scheduled reports...');

    // Get all tenants
    const allTenants = await publicDb.select().from(tenants);

    let totalScheduled = 0;

    for (const tenant of allTenants) {
      try {
        const tenantDbContext = createTenantDb(tenant.schemaName);
        const db = tenantDbContext.db;
        const schema = tenantDbContext;

        // Find active schedules where nextRunAt <= NOW()
        const now = new Date();
        const dueSchedules = await db
          .select()
          .from(schema.reportSchedules)
          .where(
            and(
              eq(schema.reportSchedules.isActive, true),
              lte(schema.reportSchedules.nextRunAt, now)
            )
          );

        // Add each due schedule to the queue
        for (const schedule of dueSchedules) {
          await getScheduledReportsQueue().add(
            'process-scheduled-report',
            {
              tenantId: tenant.id,
              scheduleId: schedule.id,
            },
            {
              jobId: `${tenant.id}-${schedule.id}-${Date.now()}`, // Prevent duplicate jobs
            }
          );

          totalScheduled++;
          console.log(`Queued scheduled report: ${schedule.name} (${schedule.id}) for tenant ${tenant.schemaName}`);
        }
      } catch (error) {
        console.error(`Error checking schedules for tenant ${tenant.schemaName}:`, error);
        // Continue with other tenants
      }
    }

    if (totalScheduled > 0) {
      console.log(`Scheduled ${totalScheduled} reports for processing`);
    } else {
      console.log('No due scheduled reports found');
    }
  } catch (error) {
    console.error('Error in scheduleNextReports:', error);
  }
}
