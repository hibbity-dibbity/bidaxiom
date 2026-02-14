import type { TenantSchema } from '../../../db/schema/tenant.js';
import { createMicrosoftGraphClient } from './client.js';
import { mapMicrosoftEventToInternal, internalToMicrosoftEvent, type InternalCalendarEvent } from '../shared/mappers.js';
import { eq, and } from 'drizzle-orm';

export interface MicrosoftSyncResult {
  synced: number;
  deleted: number;
  newDeltaToken?: string;
}

export interface MicrosoftSyncParams {
  connection: {
    id: string;
    accessToken: string;
    calendarId: string;
    syncToken: string | null; // deltaLink
  };
  db: ReturnType<typeof import('../../../db/client.js')['createTenantDb']>['db'];
  schema: TenantSchema;
}

/**
 * Incremental sync from Microsoft Calendar using delta links.
 *
 * Flow:
 * - If deltaLink exists: fetch only changes since last sync
 * - If no deltaLink: full delta sync from 30 days ago
 * - Handle pagination with @odata.nextLink
 * - Store new deltaLink for next incremental sync
 * - Handle 410 Gone (expired deltaLink) by clearing and retrying
 *
 * @param params - Sync parameters with db and schema from worker
 * @returns Sync results with counts and new delta token
 */
export async function syncMicrosoftCalendar(params: MicrosoftSyncParams): Promise<MicrosoftSyncResult> {
  const { connection, db, schema } = params;
  const client = createMicrosoftGraphClient(connection.accessToken);

  let syncedCount = 0;
  let deletedCount = 0;
  let nextLink: string | undefined = undefined;
  let deltaLink: string | undefined = undefined;

  try {
    // Determine initial URL
    let url: string;
    if (connection.syncToken) {
      // Incremental sync using stored delta link
      url = connection.syncToken;
    } else {
      // Full delta sync from 30 days ago to 1 year from now
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

      url = `/me/calendarView/delta?startDateTime=${thirtyDaysAgo.toISOString()}&endDateTime=${oneYearFromNow.toISOString()}`;
    }

    do {
      const response = await client.api(url).get();

      // Process events
      if (response.value && Array.isArray(response.value)) {
        for (const msEvent of response.value) {
          if (!msEvent.id) continue;

          // Check if deleted
          if (msEvent['@removed']) {
            // Delete from our database
            await db
              .delete(schema.calendarEvents)
              .where(
                and(
                  eq(schema.calendarEvents.calendarConnectionId, connection.id),
                  eq(schema.calendarEvents.externalEventId, msEvent.id)
                )
              );
            deletedCount++;
          } else {
            // Map to internal format
            const internalEvent = mapMicrosoftEventToInternal(msEvent);

            if (internalEvent) {
              // Upsert into calendarEvents
              const existingEvent = await db
                .select()
                .from(schema.calendarEvents)
                .where(
                  and(
                    eq(schema.calendarEvents.calendarConnectionId, connection.id),
                    eq(schema.calendarEvents.externalEventId, msEvent.id)
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
                    etag: msEvent['@odata.etag'] || null,
                    lastSyncedAt: new Date(),
                    updatedAt: new Date(),
                  })
                  .where(eq(schema.calendarEvents.id, existingEvent[0].id));
              } else {
                // Insert new
                await db.insert(schema.calendarEvents).values({
                  calendarConnectionId: connection.id,
                  externalEventId: msEvent.id,
                  title: internalEvent.title,
                  description: internalEvent.description || null,
                  startDate: internalEvent.startDate,
                  endDate: internalEvent.endDate,
                  allDay: internalEvent.allDay,
                  timezone: internalEvent.timezone || null,
                  source: 'external',
                  etag: msEvent['@odata.etag'] || null,
                  lastSyncedAt: new Date(),
                });
              }

              syncedCount++;
            }
          }
        }
      }

      // Check for next page or delta link
      nextLink = response['@odata.nextLink'];
      deltaLink = response['@odata.deltaLink'] || deltaLink;

      if (nextLink) {
        url = nextLink;
      }

    } while (nextLink);

    return { synced: syncedCount, deleted: deletedCount, newDeltaToken: deltaLink };

  } catch (error: any) {
    // Handle 410 Gone (delta link expired)
    if (error.statusCode === 410 || error.code === '410') {
      console.log(`Microsoft delta link expired for connection ${connection.id}. Clearing and retrying with full sync.`);

      // Clear delta link on connection
      await db
        .update(schema.calendarConnections)
        .set({ syncToken: null })
        .where(eq(schema.calendarConnections.id, connection.id));

      // Retry with full sync
      return syncMicrosoftCalendar({
        ...params,
        connection: { ...connection, syncToken: null },
      });
    }

    throw error;
  }
}

/**
 * Push an event to Microsoft Calendar.
 *
 * @param params - Sync parameters
 * @param eventData - Internal event data to create
 * @returns Created Microsoft Graph event
 */
export async function pushEventToMicrosoft(
  params: MicrosoftSyncParams,
  eventData: InternalCalendarEvent
): Promise<any> {
  const { connection } = params;
  const client = createMicrosoftGraphClient(connection.accessToken);

  const msEvent = internalToMicrosoftEvent(eventData);

  const response = await client
    .api('/me/calendar/events')
    .post(msEvent);

  return response;
}

/**
 * Update an existing event on Microsoft Calendar.
 *
 * @param params - Sync parameters
 * @param externalEventId - Microsoft Graph event ID
 * @param eventData - Updated event data
 * @returns Updated Microsoft Graph event
 */
export async function updateMicrosoftEvent(
  params: MicrosoftSyncParams,
  externalEventId: string,
  eventData: InternalCalendarEvent
): Promise<any> {
  const { connection } = params;
  const client = createMicrosoftGraphClient(connection.accessToken);

  const msEvent = internalToMicrosoftEvent(eventData);

  const response = await client
    .api(`/me/calendar/events/${externalEventId}`)
    .patch(msEvent);

  return response;
}

/**
 * Delete an event from Microsoft Calendar.
 *
 * @param params - Sync parameters
 * @param externalEventId - Microsoft Graph event ID
 */
export async function deleteMicrosoftEvent(
  params: MicrosoftSyncParams,
  externalEventId: string
): Promise<void> {
  const { connection } = params;
  const client = createMicrosoftGraphClient(connection.accessToken);

  try {
    await client
      .api(`/me/calendar/events/${externalEventId}`)
      .delete();
  } catch (error: any) {
    // 404 means already deleted - ignore
    if (error.statusCode === 404 || error.code === 'itemNotFound') {
      console.log(`Event ${externalEventId} already deleted from Microsoft Calendar. Ignoring.`);
      return;
    }

    throw error;
  }
}
