import { Worker, Job, UnrecoverableError } from 'bullmq';
import { eq, and, desc } from 'drizzle-orm';
import { redisConnection, type QboSyncJobData } from '../queue.js';
import { dispatchSync, type SyncParams } from './mappers/index.js';
import { createQboClient } from '../client.js';
import { getFreshAccess } from '../access.js';
import { isSyncTokenConflict } from './conflict.js';
import { db as publicDb } from '../../../db/client.js';
import { tenants } from '../../../db/schema/public.js';
import { createTenantDb } from '../../../db/client.js';

/**
 * Start the BullMQ worker that processes QuickBooks sync jobs.
 * Handles bidirectional sync between platform and QBO.
 *
 * Worker configuration:
 * - Concurrency: 10 (matches QBO concurrent request limit)
 * - Rate limit: 400 jobs/min (buffer under QBO's 500/min limit)
 * - Retry: 5 attempts with exponential backoff (handled by queue config)
 *
 * @returns Running BullMQ Worker instance
 */
export function startQboSyncWorker(): Worker {
  const worker = new Worker<QboSyncJobData>(
    'qbo-sync',
    async (job: Job<QboSyncJobData>) => {
      const { tenantId, entityType, platformId, qboId, syncReason } = job.data;

      console.log(`Processing ${job.name} for tenant ${tenantId}, entity ${entityType}, reason: ${syncReason}`);

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
        const schema = tenantDbContext; // createTenantDb returns flat structure with all tables

        // 3. Get active QBO connection
        const [connection] = await db
          .select()
          .from(schema.qboConnections)
          .where(eq(schema.qboConnections.status, 'active'))
          .limit(1);

        if (!connection) {
          console.log(`No active QBO connection for tenant ${tenantId}. Skipping sync.`);
          return; // Skip job silently - connection may have been disconnected
        }

        // 4. A valid access token (renewed once, under a lock, however many jobs need it at the same time)
        const fresh = await getFreshAccess(db, schema, connection.id);
        const accessToken = fresh.accessToken;
        const realmId = fresh.realmId;

        // 5. Create QBO client
        const qboClient = createQboClient(accessToken, realmId);

        // 6. Determine sync direction from job name
        const direction = job.name === 'sync-to-qbo' ? 'to-qbo' : 'from-qbo';

        // 7. Prepare sync parameters
        const syncParams: SyncParams = {
          tenantId,
          db,
          schema,
          qboClient,
          accessToken,
          realmId,
          platformId,
          qboId,
          createdBy: 'system', // Worker-triggered syncs use 'system' as creator
        };

        // 8. Dispatch to appropriate mapper
        await dispatchSync(direction, entityType, syncParams);

        // 9. Update sync state on success
        const [syncState] = await db
          .select()
          .from(schema.qboSyncState)
          .where(eq(schema.qboSyncState.entityType, entityType))
          .limit(1);

        if (syncState) {
          await db
            .update(schema.qboSyncState)
            .set({
              lastSuccessfulSync: new Date(),
              syncStatus: 'synced',
              syncedCount: syncState.syncedCount + 1,
              updatedAt: new Date(),
            })
            .where(eq(schema.qboSyncState.id, syncState.id));
        } else {
          // Create sync state if doesn't exist
          await db.insert(schema.qboSyncState).values({
            entityType,
            lastSuccessfulSync: new Date(),
            syncStatus: 'synced',
            syncedCount: 1,
            errorCount: 0,
          });
        }

        // A later success settles earlier failures for the same record: they should not keep reading as current problems.
        if (platformId) {
          await db
            .update(schema.qboSyncNotifications)
            .set({ dismissed: true })
            .where(and(eq(schema.qboSyncNotifications.entityId, platformId), eq(schema.qboSyncNotifications.severity, 'error'), eq(schema.qboSyncNotifications.dismissed, false)))
            .catch(() => undefined);
        }
        console.log(`Successfully synced ${entityType} (${direction}) for tenant ${tenantId}`);
      } catch (error) {
        console.error(`Sync job failed for tenant ${tenantId}, entity ${entityType}:`, error);

        // Handle specific error types
        const errorObj = error as any;

        // Rate limit error (429) - throw to trigger BullMQ retry with backoff
        if (errorObj.statusCode === 429 || errorObj.code === 'RATE_LIMIT') {
          console.log(`Rate limit hit for tenant ${tenantId}. Job will be retried with backoff.`);
          throw error;
        }

        // Auth error (401) - already attempted refresh above, throw to retry
        if (errorObj.statusCode === 401 || errorObj.code === 'AUTH_ERROR') {
          console.error(`Auth error for tenant ${tenantId} even after refresh attempt.`);
          throw error;
        }

        // SyncToken conflict (5010) - do NOT retry, mark as conflict
        if (isSyncTokenConflict(error)) {
          console.log(`SyncToken conflict detected for ${entityType}. User must resolve. Not retrying.`);
          // Don't throw - job completes successfully but entity remains in 'conflict' status
          return;
        }

        // Something QuickBooks refused for a reason a person has to fix: retrying five times only delays the message.
        if (errorObj.name === 'QboUserError') throw new UnrecoverableError(errorObj.message);

        // Other errors - throw to trigger retry
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 3, // QuickBooks allows 500 requests a minute per company and a job makes several, so few at a time
      limiter: {
        max: 60, // jobs per minute (about 6 requests each, under QuickBooks' 500/min)
        duration: 60000, // 60 seconds
      },
    }
  );

  // Event handlers
  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully`);
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;

    console.error(`Job ${job.id} failed:`, err);

    // If all retries exhausted, update sync state and create notification
    if (err.name === 'UnrecoverableError' || job.attemptsMade >= (job.opts.attempts || 5)) {
      console.error(`Job ${job.id} failed after ${job.attemptsMade} attempts. Creating notification.`);

      try {
        const { tenantId, entityType, platformId, qboId } = job.data;

        // Resolve tenant and build context
        const [tenant] = await publicDb
          .select()
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1);

        if (!tenant) return;

        const tenantDbCtx = createTenantDb(tenant.schemaName);
        const db = tenantDbCtx.db;
        const schema = tenantDbCtx;

        // Update sync state with error
        const [syncState] = await db
          .select()
          .from(schema.qboSyncState)
          .where(eq(schema.qboSyncState.entityType, entityType))
          .limit(1);

        if (syncState) {
          await db
            .update(schema.qboSyncState)
            .set({
              syncStatus: 'error',
              errorMessage: err.message,
              errorCount: syncState.errorCount + 1,
              updatedAt: new Date(),
            })
            .where(eq(schema.qboSyncState.id, syncState.id));
        }

        // Create sync failure notification
        await db.insert(schema.qboSyncNotifications).values({
          entityType,
          entityId: platformId || qboId || 'unknown',
          message: err.name === 'UnrecoverableError' ? err.message : /status code 429|rate limit|throttl/i.test(err.message) ? 'QuickBooks was busy and asked us to slow down, so this was not sent. Press Sync again in a minute.' : `Sync failed after ${job.attemptsMade} attempts: ${err.message}`,
          severity: 'error',
          dismissed: false,
        });

        console.log(`Created failure notification for ${entityType} sync failure`);
      } catch (notificationError) {
        console.error('Failed to create sync failure notification:', notificationError);
      }
    }
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  console.log('QuickBooks sync worker started with concurrency 3, rate limit 60 jobs/min');
  return worker;
}
