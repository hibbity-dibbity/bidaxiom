import type { TenantSchema } from '../../../db/schema/tenant.js';
import { createGoogleCalendarClient } from './client.js';
import { calendarSyncQueue } from '../shared/queue.js';
import { eq } from 'drizzle-orm';

export interface GoogleWebhookSetupParams {
  connection: {
    id: string;
    accessToken: string;
    calendarId: string;
    webhookChannelId?: string | null;
    webhookResourceId?: string | null;
  };
  db: ReturnType<typeof import('../../../db/client.js')['createTenantDb']>['db'];
  schema: TenantSchema;
  tenantId: string;
}

export interface GoogleWebhookNotification {
  connectionId: string;
  shouldSync: boolean;
}

/**
 * Setup Google Calendar push notification channel.
 *
 * Creates a webhook channel that receives notifications when calendar events change.
 * Channel expires after 7 days, so we queue a renewal job for 6 days.
 *
 * @param params - Setup parameters
 * @returns Channel information
 */
export async function setupGoogleWebhook(params: GoogleWebhookSetupParams): Promise<void> {
  const { connection, db, schema, tenantId } = params;
  const calendar = createGoogleCalendarClient(connection.accessToken);

  // Generate unique channel ID
  const channelId = `cal-${connection.id}-${Date.now()}`;

  // Expiration: 7 days from now (Google max is ~30 days, we use 7 for frequent renewal)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Create push notification channel
  const response = await calendar.events.watch({
    calendarId: connection.calendarId,
    requestBody: {
      id: channelId,
      type: 'web_hook',
      address: `${process.env.API_URL}/api/webhooks/calendar/google`,
      token: connection.id, // Use connection ID as token for validation
      expiration: expiresAt.getTime().toString(),
    },
  });

  // Store channel info on connection
  await db
    .update(schema.calendarConnections)
    .set({
      webhookChannelId: response.data.id || channelId,
      webhookResourceId: response.data.resourceId || null,
      webhookExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(schema.calendarConnections.id, connection.id));

  // Queue renewal job for 6 days from now
  const sixDays = 6 * 24 * 60 * 60 * 1000;
  await calendarSyncQueue.add(
    'renew-webhook',
    {
      tenantId,
      provider: 'google',
      connectionId: connection.id,
      operation: 'renew-webhook',
      syncReason: 'scheduled',
    },
    { delay: sixDays }
  );

  console.log(`Google webhook channel created for connection ${connection.id}, expires ${expiresAt.toISOString()}`);
}

/**
 * Handle incoming Google Calendar webhook notification.
 *
 * Google sends notifications with headers:
 * - x-goog-channel-id: Channel ID
 * - x-goog-channel-token: Token we provided (connection ID)
 * - x-goog-resource-state: 'sync' (setup confirmation) or 'exists' (change occurred)
 *
 * @param headers - Request headers from webhook
 * @returns Notification result
 */
export function handleGoogleWebhookNotification(
  headers: Record<string, string | undefined>
): GoogleWebhookNotification {
  const channelId = headers['x-goog-channel-id'];
  const channelToken = headers['x-goog-channel-token'];
  const resourceState = headers['x-goog-resource-state'];

  if (!channelId || !channelToken) {
    console.warn('Google webhook notification missing required headers');
    return { connectionId: '', shouldSync: false };
  }

  // 'sync' is sent when channel is first created (confirmation)
  if (resourceState === 'sync') {
    console.log(`Google webhook sync confirmation for channel ${channelId}`);
    return { connectionId: channelToken, shouldSync: false };
  }

  // 'exists' means something changed
  if (resourceState === 'exists') {
    console.log(`Google webhook change notification for channel ${channelId}`);
    return { connectionId: channelToken, shouldSync: true };
  }

  console.warn(`Unknown Google webhook resource state: ${resourceState}`);
  return { connectionId: channelToken, shouldSync: false };
}

/**
 * Renew Google Calendar webhook channel.
 *
 * Stops the old channel and creates a new one.
 *
 * @param params - Setup parameters
 */
export async function renewGoogleChannel(params: GoogleWebhookSetupParams): Promise<void> {
  const { connection, db, schema } = params;

  // Stop existing channel (if it exists)
  if (connection.webhookChannelId && connection.webhookResourceId) {
    await stopGoogleChannel({
      accessToken: connection.accessToken,
      channelId: connection.webhookChannelId,
      resourceId: connection.webhookResourceId,
    });
  }

  // Create new channel
  await setupGoogleWebhook(params);

  console.log(`Renewed Google webhook channel for connection ${connection.id}`);
}

/**
 * Stop watching a Google Calendar channel.
 *
 * @param params - Channel information
 */
export async function stopGoogleChannel(params: {
  accessToken: string;
  channelId: string;
  resourceId: string;
}): Promise<void> {
  const { accessToken, channelId, resourceId } = params;
  const calendar = createGoogleCalendarClient(accessToken);

  try {
    await calendar.channels.stop({
      requestBody: {
        id: channelId,
        resourceId: resourceId,
      },
    });

    console.log(`Stopped Google webhook channel ${channelId}`);
  } catch (error: any) {
    // Channel may already be expired or stopped - log but don't throw
    console.warn(`Failed to stop Google webhook channel ${channelId}:`, error.message);
  }
}
