import { Worker, Job } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import { calendarSyncQueue, redisConnection, type CalendarSyncJobData } from './queue.js';
import { db as publicDb } from '../../../db/client.js';
import { tenants } from '../../../db/schema/public.js';
import { createTenantDb } from '../../../db/client.js';
import { encryptToken } from './crypto.js';

// Google imports
import { refreshGoogleCalendarToken } from '../google/oauth.js';
import { syncGoogleCalendar, pushEventToGoogle, updateGoogleEvent, deleteGoogleEvent, type GoogleSyncResult } from '../google/sync.js';
import { setupGoogleWebhook, renewGoogleChannel } from '../google/webhooks.js';

// Microsoft imports
import { refreshMicrosoftCalendarToken } from '../microsoft/oauth.js';
import { syncMicrosoftCalendar, pushEventToMicrosoft, updateMicrosoftEvent, deleteMicrosoftEvent, type MicrosoftSyncResult } from '../microsoft/sync.js';
import { setupMicrosoftWebhook, renewMicrosoftSubscription } from '../microsoft/webhooks.js';

// Mappers
import { projectToCalendarEvents } from './mappers.js';

/**
 * Start the BullMQ worker that processes calendar sync jobs.
 * Handles bidirectional sync between platform milestones and calendar providers.
 *
 * Worker configuration:
 * - Concurrency: 3 (conservative due to calendar API rate limits)
 * - Rate limit: 60 jobs/min (well under provider limits)
 * - Retry: 5 attempts with exponential backoff (handled by queue config)
 *
 * @returns Running BullMQ Worker instance
 */
export function startCalendarSyncWorker(): Worker {
  const worker = new Worker<CalendarSyncJobData>(
    'calendar-sync',
    async (job: Job<CalendarSyncJobData>) => {
      const { tenantId, provider, connectionId, operation, projectId, phaseId, eventId, syncReason } = job.data;

      console.log(`Processing ${job.name} for tenant ${tenantId}, provider ${provider}, operation: ${operation}, reason: ${syncReason}`);

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

        // 3. Get calendar connection
        const [connection] = await db
          .select()
          .from(schema.calendarConnections)
          .where(eq(schema.calendarConnections.id, connectionId))
          .limit(1);

        if (!connection) {
          console.log(`Calendar connection not found: ${connectionId}. Skipping sync.`);
          return; // Skip job silently - connection may have been deleted
        }

        if (connection.status !== 'active') {
          console.log(`Calendar connection ${connectionId} is not active (status: ${connection.status}). Skipping sync.`);
          return; // Skip inactive connections
        }

        // 4. Check if access token is expired and refresh if needed
        let accessToken = connection.accessToken;

        if (!accessToken || new Date(connection.tokenExpiresAt) <= new Date()) {
          console.log(`Access token expired for connection ${connectionId}. Refreshing...`);

          try {
            if (provider === 'google') {
              const refreshed = await refreshGoogleCalendarToken(connection.encryptedRefreshToken);

              // Google doesn't rotate refresh tokens
              await db
                .update(schema.calendarConnections)
                .set({
                  accessToken: refreshed.accessToken,
                  tokenExpiresAt: refreshed.tokenExpiresAt,
                  updatedAt: new Date(),
                })
                .where(eq(schema.calendarConnections.id, connectionId));

              accessToken = refreshed.accessToken;
            } else if (provider === 'microsoft') {
              const refreshed = await refreshMicrosoftCalendarToken(connection.encryptedRefreshToken);

              // Microsoft may rotate refresh token
              const updateData: any = {
                accessToken: refreshed.accessToken,
                tokenExpiresAt: refreshed.tokenExpiresAt,
                updatedAt: new Date(),
              };

              if (refreshed.newRefreshToken) {
                updateData.encryptedRefreshToken = encryptToken(refreshed.newRefreshToken);
              }

              await db
                .update(schema.calendarConnections)
                .set(updateData)
                .where(eq(schema.calendarConnections.id, connectionId));

              accessToken = refreshed.accessToken;
            }

            console.log(`Successfully refreshed access token for connection ${connectionId}`);
          } catch (error) {
            console.error(`Failed to refresh access token for connection ${connectionId}:`, error);

            // Mark connection as expired
            await db
              .update(schema.calendarConnections)
              .set({
                status: 'expired',
                errorMessage: 'Token refresh failed',
                updatedAt: new Date(),
              })
              .where(eq(schema.calendarConnections.id, connectionId));

            throw error; // Propagate to trigger retry
          }
        }

        // 5. Prepare sync parameters
        const syncParams = {
          connection: {
            id: connection.id,
            accessToken: accessToken!,
            calendarId: connection.calendarId,
            syncToken: connection.syncToken,
            webhookChannelId: connection.webhookChannelId,
            webhookResourceId: connection.webhookResourceId,
            webhookSubscriptionId: connection.webhookSubscriptionId,
          },
          db,
          schema,
        };

        const webhookParams = {
          connection: syncParams.connection,
          db,
          schema,
          tenantId,
        };

        // 6. Execute operation based on type
        switch (operation) {
          case 'full-sync': {
            // Update sync state to 'syncing'
            await db
              .update(schema.calendarSyncState)
              .set({ syncStatus: 'syncing', updatedAt: new Date() })
              .where(eq(schema.calendarSyncState.calendarConnectionId, connectionId));

            // Clear sync token to force full sync
            await db
              .update(schema.calendarConnections)
              .set({ syncToken: null })
              .where(eq(schema.calendarConnections.id, connectionId));

            // Execute sync
            let result: GoogleSyncResult | MicrosoftSyncResult;
            if (provider === 'google') {
              const googleResult = await syncGoogleCalendar({ ...syncParams, connection: { ...syncParams.connection, syncToken: null } });
              result = googleResult;
              // Update connection with new sync token (Google uses syncToken)
              if (googleResult.newSyncToken) {
                await db
                  .update(schema.calendarConnections)
                  .set({
                    syncToken: googleResult.newSyncToken,
                    lastSyncAt: new Date(),
                  })
                  .where(eq(schema.calendarConnections.id, connectionId));
              }
            } else {
              const msResult = await syncMicrosoftCalendar({ ...syncParams, connection: { ...syncParams.connection, syncToken: null } });
              result = msResult;
              // Update connection with new delta token (Microsoft uses deltaToken)
              if (msResult.newDeltaToken) {
                await db
                  .update(schema.calendarConnections)
                  .set({
                    syncToken: msResult.newDeltaToken,
                    lastSyncAt: new Date(),
                  })
                  .where(eq(schema.calendarConnections.id, connectionId));
              }
            }

            // Update sync state
            await db
              .update(schema.calendarSyncState)
              .set({
                syncStatus: 'synced',
                lastFullSyncAt: new Date(),
                syncedEventCount: result.synced,
                updatedAt: new Date(),
              })
              .where(eq(schema.calendarSyncState.calendarConnectionId, connectionId));

            console.log(`Full sync completed: ${result.synced} synced, ${result.deleted} deleted`);
            break;
          }

          case 'incremental-sync': {
            // Update sync state to 'syncing'
            await db
              .update(schema.calendarSyncState)
              .set({ syncStatus: 'syncing', updatedAt: new Date() })
              .where(eq(schema.calendarSyncState.calendarConnectionId, connectionId));

            // Execute sync (uses existing sync token)
            let result: GoogleSyncResult | MicrosoftSyncResult;
            if (provider === 'google') {
              const googleResult = await syncGoogleCalendar(syncParams);
              result = googleResult;
              // Update connection with new sync token (Google uses syncToken)
              if (googleResult.newSyncToken) {
                await db
                  .update(schema.calendarConnections)
                  .set({
                    syncToken: googleResult.newSyncToken,
                    lastSyncAt: new Date(),
                  })
                  .where(eq(schema.calendarConnections.id, connectionId));
              }
            } else {
              const msResult = await syncMicrosoftCalendar(syncParams);
              result = msResult;
              // Update connection with new delta token (Microsoft uses deltaToken)
              if (msResult.newDeltaToken) {
                await db
                  .update(schema.calendarConnections)
                  .set({
                    syncToken: msResult.newDeltaToken,
                    lastSyncAt: new Date(),
                  })
                  .where(eq(schema.calendarConnections.id, connectionId));
              }
            }

            // Update sync state
            await db
              .update(schema.calendarSyncState)
              .set({
                syncStatus: 'synced',
                lastIncrementalSyncAt: new Date(),
                syncedEventCount: result.synced,
                updatedAt: new Date(),
              })
              .where(eq(schema.calendarSyncState.calendarConnectionId, connectionId));

            console.log(`Incremental sync completed: ${result.synced} synced, ${result.deleted} deleted`);
            break;
          }

          case 'push-event': {
            if (!projectId) {
              console.error('push-event operation requires projectId');
              return;
            }

            // Load project
            const projects = await db
              .select()
              .from(schema.projects)
              .where(eq(schema.projects.id, projectId))
              .limit(1);

            if (projects.length === 0) {
              console.error(`Project not found: ${projectId}`);
              return;
            }

            const project = projects[0];

            // Load phases
            const phases = await db
              .select()
              .from(schema.projectPhases)
              .where(eq(schema.projectPhases.projectId, projectId));

            // Generate calendar events from milestones
            const calendarEvents = projectToCalendarEvents(project, phases);

            // Push each event
            for (const eventData of calendarEvents) {
              // Check if already exists
              const existingEvents = await db
                .select()
                .from(schema.calendarEvents)
                .where(
                  and(
                    eq(schema.calendarEvents.calendarConnectionId, connectionId),
                    eq(schema.calendarEvents.sourceEntityType, eventData.sourceEntityType!),
                    eq(schema.calendarEvents.sourceEntityId, eventData.sourceEntityId!)
                  )
                )
                .limit(1);

              const existingEvent = existingEvents.length > 0 ? existingEvents[0] : null;

              if (existingEvent) {
                // Update existing event
                if (provider === 'google') {
                  const updated = await updateGoogleEvent(syncParams, existingEvent.externalEventId, eventData, existingEvent.etag || undefined);

                  await db
                    .update(schema.calendarEvents)
                    .set({
                      title: eventData.title,
                      description: eventData.description,
                      startDate: eventData.startDate,
                      endDate: eventData.endDate,
                      allDay: eventData.allDay,
                      etag: updated.etag || null,
                      lastSyncedAt: new Date(),
                      updatedAt: new Date(),
                    })
                    .where(eq(schema.calendarEvents.id, existingEvent.id));
                } else {
                  const updated = await updateMicrosoftEvent(syncParams, existingEvent.externalEventId, eventData);

                  await db
                    .update(schema.calendarEvents)
                    .set({
                      title: eventData.title,
                      description: eventData.description,
                      startDate: eventData.startDate,
                      endDate: eventData.endDate,
                      allDay: eventData.allDay,
                      lastSyncedAt: new Date(),
                      updatedAt: new Date(),
                    })
                    .where(eq(schema.calendarEvents.id, existingEvent.id));
                }
              } else {
                // Create new event
                let createdEvent;
                if (provider === 'google') {
                  createdEvent = await pushEventToGoogle(syncParams, eventData);
                } else {
                  createdEvent = await pushEventToMicrosoft(syncParams, eventData);
                }

                // Insert into database
                await db.insert(schema.calendarEvents).values({
                  calendarConnectionId: connectionId,
                  projectId: projectId,
                  externalEventId: provider === 'google' ? createdEvent.id! : createdEvent.id,
                  title: eventData.title,
                  description: eventData.description || null,
                  startDate: eventData.startDate,
                  endDate: eventData.endDate,
                  allDay: eventData.allDay,
                  timezone: eventData.timezone || null,
                  source: 'platform',
                  sourceEntityType: eventData.sourceEntityType || null,
                  sourceEntityId: eventData.sourceEntityId || null,
                  etag: provider === 'google' ? (createdEvent.etag || null) : null,
                  lastSyncedAt: new Date(),
                });
              }
            }

            // Update last sync time
            await db
              .update(schema.calendarConnections)
              .set({ lastSyncAt: new Date() })
              .where(eq(schema.calendarConnections.id, connectionId));

            console.log(`Pushed ${calendarEvents.length} events for project ${projectId}`);
            break;
          }

          case 'delete-event': {
            if (!eventId) {
              console.error('delete-event operation requires eventId');
              return;
            }

            // Load calendar event
            const [calendarEvent] = await db
              .select()
              .from(schema.calendarEvents)
              .where(eq(schema.calendarEvents.id, eventId))
              .limit(1);

            if (!calendarEvent) {
              console.error(`Calendar event not found: ${eventId}`);
              return;
            }

            // Delete from provider
            if (provider === 'google') {
              await deleteGoogleEvent(syncParams, calendarEvent.externalEventId);
            } else {
              await deleteMicrosoftEvent(syncParams, calendarEvent.externalEventId);
            }

            // Delete from database
            await db
              .delete(schema.calendarEvents)
              .where(eq(schema.calendarEvents.id, eventId));

            console.log(`Deleted event ${eventId} from ${provider} calendar`);
            break;
          }

          case 'renew-webhook': {
            if (provider === 'google') {
              await renewGoogleChannel(webhookParams);
            } else {
              await renewMicrosoftSubscription(webhookParams);
            }

            console.log(`Renewed webhook for connection ${connectionId}`);
            break;
          }

          default:
            console.error(`Unknown operation: ${operation}`);
        }

      } catch (error) {
        console.error(`Calendar sync job failed for tenant ${tenantId}, connection ${connectionId}:`, error);

        // Handle specific error types
        const errorObj = error as any;

        // Rate limit error (429) - throw to trigger BullMQ retry with backoff
        if (errorObj.statusCode === 429 || errorObj.code === 429) {
          console.log(`Rate limit hit for connection ${connectionId}. Job will be retried with backoff.`);
          throw error;
        }

        // Auth error (401) - already attempted refresh above, throw to retry
        if (errorObj.statusCode === 401 || errorObj.code === 401) {
          console.error(`Auth error for connection ${connectionId} even after refresh attempt.`);
          throw error;
        }

        // Other errors - throw to trigger retry
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 3, // Conservative due to calendar API rate limits
      limiter: {
        max: 60, // 60 jobs per minute
        duration: 60000, // 60 seconds
      },
    }
  );

  // Event handlers
  worker.on('completed', (job) => {
    console.log(`Calendar sync job ${job.id} completed successfully`);
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;

    console.error(`Calendar sync job ${job.id} failed:`, err);

    // If all retries exhausted, update sync state with error
    if (job.attemptsMade >= (job.opts.attempts || 5)) {
      console.error(`Calendar sync job ${job.id} failed after ${job.attemptsMade} attempts.`);

      try {
        const { tenantId, connectionId } = job.data;

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

        // Get current error count
        const [currentState] = await db
          .select()
          .from(schema.calendarSyncState)
          .where(eq(schema.calendarSyncState.calendarConnectionId, connectionId))
          .limit(1);

        // Update sync state with error
        await db
          .update(schema.calendarSyncState)
          .set({
            syncStatus: 'error',
            lastError: err.message,
            errorCount: (currentState?.errorCount || 0) + 1,
            updatedAt: new Date(),
          })
          .where(eq(schema.calendarSyncState.calendarConnectionId, connectionId));

        console.log(`Updated sync state with error for connection ${connectionId}`);
      } catch (updateError) {
        console.error('Failed to update sync state with error:', updateError);
      }
    }
  });

  worker.on('error', (err) => {
    console.error('Calendar sync worker error:', err);
  });

  console.log('Calendar sync worker started with concurrency 3, rate limit 60/min');
  return worker;
}
