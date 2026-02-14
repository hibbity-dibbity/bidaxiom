import type { calendar_v3 } from 'googleapis';
import type { TenantSchema } from '../../../db/schema/tenant.js';
import { createGoogleCalendarClient } from './client.js';
import { mapGoogleEventToInternal, internalToGoogleEvent, type InternalCalendarEvent } from '../shared/mappers.js';
import { eq, and } from 'drizzle-orm';

export interface GoogleSyncResult {
  synced: number;
  deleted: number;
  newSyncToken?: string;
}

export interface GoogleSyncParams {
  connection: {
    id: string;
    accessToken: string;
    calendarId: string;
    syncToken: string | null;
  };
  db: ReturnType<typeof import('../../../db/client.js')['createTenantDb']>['db'];
  schema: TenantSchema;
}

/**
 * Incremental sync from Google Calendar using sync tokens.
 *
 * Flow:
 * - If syncToken exists: fetch only changes since last sync
 * - If no syncToken: full sync from 30 days ago
 * - Handle pagination with nextPageToken
 * - Store new syncToken for next incremental sync
 * - Handle 410 Gone (expired syncToken) by clearing and retrying
 *
 * @param params - Sync parameters with db and schema from worker
 * @returns Sync results with counts and new sync token
 */
export async function syncGoogleCalendar(params: GoogleSyncParams): Promise<GoogleSyncResult> {
  const { connection, db, schema } = params;
  const calendar = createGoogleCalendarClient(connection.accessToken);

  let syncedCount = 0;
  let deletedCount = 0;
  let pageToken: string | undefined = undefined;
  let newSyncToken: string | undefined = undefined;

  try {
    do {
      const requestParams: calendar_v3.Params$Resource$Events$List = {
        calendarId: connection.calendarId,
        maxResults: 100,
        showDeleted: true, // Include deleted events for removal
      };

      if (connection.syncToken) {
        // Incremental sync using sync token
        requestParams.syncToken = connection.syncToken;
      } else {
        // Full sync from 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        requestParams.timeMin = thirtyDaysAgo.toISOString();
      }

      if (pageToken) {
        requestParams.pageToken = pageToken;
      }

      const response = await calendar.events.list(requestParams);

      // Process events
      if (response.data.items) {
        for (const googleEvent of response.data.items) {
          if (!googleEvent.id) continue;

          if (googleEvent.status === 'cancelled') {
            // Delete from our database
            await db
              .delete(schema.calendarEvents)
              .where(
                and(
                  eq(schema.calendarEvents.calendarConnectionId, connection.id),
                  eq(schema.calendarEvents.externalEventId, googleEvent.id)
                )
              );
            deletedCount++;
          } else {
            // Map to internal format
            const internalEvent = mapGoogleEventToInternal(googleEvent as any);

            if (internalEvent) {
              // Upsert into calendarEvents (insert or update on conflict)
              const existingEvent = await db
                .select()
                .from(schema.calendarEvents)
                .where(
                  and(
                    eq(schema.calendarEvents.calendarConnectionId, connection.id),
                    eq(schema.calendarEvents.externalEventId, googleEvent.id)
                  )
                )
                .limit(1);

              if (existingEvent.length > 0) {
                // Update existing
                await db
                  .update(schema.calendarEvents)
                  .set({
                    title: internalEvent.title,
                    description: internalEvent.description,
                    startDate: internalEvent.startDate,
                    endDate: internalEvent.endDate,
                    allDay: internalEvent.allDay,
                    timezone: internalEvent.timezone,
                    etag: googleEvent.etag,
                    lastSyncedAt: new Date(),
                    updatedAt: new Date(),
                  })
                  .where(eq(schema.calendarEvents.id, existingEvent[0].id));
              } else {
                // Insert new
                await db.insert(schema.calendarEvents).values({
                  calendarConnectionId: connection.id,
                  externalEventId: googleEvent.id,
                  title: internalEvent.title,
                  description: internalEvent.description || null,
                  startDate: internalEvent.startDate,
                  endDate: internalEvent.endDate,
                  allDay: internalEvent.allDay,
                  timezone: internalEvent.timezone || null,
                  source: 'external',
                  etag: googleEvent.etag || null,
                  lastSyncedAt: new Date(),
                });
              }

              syncedCount++;
            }
          }
        }
      }

      // Check for next page or sync token
      pageToken = response.data.nextPageToken || undefined;
      newSyncToken = response.data.nextSyncToken || newSyncToken;

    } while (pageToken);

    return { synced: syncedCount, deleted: deletedCount, newSyncToken };

  } catch (error: any) {
    // Handle 410 Gone (sync token expired)
    if (error.code === 410 || error.status === 410) {
      console.log(`Google sync token expired for connection ${connection.id}. Clearing and retrying with full sync.`);

      // Clear sync token on connection
      await db
        .update(schema.calendarConnections)
        .set({ syncToken: null })
        .where(eq(schema.calendarConnections.id, connection.id));

      // Retry with full sync
      return syncGoogleCalendar({
        ...params,
        connection: { ...connection, syncToken: null },
      });
    }

    throw error;
  }
}

/**
 * Push an event to Google Calendar.
 *
 * @param params - Sync parameters
 * @param eventData - Internal event data to create
 * @returns Created Google Calendar event
 */
export async function pushEventToGoogle(
  params: GoogleSyncParams,
  eventData: InternalCalendarEvent
): Promise<calendar_v3.Schema$Event> {
  const { connection } = params;
  const calendar = createGoogleCalendarClient(connection.accessToken);

  const googleEvent = internalToGoogleEvent(eventData);

  const response = await calendar.events.insert({
    calendarId: connection.calendarId,
    requestBody: googleEvent,
  });

  return response.data;
}

/**
 * Update an existing event on Google Calendar.
 *
 * Uses If-Match header with etag for conflict detection.
 *
 * @param params - Sync parameters
 * @param externalEventId - Google Calendar event ID
 * @param eventData - Updated event data
 * @param etag - Optional etag for conflict detection
 * @returns Updated Google Calendar event
 */
export async function updateGoogleEvent(
  params: GoogleSyncParams,
  externalEventId: string,
  eventData: InternalCalendarEvent,
  etag?: string
): Promise<calendar_v3.Schema$Event> {
  const { connection } = params;
  const calendar = createGoogleCalendarClient(connection.accessToken);

  const googleEvent = internalToGoogleEvent(eventData);

  try {
    const response = await calendar.events.update({
      calendarId: connection.calendarId,
      eventId: externalEventId,
      requestBody: googleEvent,
      // If-Match header for conflict detection (etag)
      ...(etag && { headers: { 'If-Match': etag } }),
    } as any);

    return response.data;
  } catch (error: any) {
    // 412 Precondition Failed (etag mismatch)
    if (error.code === 412 || error.status === 412) {
      console.log(`ETag conflict detected for event ${externalEventId}. Re-fetching and applying last-write-wins.`);

      // Re-fetch current event
      const current = await calendar.events.get({
        calendarId: connection.calendarId,
        eventId: externalEventId,
      });

      // Apply last-write-wins: use our update
      const response = await calendar.events.update({
        calendarId: connection.calendarId,
        eventId: externalEventId,
        requestBody: googleEvent,
      });

      return response.data;
    }

    throw error;
  }
}

/**
 * Delete an event from Google Calendar.
 *
 * @param params - Sync parameters
 * @param externalEventId - Google Calendar event ID
 */
export async function deleteGoogleEvent(
  params: GoogleSyncParams,
  externalEventId: string
): Promise<void> {
  const { connection } = params;
  const calendar = createGoogleCalendarClient(connection.accessToken);

  try {
    await calendar.events.delete({
      calendarId: connection.calendarId,
      eventId: externalEventId,
    });
  } catch (error: any) {
    // 404 means already deleted - ignore
    if (error.code === 404 || error.status === 404) {
      console.log(`Event ${externalEventId} already deleted from Google Calendar. Ignoring.`);
      return;
    }

    throw error;
  }
}
